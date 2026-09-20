# Fieldnote portable sightings, version 1

This is the complete public wire-format contract. A reader needs this document, ordinary Swarm tooling and a notebook link. It does not need the Fieldnote application, its account session, its source code or its browser storage.

All objects are UTF-8 JSON. Field names and format identifiers are case-sensitive. Each object declares `format` and integer `version: 1` in its stored bytes. A reader must reject an unsupported format/version instead of silently guessing. Readers may ignore unknown fields within a supported version. Missing required fields and invalid values must produce a visible error. All fields in the accompanying schemas are required; nullable fields use JSON `null`, not an omitted property or an empty string.

The schemas are [address.schema.json](address.schema.json), [notebook.schema.json](notebook.schema.json) and [sighting.schema.json](sighting.schema.json). Cross-field rules below supplement those schemas. [Examples](examples/) illustrate the format; their placeholder references are not live network objects.

## Object graph and retrieval

1. Extract `notebook` from the URL fragment, for example `https://reader.example.org/#notebook=<address-reference>`. A bare address reference is also valid input. This parameter is a public content address, not a key or an authentication token.
2. Fetch `GET <swarm-api-origin>/bytes/<address-reference>`. Decode it as an `org.fieldnote.address` descriptor.
3. Use its feed owner and topic to resolve the latest sequential Swarm feed update. Verify the SOC signature and address using a standard Swarm SDK. The payload is an eight-byte big-endian unsigned Unix timestamp in seconds, followed by the **32 binary bytes** of the notebook index reference. It is not a hex string and is not encrypted.
4. Fetch that index reference through `/bytes`. Decode `org.fieldnote.notebook`. Its `owner` must match the feed owner, and its `addressReference` must equal the descriptor reference used to open it.
5. Fetch each index entry's `reference` through `/bytes`. Before parsing, compare the exact byte length and SHA-256 with the index entry. Decode `org.fieldnote.sighting`; its ID must match the entry ID and its publishing owner must match the feed owner.
6. When displaying a photo, fetch its reference through `/bytes`, enforce its declared size and verify its SHA-256. Display it only after that check succeeds. A missing photograph must be visibly unavailable, not replaced by an unrelated image.

The gateway is selected by the reader, not by untrusted record data. Default implementation: `https://api.gateway.ethswarm.org`. Do not confuse it with the web browsing gateway. Reads are public and require no account, credentials, gift code, writer server or local catalogue. Every content object and photograph in this format is raw bytes; do not retrieve these references through `/bzz`.

References and SHA-256 values are 64 lowercase hexadecimal characters with no `0x` prefix. Ethereum addresses are 40 lowercase hexadecimal characters with no prefix. A 128-character encrypted Swarm reference is not a version 1 public reference and must be rejected.

### Sequential feed details

The descriptor uses `feed.type: "sequence"` and `feed.payload: "timestamp-be64+reference32"`. The SOC identifier at sequence index `i` is `keccak256(topicBytes || uint64BigEndian(i))`. Sequence numbers start at zero. Feed discovery and signature verification should use an established SDK rather than trusting unsigned HTTP headers.

Fieldnote's one-notebook-per-app-key topic is SHA-256 over the UTF-8 string `org.fieldnote.notebook/v1`:

```
5c1b3b9ee99ed5dd14ee3013dcb37476b86e36cc0f9cd36c9006bb5bf7c9287f
```

A reader must use the topic supplied by the descriptor instead of importing this constant from a writer. In bee-js 13.1.0, `bee.feed.makeReader(topic, owner).downloadReference()` reads this reference encoding. Swarm ID publishes it with `makeSequentialFeedWriter({ topic }).uploadRawPayload(referenceBytes, { index, hasTimestamp: true })`, omitting encryption keys and pin/tag options. Live interoperability evidence, when recorded, belongs in `evidence/`.

## Address descriptor

| Field             | Meaning                                            |
| ----------------- | -------------------------------------------------- |
| `format`          | `org.fieldnote.address`                            |
| `version`         | Integer `1`                                        |
| `feed.owner`      | Public address of the key signing notebook updates |
| `feed.topic`      | Public 32-byte feed topic, encoded as hexadecimal  |
| `feed.type`       | `sequence`                                         |
| `feed.payload`    | `timestamp-be64+reference32`                       |
| `contentEndpoint` | `bytes`                                            |

Maximum size: 4,096 bytes. The descriptor is immutable and has no current-index field, so its address remains stable as the notebook changes. The owner and topic are enough to discover future updates.

Swarm ID app keys are derived per origin. The feed owner is the user's **app key**, not necessarily the identity's account address. Logging in to a different reader origin does not reproduce the writer's key. A public descriptor solves discovery without sharing a secret. Reading across apps is supported; signing updates from another origin requires explicit identity/key portability work and is outside this version's scope.

## Notebook index

| Field                 | Meaning                                                       |
| --------------------- | ------------------------------------------------------------- |
| `format`, `version`   | `org.fieldnote.notebook`, integer `1`                         |
| `title`               | Nonblank display title, at most 160 characters                |
| `owner`               | Must equal the signed feed owner                              |
| `updatedAt`           | ISO 8601 UTC timestamp ending in `Z`                          |
| `addressReference`    | This notebook's immutable descriptor reference                |
| `previous`            | Previous index reference, or `null` for the first publication |
| `records`             | Up to 1,000 entries; entry IDs must be unique                 |
| `records[].id`        | UUID matching the sighting ID                                 |
| `records[].reference` | Raw Swarm reference for the sighting JSON                     |
| `records[].bytes`     | Exact byte length, 1 to 32,768                                |
| `records[].sha256`    | SHA-256 of the exact stored UTF-8 bytes                       |

