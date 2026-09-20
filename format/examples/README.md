# Format examples

These are schema and interoperability fixtures, not published Swarm observations. References use explicit placeholder hex values and must not be treated as live network evidence.

- `sighting.json`: valid day-precision demonstration record, with no invented observation time.
- `address.json`: valid portable descriptor.
- `notebook.json`: valid index whose size and SHA-256 describe the exact bytes in `sighting.json`; its content reference remains a placeholder.
- `unsupported-version.json`: syntactically valid JSON that a v1 reader must reject as an unsupported version.
- `invalid-location.json`: a v1 record with latitude outside WGS84 bounds, which a reader must reject.

JSON Schema describes structural constraints. The full [specification](../README.md) also defines cross-field checks, exact calendar dates, ownership, reference consistency and checksum validation.
