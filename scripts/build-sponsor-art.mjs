/**
 * Turns each sponsoring school's art into the files the board loads.
 *
 * A school's art comes one of two ways:
 *   - drawn by its designer on the saloon's wrap template
 *     (public/assets/board/sponsors/saloon-template.svg) and saved as
 *     scripts/sponsor-art/<id>/wrap.png or wrap.svg, with logo.png / logo.svg
 *     beside it; or
 *   - drawn in code, by scripts/sponsor-art/<id>.mjs (see helz.mjs), until the
 *     school sends its own files.
 *
 * Writes public/assets/board/sponsors/<id>/:
 *   wrap-1024.webp, wrap-512.webp   the car's paint, for strong and weak phones
 *   wrap.png                        full size, for the review tool and Blender
 *   logo.png                        full colour, transparent
 *   logo-mono.png                   white on transparent, for brass and board paint
 *
 * Run:  node scripts/build-sponsor-art.mjs [id ...]   (every school if none given)
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

const ROOT = process.cwd();
const SRC = path.join(ROOT, "scripts/sponsor-art");
const OUT = path.join(ROOT, "public/assets/board/sponsors");
const layout = JSON.parse(
  readFileSync(path.join(OUT, "saloon-wrap.json"), "utf8"),
);

const asked = process.argv.slice(2);
const ids = asked.length
  ? asked
  : [
      ...new Set(
        readdirSync(SRC)
          .filter(
            (f) =>
              f.endsWith(".mjs") ||
              existsSync(path.join(SRC, f, "wrap.png")) ||
              existsSync(path.join(SRC, f, "wrap.svg")),
          )
          .map((f) => f.replace(/\.mjs$/, "")),
      ),
    ].filter((id) => id !== "fonts" && id !== "lib");

/** A picture as an image sharp can read: SVG text, or a file. */
function input(source) {
  return typeof source === "string" && source.trimStart().startsWith("<")
    ? Buffer.from(source)
    : source;
}

/** The school's art, from its designer's files or its code. */
async function artOf(id) {
  const dir = path.join(SRC, id);
  const file = (name) =>
    ["svg", "png"]
      .map((ext) => path.join(dir, `${name}.${ext}`))
      .find(existsSync);
  if (file("wrap")) {
    return { wrap: file("wrap"), logo: file("logo") };
  }
  const code = path.join(SRC, `${id}.mjs`);
  if (!existsSync(code)) throw new Error(`no art for "${id}"`);
  const mod = await import(pathToFileURL(code).href);
  return mod.default({ layout, fonts: path.join(SRC, "fonts") });
}

for (const id of ids) {
  const art = await artOf(id);
  const dir = path.join(OUT, id);
  mkdirSync(dir, { recursive: true });
  const { width, height } = layout.atlas;

  // The paint, full size, then smaller copies for the board.
  const full = await sharp(input(art.wrap), { density: 72 })
    .resize(width, height, { fit: "fill" })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  writeFileSync(path.join(dir, "wrap.png"), full);
  for (const size of [1024, 512]) {
    await sharp(full)
      .resize(size, size / 2, { kernel: "lanczos3" })
      .webp({ quality: 86, effort: 6 })
      .toFile(path.join(dir, `wrap-${size}.webp`));
  }

  // The logo in colour, and in white for engraving and paint.
  if (art.logo) {
    const logo = await sharp(input(art.logo), { density: 144 })
      .resize({ width: 1024, height: 512, fit: "inside" })
      .png()
      .toBuffer();
    writeFileSync(path.join(dir, "logo.png"), logo);
    const mono = art.logoMono
      ? await sharp(input(art.logoMono), { density: 144 })
          .resize({ width: 1024, height: 512, fit: "inside" })
          .png()
          .toBuffer()
      : await sharp(logo)
          .ensureAlpha()
          .composite([
            {
              input: {
                create: {
                  width: 1,
                  height: 1,
                  channels: 4,
                  background: "#ffffff",
                },
              },
              tile: true,
              blend: "in",
            },
          ])
          .png()
          .toBuffer();
    writeFileSync(path.join(dir, "logo-mono.png"), mono);
  }
  console.log(id, "->", path.relative(ROOT, dir));
}
