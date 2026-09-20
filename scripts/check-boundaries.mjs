import { build } from "esbuild";
import path from "node:path";
const result = await build({
  entryPoints: ["apps/reader/src/main.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  metafile: true,
});
const inputs = Object.keys(result.metafile.inputs)
  .filter((name) => !name.startsWith("(disabled):"))
  .map((name) => path.resolve(name));
const reader = path.resolve("apps/reader") + path.sep;
const dependencies = path.resolve("node_modules") + path.sep;
const forbidden = inputs.filter(
  (name) => !name.startsWith(reader) && !name.startsWith(dependencies),
);
if (forbidden.length)
  throw new Error(
    `Reader imports outside its own application and third-party dependencies: ${forbidden.join(", ")}`,
  );
console.log(
  `Reader independence verified: ${inputs.filter((name) => name.startsWith(reader)).length} reader modules; zero writer imports.`,
);
