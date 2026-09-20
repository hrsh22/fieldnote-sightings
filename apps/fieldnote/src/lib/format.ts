import { z } from "zod";

export const GATEWAY = "https://api.gateway.ethswarm.org";
export const TOPIC =
  "5c1b3b9ee99ed5dd14ee3013dcb37476b86e36cc0f9cd36c9006bb5bf7c9287f";
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_RECORDS = 1000;
const ref = z.string().regex(/^[a-f0-9]{64}$/);
const owner = z.string().regex(/^[a-f0-9]{40}$/);
const text = (max: number) => z.string().trim().min(1).max(max);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s;
  }, "Enter a real calendar date.");
export const PhotoSchema = z.object({
  reference: ref,
  endpoint: z.literal("bytes"),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  bytes: z.number().int().min(1).max(MAX_PHOTO_BYTES),
  sha256: ref,
  caption: z.string().max(500),
  credit: z.string().max(200),
});
export const ObservationSchema = z
  .object({
    date,
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    utcOffset: z
      .string()
      .regex(/^[+-](0\d|1[0-4]):[0-5]\d$/)
      .nullable(),
    timezone: z.string().max(100).nullable(),
    precision: z.enum(["day", "minute"]),
  })
  .refine(
    (v) =>
      v.precision === "day"
        ? v.time === null && v.utcOffset === null && v.timezone === null
        : v.time !== null && v.utcOffset !== null,
    "Time and UTC offset are required for a timed sighting.",
  );
export const SightingSchema = z.object({
  format: z.literal("org.fieldnote.sighting"),
  version: z.literal(1),
  id: z.uuid(),
  recordedAt: z.iso.datetime(),
  species: z.object({
    commonName: text(160),
    scientificName: z.string().trim().max(160),
  }),
  observed: ObservationSchema,
  place: z.object({
    name: text(200),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    datum: z.literal("WGS84"),
    uncertaintyMeters: z.number().min(1).max(500000),
    source: z.enum(["manual", "device"]),
  }),
  observer: z.object({ name: text(120), identityAddress: owner }),
  publisher: z.object({ owner, appOrigin: z.url().max(300) }),
  count: z.number().int().min(1).max(100000),
  notes: z.string().max(3000),
  photo: PhotoSchema.nullable(),
  demonstration: z.boolean(),
});
export const EntrySchema = z.object({
  id: z.uuid(),
  reference: ref,
  sha256: ref,
  bytes: z.number().int().min(1).max(32768),
});
export const NotebookSchema = z
  .object({
    format: z.literal("org.fieldnote.notebook"),
    version: z.literal(1),
    title: text(160),
    owner,
    updatedAt: z.iso.datetime(),
    addressReference: ref,
    previous: ref.nullable(),
    records: z.array(EntrySchema).max(MAX_RECORDS),
  })
  .refine(
    (v) => new Set(v.records.map((e) => e.id)).size === v.records.length,
    "Notebook has duplicate sighting IDs.",
  );
export const AddressSchema = z.object({
  format: z.literal("org.fieldnote.address"),
  version: z.literal(1),
  feed: z.object({
    owner,
    topic: ref,
    type: z.literal("sequence"),
    payload: z.literal("timestamp-be64+reference32"),
  }),
  contentEndpoint: z.literal("bytes"),
});
export type Photo = z.infer<typeof PhotoSchema>;
export type Sighting = z.infer<typeof SightingSchema>;
export type Notebook = z.infer<typeof NotebookSchema>;
export type Address = z.infer<typeof AddressSchema>;
export type Entry = z.infer<typeof EntrySchema>;
export type SightingDraft = Omit<
  Sighting,
  | "format"
  | "version"
  | "id"
  | "recordedAt"
  | "observer"
  | "publisher"
  | "photo"
> & { observerName: string };
export const normalizeOwner = (s: string) =>
  owner.parse(s.replace(/^0x/, "").toLowerCase());
export function addressFor(address: string): Address {
  return {
    format: "org.fieldnote.address",
    version: 1,
    feed: {
      owner: normalizeOwner(address),
      topic: TOPIC,
      type: "sequence",
      payload: "timestamp-be64+reference32",
    },
    contentEndpoint: "bytes",
  };
}
export const encode = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value));
export const hexToBytes = (value: string) =>
  Uint8Array.from(ref.parse(value).match(/../g)!, (part) => parseInt(part, 16));
export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(bytes).buffer,
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function addressReference(input: string): string {
  const raw = input.trim();
  if (/^[a-f0-9]{64}$/i.test(raw)) return raw.toLowerCase();
  try {
    const url = new URL(raw);
    const params = new URLSearchParams(url.hash.slice(1));
    return ref.parse(params.get("notebook")?.toLowerCase());
  } catch {
    throw new Error(
      "Paste a notebook link from Fieldnote or its 64-character public reference.",
    );
  }
}
