import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import {
  AddressSchema,
  NotebookSchema,
  SightingSchema,
} from "../apps/fieldnote/src/lib/format.ts";
await mkdir("format", { recursive: true });
for (const [name, schema] of [
  ["address", AddressSchema],
  ["notebook", NotebookSchema],
  ["sighting", SightingSchema],
] as const) {
  const document = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io: "input",
  });
  Object.assign(document, {
    $id: `https://raw.githubusercontent.com/hrsh22/fieldnote-sightings/main/format/${name}.schema.json`,
    title: `Fieldnote ${name} version 1`,
  });
  await writeFile(
    `format/${name}.schema.json`,
    JSON.stringify(document, null, 2) + "\n",
  );
}
console.log(
  "Published JSON Schemas generated. Cross-field rules are specified in format/README.md.",
);
