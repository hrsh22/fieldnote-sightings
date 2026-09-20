# Problem 2 plan: Fieldnote

Status: approved implementation plan. The two applications are built and deployed; sponsored uploads, same-link feed updates and independent incognito retrieval have passed live verification. See [VERIFICATION.md](VERIFICATION.md) for current evidence. The remainder records the original plan and its acceptance criteria.
Prepared: 20 September 2026. Event deadline: 11:11 PM IST today.

## Product and repository decision

Target all three problems with three separate GitHub repositories. Folio remains the Problem 1 entry. The Problem 2 repository is now [fieldnote-sightings](https://github.com/hrsh22/fieldnote-sightings).

Fieldnote is a birding notebook: record a species, when and where it was seen, who saw it, notes and an optional photo. A notebook link opens the same records in an independently built reader. Saving and reopening both use Swarm; there is no export/import step.

The Problem 2 deliverable explicitly asks for one repository containing the sighting app, an independent reader and the stored format description. Within this repo, use two separate build roots and two deployments:

| Component                | Proposed implementation                              | Responsibility                                           |
| ------------------------ | ---------------------------------------------------- | -------------------------------------------------------- |
| `apps/fieldnote/`        | Next.js, TypeScript, shadcn                          | Sign in, file sightings, browse the user's notebook      |
| `apps/reader/`           | Standalone HTML/TypeScript build                     | Read and render the public notebook from Swarm           |
| `format/`                | Markdown specification, JSON Schemas, sample objects | Define the format independently of either implementation |
| `tests/` and `evidence/` | Contract checks, integration checks, public results  | Make every rubric claim reviewable                       |

Deploy the writer and reader as separate Vercel projects from their respective roots. The reader is a separate application, not a Next route or tab. It must also build and run with the writer directory absent. The new checkout lives in `rtd-5/fieldnote`, alongside the separate `rtd-5/folio` checkout, with its own Git history.

## User experience

1. Open Fieldnote and sign in with Swarm ID. No wallet funding or stamp purchase in the default flow.
2. Click `Record a sighting` and fill a short, accessible form. Species search has a small documented starter list plus manual scientific/common-name entry; it must not pretend to be a complete taxonomy service.
3. Enter a date and optional time, a named place, and meaningful coordinates. `Use my location` is optional; manual placement/coordinates remain available. Preserve timezone and location precision. Do not invent midnight or precise coordinates for uncertain historical records.
4. Optionally attach a bounded-size JPEG, PNG or WebP photo. Show a preview and useful validation before publishing.
5. Save. Display staged progress and retain the draft if the network fails. Report success only after network readback and notebook publication have been verified.
6. Browse the notebook by date, species and place. On reload, fetch the authoritative notebook from Swarm.
7. Click `Open in another reader`. The other deployment independently fetches the notebook and displays its records, locations and photos. Readers can bookmark or share this notebook link.

Use a field-journal visual direction: clear type, legible species names, compact observation cards and restrained nature colors. The reader should have a distinct layout, such as a searchable observation table and detail panel. Protocol details belong in an optional evidence panel, not required form inputs.

Published sightings are public. Make that visible before saving and use benign, clearly labeled demonstration observations. Location precision is part of the data model, not an undocumented display choice.

## Network and identity design

Use Swarm ID with `iframeOrigin: https://swarm-id.snaha.net` and `subsidisedGatewayUrl: https://api.gateway.ethswarm.org/`. Pin `@snaha/swarm-id` to the tested version, initially 0.4.1, and direct bee-js usage to 13.1.0. The published Swarm ID 0.4.1 package currently declares bee-js 11.x internally while the source repository has moved to 13.x. Do not force an override across that boundary. Verify the published client with the live identity proxy in the first milestone.

Load Swarm ID only in the browser. Handle initialization, popup opening and the subsequent connection callback separately: `connect()` opening a popup does not mean authentication is complete.

Every network write, including photo, sighting, index, descriptor and feed publication, must check the current authenticated identity and `connectionInfo.canUpload`. The form's disabled button is not the only guard. Recheck between stages and stop if the account changes.

The proposed notebook address is a public, versioned descriptor containing the writer feed owner, topic, feed encoding and format identifiers. Put its content reference in the reader URL. It contains no secret. The reader can be rebuilt or hosted elsewhere and still consume that descriptor.

Swarm ID derives different app keys for different origins. The reader therefore uses the explicit writer owner/topic descriptor; signing in on the reader origin does not discover the writer's notebook automatically. Create the writer's stable production origin early and keep it stable. The writer can rediscover its own notebook after sign-in using its app-key owner and the format's documented fixed notebook topic.

The signed feed belongs to the user's app-derived key, not a shared server key. Store observer identity and publishing app-key owner distinctly. Do not imply that a self-declared display name is cryptographically verified.

Proposed storage flow:

1. Read the latest notebook index from Swarm.
2. Upload optional photo bytes, then self-describing sighting JSON using `uploadData` with explicit public/unencrypted settings.
3. Download the uploaded bytes through `/bytes` and validate the record and photo digest/size.
4. Upload a new immutable notebook index containing record references and the previous index reference.
5. Recheck the current feed position. Publish the new index reference using the user's signed sequential feed only after all referenced content is available.
6. Read the feed and index back independently, then show the saved record.

First milestone must prove the exact wire encoding between Swarm ID's sequential raw-payload writer and the reader's pinned bee-js feed decoder. Use an unencrypted binary reference with the documented timestamp convention if interoperable. Record the actual verified encoding in the specification; do not blindly combine the two SDK examples.

Reader steps: fetch descriptor from `/bytes`, resolve its owner/topic feed using a standard SDK, fetch the index from `/bytes`, then fetch sighting/photo bytes from `/bytes`. Do not send raw bytes references to `/bzz`. No writer backend, database, cookies, localStorage catalogue, Swarm ID login or Folio module participates.

Browser storage may retain an unsaved draft or a bookmark, but cannot be the authoritative catalogue. Network failure must not appear as an empty notebook. Serialize writes within the app, check for a changed index before publishing, and reconcile a timeout by reading the feed before retrying. Do not claim distributed multi-writer conflict safety; one active publishing session is the initial scope.

The default path requires no Bee process or Cloudflare tunnel. Gateway retention is not exposed to the client, so do not claim permanent storage. A user-owned stamp/node path can be an extension after the required flow works; it is not a prerequisite for Problem 2.

## Stored format contract

Design this before the UI. Every sighting, notebook index and address descriptor carries its own format identifier and version in the serialized bytes.

Each sighting should contain:

- Format identifier and version, stable sighting ID and recording timestamp.
- Species common and scientific names; optional taxonomy identifier with its named source.
- Observation date, optional time, timezone/offset and declared time precision.
- Place label, WGS84 latitude/longitude, coordinate precision or uncertainty and location source.
- Observer display name/identity and publishing app-key owner, with their roles explained.
- Count, notes and optional media records containing Swarm reference, `bytes` endpoint family, MIME type, size, SHA-256 and caption/credit.

The index describes notebook ownership and contains record references. It must remain a network object, not a browser-only array. Specify size/count limits and unsupported-version behavior. The descriptor specifies feed discovery and how to find the current index.

Deliver `format/README.md`, separate JSON Schemas, valid examples, invalid/unsupported-version examples and a step-by-step retrieval specification. Include UTC/offset rules, coordinate ordering, identifier encoding, optional/null semantics and extension rules. A developer should be able to implement a third reader from these artifacts alone.

Reader parsing, validation, retrieval and rendering are independently written from that specification. Standard third-party libraries are fine. Do not import writer constants, helpers, schemas containing executable writer logic or storage modules. Sharing a standalone schema is allowed by the rubric, but the simplest proof is that the reader has no writer imports at all.

## Rubric and proof

These are the live workspace's eight technical checks, totaling 80 points. They are targets, not claimed results.

| Check                                         | Weight | Implementation and evidence                                                                                                                                                |
| --------------------------------------------- | -----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capability checked before uploads             |     12 | Guard every write and prove zero uploads for unauthenticated/unavailable states and mid-save capability loss                                                               |
| Upload path without a user stamp              |      6 | Fresh account with no drive successfully saves through the configured gateway                                                                                              |
| Format identifier and version in every record |     14 | Fetch real serialized bytes and validate them against the published contract                                                                                               |
| Independent reader                            |     14 | Build reader with writer source absent; read on a second origin with no writer code or API requests                                                                        |
| Matching endpoint family                      |     10 | Actual upload/download calls consistently use `/bytes` for raw objects and photos                                                                                          |
| No gateway pin/tag options                    |      6 | Test request options and inspect live request behavior; no pin/tag/ACT headers                                                                                             |
| Visible, specific failure reasons             |     10 | Distinguish sign-in needed, no upload capability, stamper failure, interrupted identity session, network timeout, missing record, malformed record and unsupported version |
| No tracked credentials                        |      8 | Scan source, docs, fixtures and tracked history before push; never capture auth URLs in evidence                                                                           |

The remaining 20-point qualitative criterion rewards real Swarm-backed reads, an independently useful reader, a substantive format specification and a product ordinary birders can use. Prioritize those over unrelated features.

## Acceptance demonstration

1. On the stable deployed writer origin, use an account with no personal stamp to save a sighting with a photo.
2. Record public references and independently validate the actual uploaded objects. Mark synthetic observations as demonstrations.
3. Close the writer. Open the bookmarked notebook link on the independent reader in a clean browser context, with the local Bee and tunnel off.
4. Verify the same species, date, timezone, coordinates, observer and photo without importing or exporting a file.
5. Add another sighting, then refresh the original reader link. It must discover the new index without generating a new notebook link.
6. Clear the writer's application cache and sign back in at the same production origin. Confirm it reconstructs the notebook from Swarm.
7. Demonstrate capability failure and retrieval failure without losing the draft or presenting false success/empty data.

Evidence should include public references, deployed writer/reader URLs, a short recording, reproducible verification commands, an import-boundary check, meaningful failure tests and a README table mapping the rubric to actual files. Local review remains qualitative; do not invent an official score.

## Build order and time budget

At planning time, approximately 11.5 hours remain. Budget about four hours for Problem 2, five for Problem 3 and the rest for final reviews/submission buffers. These are targets; unknown live integrations can move them.

| Stage                                          | Target | Exit condition                                                                                         |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| Repo boundaries, contract, stable deployments  | 30 min | Separate Problem 2 repo structure; documented object types; stable writer origin                       |
| Real Swarm ID and cross-reader round trip      | 60 min | Fresh stampless account writes, owner feed updates, independent reader resolves first and second saves |
| Birder workflow and reader experience          | 90 min | Form, photo, filters, accessible layouts and actionable errors work with network data                  |
| Verification, evidence and local rubric review | 60 min | All eight checks have evidence; failure paths and clean-context demo pass                              |

If the first network milestone fails, resolve the exact identity/gateway/encoding issue before expanding the UI. Preserve the required sighting, network storage, format and independent-reader work. Defer maps beyond basic usable location input, AI species recognition, social features, migration tools, edit history and advanced collaboration.

Reuse Folio's lessons, project conventions and general UI techniques, not its publisher/reader modules. In particular Folio's current standalone reader imports shared writer code and is not a compliant starting implementation for Problem 2's independence check.

When complete, prepare a separate Problem 2 submission draft against its own repo and use the per-problem workspace form. Do not overwrite Folio's Problem 1 repository through the event-wide CLI project record.

## Sources and verification status

- [Live Problem 2 brief and test cases](https://www.loops.house/road-to-devcon-v/workspace), read in the signed-in browser on 20 September 2026.
- Free evaluator prompt retrieved with `loops evaluate --event road-to-devcon-v --problem take-your-records-with-you --format json`; supplies the 20-point qualitative criterion. This did not run official judging.
- One problem knowledge-graph query checked identity, feeds and gateway constraints. It returned the sponsor API and gateway documentation as supporting sources.
- [Swarm ID Quick Start](https://swarm.snaha.net/docs/getting-started/).
- [Swarm ID API](https://swarm.snaha.net/docs/api/).
- [Swarm ID subsidised gateway](https://swarm.snaha.net/docs/subsidised-gateway/).
- [Public gateway source documentation](https://github.com/snaha/swarm-id/blob/7dbcfdf6bc047008936c4af61ba63a6a8f6eddba/docs-site/src/content/docs/public-gateway.mdx).
- [Origin-derived keys](https://swarm.snaha.net/docs/).
- Published `@snaha/swarm-id@0.4.1` package metadata and declaration files inspected without installing or changing dependencies. Capability and sequential feed APIs are present; live interoperability has since passed and is recorded in evidence/.

This plan does not constitute a submission or an official judging result.
