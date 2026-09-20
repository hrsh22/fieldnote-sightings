import { Bee, BeeResponseError } from "@ethersphere/bee-js";
import {
  parseDescriptor,
  parseIndex,
  parseRecord,
  type Entry,
  type Index,
  type RecordData,
  type Descriptor,
} from "./model";

export const DEFAULT_GATEWAY = "https://api.gateway.ethswarm.org";
export function gatewayOrigin(input: string): string {
  const url = new URL(input);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  )
    throw new Error(
      "Use a gateway origin without a path, credentials or query parameters.",
    );
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  )
    throw new Error("Use an HTTPS gateway, or your own local Bee node.");
  return url.origin;
}
export async function fetchBytes(
  gateway: string,
  reference: string,
  limit: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (!/^[a-f0-9]{64}$/.test(reference))
    throw new Error("Invalid Swarm content reference.");
  const response = await fetch(`${gateway}/bytes/${reference}`, {
    credentials: "omit",
    cache: "no-store",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? "The gateway could not find this object. It may still be propagating or no longer available."
        : `The gateway returned HTTP ${response.status}. Retry or choose another gateway.`,
    );
  const stream = response.body?.getReader();
  if (!stream) throw new Error("The gateway returned no data.");
  const pieces: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await stream.read();
      if (done) break;
      length += value.length;
      if (length > limit)
        throw new Error("The stored object exceeds the format's size limit.");
      pieces.push(value);
    }
  } finally {
    await stream.cancel().catch(() => {});
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const piece of pieces) {
    result.set(piece, offset);
    offset += piece.length;
  }
  return result;
}
export async function checksum(bytes: Uint8Array): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer),
    ),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
}
export async function checkedBytes(
  gateway: string,
  entry: { reference: string; bytes: number; sha256: string },
  signal?: AbortSignal,
) {
  const bytes = await fetchBytes(gateway, entry.reference, entry.bytes, signal);
  if (bytes.length !== entry.bytes || (await checksum(bytes)) !== entry.sha256)
    throw new Error(
      "Checksum or size mismatch. This object has not passed verification.",
    );
  return bytes;
}
export function decodeJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("The stored object is not valid UTF-8 JSON.");
  }
}
export type ReadResult = {
  descriptor: Descriptor;
  index: Index;
  indexReference: string;
  feedIndex: string;
  records: { record: RecordData; entry: Entry }[];
  failures: { entry: Entry; reason: string }[];
};
export function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/timeout|timed out|abort/i.test(message))
    return "The network did not respond in time. Retry, or choose another gateway in connection settings.";
  if (/failed to fetch|network|fetch failed/i.test(message))
    return "The gateway could not be reached. Check your connection or choose another gateway.";
  return message.length < 300
    ? message
    : "This object could not be read. Check its format and try again.";
}
export async function readNotebook(
  reference: string,
  gateway: string,
  onProgress: (text: string) => void = () => {},
): Promise<ReadResult> {
  const base = gatewayOrigin(gateway);
  onProgress("Reading the portable notebook address");
  const descriptor = parseDescriptor(
    decodeJson(await fetchBytes(base, reference, 4096)),
  );
  const bee = new Bee(base, { timeout: 30000, endlesslyRetry: false });
  onProgress("Finding the latest signed notebook update");
  let head;
  try {
    head = await bee.feed
      .makeReader(descriptor.feed.topic, descriptor.feed.owner)
      .downloadReference();
  } catch (error) {
    if (error instanceof BeeResponseError && error.status === 404)
      throw new Error(
        "This address has no notebook update available on the gateway.",
      );
    throw error;
  }
  const indexReference = head.reference.toHex();
  const index = parseIndex(
    decodeJson(await fetchBytes(base, indexReference, 524288)),
    descriptor.feed.owner,
    reference,
  );
  const records: ReadResult["records"] = [],
    failures: ReadResult["failures"] = [];
  for (let offset = 0; offset < index.records.length; offset += 6) {
    onProgress(
      `Reading and verifying sightings ${offset + 1}-${Math.min(offset + 6, index.records.length)} of ${index.records.length}`,
    );
    const entries = index.records.slice(offset, offset + 6);
    const outcomes = await Promise.allSettled(
      entries.map(async (entry) => ({
        entry,
        record: parseRecord(
          decodeJson(await checkedBytes(base, entry)),
          descriptor.feed.owner,
          entry.id,
        ),
      })),
    );
    outcomes.forEach((outcome, i) => {
      if (outcome.status === "fulfilled") records.push(outcome.value);
      else
        failures.push({
          entry: entries[i],
          reason: readableError(outcome.reason),
        });
    });
  }
  return {
    descriptor,
    index,
    indexReference,
    feedIndex: head.feedIndex.toBigInt().toString(),
    records,
    failures,
  };
}
