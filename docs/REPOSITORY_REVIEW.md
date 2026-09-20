# Repository evaluation: Problem 2

Reviewed 20 September 2026 against the freshly retrieved Loops prompt for **Take your records with you** and all eight published Test Cases. The evaluated implementation was `f65ea4628de0e17ca372484f8d002ce151bd45a1`. [Invocation and check record](../evidence/repo-review.json).

`loops evaluate --event road-to-devcon-v --problem take-your-records-with-you --format json` was run from this repository. It returned review instructions, not an official score. Its event-wide project context still names Folio; this review uses Fieldnote's actual source, which is the separate repository saved in the Problem 2 workspace. A hosted demo is not required to inspect these code paths.

## Alignment summary

The writer publishes versioned sighting records on Swarm and reconstructs its notebook from the network. The separate reader supplies its own parser, network path and renderer, and can be built with the entire writing application absent. Actual stored objects and public references are committed as evidence of the cross-application read flow.

## Verified strengths

- [publishSighting](../apps/fieldnote/src/lib/publish.ts#L92) serializes self-describing records, verifies uploaded bytes, and updates a signed feed. [The component](../apps/fieldnote/src/components/fieldnote.tsx#L316) calls it when saving; [loadNotebook](../apps/fieldnote/src/lib/network.ts#L170) reconstructs records on load.
- [Reader network code](../apps/reader/src/network.ts#L125), [parser](../apps/reader/src/model.ts) and [renderer](../apps/reader/src/main.ts) import no writer module. [CI](../.github/workflows/check.yml) builds the copied reader outside the writer tree.
- [The wire format](../format/README.md), schemas and examples describe species, temporal precision, WGS84 coordinates, uncertainty, observer/publisher roles and photographs. [Exact stored JSON objects](../evidence/objects/) can be inspected without running either UI.

## All eight published technical checks

Weights identify the published rubric; they are not awarded scores. All eight are implemented and supported by the paths below.

| #   | Published check                          | Weight | Implementation, caller and proof                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------- | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Check upload capability before writing   |     12 | `requireUpload` in [publish.ts](../apps/fieldnote/src/lib/publish.ts#L48) runs before each object upload and again before the feed commit. [Publication tests](../tests/publication.test.ts) exercise capability loss and identity changes without sending a write.                                                                                                     |
| 2   | Support a user with no personal stamp    |      6 | The real Swarm ID client configures `subsidisedGatewayUrl` in [fieldnote.tsx](../apps/fieldnote/src/components/fieldnote.tsx#L211). [First](../evidence/first-publication.json) and [second publication](../evidence/second-publication.json) record actual sponsored writes.                                                                                           |
| 3   | Store a format identifier and version    |     14 | The serializer writes `org.fieldnote.sighting` and version `1` into every stored record. [format.ts](../apps/fieldnote/src/lib/format.ts), [wire specification](../format/README.md) and [actual object bytes](../evidence/objects/) establish this independently of UI labels.                                                                                         |
| 4   | Reader does not import the writer        |     14 | Independent `apps/reader/src/{main,model,network}.ts`, [dependency-boundary check](../scripts/check-boundaries.mjs) and the separate isolated-reader CI job. The boundary check reports zero writer imports.                                                                                                                                                            |
| 5   | Match upload/download endpoint families  |     10 | `client.uploadData` writes raw objects; [writer reads](../apps/fieldnote/src/lib/network.ts) and [reader reads](../apps/reader/src/network.ts) use `/bytes`. [verify-notebook.ts](../scripts/verify-notebook.ts) imports only the reader implementation and verifies actual objects.                                                                                    |
| 6   | Do not send pin/tag options to a gateway |      6 | The central upload helper passes only `{ encrypt: false }`. Feed uploads pass index/timestamp settings. [Publication tests](../tests/publication.test.ts) assert object-upload options.                                                                                                                                                                                 |
| 7   | Give specific upload failure reasons     |     10 | `requireUpload`, conflict/readback/reconciliation errors in [publish.ts](../apps/fieldnote/src/lib/publish.ts), [explainError](../apps/fieldnote/src/lib/errors.ts) and the save handler in [fieldnote.tsx](../apps/fieldnote/src/components/fieldnote.tsx) carry distinct errors to the form. No-stamp, identity change, timeout and uncertain-write cases have tests. |
| 8   | Exclude tracked credentials              |      8 | Ignored private runtime files, deployment exclusions and [check-secrets.mjs](../scripts/check-secrets.mjs). The current source scan passes. Public object references are not account credentials.                                                                                                                                                                       |

## Product judgment and code craft

The 20-point qualitative criterion rejects export-only portability, readers that reuse the writer's parser, and interfaces built around unexplained protocol identifiers. The normal writer load fetches Swarm data; localStorage holds only an unsaved form draft. The independent parser and isolated build establish separation. The form's species/date/place/photograph inputs, search and public-data notices are inspectable in [sighting-form.tsx](../apps/fieldnote/src/components/sighting-form.tsx). The format is a substantive artifact with schemas and examples.

## Reproduce from the repository

```sh
npm ci
npm test
npm run typecheck
npm run check:boundaries
npm run check:secrets
npm run build
npm run verify:notebook -- b624c672831973e1ddcbce3b75f6f18d9dba31febca86d50fd11a966051cdba8
```

The tests and builds need no Swarm ID account. The final command reads public Swarm objects through the independent reader. It needs a reachable gateway, not writer credentials or a hosted Fieldnote app. All 20 tests and type checks pass. The 08:48 UTC public verification retrieved both sightings and verified the 1,310,793-byte photo with no failures. The prior actual write and sign-out/recovery observations are documented separately in [VERIFICATION.md](VERIFICATION.md).

## Gaps, risks and success fit

The demonstrated cross-app success outcome is met: a sighting written in Fieldnote is readable in the independently built reader without export/import. The protocol currently assumes one active writer; records are public; the sponsored gateway is an external dependency; publishing identities are app-origin-derived. There is no edit/delete workflow or promise of indefinite storage. Checksums prove byte integrity, not that a bird observation is true.

## Three review priorities

1. Expose the independent parser, isolated build and actual stored objects directly from the README: this source map supplies those links.
2. Verify capability and endpoint requirements through call sites and failure tests: all identified paths and 20 tests pass.
3. Keep format and availability claims bounded: the schema, versions, limits, public-data behavior and origin-derived identity tradeoff remain documented.

No published mechanical criterion was found unimplemented in this review. Final scoring remains with Loops.
