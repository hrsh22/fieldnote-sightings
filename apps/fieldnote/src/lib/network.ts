import { Bee, BeeResponseError } from "@ethersphere/bee-js";
import {
  AddressSchema,
  GATEWAY,
  NotebookSchema,
  SightingSchema,
  type Address,
  type Notebook,
  type Sighting,
  type Entry,
  sha256,
} from "./format";
import { FieldnoteError } from "./errors";

export type Head = { reference: string; nextIndex: bigint };
export type LoadedNotebook = {
  address: Address;
  reference: string;
  index: Notebook;
  records: { entry: Entry; sighting: Sighting }[];
  nextIndex: bigint;
};

export async function readBytes(
  reference: string,
  maxBytes = 1024 * 1024,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (!/^[a-f0-9]{64}$/.test(reference))
    throw new FieldnoteError(
      "invalid-reference",
      "This public record reference is invalid.",
    );
  const response = await fetch(`${GATEWAY}/bytes/${reference}`, {
    cache: "no-store",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new FieldnoteError(
      response.status === 404 ? "missing" : "gateway",
      response.status === 404
        ? "This record is not available from the storage gateway. Retry shortly."
        : `Storage gateway returned ${response.status}. Please retry shortly.`,
    );
  const reader = response.body?.getReader();
  if (!reader)
    throw new FieldnoteError(
      "empty",
      "The storage gateway returned an empty response.",
    );
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes)
        throw new FieldnoteError(
          "too-large",
          "This object exceeds the published format's size limit.",
        );
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export function jsonObject(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new FieldnoteError(
      "bad-json",
      "The stored object is not valid UTF-8 JSON.",
    );
  }
}
function versionCheck(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "version" in value &&
    value.version !== 1
  )
    throw new FieldnoteError(
      "unsupported-version",
      "This notebook uses a newer format version. Use a reader that supports it.",
    );
}
export async function readAddress(reference: string): Promise<Address> {
  const value = jsonObject(await readBytes(reference, 4096));
  versionCheck(value);
  const parsed = AddressSchema.safeParse(value);
  if (!parsed.success)
    throw new FieldnoteError(
      "bad-address",
      "This link does not contain a valid Fieldnote notebook address.",
    );
  return parsed.data;
}
export async function readHead(address: Address): Promise<Head | null> {
  const bee = new Bee(GATEWAY, { timeout: 30000, endlesslyRetry: false });
  try {
    const head = await bee.feed
      .makeReader(address.feed.topic, address.feed.owner)
      .downloadReference();
    return {
      reference: head.reference.toHex(),
      nextIndex: (head.feedIndexNext ?? head.feedIndex.next()).toBigInt(),
    };
  } catch (error) {
    if (error instanceof BeeResponseError && error.status === 404) return null;
    throw error;
  }
}
export async function readIndex(
  reference: string,
  owner: string,
): Promise<Notebook> {
  const value = jsonObject(await readBytes(reference, 512 * 1024));
  versionCheck(value);
  const parsed = NotebookSchema.safeParse(value);
  if (!parsed.success)
    throw new FieldnoteError(
      "bad-index",
      "The stored notebook index does not match its published format.",
    );
  if (parsed.data.owner !== owner)
    throw new FieldnoteError(
      "wrong-owner",
      "The notebook owner does not match its signed address.",
    );
  return parsed.data;
}
export async function readRecord(
  entry: Entry,
  owner: string,
): Promise<Sighting> {
  const bytes = await readBytes(entry.reference, 32768);
  if (bytes.length !== entry.bytes || (await sha256(bytes)) !== entry.sha256)
    throw new FieldnoteError(
      "integrity",
      "A sighting failed its size or checksum check. It has not been displayed as verified.",
    );
  const value = jsonObject(bytes);
  versionCheck(value);
  const parsed = SightingSchema.safeParse(value);
  if (!parsed.success)
    throw new FieldnoteError(
      "bad-record",
      "A stored sighting does not match its published format.",
    );
  if (parsed.data.publisher.owner !== owner || parsed.data.id !== entry.id)
    throw new FieldnoteError(
      "record-owner",
      "A sighting does not belong to this notebook index.",
    );
  return parsed.data;
}
export async function loadNotebook(
  address: Address,
): Promise<LoadedNotebook | null> {
  const head = await readHead(address);
  if (!head) return null;
  const index = await readIndex(head.reference, address.feed.owner);
  const storedAddress = await readAddress(index.addressReference);
  if (
    storedAddress.feed.owner !== address.feed.owner ||
    storedAddress.feed.topic !== address.feed.topic
  )
    throw new FieldnoteError(
      "wrong-address",
      "The notebook index points to a different publishing address.",
    );
  const records: LoadedNotebook["records"] = [];
  for (let i = 0; i < index.records.length; i += 6) {
    const batch = await Promise.all(
      index.records.slice(i, i + 6).map(async (entry) => ({
        entry,
        sighting: await readRecord(entry, address.feed.owner),
      })),
    );
    records.push(...batch);
  }
  return {
    address,
    reference: head.reference,
    index,
    records,
    nextIndex: head.nextIndex,
  };
}
