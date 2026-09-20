# Loops evaluator review: Take your records with you

Reviewed 20 September 2026 using the prompt returned by:

```sh
loops evaluate --event road-to-devcon-v --problem take-your-records-with-you --format json
```

The command retrieves a free evaluator prompt; it does not run the official judging pipeline or produce a score. This report executes that prompt against Fieldnote's source and live evidence. The eight technical checks were also reread in the signed-in Problem 2 workspace.

## Alignment summary

Fieldnote directly implements the requested outcome: a birder files public records under a Swarm ID app-derived key, and a separately built application reads those records from Swarm without exporting or importing a file. The working implementation is supported by two live publications, a photographed record, independent incognito retrieval, exact stored objects, and an isolated reader build. It is a usable prototype with explicit storage and single-writer limits.

## What is genuinely strong

- **Network-backed ownership and retrieval.** `apps/fieldnote/src/lib/publish.ts:92` publishes self-describing records and updates the user's signed sequence feed. `apps/fieldnote/src/lib/network.ts:182` reconstructs the notebook from Swarm; local storage in `components/sighting-form.tsx` contains only an unsaved draft.
- **Real independent reading.** `apps/reader/src/network.ts:130` resolves the descriptor, feed, index and raw record bytes. `model.ts` supplies its own parser and `main.ts` its own renderer. `scripts/check-boundaries.mjs` and `.github/workflows/check.yml` establish that it builds without writer imports or the writer directory.
- **Capability guards and upload verification.** `apps/fieldnote/src/lib/publish.ts:48`, `:137` and `:195` gate all object and feed writes. Publication tests exercise identity/capability loss, conflicts and uncertain-write reconciliation. A fresh identity without a personal drive successfully used the sponsored path.
- **A substantive portable format.** `format/README.md`, three schemas, valid/invalid examples and exact bytes under `evidence/objects/` describe dates, time precision, offsets, WGS84 coordinates, uncertainty, observer/publisher roles, photo attribution, feed discovery and supported versions.
- **A product beyond the protocol.** The writer offers species suggestions, manual names, optional photos, retained drafts, date/place search and public-data notices. Protocol identifiers appear in optional evidence views. The reader works with no account and verifies photos before displaying them.

## Gaps and risks found, and fixes applied

1. **Mobile reader overflow.** A screen-reader-only table heading escaped the horizontal scroll container. At a 375-pixel width, the document extended to 682 pixels. `apps/reader/style.css` now positions `.table-wrap` so the hidden heading remains contained. The table can scroll while the page remains the viewport's width.
2. **Stale scientific name.** Editing an automatically suggested common name previously retained the former species' scientific name. `apps/fieldnote/src/components/sighting-form.tsx` now clears it when the new name does not match a suggestion. The deployed form was checked by changing Common Kingfisher to Unidentified warbler; Alcedo atthis was cleared.
3. **Overstated verification wording.** The reader now labels ordinary records “Public field observation”. A valid checksum establishes byte integrity, not whether someone actually saw the bird.
4. **Previously missing recovery evidence.** The production test account was signed out, the writer origin's localStorage/sessionStorage were cleared, and the same identity signed back in through Swarm ID. Both sightings and the original independent-reader address returned from Swarm. The identity account and published data were not deleted.

Remaining limits are documented in the root README: one active writer, public unencrypted records, origin-derived publishing keys, a small starter species list, no edit/delete workflow, and no indefinite availability guarantee. Capability-loss and checksum-failure checks are automated; no claim is made that every negative test was manually reenacted in the browser. There is no walkthrough video.

## Per-criterion assessment

Weights below are rubric weights, not awarded scores.

| Criterion                                               | Weight | Evidence-based assessment                                                                                                                                                                                                                    |
| ------------------------------------------------------- | -----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload capability checked before writing                |     12 | Implemented at every upload helper and feed commit; negative tests stop writes. Preserve these guards for future upload features.                                                                                                            |
| Route for a user with no personal stamp                 |      6 | Configured `subsidisedGatewayUrl` in `fieldnote.tsx`; two live publications without a personal drive establish the default path.                                                                                                             |
| Format identifier and version in stored records         |     14 | Present in serialized records, descriptor and index; independently parsed actual bytes are captured in evidence.                                                                                                                             |
| Reader does not import the writing application          |     14 | Separate package, entrypoint, parser, network module and deployment; dependency-boundary and isolated-build checks pass.                                                                                                                     |
| Matching upload/download endpoint family                |     10 | Raw objects and photos use `/bytes`; independent live retrieval passed. Feed discovery correctly uses the SDK's feed/SOC calls.                                                                                                              |
| No pin/tag options on the gateway route                 |      6 | Application object uploads pass only `encrypt: false`; feed writes pass sequence/timestamp settings. Tests assert the object option allowlist.                                                                                               |
| Specific reasons for failed/unavailable uploads         |     10 | Distinct capability, identity, postage, timeout, integrity, conflict and uncertain-publication messages are rendered in the form/page. Interactive reader checks also distinguish invalid links and wrong object formats.                    |
| No tracked credentials                                  |      8 | Source/CI secret scans pass. Ignored private files hold the dedicated account material; public evidence includes only public locators and synthetic observations.                                                                            |
| Problem interpretation, product judgment and code craft |     20 | Real Swarm reads, independently implemented reader, substantial wire specification and a birder-oriented interface substantiate the criterion. The mobile/data-quality issues above were fixed; actual scoring remains the judge's decision. |

## Success-criteria fit

**Met for the demonstrated flow:** Meera can file a sighting in the writer and open it, including the optional photo and its meaning, in the separately deployed reader without export/import. `evidence/first-publication.json`, `second-publication.json`, the raw objects and the clean-session browser check establish that result. The same public link finds subsequent records.

## Top three follow-up priorities

1. Keep the production demonstration and verification command working through the deadline; recheck availability if the gateway changes.
2. Keep the committed source, Vercel deployments and per-problem repository submission aligned. Loops says the latest pushed code is judged before the clock ends.
3. If additional polish time is available, record a short walkthrough of the already verified write/read/recovery flow. It is useful evidence, not a substitute for code or network checks.

## Submission-record caveat

Fieldnote was submitted in the Problem 2 workspace and the saved repository URL was verified after reloading. Folio remains in Problem 1. The CLI's event-wide project lookup and evaluator context still attach the first project, Folio; that is a CLI context limitation. Do not overwrite Folio using `loops project update` to hide this mismatch. The review above deliberately inspected the separate Fieldnote repository that was actually submitted for Problem 2.
