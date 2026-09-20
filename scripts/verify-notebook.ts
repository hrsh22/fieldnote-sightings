import { parseLink } from "../apps/reader/src/model.ts";
import {
  checkedBytes,
  DEFAULT_GATEWAY,
  gatewayOrigin,
  readNotebook,
} from "../apps/reader/src/network.ts";

const input = process.argv[2];
if (!input) {
  console.error(
    "Usage: npm run verify:notebook -- <notebook-link-or-reference> [gateway-origin]",
  );
  process.exit(2);
}
try {
  const reference = parseLink(input);
  const gateway = gatewayOrigin(process.argv[3] ?? DEFAULT_GATEWAY);
  const result = await readNotebook(reference, gateway);
  const records = [];
  for (const { record, entry } of result.records) {
    if (record.photo) await checkedBytes(gateway, record.photo);
    records.push({
      id: record.id,
      reference: entry.reference,
      sha256: entry.sha256,
      bytes: entry.bytes,
      format: record.format,
      version: record.version,
      species: record.species,
      demonstration: record.demonstration,
      photo: record.photo
        ? {
            reference: record.photo.reference,
            bytes: record.photo.bytes,
            sha256: record.photo.sha256,
            verified: true,
          }
        : null,
    });
  }
  console.log(
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        gateway,
        addressReference: reference,
        owner: result.descriptor.feed.owner,
        topic: result.descriptor.feed.topic,
        feedIndex: result.feedIndex,
        indexReference: result.indexReference,
        endpointFamily: "bytes",
        records,
        failures: result.failures,
        complete: result.failures.length === 0,
      },
      null,
      2,
    ),
  );
  if (result.failures.length) process.exitCode = 1;
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Notebook verification failed.",
  );
  process.exitCode = 1;
}
