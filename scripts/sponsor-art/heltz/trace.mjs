/**
 * Traces the red splash on Heltz Driving Academy's front wing from the photo
 * of their real car (reference.jpg), and measures their gold.
 *
 * The red is picked out of the photo, the edges are smoothed, and potrace
 * turns it into an outline. (Their lettering is too small in this photo to
 * trace cleanly, so design.mjs sets it in the closest typefaces instead.)
 *
 * Writes splash.svg beside this file. Run again when Heltz sends a better
 * photo or their files:
 *   node scripts/sponsor-art/heltz/trace.mjs
 * Needs potrace (brew install potrace).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PHOTO = path.join(HERE, "reference.jpg");
const K = 6; // upscale before tracing
const scratch = mkdtempSync(path.join(tmpdir(), "heltz-trace-"));

/** A region of the photo, straightened and enlarged, as raw RGB. */
async function region({ left, top, width, height, angle = 0 }) {
  const { data, info } = await sharp(PHOTO)
    .extract({ left, top, width, height })
    .resize(width * K, height * K, { kernel: "lanczos3" })
    .rotate(angle, { background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function hsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max / 255];
}

/** A mask of the pixels `pick` keeps. */
function maskOf(img, pick) {
  const m = new Uint8Array(img.w * img.h);
  for (let i = 0; i < m.length; i++) {
    const [h, s, v] = hsv(
      img.data[i * 3],
      img.data[i * 3 + 1],
      img.data[i * 3 + 2],
    );
    m[i] = pick(h, s, v) ? 1 : 0;
  }
  return m;
}

/** Keeps the joined pieces of a mask that `keep(piece)` accepts. */
function pieces(m, w, h, keep) {
  const label = new Int32Array(m.length).fill(-1);
  const out = new Uint8Array(m.length);
  const stack = [];
  for (let start = 0; start < m.length; start++) {
    if (!m[start] || label[start] >= 0) continue;
    const list = [];
    stack.push(start);
    label[start] = start;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    while (stack.length) {
      const i = stack.pop();
      list.push(i);
      const x = i % w;
      const y = (i - x) / w;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j < 0 || j >= m.length || !m[j] || label[j] >= 0) continue;
        if (Math.abs((j % w) - x) > 1) continue;
        label[j] = start;
        stack.push(j);
      }
    }
    if (keep({ area: list.length, x0, y0, x1, y1 })) {
      for (const i of list) out[i] = 1;
    }
  }
  return out;
}

/** Smooths a mask's edges and closes small gaps (a blur, then a threshold). */
async function smooth(m, w, h, sigma) {
  const grey = Buffer.alloc(m.length);
  for (let i = 0; i < m.length; i++) grey[i] = m[i] ? 255 : 0;
  const { data } = await sharp(grey, {
    raw: { width: w, height: h, channels: 1 },
  })
    .blur(sigma)
    .threshold(128)
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) out[i] = data[i] > 127 ? 1 : 0;
  return out;
}

/** The mask's outlines as SVG path data, in the region's pixels. */
function trace(m, w, h, name, turd) {
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
    String(turd),
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
  return { transform, d };
}

/** The middle colour of the photo's pixels under a mask. */
function colourOf(img, m) {
  const ch = [[], [], []];
  for (let i = 0; i < m.length; i += 7) {
    if (!m[i]) continue;
    for (let k = 0; k < 3; k++) ch[k].push(img.data[i * 3 + k]);
  }
  const mid = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
  return `#${ch.map((a) => mid(a).toString(16).padStart(2, "0")).join("")}`;
}

/** Lifts a photo colour out of the daylight and shadow: fuller and brighter. */
function vivid(hex, sat = 1.25, val = 1.15) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [h, s, v] = hsv(r, g, b);
  const S = Math.min(1, s * sat);
  const V = Math.min(1, v * val);
  const c = V * S;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = V - c;
  const [R, G, B] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return `#${[R, G, B]
    .map((t) =>
      Math.round((t + m) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const warm = (h, s, v) => (h <= 52 || h >= 340) && s >= 0.42 && v >= 0.33;
const red = (h, s, v) => (h <= 14 || h >= 340) && s >= 0.6 && v >= 0.3;
const blue = (h, s, v) => h >= 205 && h <= 255 && s >= 0.35 && v >= 0.2;

// ---- the splash on the front wing -----------------------------------------------

const wing = await region({ left: 540, top: 118, width: 66, height: 48 });
const splashMask = await smooth(
  pieces(maskOf(wing, red), wing.w, wing.h, (p) => p.area > 3000),
  wing.w,
  wing.h,
  K * 0.5,
);
const tSplash = trace(splashMask, wing.w, wing.h, "splash", 300);
const splashColour = vivid(colourOf(wing, splashMask), 1.1, 1.25);
writeFileSync(
  path.join(HERE, "splash.svg"),
  [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${wing.w}" height="${wing.h}" viewBox="0 0 ${wing.w} ${wing.h}">`,
    `<!-- Traced from reference.jpg by trace.mjs: the red splash on Heltz's front wing (nose to the right). -->`,
    `<g id="splash" transform="${tSplash.transform}"><path d="${tSplash.d}" fill="${splashColour}"/></g>`,
    `</svg>`,
  ].join("\n"),
);

// The front's gold, measured off the front door and wing.
const front = await region({ left: 455, top: 120, width: 70, height: 60 });
const gold = vivid(
  colourOf(
    front,
    maskOf(front, (hh, s, v) => hh >= 30 && hh <= 50 && s > 0.6 && v > 0.5),
  ),
  1.05,
  1.1,
);
console.log("heltz colours", { splash: splashColour, gold });
