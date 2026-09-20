// Independent implementation of format/README.md. No writer code is imported.
export type Descriptor = {
  format: "org.fieldnote.address";
  version: 1;
  feed: {
    owner: string;
    topic: string;
    type: "sequence";
    payload: "timestamp-be64+reference32";
  };
  contentEndpoint: "bytes";
};
export type Entry = {
  id: string;
  reference: string;
  sha256: string;
  bytes: number;
};
export type Index = {
  format: "org.fieldnote.notebook";
  version: 1;
  title: string;
  owner: string;
  updatedAt: string;
  addressReference: string;
  previous: string | null;
  records: Entry[];
};
export type RecordData = {
  format: "org.fieldnote.sighting";
  version: 1;
  id: string;
  recordedAt: string;
  species: { commonName: string; scientificName: string };
  observed: {
    date: string;
    time: string | null;
    utcOffset: string | null;
    timezone: string | null;
    precision: "day" | "minute";
  };
  place: {
    name: string;
    latitude: number;
    longitude: number;
    datum: "WGS84";
    uncertaintyMeters: number;
    source: "manual" | "device";
  };
  observer: { name: string; identityAddress: string };
  publisher: { owner: string; appOrigin: string };
  count: number;
  notes: string;
  demonstration: boolean;
  photo: null | {
    reference: string;
    endpoint: "bytes";
    mediaType: "image/jpeg" | "image/png" | "image/webp";
    bytes: number;
    sha256: string;
    caption: string;
    credit: string;
  };
};
function fail(message: string): never {
  throw new Error(message);
}
function object(v: unknown, label: string): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    fail(`${label} must be an object.`);
  return v as Record<string, unknown>;
}
function string(v: unknown, label: string, max: number, min = 0): string {
  if (typeof v !== "string" || v.length > max || v.trim().length < min)
    fail(`${label} is missing or exceeds the format limit.`);
  return v;
}
function number(
  v: unknown,
  label: string,
  min: number,
  max: number,
  integer = false,
): number {
  if (
    typeof v !== "number" ||
    !Number.isFinite(v) ||
    v < min ||
    v > max ||
    (integer && !Number.isInteger(v))
  )
    fail(`${label} is outside the allowed range.`);
  return v;
}
function exact(v: unknown, expected: string, label: string) {
  if (v !== expected) fail(`Unsupported ${label}: expected ${expected}.`);
}
function hex(v: unknown, length: number, label: string): string {
  const s = string(v, label, length, length);
  if (!new RegExp(`^[a-f0-9]{${length}}$`).test(s))
    fail(`${label} is not a lowercase hexadecimal value.`);
  return s;
}
function uuid(v: unknown): string {
  const s = string(v, "Sighting ID", 36, 36);
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      s,
    )
  )
    fail("Sighting ID is not a UUID.");
  return s;
}
function timestamp(v: unknown, label: string): string {
  const s = string(v, label, 40, 20);
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(s) ||
    !Number.isFinite(Date.parse(s))
  )
    fail(`${label} is not a UTC timestamp.`);
  return s;
}
function envelope(v: unknown, format: string) {
  const value = object(v, "Stored data");
  exact(value.format, format, "record format");
  if (value.version !== 1)
    fail(
      `Unsupported format version ${String(value.version)}. This reader supports version 1.`,
    );
  return value;
}
export function parseDescriptor(v: unknown): Descriptor {
  const d = envelope(v, "org.fieldnote.address"),
    f = object(d.feed, "Feed");
  hex(f.owner, 40, "Feed owner");
  hex(f.topic, 64, "Feed topic");
  exact(f.type, "sequence", "feed type");
  exact(f.payload, "timestamp-be64+reference32", "feed encoding");
  exact(d.contentEndpoint, "bytes", "content endpoint");
  return d as unknown as Descriptor;
}
export function parseIndex(
  v: unknown,
  expectedOwner: string,
  expectedAddress: string,
): Index {
  const d = envelope(v, "org.fieldnote.notebook");
  string(d.title, "Notebook title", 160, 1);
  hex(d.owner, 40, "Notebook owner");
  if (d.owner !== expectedOwner)
    fail("The notebook owner does not match its signed feed.");
  if (hex(d.addressReference, 64, "Notebook address") !== expectedAddress)
    fail("The index points to a different notebook address.");
  timestamp(d.updatedAt, "Updated time");
  if (d.previous !== null) hex(d.previous, 64, "Previous index");
  if (!Array.isArray(d.records) || d.records.length > 1000)
    fail("The notebook must contain at most 1,000 sighting references.");
  const ids = new Set<string>();
  for (const raw of d.records) {
    const entry = object(raw, "Index entry");
    const id = uuid(entry.id);
    if (ids.has(id)) fail("The notebook contains a duplicate sighting ID.");
    ids.add(id);
    hex(entry.reference, 64, "Sighting reference");
    hex(entry.sha256, 64, "Sighting checksum");
    number(entry.bytes, "Sighting size", 1, 32768, true);
  }
  return d as unknown as Index;
}
export function parseRecord(
  v: unknown,
  owner: string,
  expectedId: string,
): RecordData {
  const d = envelope(v, "org.fieldnote.sighting");
  if (uuid(d.id) !== expectedId)
    fail("The sighting ID does not match the notebook index.");
  timestamp(d.recordedAt, "Recording time");
  const s = object(d.species, "Species");
  string(s.commonName, "Common name", 160, 1);
  string(s.scientificName, "Scientific name", 160);
  const o = object(d.observed, "Observation time");
  const date = string(o.date, "Observation date", 10, 10);
  const day = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d\d-\d\d$/.test(date) ||
    !Number.isFinite(day.valueOf()) ||
    day.toISOString().slice(0, 10) !== date
  )
    fail("The observation date is not a real calendar date.");
  if (o.precision === "day") {
    if (o.time !== null || o.utcOffset !== null || o.timezone !== null)
      fail("A date-only sighting must not invent a time or timezone.");
  } else if (o.precision === "minute") {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(string(o.time, "Time", 5, 5)))
      fail("The sighting time is invalid.");
    if (
      !/^[+-](0\d|1[0-4]):[0-5]\d$/.test(
        string(o.utcOffset, "UTC offset", 6, 6),
      )
    )
      fail("The UTC offset is invalid.");
    if (o.timezone !== null) string(o.timezone, "Timezone", 100);
  } else fail("Unsupported observation time precision.");
  const p = object(d.place, "Place");
  string(p.name, "Place name", 200, 1);
  number(p.latitude, "Latitude", -90, 90);
  number(p.longitude, "Longitude", -180, 180);
  number(p.uncertaintyMeters, "Location accuracy", 1, 500000);
  exact(p.datum, "WGS84", "coordinate datum");
  if (p.source !== "manual" && p.source !== "device")
    fail("Unsupported location source.");
  const observer = object(d.observer, "Observer");
  string(observer.name, "Observer name", 120, 1);
  hex(observer.identityAddress, 40, "Observer identity");
  const publisher = object(d.publisher, "Publisher");
  if (hex(publisher.owner, 40, "Publishing owner") !== owner)
    fail("The sighting publisher does not match the notebook owner.");
  const origin = string(publisher.appOrigin, "Writing origin", 300, 1);
  try {
    new URL(origin);
  } catch {
    fail("Writing origin is not a URL.");
  }
  number(d.count, "Bird count", 1, 100000, true);
  string(d.notes, "Notes", 3000);
  if (typeof d.demonstration !== "boolean")
    fail("Demonstration flag must be a boolean.");
  if (d.photo !== null) {
    const photo = object(d.photo, "Photo");
    hex(photo.reference, 64, "Photo reference");
    hex(photo.sha256, 64, "Photo checksum");
    exact(photo.endpoint, "bytes", "photo endpoint");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(
        String(photo.mediaType),
      )
    )
      fail("Unsupported photo media type.");
    number(photo.bytes, "Photo size", 1, 5242880, true);
    string(photo.caption, "Photo caption", 500);
    string(photo.credit, "Photo credit", 200);
  }
  return d as unknown as RecordData;
}
export function parseLink(input: string): string {
  const raw = input.trim();
  if (/^[a-f0-9]{64}$/i.test(raw)) return raw.toLowerCase();
  try {
    const url = new URL(raw);
    const ref = new URLSearchParams(url.hash.slice(1)).get("notebook");
    return hex(ref?.toLowerCase(), 64, "Notebook reference");
  } catch {
    throw new Error(
      "Paste a notebook link or its 64-character public reference.",
    );
  }
}
