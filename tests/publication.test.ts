import test from "node:test";
import assert from "node:assert/strict";
import {
  addressFor,
  encode,
  sha256,
  type SightingDraft,
  type Notebook,
} from "../apps/fieldnote/src/lib/format.ts";
import {
  publishSighting,
  type PublishingClient,
  type Connection,
  type PublishNetwork,
} from "../apps/fieldnote/src/lib/publish.ts";

const owner = "1234567890abcdef1234567890abcdef12345678";
const identity = "abcdef1234".repeat(4);
const draft: SightingDraft = {
  species: { commonName: "Common Kingfisher", scientificName: "Alcedo atthis" },
  observed: {
    date: "2026-09-20",
    time: null,
    utcOffset: null,
    timezone: null,
    precision: "day",
  },
  place: {
    name: "Demonstration wetland",
    latitude: 18.5,
    longitude: 73.8,
    datum: "WGS84",
    uncertaintyMeters: 1000,
    source: "manual",
  },
  count: 1,
  notes: "A synthetic observation for automated tests.",
  observerName: "Example observer",
  demonstration: true,
};
function setup() {
  const storage = new Map<string, Uint8Array>();
  const uploads: { data: Uint8Array; options: unknown }[] = [];
  let feed: string | null = null;
  let feedWrites = 0;
  let reads = 0;
  const connection: Connection = {
    canUpload: true,
    uploadMode: "subsidised",
    identity: { id: "example", name: "Example observer", address: identity },
    appKey: { address: owner, publicKey: "public-test-identifier" },
  };
  const client: PublishingClient = {
    connectionInfo: connection,
    async uploadData(data, options) {
      uploads.push({ data, options });
      const reference = await sha256(data);
      storage.set(reference, data);
      return { reference };
    },
    makeSequentialFeedWriter(options) {
      assert.equal(options.topic, addressFor(owner).feed.topic);
      return {
        async uploadRawPayload(data, options) {
          assert.equal(options.hasTimestamp, true);
          assert.equal(options.index, feed === null ? 0n : 1n);
          feedWrites++;
          feed = Buffer.from(data).toString("hex");
        },
      };
    },
  };
  const network: PublishNetwork = {
    async bytes(ref) {
      const data = storage.get(ref);
      assert.ok(data);
      return data;
    },
    async head() {
      reads++;
      return feed ? { reference: feed, nextIndex: 1n } : null;
    },
    async index(reference) {
      const data = storage.get(reference);
      assert.ok(data);
      return JSON.parse(new TextDecoder().decode(data)) as Notebook;
    },
  };
  return {
    client,
    connection,
    network,
    storage,
    uploads,
    get feedWrites() {
      return feedWrites;
    },
    get reads() {
      return reads;
    },
    setFeed(value: string) {
      feed = value;
    },
  };
}
const run = (
  s: ReturnType<typeof setup>,
  extra: Partial<Parameters<typeof publishSighting>[0]> = {},
) =>
  publishSighting({
    client: s.client,
    draft,
    appOrigin: "https://writer.example.org",
    title: "Example field notes",
    network: s.network,
    ...extra,
  });

