import { build, context } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
for (const name of ["index.html", "style.css", "demo.json"])
  await copyFile(name, `dist/${name}`);
const options = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "esm",
  outfile: "dist/app.js",
  target: "es2022",
  minify: true,
  sourcemap: false,
};
if (process.argv.includes("--serve")) {
  const ctx = await context(options);
  await ctx.watch();
  await ctx.serve({ servedir: "dist", host: "127.0.0.1", port: 4174 });
  console.log("Independent reader: http://127.0.0.1:4174");
} else {
  await build(options);
  console.log("Independent reader built without writer imports.");
}
