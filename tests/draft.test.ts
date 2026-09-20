import test from "node:test";
import assert from "node:assert/strict";
import { blankDraft, restoreDraft } from "../apps/fieldnote/src/lib/draft.ts";

test("draft recovery retains retry identity, account binding and the name of a photo that must be reattached", () => {
  const draft = {
    ...blankDraft(),
    commonName: "Common Kingfisher",
    publishingOwner: "a".repeat(40),
    photoName: "kingfisher.jpg",
  };
  const restored = restoreDraft(JSON.stringify(draft));
  assert.deepEqual(restored, draft);
  assert.equal("photo" in restored, false);
});

test("older drafts gain a retry identity without losing their observation", () => {
  const restored = restoreDraft(
    JSON.stringify({ commonName: "Purple Sunbird", latitude: "18.5" }),
  );
  assert.equal(restored.commonName, "Purple Sunbird");
  assert.equal(restored.latitude, "18.5");
  assert.match(restored.recordId, /^[a-f0-9-]{36}$/);
  assert.equal(restored.photoName, "");
});

test("damaged local draft data cannot inject malformed retry IDs or invalid field types", () => {
  for (const raw of ["not JSON", "null", "[]"])
    assert.equal(restoreDraft(raw).commonName, "");
  const restored = restoreDraft(
    JSON.stringify({
      recordId: "bad",
      commonName: 5,
      publishingOwner: "other",
      source: "unknown",
    }),
  );
  assert.match(restored.recordId, /^[a-f0-9-]{36}$/);
  assert.equal(restored.commonName, "");
  assert.equal(restored.publishingOwner, "");
  assert.equal(restored.source, "manual");
});
