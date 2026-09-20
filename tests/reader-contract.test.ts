import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseDescriptor,
  parseIndex,
  parseRecord,
  parseLink,
} from "../apps/reader/src/model.ts";
import {
  checkedBytes,
  fetchBytes,
  gatewayOrigin,
} from "../apps/reader/src/network.ts";
import {
  SightingSchema,
  NotebookSchema,
  addressFor,
  encode,
  sha256,
} from "../apps/fieldnote/src/lib/format.ts";

const owner = "1234567890abcdef1234567890abcdef12345678",
  reference = "a".repeat(64),
  id = "84d0a094-ec4d-4e3b-8b95-a7db7b659a33";
const record = {
  format: "org.fieldnote.sighting",
  version: 1,
  id,
  recordedAt: "2026-09-20T00:00:00.000Z",
  species: { commonName: "Common Kingfisher", scientificName: "Alcedo atthis" },
  observed: {
    date: "1998-09-20",
    time: null,
    utcOffset: null,
    timezone: null,
    precision: "day",
  },
  place: {
    name: "Illustrative location",
    latitude: 18.5,
    longitude: 73.8,
    datum: "WGS84",
    uncertaintyMeters: 1000,
    source: "manual",
  },
  observer: { name: "Example observer", identityAddress: owner },
  publisher: { owner, appOrigin: "https://writer.example.org" },
  count: 1,
  notes: "A portable format example, not a real observation.",
  photo: null,
  demonstration: true,
};
const index = {
  format: "org.fieldnote.notebook",
  version: 1,
  title: "Example notebook",
  owner,
  addressReference: reference,
  updatedAt: "2026-09-20T00:00:00.000Z",
  previous: null,
  records: [],
};

test("the published example bytes are independently readable and their index checksum is exact", async () => {
  const read = (name: string) =>
    readFileSync(new URL(`../format/examples/${name}.json`, import.meta.url));
  const exampleBytes = read("sighting");
  const example = parseRecord(JSON.parse(exampleBytes.toString()), owner, id);
  SightingSchema.parse(example);
  const notebook = parseIndex(
    JSON.parse(read("notebook").toString()),
    owner,
    reference,
  );
  assert.equal(notebook.records[0].bytes, exampleBytes.length);
  assert.equal(notebook.records[0].sha256, await sha256(exampleBytes));
  assert.throws(
    () =>
      parseRecord(
        JSON.parse(read("unsupported-version").toString()),
        owner,
        id,
      ),
    /Unsupported format version/,
  );
  assert.throws(
    () =>
      parseRecord(JSON.parse(read("invalid-location").toString()), owner, id),
    /Latitude/,
  );
});

test("the independent parser understands serialized writer records and descriptors", () => {
  const validated = SightingSchema.parse(record);
  assert.deepEqual(
    parseRecord(
      JSON.parse(new TextDecoder().decode(encode(validated))),
      owner,
      id,
    ),
    validated,
  );
  assert.deepEqual(parseDescriptor(addressFor(owner)), addressFor(owner));
  assert.deepEqual(
    parseIndex(NotebookSchema.parse(index), owner, reference),
    index,
  );
});
test("unsupported versions and wrong format identifiers are distinguished", () => {
  assert.throws(
    () => parseRecord({ ...record, version: 2 }, owner, id),
    /Unsupported format version 2/,
  );
  assert.throws(
    () => parseRecord({ ...record, format: "unrelated.record" }, owner, id),
    /Unsupported record format/,
  );
});
test("the reader rejects wrong ownership and an index addressed to a different notebook", () => {
  assert.throws(
    () =>
      parseRecord(
        {
          ...record,
          publisher: { ...record.publisher, owner: "f".repeat(40) },
        },
        owner,
        id,
      ),
    /publisher does not match/,
  );
  assert.throws(
    () => parseIndex(index, owner, "b".repeat(64)),
    /different notebook address/,
  );
});
test("locations and historical date precision travel with the record", () => {
  const parsed = parseRecord(record, owner, id);
  assert.equal(parsed.observed.time, null);
  assert.equal(parsed.place.uncertaintyMeters, 1000);
  assert.throws(
    () =>
      parseRecord(
        { ...record, place: { ...record.place, latitude: 190 } },
        owner,
        id,
      ),
    /Latitude/,
  );
  assert.throws(
    () =>
      parseRecord(
        { ...record, observed: { ...record.observed, date: "2026-02-30" } },
        owner,
        id,
      ),
    /real calendar date/,
  );
  assert.throws(
    () =>
      parseRecord(
        { ...record, observed: { ...record.observed, time: "00:00" } },
        owner,
        id,
      ),
    /must not invent/,
  );
});
test("both applications accept a portable reader link", () => {
  assert.equal(
    parseLink(`https://reader.example.org/#notebook=${reference}`),
    reference,
  );
  assert.equal(parseLink(reference), reference);
  assert.throws(() => parseLink("not a notebook"), /Paste a notebook link/);
});
test("custom gateway settings cannot carry credentials, authenticated queries or remote plaintext URLs", () => {
  assert.equal(
    gatewayOrigin("http://127.0.0.1:1633/"),
    "http://127.0.0.1:1633",
  );
  assert.throws(() => gatewayOrigin("http://gateway.example.org"), /HTTPS/);
  assert.throws(
    () => gatewayOrigin("https://gateway.example.org/?option=1"),
    /without a path/,
  );
});
test("the reader retrieves raw records through /bytes and enforces checksums", async () => {
  const original = globalThis.fetch;
  const bytes = encode(record);
  let request = "";
  globalThis.fetch = async (input, options) => {
    request = String(input);
    assert.equal(options?.credentials, "omit");
    return new Response(bytes);
  };
  try {
    const entry = {
      reference,
      bytes: bytes.length,
      sha256: await sha256(bytes),
    };
    assert.deepEqual(
      await checkedBytes("https://gateway.example.org", entry),
      bytes,
    );
    assert.equal(request, `https://gateway.example.org/bytes/${reference}`);
    await assert.rejects(
      checkedBytes("https://gateway.example.org", {
        ...entry,
        sha256: "b".repeat(64),
      }),
      /Checksum or size mismatch/,
    );
    await assert.rejects(
      fetchBytes("https://gateway.example.org", reference, 10),
      /size limit/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
