# Optional application use and development

Repository review starts with the [source and evidence map](REPOSITORY_REVIEW.md). These commands are for developing or trying the applications; the submitted evidence can be inspected directly in GitHub.

## Try it

1. Open the writer and sign in with Swarm ID. Use its default network settings for the sponsored upload path; a personal stamp or local Bee process is not required.
2. Record a species, observation date, place, coordinates and coordinate uncertainty. Time, notes and a JPEG, PNG or WebP photo are optional.
3. Save. Fieldnote checks your current upload capability before every write and verifies the uploaded content before confirming the notebook update.
4. Select **Open in another reader**. The second application fetches the descriptor, signed feed, index, records and photo directly from Swarm, without signing in or importing a file.
5. Bookmark that reader link. It resolves the latest notebook index, so subsequent sightings appear at the same address.

Sightings and coordinates are public. Use approximate locations for sensitive species. Demonstration records are labeled. Sponsored storage has no client-visible retention guarantee.

## Run locally

Use Node.js 22 and npm.

```sh
npm ci
npm run dev
# In another terminal:
npm run dev:reader
```

Writer: `http://127.0.0.1:3001`. Reader: `http://127.0.0.1:4174`.

No application secret or environment file is required. For a local reader link, optionally set `NEXT_PUBLIC_READER_URL=http://127.0.0.1:4174` in `apps/fieldnote/.env.local`. A Swarm ID app key is derived per origin: local and deployed writers have different notebooks even when using the same identity. Keep the production writer origin stable.

```sh
npm test
npm run typecheck
npm run check:boundaries
npm run check:secrets
npm run build
```
