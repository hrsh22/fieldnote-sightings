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
8. Signed out of the writer, cleared its origin-specific localStorage and sessionStorage, reloaded, and signed back in with the same identity. Both sightings and the original reader address returned from Swarm.
9. Inspected both applications at a 375-pixel responsive viewport. Fixed reader page overflow caused by a hidden table heading, then checked the deployed reader, its horizontally scrolling table, the writer landing page and the sighting form.
10. Entered an invalid reader link and then a real sighting reference in place of a notebook address. The reader showed distinct, specific errors and recovered when the valid notebook address was restored.
11. Checked the deployed species-name fix: Common Kingfisher filled Alcedo atthis; changing the common name to Unidentified warbler cleared that scientific name.

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

## Review and submission

Fieldnote's repository was submitted to Problem 2 through the Loops workspace after explicit user approval. The saved URL survived a page reload, and Folio remained separately selected for Problem 1. See [submission record](../evidence/submission.json).

The [Loops evaluator review](LOOPS_EVALUATION.md) records the source review, weighted criteria, fixed issues and remaining limitations. The evaluator command supplies a free review prompt; it does not return an official score.

The remaining optional evidence work is a short walkthrough recording. Capability-loss, checksum-failure and conflict cases have automated coverage; not every negative scenario was manually reenacted. Chrome's earlier control failure was resolved sufficiently to complete the mobile and sign-out/recovery checks above.

## Independent network verification

```sh
npm run verify:notebook -- b624c672831973e1ddcbce3b75f6f18d9dba31febca86d50fd11a966051cdba8
# Optional: use another gateway origin as the second argument.
```

The verifier reports the feed index, object references, sizes, SHA-256 values and photo checks. It exits unsuccessfully if an object cannot be read or validated, and uses no account, credentials or local notebook catalogue. Availability still depends on the gateway and Swarm postage; these successful checks do not promise permanent storage.
