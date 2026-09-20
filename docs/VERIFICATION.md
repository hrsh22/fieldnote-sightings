# Verification status

Updated 20 September 2026. This records completed checks and remaining review work, not an official judging score.

## Completed live acceptance checks

The stable production writer and a fresh Fieldnote Demo Swarm ID account completed these checks:

1. Signed in through the embedded Swarm ID control. The account has no personal drive or stamp. The default sponsored gateway accepted the writes while the local Bee, keeper and Cloudflare tunnel were stopped.
2. Saved a clearly labeled synthetic Common Kingfisher sighting with an unchanged 1,310,793-byte JPEG. The writer reported success after content readback and feed confirmation.
3. The independent reader, on a separate Vercel origin, retrieved the record and photo from Swarm and verified their declared sizes and SHA-256 checksums. Its details preserved the species, observer, date-only precision, coordinates, location uncertainty, notes and photo attribution.
4. Reloaded the production writer. Sign-in persisted and the notebook was fetched from Swarm.
5. Saved a second synthetic Purple Sunbird sighting without a photo. The original reader link discovered feed index 1 and displayed both records. The second record retained count 2, 07:35 local time, UTC+05:30, WGS84 coordinates 18.5362/73.7858, and 500-metre location uncertainty.
6. Opened the original reader link in a new Chrome incognito window, with no writer or Swarm ID session. Both records and the photograph were retrieved and rendered successfully.
7. A separate command-line process, using the independent reader implementation and no credentials, verified both publications. Captured network objects confirm that the second index points back to the first and retains its record reference.

Public notebook: [Open the verified demonstration](https://fieldnote-reader-hrsh22.vercel.app/#notebook=b624c672831973e1ddcbce3b75f6f18d9dba31febca86d50fd11a966051cdba8).

See [evidence/](../evidence/) for timestamped verification outputs, exact stored JSON bytes and their manifest. The demo buttons resolve this real notebook; they do not load embedded sighting records.

### Sign-in issue found and fixed

The original custom button could open the identity popup but fail to deliver its connection back to the application under Chrome's storage partitioning. The writer now renders the SDK's embedded sign-in control, preserving the supported iframe/popup transport. The production sign-in and subsequent reload were verified after this fix. Browser security settings were not weakened.

## Automated checks

- 20 tests pass: capability guards before writes, a stampless connection, identity changes, checksum failures, notebook conflicts, uncertain-write reconciliation, network-backed reloads, photo metadata, and independent format parsing.
- Both applications typecheck and build for production.
- The reader dependency graph has no writer imports. A second CI job copies the reader outside the writer tree, installs only its dependencies, typechecks and builds it successfully.
- The source secret scan passes. Test account credentials are stored only in the ignored `.runtime/private` directory with owner-only filesystem permissions.

[GitHub Actions run 35495732030](https://github.com/hrsh22/fieldnote-sightings/actions/runs/35495732030) passed both jobs on implementation commit `7e7eec8`. Later evidence and demonstration-pointer updates are checked by the same workflow.

| Application        | Stable origin                                 |
| ------------------ | --------------------------------------------- |
| Writer             | https://fieldnote-sightings-hrsh22.vercel.app |
| Independent reader | https://fieldnote-reader-hrsh22.vercel.app    |

Run all checks from the repository root:

```sh
npm ci
npm test
npm run typecheck
npm run check:boundaries
npm run check:secrets
npm run build
```

Mocked tests establish failure-path behavior; the live acceptance checks above separately establish that the sponsor gateway accepted actual writes and the other application retrieved them.

## Remaining manual checks

- Mobile viewport inspection and a complete sign-out/sign-back-in after clearing writer application storage have not yet been completed. A normal writer reload and a reader incognito session passed.
- Capability-loss and malformed/checksum-failure behavior passed automated tests. Interactive browser demonstrations of those failures are still outstanding.
- No demo video or official judging result is claimed.

Chrome's native automation stopped returning page contents during the mobile inspection attempt. The completed checks above were observed before that failure. This limitation is recorded rather than treating unobserved interactions as successful.

## Independent network verification

```sh
npm run verify:notebook -- b624c672831973e1ddcbce3b75f6f18d9dba31febca86d50fd11a966051cdba8
# Optional: use another gateway origin as the second argument.
```

The verifier reports the feed index, object references, sizes, SHA-256 values and photo checks. It exits unsuccessfully if an object cannot be read or validated, and uses no account, credentials or local notebook catalogue. Availability still depends on the gateway and Swarm postage; these successful checks do not promise permanent storage.
