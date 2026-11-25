import { build } from "esbuild";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "dist-electron");
mkdirSync(outDir, { recursive: true });

await Promise.all([
  build({
    entryPoints: [path.join(root, "electron/main.ts")],
    outfile: path.join(outDir, "main.cjs"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["electron"],
    sourcemap: false,
  }),
  build({
    entryPoints: [path.join(root, "electron/preload.ts")],
    outfile: path.join(outDir, "preload.cjs"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["electron"],
    sourcemap: false,
  }),
]);

const iconSrc = path.join(root, "build/icon.png");
if (existsSync(iconSrc)) {
  copyFileSync(iconSrc, path.join(outDir, "icon.png"));
}

console.log("Built Electron main + preload bundles.");
