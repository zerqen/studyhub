import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import catalog from "./worker/catalog.json" with { type: "json" };

for (const directory of ["dist/server/", "dist/.openai/"]) {
  await mkdir(new URL(directory, import.meta.url), { recursive: true });
}
const source = await readFile(new URL("worker/index.js", import.meta.url), "utf8");
const bundled = source.replace(
  'import catalog from "./catalog.json" with { type: "json" };',
  () => `const catalog = ${JSON.stringify(catalog)};`,
);
await writeFile(new URL("dist/server/index.js", import.meta.url), bundled);
await copyFile(new URL(".openai/hosting.json", import.meta.url), new URL("dist/.openai/hosting.json", import.meta.url));
