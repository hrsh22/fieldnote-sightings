# Strict evaluator review: Fieldnote

[Evaluator command, response fingerprint and reviewed CI](../evidence/strict-evaluation.json)

Reviewed 20 September 2026 at implementation commit `8f9a8bc2146a676ad097ce2604a261d9cfc889bd` using a fresh invocation of:

```sh
loops evaluate --event road-to-devcon-v --problem take-your-records-with-you --format json
```

The command returns a problem-specific review prompt, not an official judging result. This report executes that prompt against the submitted Fieldnote repository. The event-wide project record names Folio; Fieldnote is the separate repository saved for Problem 2. No submission was changed by this review. Rubric weights below identify criteria and are not awarded points.

## Alignment summary

Fieldnote implements the requested outcome: write a bird sighting under a Swarm ID app key, then open the notebook in a separately built reader without exporting or importing records. Both applications reconstruct their ordinary views from Swarm. The stored objects, independent parser, format specification and isolated-reader build are reviewable directly in GitHub.

## Verified strengths

- **Network data is the normal path.** Sign-in calls `loadOwn`, which calls `loadNotebook`; opening a shared notebook calls `readAddress` followed by the same network loader. `records` comes from that loaded notebook. See [application call sites](../apps/fieldnote/src/components/fieldnote.tsx#L160), [load-on-identity effect](../apps/fieldnote/src/components/fieldnote.tsx#L269) and [network loader](../apps/fieldnote/src/lib/network.ts#L170). The demo JSON supplies only a public address reference, not a local collection of sightings.
- **The reader has its own implementation.** [Reader entrypoint](../apps/reader/src/main.ts#L49), [parser](../apps/reader/src/model.ts) and [network module](../apps/reader/src/network.ts#L125) import no writing-application code. [The bundle-boundary check](../scripts/check-boundaries.mjs) inspects actual bundled imports. [CI](../.github/workflows/check.yml) also copies the reader outside the repository, installs its own lockfile and builds with the writer source absent.
- **Meaning travels with the bytes.** [The format contract](../format/README.md) specifies object discovery, signature/reference encoding, identifiers, versions, date precision, offsets, WGS84 coordinates, uncertainty, observer versus publisher, and photo retrieval/integrity. [Exact published objects](../evidence/objects/) carry those fields. The JSON schemas and examples are substantive artifacts, not links back to application-only lookup data.
- **An uncertain save is recoverable.** [The form](../apps/fieldnote/src/components/sighting-form.tsx#L112) persists a stable record ID and publishing account before writing. [The publisher](../apps/fieldnote/src/lib/publish.ts#L142) searches the current signed notebook for that ID and verifies the full earlier record and photo metadata before returning recovered success. Changed details remain a visible conflict. [Regression evidence](../evidence/retry-safety-review.json) records the tests supporting these behaviors.
- **Publication is deliberate.** Species, date, named place, coordinates, observer, notes, photo caption and credit are editable before saving. [The public notice](../apps/fieldnote/src/components/sighting-form.tsx#L451) explains precise coordinates, unchanged photo metadata and the effect of publication. A reloaded draft with a missing selected photograph requires reattachment or an explicit choice to omit it.

## The problem's own 20-point qualitative criterion

The fresh Problem 2 prompt rejects portability theatre, a reader that reuses the writer's implementation, and protocol-oriented exercises presented as a birder's app.

| Skeptical question | Source-based finding |
| --- | --- |
| Does Swarm receive an export while the real notebook stays in local state? | **No such path found.** [The signed feed and index are read on load](../apps/fieldnote/src/lib/network.ts#L111); individual records are fetched and checksum-checked before display. Browser storage holds only [an unsaved draft and retry identity](../apps/fieldnote/src/lib/draft.ts#L28). Removing that draft does not remove the published notebook. |
| Does the separate reader depend on the writer's parser, constants or record class? | **No such dependency found.** The reader owns its descriptor/index/record validation, obtains the feed topic from the stored descriptor, and has a separate build. Both the actual bundle boundary and writer-absent CI build substantiate this. Tests may compare both implementations; the production reader does not import the writer. |
| Must Meera understand a topic, batch ID or hex reference to file a sighting? | **No.** The [sighting form](../apps/fieldnote/src/components/sighting-form.tsx) uses birding fields and device location. The [sharing action](../apps/fieldnote/src/components/fieldnote.tsx#L390) copies a complete reader link. The reader accepts that link and automatically opens its notebook fragment; technical proof is in a disclosure rather than the main form. |
| Could a stranger interpret a stored record without application source? | **Strongly supported.** Named fields, explicit units/precision, formats/versions and separate observer/publisher identities are visible in the stored JSON. The [wire contract](../format/README.md) describes how to discover and read every object; the independent implementation exercises it. This demonstrates a second implementation, not an unobserved third-party adoption claim. |

**Qualitative assessment:** the three wrong-shaped builds are contradicted by executable read paths and independent build evidence. The strongest argument is the format plus the independently implemented primary reader, rather than an export feature or a claim in the README. This review cannot award the qualitative points on the judge's behalf.

## Additional cross-check requested by the builder

The archive-specific passage about Tsering belongs to Problem 1. It is applied here as an additional product test, without substituting it for Fieldnote's own rubric.

| Archive failure pattern or positive test | Fieldnote cross-check |
| --- | --- |
| The mirror | Both everyday read paths fetch the network feed, index and objects. The independent reader needs the public notebook link, not Fieldnote browser storage or its writing application. |
| The developer tool | A visual sighting form, named species, dates, places, search, photos and a shareable link are primary. [Reader rendering](../apps/reader/src/main.ts#L139) turns records into a notebook table and detail dialog. CLI verification is supplementary evidence. |
| The false promise | The [writer's explanation](../apps/fieldnote/src/components/fieldnote.tsx#L854), [reader footer](../apps/reader/index.html#L156) and [format availability semantics](../format/README.md#publication-failure-and-availability) explicitly tie availability to storage/postage. No claim of permanent sponsored storage was found. |
| Recovery is primary | Opening a notebook normally runs the same network resolution that a fresh reader uses. No special export, writer login or recovery mode is needed to read published records. |
| Public information is selected deliberately | Editable location, notes, photo caption/credit and the pre-save public notice make the publication choice visible. Demonstration observations are marked in stored data and rendering. |
| Continuity after changing institutions or applications | The public notebook descriptor, owner/topic, versioned records and independent reader preserve discovery and interpretation outside the writing app. This is evidence for cross-application reading; it is not presented as a demonstration of migrating signing authority to another app origin. |

## All eight published technical checks

| Criterion | Weight | Verified implementation and evidence |
| --- | ---: | --- |
| Check upload capability before writing | 12 | [`requireUpload`](../apps/fieldnote/src/lib/publish.ts#L54) checks identity, app key and `canUpload`; every object helper and feed commit calls it. [Tests](../tests/publication.test.ts) cover capability loss and identity changes without another write. |
| Support an account without a personal stamp | 6 | [The Swarm ID constructor](../apps/fieldnote/src/components/fieldnote.tsx#L209) passes `subsidisedGatewayUrl`. [The observed account-without-stamp publication](VERIFICATION.md#completed-live-acceptance-checks) records the sponsored-write behavior; [first](../evidence/first-publication.json) and [second publication](../evidence/second-publication.json) receipts verify public retrieval and integrity. |
| Format identifier and version in stored records | 14 | [Serialization](../apps/fieldnote/src/lib/publish.ts#L116), [schemas](../format/) and [published bytes](../evidence/objects/) include explicit `format` and `version`. |
| Independent reader does not import the writer | 14 | [Independent parser](../apps/reader/src/model.ts), [boundary check](../scripts/check-boundaries.mjs) and [isolated-reader CI job](../.github/workflows/check.yml) establish source and build separation. |
| Matching upload/download endpoint family | 10 | `uploadData` writes raw objects; both [writer](../apps/fieldnote/src/lib/network.ts#L24) and [reader](../apps/reader/src/network.ts#L35) fetch `/bytes`. [Notebook verifier](../scripts/verify-notebook.ts) uses the reader implementation and verifies the published photograph too. |
| No gateway pin/tag options | 6 | [Central object upload](../apps/fieldnote/src/lib/publish.ts#L190) sends only `{ encrypt: false }`. Feed commits pass index/timestamp options. Publication tests assert the allowed options. |
| Specific visible upload failures | 10 | Capability, account change, photo type, readback, changed feed and uncertain commit have distinct errors in [publisher](../apps/fieldnote/src/lib/publish.ts) and [error mapping](../apps/fieldnote/src/lib/errors.ts). [The form](../apps/fieldnote/src/components/sighting-form.tsx#L461) renders the save error and keeps the draft. |
| No committed credentials | 8 | [Secret scanner](../scripts/check-secrets.mjs), ignored runtime credential paths and the successful current CI secret check support this. Public references and signed-feed addresses are evidence, not credentials. |

## Verification and remaining review work

The [successful CI run for the reviewed commit](https://github.com/hrsh22/fieldnote-sightings/actions/runs/35513540171) ran the repository's 29 tests, both application typechecks, bundle boundaries, secret scan, both production builds and the isolated reader job. [Retry evidence](../evidence/retry-safety-review.json) identifies the controlled failure tests and does not claim they were new public writes. [Publication evidence](../evidence/second-publication.json) records the separate real network demonstration. This review inspected source, call sites and committed evidence; it did not create new public records.

No new blocking defect was found in the eight checks or the three qualitative failure patterns. Two specific confidence improvements remain distinguishable from completed work:

- The latest draft, missing-photo and changed-account paths are covered by source review and automated regressions. [Their evidence explicitly states](../evidence/retry-safety-review.json) that a browser visual review of those changes was not performed. A recorded browser walkthrough of those exact interactions would add UI evidence; it should not be represented as already completed.
- [The historical-place entry path](../apps/fieldnote/src/components/sighting-form.tsx#L304) still asks for numeric coordinates when device location is unsuitable. A named-place search or map picker would make older observations easier for a nontechnical birder while preserving the explicit stored coordinates. This is a usability opportunity, not a missing independent-read path.

## Success-criteria fit and priorities

**Met for the demonstrated flow:** a sighting and photograph written in Fieldnote are independently discoverable, interpretable and displayable in the separate reader, with no export/import step. The source, raw stored objects, actual publication receipts and writer-absent build collectively support that conclusion.

1. Add a browser evidence record for the newly added retry, account-change and missing-photo interactions, preserving the distinction between controlled failure tests and actual UI observations.
2. If extending the product, improve named-place selection for historical observations without weakening the portable coordinate/uncertainty format.
3. Preserve the independent-reader boundary and wire examples as release checks. A reader authored by an unrelated implementer from only the specification would add adoption evidence; the repository already proves its own separate implementation.
