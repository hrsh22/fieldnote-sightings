# Problem 2 submission draft

Status: repository submitted through the Problem 2 workspace on 20 September 2026, following user approval. Loops displayed Saved and two submissions; after reloading, Problem 2 retained the Fieldnote URL and Problem 1 retained Folio. The form accepts a repository only; the description below is supporting project copy, not a claim that additional metadata fields were submitted.

**Problem:** Take your records with you

**Name:** Fieldnote

**Tagline:** A birding notebook whose records have a life beyond one app.

**Repository:** https://github.com/hrsh22/fieldnote-sightings

**Demo:** https://fieldnote-sightings-hrsh22.vercel.app

**Independent reader:** https://fieldnote-reader-hrsh22.vercel.app

**Public notebook:** https://fieldnote-reader-hrsh22.vercel.app/#notebook=b624c672831973e1ddcbce3b75f6f18d9dba31febca86d50fd11a966051cdba8

**Description:**

Fieldnote is a Swarm-backed birding notebook. Sign in with Swarm ID, record a species, observation date or time, place, coordinates, location accuracy, count and notes, and optionally attach a photograph. The default sponsored upload path requires no personal stamp. Each write checks the current upload capability, and success is reported only after content readback and notebook-feed confirmation.

Records carry their own format identifier, version, meaning, photo metadata and attribution in the actual stored bytes. A stable public descriptor discovers the latest signed notebook index. Open Fieldbook, a separately built and deployed reader with its own parser and network code, retrieves those bytes without signing in, importing a file, accessing the writer or depending on a local catalogue.

The repository includes the Next.js/TypeScript writer, independent TypeScript reader, complete format contract and schemas, 29 automated tests, an isolated reader build in CI, and reproducible live network evidence. A fresh account published two clearly labeled demonstration sightings and a photograph; the original reader link discovered the second update, and an incognito session retrieved both records and the photo. The local Bee and tunnel were stopped for these checks.

Published observations are public. The format contract defines the single-writer publication procedure and record validation. See [verification evidence](VERIFICATION.md) for completed checks.

**Repository review path:**

1. Read [the source map](REPOSITORY_REVIEW.md) for all eight technical checks and the qualitative criterion.
2. Inspect [exact stored objects](../evidence/objects/) and the [format contract](../format/README.md).
3. Follow the writer network load and publish functions, then the independent reader's own parser and retrieval code.
4. Inspect publication failure tests, draft recovery tests and the isolated-reader CI job.
5. Read the captured publication receipts and retry-safety verification record.
