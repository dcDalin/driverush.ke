/**
 * Pictures for the board's classroom (app/lib/board/room.ts) that are not a
 * school's: the road-signs chart framed on the teaching wall. The chart is
 * the one the road-signs trainer shows (with Pelican Signs' logo, as there),
 * made small enough for a wall in the 3D scene.
 *
 * Writes public/assets/board/room/signs-chart.webp.
 * Run: node scripts/build-room-art.mjs
 */
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public/assets/board/room");
mkdirSync(OUT, { recursive: true });

const chart = JSON.parse(
  readFileSync(path.join(ROOT, "app/data/road-signs-pelican.json"), "utf8"),
).imageSrc;
await sharp(path.join(ROOT, "public", chart), { density: 96 })
  .resize(1024, 576, { fit: "contain", background: "#ffffff" })
  .flatten({ background: "#ffffff" })
  .webp({ quality: 86, effort: 6 })
  .toFile(path.join(OUT, "signs-chart.webp"));
console.log("room art ->", path.relative(ROOT, OUT));
