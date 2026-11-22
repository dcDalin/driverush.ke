#!/usr/bin/env node
/**
 * Photograph each board vehicle from `/tools/car-thumb` into
 * `public/assets/board/cars/thumbs/<id>.webp`: the small pictures beside the
 * names in the board's car menu.
 *
 * Every vehicle is taken from the same place and shrunk by the same amount,
 * then stood on the same ground line in a picture of the same size. So the
 * van and the lorry stay bigger than the six cars, as they are on the board.
 *
 * Usage:
 *   npm run dev                  # terminal 1
 *   npm run build:car-thumbs     # terminal 2
 *   DEV_URL=http://localhost:5183 npm run build:car-thumbs
 *
 * After a vehicle's model changes, run this again and bump the `?v=` on
 * `thumb` in `app/lib/board/cars.ts` and in `public/sw.js`. The script prints
 * the picture size to put in `CAR_THUMB_SIZE` there.
 *
 * Requires Google Chrome, as `build-og-images.mjs` does.
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import sharp from "sharp";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "assets", "board", "cars", "thumbs");
const DEV_URL = process.env.DEV_URL ?? "http://localhost:5173";

/** Keep in step with WIDTH and HEIGHT in `app/routes/tools/car-thumb.tsx`. */
const WIDTH = 640;
const HEIGHT = 400;
/** Taken large, then shrunk: smoother edges than a small shot. */
const SCALE = 2;
/** How wide the saved pictures are: twice the widest slot in the menu. */
const OUT_WIDTH = 320;
const MAX_ATTEMPTS = 4;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

async function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await stat(candidate);
      return candidate;
    } catch {
      // try the next one
    }
  }
  throw new Error(
    `No Chrome found. Set CHROME_PATH to your browser binary. Looked in:\n  ${CHROME_CANDIDATES.join("\n  ")}`,
  );
}

/** The vehicles, read from the app's own list so the two cannot drift. */
async function carIds() {
  const source = await readFile(
    path.join(ROOT, "app", "lib", "board", "cars.ts"),
    "utf8",
  );
  const list = source.slice(
    source.indexOf("export const BOARD_CARS"),
    source.indexOf("] as const;"),
  );
  return [...list.matchAll(/^\s{4}id: "([a-z]+)"/gm)].map((m) => m[1]);
}

/** One vehicle, cut to its own edges. Null if the shot came back empty. */
async function shoot(chrome, id, tmp, attempt) {
  const png = path.join(tmp, `${id}.png`);
  await execFileAsync(
    chrome,
    [
      "--headless=new",
      "--enable-unsafe-swiftshader",
      "--hide-scrollbars",
      "--run-all-compositor-stages-before-draw",
      "--disable-new-content-rendering-timeout",
      // A clear page, so only the vehicle is in the picture.
      "--default-background-color=00000000",
      `--force-device-scale-factor=${SCALE}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      `--virtual-time-budget=${12000 * attempt}`,
      `--screenshot=${png}`,
      `${DEV_URL}/tools/car-thumb?car=${id}`,
    ],
    { maxBuffer: 1024 * 1024 * 16 },
  );
  const { channels } = await sharp(png).stats();
  if (channels.length < 4 || channels[3].max === 0) return null;
  const { data, info } = await sharp(png)
    .trim()
    .png()
    .toBuffer({ resolveWithObject: true });
  return { id, data, width: info.width, height: info.height };
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const ids = await carIds();
  if (!ids.length) throw new Error("No vehicles found in cars.ts.");
  if (only.length) {
    // The pictures share one scale, so they are always taken together.
    throw new Error("This takes every vehicle at once; run it with no names.");
  }

  const chrome = await findChrome();
  try {
    const res = await fetch(`${DEV_URL}/tools/car-thumb`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    throw new Error(
      `Can't reach ${DEV_URL}/tools/car-thumb (${err.message}). Start the app first:\n  npm run dev`,
    );
  }

  const tmp = await mkdtemp(path.join(os.tmpdir(), "car-thumbs-"));
  const shots = [];
  try {
    for (const id of ids) {
      process.stdout.write(`  ${id.padEnd(10)} `);
      let shot = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !shot; attempt += 1) {
        shot = await shoot(chrome, id, tmp, attempt);
        if (!shot) process.stdout.write(`(blank, retry ${attempt}) `);
      }
      if (!shot) {
        throw new Error(
          `${id} rendered blank. Check ${DEV_URL}/tools/car-thumb?car=${id} in a real browser.`,
        );
      }
      console.log(`${shot.width}×${shot.height}`);
      shots.push(shot);
    }

    const shrink = OUT_WIDTH / Math.max(...shots.map((s) => s.width));
    const outHeight = Math.ceil(
      Math.max(...shots.map((s) => s.height)) * shrink,
    );
    await mkdir(OUT_DIR, { recursive: true });
    for (const shot of shots) {
      const width = Math.round(shot.width * shrink);
      const height = Math.round(shot.height * shrink);
      const small = await sharp(shot.data).resize(width, height).toBuffer();
      const out = path.join(OUT_DIR, `${shot.id}.webp`);
      await sharp({
        create: {
          width: OUT_WIDTH,
          height: outHeight,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        // Centred, wheels on the bottom edge.
        .composite([
          {
            input: small,
            left: Math.round((OUT_WIDTH - width) / 2),
            top: outHeight - height,
          },
        ])
        .webp({ quality: 82, alphaQuality: 90 })
        .toFile(out);
      const { size } = await stat(out);
      console.log(
        `  ${shot.id.padEnd(10)} ${(size / 1024).toFixed(1)} kB  →  ${path.relative(ROOT, out)}`,
      );
    }
    console.log(
      `\n${shots.length} pictures at ${OUT_WIDTH}×${outHeight}. CAR_THUMB_SIZE in app/lib/board/cars.ts must say the same.`,
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
