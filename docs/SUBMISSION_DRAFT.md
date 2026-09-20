# Problem 2 submission draft

Status: prepared for review, not submitted. Use the Problem 2 workspace form; do not replace Folio's Problem 1 repository through the event-wide CLI record.

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

The repository includes the Next.js/TypeScript writer, independent TypeScript reader, complete format contract and schemas, 20 automated tests, an isolated reader build in CI, and reproducible live network evidence. A fresh account published two clearly labeled demonstration sightings and a photograph; the original reader link discovered the second update, and an incognito session retrieved both records and the photo. The local Bee and tunnel were stopped for these checks.

Published observations are public. Storage availability depends on Swarm and its postage; the project does not claim permanent retention or distributed multi-writer safety. See docs/VERIFICATION.md for completed checks and outstanding manual review items.

**Suggested walkthrough:**

1. Open the writer's demonstration notebook.
2. Open the Common Kingfisher record and view its photograph, date-only precision, approximate location and attribution.
3. Open the same notebook in Open Fieldbook. Inspect the Purple Sunbird's local time, UTC offset and location uncertainty.
4. Expand the network evidence and inspect a raw JSON record through `/bytes`.
5. Run `npm run verify:notebook -- <public-reference>` or review the captured evidence and CI results.
