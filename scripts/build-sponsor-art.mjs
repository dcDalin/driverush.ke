/**
 * Builds each sponsoring school's paint for every board car, and its logo.
 *
 * A school is a brand file, scripts/sponsor-art/<id>.json: its colours, its
 * wordmark and tagline, and a style (scripts/sponsor-art/styles/<style>.mjs).
 * The style draws the paint for each car from that car's measured landmarks
 * (public/assets/board/sponsors/<car>-wrap.json), so it fits a saloon, a
 * hatchback, a wagon, a pickup and an SUV alike.
 *
 * A school's own designer can paint a car by hand instead, on that car's
 * template (public/assets/board/sponsors/<car>-template.svg), saved as
 * scripts/sponsor-art/<id>/<car>.png or .svg: it replaces the style for that car.
 *
 * Writes public/assets/board/sponsors/<id>/:
 *   <car>-wrap4-hi.webp, -wrap4-lo.webp  the paint, for strong and weak phones (near-lossless).
 *                                    "wrap4" goes with the cars' `?v=4` UVs: a new layout
 *                                    means new names, so no cache pairs old art with new UVs.
 *   topboard.webp                      the name board on the car's roof
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
export const CARS = [
  "saloon",
  "hatchback",
  "wagon",
  "pickup",
  "suv",
  "van",
  "lorry",
  "minibus",
];

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

/**
 * How a school's pictures are saved: near-lossless WebP. Ordinary lossy WebP
 * halves the colour detail, which smears exactly what a school pays for: red
 * on white, blue lettering, the hard edge of a stripe. Near-lossless keeps
 * every edge and colour, at about half the size of true lossless.
 */
const CRISP = { nearLossless: true, quality: 40, effort: 6 };

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
  return k.svg(defs, body, {
    shade: designFile(brand, styleName).includes("/styles/"),
  });
}

/**
 * A school's pictures for the classroom walls: `banner-hi.webp` and
 * `banner-lo.webp` (3.2 x 0.6 m on the wall), and `poster-<id>.webp`.
 */
async function roomArt(brand, fonts, dir) {
  if (!brand.design || option("style")) return;
  const design = await import(pathToFileURL(path.join(SRC, brand.design)).href);
  if (design.banner) {
    const svg = Buffer.from(design.banner({ fonts }));
    for (const [name, size] of [
      ["hi", 4096],
      ["lo", 2048],
    ]) {
      await sharp(svg, { density: 144 })
        .resize(size, Math.round((size * 384) / 2048), { fit: "fill" })
        .flatten({ background: "#ffffff" })
        .webp(CRISP)
        .toFile(path.join(dir, `banner-${name}.webp`));
    }
  }
  for (const poster of design.posters?.({ fonts }) ?? []) {
    await sharp(Buffer.from(poster.svg), { density: 72 })
      .resize({ width: 1024 })
      .flatten({ background: "#ffffff" })
      .webp(CRISP)
      .toFile(path.join(dir, `poster-${poster.id}.webp`));
  }
  // The name board on the car's roof (app/components/board/top-board.ts).
  if (design.topBoard) {
    await sharp(Buffer.from(design.topBoard({ fonts })), { density: 72 })
      .resize({ width: 1024 })
      .flatten({ background: "#ffffff" })
      .webp(CRISP)
      .toFile(path.join(dir, "topboard.webp"));
  }
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
  // The white logo is painted large on the board and engraved on the plates,
  // so it is kept at twice the size of the colour one.
  const size =
    on === "mono" ? { width: 2048, height: 888 } : { width: 1024, height: 444 };
  if (brand.design) {
    const design = await import(
      pathToFileURL(path.join(SRC, brand.design)).href
    );
    if (design.logo) {
      return sharp(Buffer.from(design.logo({ fonts, mono: on === "mono" })), {
        density: 144,
      })
        .resize({ ...size, fit: "inside" })
        .png()
        .toBuffer();
    }
  }
  const w = 1200;
  const h = 520;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${lockup(brand, fonts, { x: 30, y: 30, w: w - 60, h: h - 60 }, { on })}</svg>`;
  return sharp(Buffer.from(svg), { density: 144 })
    .resize({ ...size, fit: "inside" })
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
    const { width, height } = JSON.parse(
      readFileSync(path.join(ASSETS, `${car}-wrap.json`), "utf8"),
    ).atlas;
    const full = await sharp(input(art), { density: 72 })
      .resize(width, height, { fit: "fill" })
      .flatten({ background: brand.colors.base })
      .png()
      .toBuffer();
    // The board's copies: the full picture for strong phones, half for weak
    // ones. See CRISP: a school's edges and colours stay its own.
    await sharp(full)
      .webp(CRISP)
      .toFile(path.join(dir, `${car}-wrap4-hi.webp`));
    await sharp(full)
      .resize(width / 2, height / 2, { kernel: "lanczos3" })
      .webp(CRISP)
      .toFile(path.join(dir, `${car}-wrap4-lo.webp`));
  }

  // The classroom's walls (app/lib/board/room.ts): a banner and posters, when
  // the school's design draws them.
  await roomArt(brand, fonts, dir);

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
