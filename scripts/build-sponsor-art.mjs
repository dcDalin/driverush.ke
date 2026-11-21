/**
 * Builds each sponsoring school's paint for every board car, and its logo.
 *
 * A school is a brand file, scripts/sponsor-art/<id>.json: its colours, its
 * wordmark and tagline, and a style (scripts/sponsor-art/styles/<style>.mjs).
 * The style draws the paint for each car from that car's measured landmarks
 * (public/assets/board/sponsors/<car>-wrap.json), so it fits a saloon, an SUV
 * and a pickup alike.
 *
 * A school's own designer can paint a car by hand instead, on that car's
 * template (public/assets/board/sponsors/<car>-template.svg), saved as
 * scripts/sponsor-art/<id>/<car>.png or .svg: it replaces the style for that car.
 *
 * Writes public/assets/board/sponsors/<id>/:
 *   <car>-2048.webp, <car>-1024.webp   the paint, for strong and weak phones
 *   <car>.png                          full size, for the review tool and Blender
 *   logo.png                           the lockup in colour, transparent
 *   logo-mono.png                      the lockup in white, for brass and board paint
 *
 * Run:  node scripts/build-sponsor-art.mjs [id ...] [--style <style>] [--out <dir>] [--cars saloon,suv]
 *       (every school and car if none given; --style and --out try another
 *       style without touching the files the board loads)
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

import { kit, loadFont, lockup } from "./sponsor-art/lib.mjs";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "scripts/sponsor-art");
const FONTS = path.join(SRC, "fonts");
const ASSETS = path.join(ROOT, "public/assets/board/sponsors");
export const CARS = ["saloon", "suv", "pickup"];

function option(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}
const flags = new Set(["--style", "--out", "--cars"]);
const ids = process.argv
  .slice(2)
  .filter((a, i, all) => !a.startsWith("--") && !flags.has(all[i - 1]));
const schools = ids.length
  ? ids
  : readdirSync(SRC)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
const out = path.resolve(option("out") ?? ASSETS);
const cars = option("cars")?.split(",") ?? CARS;

const fontCache = new Map();
function fontsFor(brand) {
  const names = [
    ...(brand.fonts ?? []),
    brand.wordmark?.font,
    brand.tagline?.font,
  ].filter(Boolean);
  const fonts = {};
  for (const name of names) {
    if (!fontCache.has(name)) fontCache.set(name, loadFont(FONTS, name));
    fonts[name] = fontCache.get(name);
  }
  return fonts;
}

const input = (source) =>
  typeof source === "string" && source.trimStart().startsWith("<")
    ? Buffer.from(source)
    : source;

async function paintFor(id, brand, fonts, car, styleName) {
  const own = ["svg", "png"]
    .map((ext) => path.join(SRC, id, `${car}.${ext}`))
    .find(existsSync);
  if (own && !option("style")) return own;
  const layout = JSON.parse(
    readFileSync(path.join(ASSETS, `${car}-wrap.json`), "utf8"),
  );
  const style = await import(pathToFileURL(designFile(brand, styleName)).href);
  const k = kit(layout, fonts);
  const { defs, body } = style.default({ k, brand, fonts });
  return k.svg(defs, body);
}

/**
 * Where a school's paint is drawn: its own design (`design` in its brand
 * file, a copy of its real car), or one of our styles.
 */
function designFile(brand, styleName) {
  return !option("style") && brand.design
    ? path.join(SRC, brand.design)
    : path.join(SRC, "styles", `${styleName}.mjs`);
}

async function logoOf(brand, fonts, on) {
  if (brand.design) {
    const design = await import(
      pathToFileURL(path.join(SRC, brand.design)).href
    );
    if (design.logo) {
      return sharp(Buffer.from(design.logo({ fonts, mono: on === "mono" })), {
        density: 144,
      })
        .resize({ width: 1024, height: 444, fit: "inside" })
        .png()
        .toBuffer();
    }
  }
  const w = 1200;
  const h = 520;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${lockup(brand, fonts, { x: 30, y: 30, w: w - 60, h: h - 60 }, { on })}</svg>`;
  return sharp(Buffer.from(svg), { density: 144 })
    .resize({ width: 1024, height: 444, fit: "inside" })
    .png()
    .toBuffer();
}

for (const id of schools) {
  const brand = JSON.parse(readFileSync(path.join(SRC, `${id}.json`), "utf8"));
  const fonts = fontsFor(brand);
  const styleName = option("style") ?? brand.style ?? "sweep";
  const dir = path.join(out, id);
  mkdirSync(dir, { recursive: true });

  for (const car of cars) {
    const art = await paintFor(id, brand, fonts, car, styleName);
    const full = await sharp(input(art), { density: 72 })
      .resize(2048, 1024, { fit: "fill" })
      .flatten({ background: brand.colors.base })
      .png()
      .toBuffer();
    writeFileSync(path.join(dir, `${car}.png`), full);
    for (const size of [2048, 1024]) {
      await sharp(full)
        .resize(size, size / 2, { kernel: "lanczos3" })
        .webp({ quality: 90, effort: 6 })
        .toFile(path.join(dir, `${car}-${size}.webp`));
    }
  }

  writeFileSync(
    path.join(dir, "logo.png"),
    await logoOf(brand, fonts, "light"),
  );
  writeFileSync(
    path.join(dir, "logo-mono.png"),
    await logoOf(brand, fonts, "mono"),
  );
  console.log(
    id,
    brand.design && !option("style") ? brand.design : styleName,
    "->",
    path.relative(ROOT, dir),
    cars.join(", "),
  );
}
