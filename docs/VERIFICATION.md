# Verification status

Updated 20 September 2026. This document records evidence, not an official judging score.

## Automated checks

- 20 tests pass: capability guards before each write, a stampless connection, identity changes, checksum failures, notebook conflicts, uncertain-write reconciliation, network-backed reloads, photo metadata, and the independent format parser.
- Both applications typecheck.
- Both applications have completed production builds and deployed to separate Vercel origins. Source changes made afterward require a final deployment refresh.
- The reader dependency graph contains its own three source modules and third-party dependencies, with no imports from the writer.
- The source secret scan passes. Local test account credentials live only in the ignored `.runtime/private` directory with owner-only filesystem permissions.

Run all checks from the repository root:

```sh
npm ci
npm test
npm run typecheck
npm run check:boundaries
npm run check:secrets
npm run build
```

The mocked publication tests prove the application's guard and reconciliation behavior. They do not prove that the live sponsor gateway accepted an upload.

## Live checks still required

- Complete the dedicated test Swarm ID account and confirm sign-in at the stable writer origin.
- Save a clearly marked demonstration record and photo through the sponsored gateway with no personal stamp.
- Record the public descriptor, index, record and photo references and verify the actual network bytes.
- Read the notebook at the independent reader origin with no writer session.
- Save a second record and verify that the original reader link discovers the new feed index.
- Confirm that signing back into the writer reconstructs the notebook from Swarm.
- Review desktop and mobile layouts and the actual error states in the browser.

No completed live upload or cross-reader round trip is claimed yet. `demo.json` intentionally has no notebook reference until the public demonstration has passed these checks.
