// Готовит файлы компилятора для браузера: копирует пакет в public/ и сжимает большие файлы.
// В git они не попадают и собираются из node_modules при каждой сборке.
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createGzip, constants } from "node:zlib";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "node_modules/@yowasp/clang/gen");
const pkg = JSON.parse(await readFile(path.join(root, "node_modules/@yowasp/clang/package.json"), "utf8"));
const parent = path.join(root, "public/wasm/compiler");
const target = path.join(parent, pkg.version);
const manifestPath = path.join(target, "manifest.json");

if (existsSync(manifestPath)) {
  console.log(`Компилятор ${pkg.version} уже подготовлен`);
} else {
  await rm(parent, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  let total = 0;
  for (const name of await readdir(source)) {
    const from = path.join(source, name);
    if (/\.(wasm|tar)$/.test(name)) {
      const to = path.join(target, `${name}.gz`);
      await pipeline(createReadStream(from), createGzip({ level: constants.Z_BEST_SPEED + 5 }), createWriteStream(to));
      total += (await stat(to)).size;
    } else {
      await copyFile(from, path.join(target, name));
    }
  }
  await writeFile(manifestPath, JSON.stringify({ version: pkg.version, total }));
  console.log(`Компилятор ${pkg.version}: ${(total / 1048576).toFixed(1)} МБ в сжатом виде`);
}
