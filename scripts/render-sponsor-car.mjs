/**
 * Renders a school's paint on every board car with Blender: both sides, the
 * top and four views at the board camera's own tilt, plus one contact sheet.
 * For checking a school's art before it goes live, and for its sales deck.
 *
 * Needs Blender (brew install --cask blender) and the school's art built by
 * scripts/build-sponsor-art.mjs.
 *
 * Run:  node scripts/render-sponsor-car.mjs <id> [--styles] [--out <dir>]
 *   --styles  renders every style in scripts/sponsor-art/styles side by side
 *             (the board's own files are not touched), for choosing one
 *   out dir defaults to marketing/sponsors/<id>, which is never committed
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { NodeIO } from "@gltf-transform/core";
import {
  EXTMeshoptCompression,
  KHRMeshQuantization,
} from "@gltf-transform/extensions";
import { dequantize } from "@gltf-transform/functions";
import { MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";

const id = process.argv[2];
if (!id || id.startsWith("--")) {
  console.error(
    "Usage: node scripts/render-sponsor-car.mjs <id> [--styles] [--out <dir>]",
  );
  process.exit(1);
}
const ROOT = process.cwd();
const CARS = ["saloon", "hatchback", "wagon", "pickup", "suv"];
const outAt = process.argv.indexOf("--out");
const out = path.resolve(
  outAt > 0
    ? process.argv[outAt + 1]
    : path.join(ROOT, "marketing/sponsors", id),
);
const compare = process.argv.includes("--styles");
const BLENDER =
  [
    process.env.BLENDER,
    "/Applications/Blender.app/Contents/MacOS/Blender",
  ].find((p) => p && existsSync(p)) ?? "blender";

const scratch = mkdtempSync(path.join(tmpdir(), "sponsor-car-"));

// Blender's importer can't read meshopt-compressed files: hand it plain copies.
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
for (const car of CARS) {
  const doc = await io.read(
    path.join(ROOT, `public/assets/board/cars/${car}.glb`),
  );
  await doc.transform(dequantize());
  for (const ext of doc.getRoot().listExtensionsUsed()) ext.dispose();
  await new NodeIO().write(path.join(scratch, `${car}.glb`), doc);
}

function render(wrapDir, car, dir) {
  execFileSync(
    BLENDER,
    [
      "-b",
      "--factory-startup",
      "-P",
      path.join(ROOT, "scripts/blender/turntable.py"),
      "--",
      path.join(scratch, `${car}.glb`),
      path.join(wrapDir, `${car}-wrap4-hi.webp`),
      dir,
    ],
    { stdio: ["ignore", "ignore", "ignore"] },
  );
}

/** Tiles of renders in a grid, with a label on each row. */
async function sheet(rows, file) {
  const tileW = 520;
  const tileH = 347;
  const labelW = 170;
  const cols = Math.max(...rows.map((r) => r.tiles.length));
  const width = labelW + cols * tileW;
  const height = rows.length * tileH;
  const parts = [];
  for (const [r, row] of rows.entries()) {
    const label = `<svg xmlns="http://www.w3.org/2000/svg" width="${labelW}" height="${tileH}"><rect width="100%" height="100%" fill="#2a2926"/><text x="16" y="${tileH / 2}" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="700" fill="#ffffff">${row.label}</text></svg>`;
    parts.push({ input: Buffer.from(label), left: 0, top: r * tileH });
    for (const [c, tile] of row.tiles.entries()) {
      parts.push({
        input: await sharp(tile)
          .resize(tileW, tileH, { fit: "cover" })
          .toBuffer(),
        left: labelW + c * tileW,
        top: r * tileH,
      });
    }
  }
  await sharp({ create: { width, height, channels: 3, background: "#4f4c47" } })
    .composite(parts)
    .png()
    .toFile(file);
}

const SHOTS = ["side-left", "seat-1", "seat-3", "top"];
mkdirSync(out, { recursive: true });

if (compare) {
  const styles = readdirSync(path.join(ROOT, "scripts/sponsor-art/styles"))
    .filter((f) => f.endsWith(".mjs"))
    .map((f) => f.replace(/\.mjs$/, ""));
  const rows = [];
  for (const style of styles) {
    const art = path.join(scratch, `art-${style}`);
    execFileSync(
      "node",
      ["scripts/build-sponsor-art.mjs", id, "--style", style, "--out", art],
      { cwd: ROOT, stdio: "ignore" },
    );
    for (const car of CARS) {
      const dir = path.join(out, "styles", style, car);
      render(path.join(art, id), car, dir);
      rows.push({
        label: `${style}\n${car}`.replace("\n", " · "),
        tiles: SHOTS.map((s) => path.join(dir, `${s}.png`)),
      });
    }
  }
  await sheet(rows, path.join(out, "styles.png"));
  console.log(
    "styles sheet",
    path.relative(ROOT, path.join(out, "styles.png")),
  );
} else {
  const wrapDir = path.join(ROOT, "public/assets/board/sponsors", id);
  const rows = [];
  for (const car of CARS) {
    if (!existsSync(path.join(wrapDir, `${car}-wrap4-hi.webp`))) continue;
    const dir = path.join(out, car);
    render(wrapDir, car, dir);
    rows.push({
      label: car,
      tiles: SHOTS.map((s) => path.join(dir, `${s}.png`)),
    });
  }
  await sheet(rows, path.join(out, "sheet.png"));
  console.log("rendered", path.relative(ROOT, out));
}
