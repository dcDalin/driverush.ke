/**
 * Renders the saloon in a school's paint with Blender: four views at the
 * board camera's tilt, both sides and the top. For checking a new school's
 * art before it goes live, and for the school's sales deck.
 *
 * Needs Blender (brew install --cask blender) and the school's art built by
 * scripts/build-sponsor-art.mjs.
 *
 * Run:  node scripts/render-sponsor-car.mjs <id> [out dir]
 *       (out dir defaults to marketing/sponsors/<id>, which is never committed)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import {
  EXTMeshoptCompression,
  KHRMeshQuantization,
} from "@gltf-transform/extensions";
import { dequantize } from "@gltf-transform/functions";
import { MeshoptDecoder } from "meshoptimizer";

const [id, outArg] = process.argv.slice(2);
if (!id) {
  console.error("Usage: node scripts/render-sponsor-car.mjs <id> [out dir]");
  process.exit(1);
}
const ROOT = process.cwd();
const wrap = path.join(ROOT, "public/assets/board/sponsors", id, "wrap.png");
if (!existsSync(wrap))
  throw new Error(`no ${wrap}: run build-sponsor-art.mjs ${id}`);
const out = path.resolve(outArg ?? path.join(ROOT, "marketing/sponsors", id));

const BLENDER = [
  process.env.BLENDER,
  "/Applications/Blender.app/Contents/MacOS/Blender",
  "blender",
].find((p) => p && (p === "blender" || existsSync(p)));

// Blender's importer can't read meshopt-compressed files: hand it a plain copy.
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(
  path.join(ROOT, "public/assets/board/cars/saloon.glb"),
);
await doc.transform(dequantize());
for (const ext of doc.getRoot().listExtensionsUsed()) ext.dispose();
const plain = path.join(
  mkdtempSync(path.join(tmpdir(), "sponsor-car-")),
  "saloon.glb",
);
await new NodeIO().write(plain, doc);

execFileSync(
  BLENDER,
  [
    "-b",
    "--factory-startup",
    "-P",
    path.join(ROOT, "scripts/blender/turntable.py"),
    "--",
    plain,
    wrap,
    out,
  ],
  { stdio: ["ignore", "ignore", "inherit"] },
);
console.log("rendered", path.relative(ROOT, out));
