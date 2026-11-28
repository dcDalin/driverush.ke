/**
 * Traces the outline of Petanns Driving School's emblem (logo.jpg) for the
 * places it is shown in one colour: engraved on the brass plates and painted
 * on the board. Everything that is not the white ground is kept as one
 * shape, so the lettering on its arcs shows as cut-outs.
 *
 * In colour, the emblem is shown as their own picture (it has a photograph
 * of a car in it, which a tracing would flatten).
 *
 * Writes emblem.svg beside this file. Run again when Petanns sends their
 * artwork files:
 *   node scripts/sponsor-art/petanns/trace.mjs
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
const K = 5; // enlarged before tracing
const scratch = mkdtempSync(path.join(tmpdir(), "petanns-trace-"));

const { data, info } = await sharp(LOGO)
  .resize({ width: 512 * K, kernel: "lanczos3" })
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

const isInk = (r, g, b) => Math.min(r, g, b) < 205;

const ink = await smooth(maskOf(isInk, [0, 512]), K * 0.45);

writeFileSync(
  path.join(HERE, "emblem.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<!-- Traced from logo.jpg by trace.mjs: the outline of Petanns' emblem, for one colour. -->
${trace(ink, "ink")}
</svg>
`,
);
console.log(`emblem.svg ${w} x ${h}`);