test("a signed-in stampless account can publish self-describing records through the subsidised path", async () => {
  const s = setup();
  const result = await run(s);
  assert.equal(s.feedWrites, 1);
  assert.equal(result.index.records.length, 1);
  const objects = s.uploads.map((u) =>
    JSON.parse(new TextDecoder().decode(u.data)),
  );
  assert.deepEqual(
    objects.map((o) => o.format),
    [
      "org.fieldnote.sighting",
      "org.fieldnote.address",
      "org.fieldnote.notebook",
    ],
  );
  assert.ok(objects.every((o) => o.version === 1));
  assert.ok(
    s.uploads.every((u) => JSON.stringify(u.options) === '{"encrypt":false}'),
  );
  assert.equal(result.index.addressReference, result.addressReference);
  assert.equal(result.sighting.publisher.owner, owner);
  assert.equal(result.sighting.observer.identityAddress, identity);
});
for (const reason of ["not-signed-in", "no-stamp", "stamper-failed"] as const) {
  test(`${reason} blocks every upload before the first write`, async () => {
    const s = setup();
    s.connection.canUpload = false;
    if (reason === "not-signed-in") s.connection.identity = undefined;
    else s.connection.uploadUnavailableReason = reason;
    await assert.rejects(
      run(s),
      (error) =>
        error instanceof Error &&
        error.message.includes(
          reason === "not-signed-in"
            ? "Sign in"
            : reason === "stamper-failed"
              ? "prepare uploads"
              : "uploads are unavailable",
        ),
    );
    assert.equal(s.uploads.length, 0);
    assert.equal(s.feedWrites, 0);
  });
}
test("losing capability during a multi-object save prevents all subsequent writes", async () => {
  const s = setup();
  const original = s.client.uploadData;
  s.client.uploadData = async (...args) => {
    const result = await original(...args);
    s.connection.canUpload = false;
    return result;
  };
  await assert.rejects(run(s), /uploads are unavailable/);
  assert.equal(s.uploads.length, 1);
  assert.equal(s.feedWrites, 0);
});
test("switching identity during publication prevents the next write", async () => {
  const s = setup();
  const original = s.client.uploadData;
  s.client.uploadData = async (...args) => {
    const result = await original(...args);
    s.connection.appKey = {
      address: "f".repeat(40),
      publicKey: "another-public-identifier",
    };
    return result;
  };
  await assert.rejects(run(s), /account changed/);
  assert.equal(s.uploads.length, 1);
  assert.equal(s.feedWrites, 0);
});
test("corrupt upload readback cannot advance the notebook", async () => {
  const s = setup();
  s.network.bytes = async () => encode({ corrupt: true });
  await assert.rejects(run(s), /could not be verified/);
  assert.equal(s.feedWrites, 0);
});
test("an update from another writer causes a visible conflict instead of overwriting it", async () => {
  const s = setup();
  let calls = 0;
  s.network.head = async () =>
    ++calls === 1 ? null : { reference: "a".repeat(64), nextIndex: 1n };
  await assert.rejects(run(s), /changed in another window/);
  assert.equal(s.feedWrites, 0);
});
test("an interrupted feed response is reconciled from Swarm before reporting failure", async () => {
  const s = setup();
  const original = s.client.makeSequentialFeedWriter;
  s.client.makeSequentialFeedWriter = (options) => {
    const writer = original(options);
    return {
      async uploadRawPayload(...args) {
        await writer.uploadRawPayload(...args);
        throw new Error("Response timed out after commit");
      },
    };
  };
  const result = await run(s);
  assert.equal(result.index.records.length, 1);
  assert.equal(s.feedWrites, 1);
});
test("a second save uses the network index, preserving existing records without a local catalogue", async () => {
  const s = setup();
  const first = await run(s);
  const second = await run(s, {
    draft: {
      ...draft,
      species: {
        commonName: "Little Egret",
        scientificName: "Egretta garzetta",
      },
    },
  });
  assert.equal(second.index.previous, first.indexReference);
  assert.equal(second.index.records.length, 2);
  assert.equal(second.index.records[1].reference, first.entry.reference);
  assert.equal(second.addressReference, first.addressReference);
  assert.equal(s.feedWrites, 2);
});
test("photo validation rejects renamed non-images before spending storage", async () => {
  const s = setup();
  await assert.rejects(
    run(s, {
      photo: { bytes: encode("not an image"), caption: "", credit: "" },
    }),
    /JPEG, PNG or WebP/,
  );
  assert.equal(s.uploads.length, 0);
});
test("photo upload is capability-gated and carries enough metadata to retrieve independently", async () => {
  const s = setup();
  const bytes = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3);
  const result = await run(s, {
    photo: {
      bytes,
      caption: "Test signature bytes, not a demo photograph",
      credit: "Automated test",
    },
  });
  assert.equal(result.sighting.photo?.endpoint, "bytes");
  assert.equal(result.sighting.photo?.bytes, bytes.length);
  assert.equal(result.sighting.photo?.sha256, await sha256(bytes));
  assert.equal(s.uploads.length, 4);
});
