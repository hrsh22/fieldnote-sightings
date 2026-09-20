import {
  addressFor,
  encode,
  hexToBytes,
  MAX_PHOTO_BYTES,
  MAX_RECORDS,
  normalizeOwner,
  sha256,
  SightingSchema,
  type Address,
  type Photo,
  type SightingDraft,
  type Notebook,
} from "./format";
import { FieldnoteError } from "./errors";
import { readBytes, readHead, readIndex, type Head } from "./network";

export type Connection = {
  canUpload: boolean;
  uploadMode?: "user-stamp" | "subsidised" | "unavailable";
  uploadUnavailableReason?: "no-stamp" | "stamper-failed";
  identity?: { id: string; name: string; address: string };
  appKey?: { address: string; publicKey: string };
};
export interface PublishingClient {
  readonly connectionInfo: Connection;
  uploadData(
    data: Uint8Array,
    options?: { encrypt?: boolean; deferred?: boolean },
  ): Promise<{ reference: string }>;
  makeSequentialFeedWriter(options: { topic: string }): {
    uploadRawPayload(
      data: Uint8Array,
      options: { index: bigint; hasTimestamp: boolean },
    ): Promise<unknown>;
  };
}
export type PublishNetwork = {
  bytes: typeof readBytes;
  head: typeof readHead;
  index: typeof readIndex;
};
const network: PublishNetwork = {
  bytes: readBytes,
  head: readHead,
  index: readIndex,
};
export function requireUpload(
  client: PublishingClient,
  expectedOwner?: string,
) {
  const info = client.connectionInfo;
  if (!info.identity || !info.appKey)
    throw new FieldnoteError(
      "sign-in",
      "Sign in to save this sighting. Your draft is still here.",
    );
  const owner = normalizeOwner(info.appKey.address);
  if (expectedOwner && owner !== expectedOwner)
    throw new FieldnoteError(
      "identity-changed",
      "The signed-in account changed while saving. Reopen your notebook and save again.",
    );
  if (!info.canUpload) {
    if (info.uploadUnavailableReason === "stamper-failed")
      throw new FieldnoteError(
        "stamper-failed",
        "You are signed in, but your drive could not prepare uploads. Reconnect or check the drive in Swarm ID.",
      );
    throw new FieldnoteError(
      "no-stamp",
      "You are signed in, but uploads are unavailable. In Swarm ID, use the default network to enable sponsored storage, then reload Fieldnote.",
    );
  }
  return { owner, identity: info.identity };
}
export function identifyPhoto(bytes: Uint8Array): Photo["mediaType"] {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return "image/png";
  if (
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  throw new FieldnoteError(
    "photo-type",
    "Choose a JPEG, PNG or WebP photo. Renaming another file is not enough.",
  );
}
export async function publishSighting(options: {
  client: PublishingClient;
  draft: SightingDraft;
  appOrigin: string;
  title: string;
  photo?: { bytes: Uint8Array; caption: string; credit: string };
  progress?: (stage: string) => void;
  network?: PublishNetwork;
}) {
  const { client, draft, progress = () => {} } = options;
  const transport = options.network ?? network;
  const { owner, identity } = requireUpload(client);
  const address = addressFor(owner);
  const recordId = crypto.randomUUID();
  const record = SightingSchema.parse({
    ...draft,
    format: "org.fieldnote.sighting",
    version: 1,
    id: recordId,
    recordedAt: new Date().toISOString(),
    observer: {
      name: draft.observerName,
      identityAddress: normalizeOwner(identity.address),
    },
    publisher: { owner, appOrigin: options.appOrigin },
    photo: null,
  });
  let photo: Photo | null = null;
  if (
    options.photo &&
    (options.photo.bytes.length === 0 ||
      options.photo.bytes.length > MAX_PHOTO_BYTES)
  )
    throw new FieldnoteError("photo-size", "Choose a photo smaller than 5 MB.");
  const photoType = options.photo ? identifyPhoto(options.photo.bytes) : null;
  progress("Checking your notebook");
  const initial = await transport.head(address);
  const previous = initial
    ? await transport.index(initial.reference, owner)
    : null;
  if ((previous?.records.length ?? 0) >= MAX_RECORDS)
    throw new FieldnoteError(
      "notebook-full",
      "This notebook has reached the format's 1,000-sighting limit.",
    );
  async function uploadVerified(bytes: Uint8Array) {
    requireUpload(client, owner);
    // A public gateway cannot accept pin/tag/ACT headers. Keep this allowlist small.
    const result = await client.uploadData(bytes, { encrypt: false });
    if (!/^[a-f0-9]{64}$/.test(result.reference))
      throw new FieldnoteError(
        "upload-reference",
        "Storage returned an unexpected public reference.",
      );
    const digest = await sha256(bytes);
    const downloaded = await transport.bytes(
      result.reference,
      Math.max(bytes.length, 4096),
    );
    if (
      downloaded.length !== bytes.length ||
      (await sha256(downloaded)) !== digest
    )
      throw new FieldnoteError(
        "readback",
        "The uploaded object could not be verified. Your notebook has not been updated.",
      );
    return { reference: result.reference, sha256: digest, bytes: bytes.length };
  }
  if (options.photo && photoType) {
    progress("Saving and checking your photo");
    photo = {
      ...(await uploadVerified(options.photo.bytes)),
      endpoint: "bytes",
      mediaType: photoType,
      caption: options.photo.caption,
      credit: options.photo.credit,
    };
  }
  progress("Saving and checking the sighting");
  const sighting = SightingSchema.parse({ ...record, photo });
  const entry = { id: recordId, ...(await uploadVerified(encode(sighting))) };
  const descriptor = await uploadVerified(encode(address));
  const index: Notebook = {
    format: "org.fieldnote.notebook",
    version: 1,
    title:
      options.title.trim().slice(0, 160) ||
      `${draft.observerName}'s field notes`,
    owner,
    updatedAt: new Date().toISOString(),
    addressReference: descriptor.reference,
    previous: initial?.reference ?? null,
    records: [entry, ...(previous?.records ?? [])],
  };
  progress("Updating your notebook");
  const indexObject = await uploadVerified(encode(index));
  const current = await transport.head(address);
  if ((current?.reference ?? null) !== (initial?.reference ?? null))
    throw new FieldnoteError(
      "conflict",
      "Your notebook changed in another window. Refresh it and save this draft again.",
    );
  requireUpload(client, owner);
  const writer = client.makeSequentialFeedWriter({ topic: address.feed.topic });
  let writeError: unknown;
  try {
    await writer.uploadRawPayload(hexToBytes(indexObject.reference), {
      index: initial?.nextIndex ?? 0n,
      hasTimestamp: true,
    });
  } catch (error) {
    writeError = error;
  }
  progress("Confirming the public notebook");
  let confirmed: Head | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      confirmed = await transport.head(address);
    } catch {
      /* Reconcile an uncertain write before claiming success. */
    }
    if (confirmed?.reference === indexObject.reference) break;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  if (confirmed?.reference !== indexObject.reference)
    throw new FieldnoteError(
      "uncertain",
      `The sighting was uploaded, but its notebook update could not be confirmed. Refresh your notebook before retrying to avoid a duplicate.${writeError ? " The publishing request was interrupted." : ""}`,
    );
  await transport.index(indexObject.reference, owner);
  return {
    addressReference: descriptor.reference,
    indexReference: indexObject.reference,
    sighting,
    entry,
    index,
    address,
  };
}
