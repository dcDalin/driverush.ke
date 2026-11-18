#!/usr/bin/env node
/**
 * Draw every icon from the DR mark in `app/lib/brand-mark.ts`: favicons, the
 * Apple touch icon, the Android and maskable app icons, and a plain logo SVG.
 * Change the mark or its colours there, then run this and commit the files.
 *
 *   npm run build:brand
 *
 * The icon is the mark on an ink tile: cream D, bright red R. At 16 and 32
 * pixels the D drops its road dashes (`D_SIMPLE_PATH`), which only blur it.
 *
 * What each file is for:
 *   favicon.svg               browser tab, any size (modern browsers)
 *   favicon.ico               browser tab, 16/32/48 (older browsers, Windows)
 *   favicon-16x16.png, -32x32 browser tab, explicit sizes
 *   apple-touch-icon.png      iPhone home screen. Square: iOS rounds it.
 *   android-chrome-192/512    the installed app's icon, rounded tile
 *   pwa/icon-maskable-192/512 Android's own shape cut from a full square
 *   logo.svg, logo-dark.svg   the mark alone, for light and for dark
 *                             backgrounds: the site's <Logo>, the social
 *                             cards, and anyone who needs the logo
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  D_PATH,
  D_SIMPLE_PATH,
  MARK_COLORS,
  MARK_HEIGHT,
  MARK_WIDTH,
  R_GRADIENT,
  R_PATH,
  TILE_COLOR,
} from "../app/lib/brand-mark.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");

/** The mark's two paths, filled in one theme's colours. */
function mark(theme, { simple = false } = {}) {
  const c = MARK_COLORS[theme];
  const g = R_GRADIENT;
  return (
    `<defs><linearGradient id="r" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}">` +
    `<stop offset="0" stop-color="${c.r[0]}"/><stop offset="1" stop-color="${c.r[1]}"/>` +
    `</linearGradient></defs>` +
    `<path fill="${c.d}" fill-rule="evenodd" d="${simple ? D_SIMPLE_PATH : D_PATH}"/>` +
    `<path fill="url(#r)" d="${R_PATH}"/>`
  );
}

/**
 * The mark centred on an ink square, drawn on a 512 grid.
 * `share`: the mark's width against the tile's. `radius`: corner rounding
 * against the tile's side, 0 for a full square.
 */
function tile({ share, radius, simple = false }) {
  const V = 512;
  const w = V * share;
  const s = w / MARK_WIDTH;
  const h = MARK_HEIGHT * s;
  const x = ((V - w) / 2).toFixed(2);
  const y = ((V - h) / 2).toFixed(2);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${V} ${V}">` +
    `<rect width="${V}" height="${V}" rx="${V * radius}" fill="${TILE_COLOR}"/>` +
    `<g transform="translate(${x} ${y}) scale(${s.toFixed(4)})">${mark("dark", { simple })}</g>` +
    `</svg>`
  );
}

/**
 * Tiles per use. Small favicons give the mark more of the tile and round
 * less; the maskable one keeps it inside the middle circle Android always
 * shows (radius 40% of the side): at 0.62 its corners reach about 35%.
 */
const TAB = { share: 0.86, radius: 0.2, simple: true };
const TAB_16 = { share: 0.92, radius: 0.16, simple: true };
const APP = { share: 0.74, radius: 0.22 };
const APPLE = { share: 0.7, radius: 0 };
const MASKABLE = { share: 0.62, radius: 0 };

async function png(svg, size) {
  return sharp(Buffer.from(svg), { density: 72 * Math.max(1, size / 64) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** An .ico holding PNGs, which every browser since IE 11 reads. */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, at);
    header.writeUInt8(size >= 256 ? 0 : size, at + 1);
    header.writeUInt8(0, at + 2);
    header.writeUInt8(0, at + 3);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

async function out(file, data) {
  const to = path.join(PUBLIC, file);
  await mkdir(path.dirname(to), { recursive: true });
  await writeFile(to, data);
  console.log(`  ${file.padEnd(30)} ${(data.length / 1024).toFixed(1)} kB`);
}

async function main() {
  await out("favicon.svg", tile(TAB));
  const tab16 = await png(tile(TAB_16), 16);
  const tab32 = await png(tile(TAB), 32);
  const tab48 = await png(tile(TAB), 48);
  await out("favicon-16x16.png", tab16);
  await out("favicon-32x32.png", tab32);
  await out(
    "favicon.ico",
    ico([
      { size: 16, data: tab16 },
      { size: 32, data: tab32 },
      { size: 48, data: tab48 },
    ]),
  );
  await out("apple-touch-icon.png", await png(tile(APPLE), 180));
  await out("android-chrome-192x192.png", await png(tile(APP), 192));
  await out("android-chrome-512x512.png", await png(tile(APP), 512));
  await out("pwa/icon-maskable-192.png", await png(tile(MASKABLE), 192));
  await out("pwa/icon-maskable-512.png", await png(tile(MASKABLE), 512));
  for (const [file, theme] of [
    ["logo.svg", "light"],
    ["logo-dark.svg", "dark"],
  ]) {
    await out(
      file,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK_WIDTH} ${MARK_HEIGHT}">${mark(theme)}</svg>`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
