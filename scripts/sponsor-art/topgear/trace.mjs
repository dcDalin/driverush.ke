/**
 * Traces Top Gear Driving School's "TG" mark (a T and a G with gear wheels
 * between them) from their logo (logo.jpg). The same mark is scattered over
 * their car in white and gold, so one tracing serves the logo and the paint.
 *
 * The blue of the letters and gears is picked out of the picture, the edges
 * are smoothed, and potrace turns it into an outline. The small yellow and
 * red wheels inside the gears are left as holes.
 *
 * Writes tg.svg beside this file. Run again when Top Gear sends their
 * artwork files:
 *   node scripts/sponsor-art/topgear/trace.mjs
 * Needs potrace (brew install potrace).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOGO = path.join(HERE, "logo.jpg");
/** The mark's corner of the logo, in its pixels. */
const MARK = { left: 0, top: 18, width: 218, height: 262 };
const K = 6; // enlarged before tracing
const scratch = mkdtempSync(path.join(tmpdir(), "topgear-trace-"));

const { data, info } = await sharp(LOGO)
  .extract(MARK)
  .resize(MARK.width * K, MARK.height * K, { kernel: "lanczos3" })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const w = info.width;
const h = info.height;

// The letters and gears are blue with a thin red edge on yellow: keep what
// is clearly more blue than red or green, and the red edge that touches it.
const blue = new Uint8Array(w * h);
for (let i = 0; i < blue.length; i++) {
  const r = data[i * 3];
  const g = data[i * 3 + 1];
  const b = data[i * 3 + 2];
  blue[i] = b > r + 25 && b > g + 25 ? 1 : 0;
}

/** Smooths a mask's edges and closes small gaps (a blur, then a threshold). */
async function smooth(m, sigma) {
  const grey = Buffer.alloc(m.length);
  for (let i = 0; i < m.length; i++) grey[i] = m[i] ? 255 : 0;
  const out = await sharp(grey, { raw: { width: w, height: h, channels: 1 } })
    .blur(sigma)
    .threshold(128)
    .extractChannel(0)
    .raw()
    .toBuffer();
  return Uint8Array.from(out, (v) => (v > 127 ? 1 : 0));
}

const mask = await smooth(blue, K * 0.9);

const pgm = Buffer.alloc(mask.length);
for (let i = 0; i < mask.length; i++) pgm[i] = mask[i] ? 0 : 255; // potrace traces black
const file = path.join(scratch, "tg.pgm");
writeFileSync(file, Buffer.concat([Buffer.from(`P5\n${w} ${h}\n255\n`), pgm]));
const svgFile = path.join(scratch, "tg.svg");
execFileSync("potrace", [
  file,
  "-b",
  "svg",
  "--flat",
  "-t",
  String(K * K * 6),
  "-a",
  "1.0",
  "-O",
  "0.4",
  "-u",
  "1",
  "-o",
  svgFile,
]);
const traced = readFileSync(svgFile, "utf8");
const transform = /<g transform="([^"]+)"/.exec(traced)[1];
const d = [...traced.matchAll(/ d="([^"]+)"/g)].map((x) => x[1]).join(" ");

writeFileSync(
  path.join(HERE, "tg.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<!-- Traced from logo.jpg by trace.mjs: Top Gear's TG mark with its gear wheels. -->
<g id="tg" transform="${transform}"><path d="${d}" fill-rule="evenodd"/></g>
</svg>
`,
);
console.log(`tg.svg ${w} x ${h}, ${d.length} characters of outline`);