Maximum index size: 524,288 bytes. Entry order is newest publication first; observation date may be historical. Do not infer observation time from array order. Readers can offer their own sorting. Follow only the current index for ordinary browsing; `previous` is provenance, not an instruction to recursively download an unbounded history.

## Sighting

| Field                      | Meaning                                                                    |
| -------------------------- | -------------------------------------------------------------------------- |
| `format`, `version`        | `org.fieldnote.sighting`, integer `1`                                      |
| `id`                       | UUID, stable identity for this sighting                                    |
| `recordedAt`               | When this record was authored, ISO 8601 UTC ending in `Z`                  |
| `species.commonName`       | Nonblank common name, at most 160 characters                               |
| `species.scientificName`   | Scientific name, at most 160 characters; empty string means not recorded   |
| `observed.date`            | Real Gregorian calendar date, `YYYY-MM-DD`                                 |
| `observed.time`            | Local `HH:mm`, or `null` for a date-only observation                       |
| `observed.utcOffset`       | Signed offset, `+HH:mm` or `-HH:mm`, or `null`                             |
| `observed.timezone`        | IANA timezone label when available, otherwise `null`                       |
| `observed.precision`       | `day` or `minute`                                                          |
| `place.name`               | Nonblank human-readable location, at most 200 characters                   |
| `place.latitude`           | Decimal degrees, north positive, range -90 to 90                           |
| `place.longitude`          | Decimal degrees, east positive, range -180 to 180                          |
| `place.datum`              | `WGS84`                                                                    |
| `place.uncertaintyMeters`  | Approximate accuracy radius, 1 to 500,000 metres                           |
| `place.source`             | `manual` or `device`                                                       |
| `observer.name`            | Nonblank self-declared observer name, at most 120 characters               |
| `observer.identityAddress` | Public account identity address, distinct from app-key ownership           |
| `publisher.owner`          | App-key address that owns the signed notebook feed                         |
| `publisher.appOrigin`      | Writing app's URL origin, at most 300 characters; informational only       |
| `count`                    | Integer bird count, 1 to 100,000                                           |
| `notes`                    | Plain text, at most 3,000 characters; may be empty                         |
| `demonstration`            | Boolean; `true` means synthetic/test data, not a genuine field observation |
| `photo`                    | Photo object below, or `null`                                              |

For `precision: "day"`, time, UTC offset and timezone must all be `null`. Never turn an unknown time into midnight. For `precision: "minute"`, time and UTC offset must be present; the timezone label is optional. The stored offset is authoritative for interpreting the recorded time. The writer currently uses the browser's local timezone for timed entries and labels that choice in the form.

Coordinates are named fields, not an ambiguous comma-separated string. A large uncertainty radius explicitly represents an approximate place. Place names, observation date, observer and taxonomy names all travel with the record; no application-local lookup table is required to display a meaningful observation. The writer's short species suggestion list is convenience data, not a comprehensive taxonomic authority.

All text is data. Render it as text, never HTML or script. An observer name and account identity field are claims in a record; the notebook feed signature proves the publishing app key, not the truth of the biological observation or the human's identity.

## Photo metadata

| Field       | Meaning                                                      |
| ----------- | ------------------------------------------------------------ |
| `reference` | Public Swarm raw-byte reference                              |
| `endpoint`  | `bytes`                                                      |
| `mediaType` | `image/jpeg`, `image/png` or `image/webp`                    |
| `bytes`     | Exact byte length, 1 to 5,242,880                            |
| `sha256`    | Checksum of the exact original uploaded photo bytes          |
| `caption`   | Plain text, at most 500 characters; may be empty             |
| `credit`    | Plain text attribution, at most 200 characters; may be empty |

Photos are stored separately from their JSON record. A missing photo does not make the observation's species/date/location unknowable. SVG and HTML are not supported image types. License/source details that exceed the credit field can be included in the record's notes.

## Publication, failure and availability

The writer gates every write on current authentication and upload capability. It uploads and reads back the photo, record, descriptor and index before advancing the feed. The feed becomes the public commit point. A timeout is reconciled by reading the latest feed before reporting uncertainty. The app serializes same-origin tabs with Web Locks and checks for a changed feed before publishing, but does not claim a distributed lock across devices. Use one active writer at a time.

Readers must bound object sizes, time out network requests and report invalid, unsupported, missing or corrupt records. An incomplete notebook is visibly incomplete. Never silently present a failed retrieval as an empty notebook.

Version 1 is public and unencrypted. A notebook link is a public locator, not a confidentiality boundary. The subsidised gateway's postage lifetime is not visible through its API. This format provides portability and interpretation, not a promise that storage will last forever.

## Reference resources

- [Swarm ID API](https://swarm.snaha.net/docs/api/)
- [Swarm ID gateway behavior](https://swarm.snaha.net/docs/subsidised-gateway/)
- [bee-js upload and download namespaces](https://bee-js.ethswarm.org/docs/upload-download/)
- [bee-js v13 migration](https://bee-js.ethswarm.org/docs/migrating-to-v13/)

The independent reader implementation is in `apps/reader/src/`. It imports only its own code and the public bee-js package. The repository's import-boundary check verifies that property from an actual bundle.
