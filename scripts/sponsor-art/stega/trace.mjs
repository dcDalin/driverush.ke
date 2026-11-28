/**
 * Traces Stega Driving School's logo (logo.png, from their own site): the
 * emblem (a red wing, a blue lightning bolt and a blue wing), STEGA in red,
 * DRIVING SCHOOL in blue and "Est 1995" in red.
 *
 * Each colour is picked out of the picture row band by row band, its edges
 * smoothed, and potrace turns it into outlines.
 *
 * Writes stega.svg beside this file, with five parts (emblem-red,
 * emblem-blue, stega, school, est), each with its box in the traced
 * picture's pixels (the logo five times enlarged). Run again when Stega
 * sends their artwork files:
 *   node scripts/sponsor-art/stega/trace.mjs
 * Needs potrace (brew install potrace).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOGO = path.join(HERE, "logo.png");
const K = 5; // enlarged before tracing
const scratch = mkdtempSync(path.join(tmpdir(), "stega-trace-"));

const meta = await sharp(LOGO).metadata();
const { data, info } = await sharp(LOGO)
  .resize({ width: meta.width * K, kernel: "lanczos3" })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const w = info.width;
const h = info.height;

function maskOf(pick, rows) {
  const m = new Uint8Array(w * h);
  for (let y = Math.round(rows[0] * K); y < Math.round(rows[1] * K); y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      m[i] = pick(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) ? 1 : 0;
    }
  }
  return m;
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

function boxOf(m) {
  let x0 = w;
  let y0 = h;
  let x1 = 0;
  let y1 = 0;
  for (let i = 0; i < m.length; i++) {
    if (!m[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1 - x0, y1 - y0].join(" ");
}

function trace(m, name) {
  const pgm = Buffer.alloc(m.length);
  for (let i = 0; i < m.length; i++) pgm[i] = m[i] ? 0 : 255; // potrace traces black
  const file = path.join(scratch, `${name}.pgm`);
  writeFileSync(
    file,
    Buffer.concat([Buffer.from(`P5\n${w} ${h}\n255\n`), pgm]),
  );
  const svgFile = path.join(scratch, `${name}.svg`);
  execFileSync("potrace", [
    file,
    "-b",
    "svg",
    "--flat",
    "-t",
    String(K * K * 4),
    "-a",
    "1.0",
    "-O",
    "0.4",
    "-u",
    "1",
    "-o",
    svgFile,
  ]);
  const svg = readFileSync(svgFile, "utf8");
  const transform = /<g transform="([^"]+)"/.exec(svg)[1];
  const d = [...svg.matchAll(/ d="([^"]+)"/g)].map((x) => x[1]).join(" ");
  return `<g id="${name}" data-box="${boxOf(m)}" transform="${transform}"><path d="${d}" fill-rule="evenodd"/></g>`;
}

// Their red is about #e8212b, their blue #1e69a7, on white.
const isRed = (r, g, b) => r > 150 && r - g > 80 && r - b > 70;
const isBlue = (r, g, b) => b > 110 && b - r > 50;

// The logo's rows (in logo.png's own pixels): the emblem, STEGA, DRIVING
// SCHOOL, Est 1995.
const EMBLEM = [100, 290];
const NAME = [295, 418];
const SCHOOL = [418, 478];
const EST = [478, 520];

const sigma = K * 0.5;
// The lettering is drawn from a small picture: smoothed harder, it loses the
// picture's ripples and keeps its corners.
const textSigma = K * 1.1;
const parts = [
  ["emblem-red", await smooth(maskOf(isRed, EMBLEM), sigma)],
  ["emblem-blue", await smooth(maskOf(isBlue, EMBLEM), sigma)],
  ["stega", await smooth(maskOf(isRed, NAME), textSigma)],
  ["school", await smooth(maskOf(isBlue, SCHOOL), textSigma)],
  ["est", await smooth(maskOf(isRed, EST), textSigma)],
];

writeFileSync(
  path.join(HERE, "stega.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<!-- Traced from logo.png by trace.mjs: Stega Driving School's logo, by part. -->
${parts.map(([name, m]) => trace(m, name)).join("\n")}
</svg>
`,
);
console.log(`stega.svg ${w} x ${h}`);
