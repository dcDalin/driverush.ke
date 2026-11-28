#!/usr/bin/env node
/**
 * Take the installed app's install screenshots, into `public/pwa/`. Chrome on
 * Android shows them in a richer install sheet ("app store" style) instead of
 * the one-line prompt. The app's icons are drawn by `build-brand-assets.mjs`.
 *
 * Headless Chrome takes the pictures from the running app, the same way
 * `build-og-images.mjs` captures the social cards.
 *
 * Usage:
 *   npm run dev                 # terminal 1
 *   npm run build:pwa           # terminal 2
 *   DEV_URL=http://localhost:5731 npm run build:pwa
 *
 * Requires Google Chrome. Keep the names in step with
 * `public/manifest.webmanifest`.
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "pwa");
const DEV_URL = process.env.DEV_URL ?? "http://localhost:5730";

/**
 * `width`×`height` are CSS pixels, `scale` the device pixel ratio: a phone
 * page laid out at 540 wide comes out 1080×1920, the size Chrome lists.
 * Not 360 at 3x: headless Chrome will not make a window under about 500
 * wide, and lays the page out wider than the picture.
 * `settleMs` lets fonts, data and (for the game) WebGL finish; `minBytes` is
 * the same blank-frame tripwire as the social cards.
 */
const SHOTS = [
  {
    file: "screen-board",
    url: "/model-town-board",
    width: 540,
    height: 960,
    scale: 2,
    settleMs: 6000,
    minBytes: 60_000,
  },
  // The game in a driving school's paint, as learners see it; a different
  // school in each picture, so none is favoured (`?sponsor=` pins one).
  {
    file: "screen-drive",
    url: "/model-town-board/play?level=four-lane-1-3&sponsor=topgear",
    width: 540,
    height: 960,
    scale: 2,
    settleMs: 30000,
    minBytes: 200_000,
  },
  {
    file: "screen-drive-wide",
    url: "/model-town-board/play?level=four-lane-1-3&sponsor=aa",
    width: 1280,
    height: 720,
    scale: 1.5,
    settleMs: 30000,
    minBytes: 200_000,
  },
];

const MAX_ATTEMPTS = 3;

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

async function shoot(chrome, { url, out, width, height, scale, settleMs }) {
  // A fresh profile each time: no saved progress, no service worker.
  const profile = await mkdtemp(path.join(os.tmpdir(), "dr-pwa-"));
  try {
    await execFileAsync(
      chrome,
      [
        "--headless=new",
        "--enable-unsafe-swiftshader",
        "--hide-scrollbars",
        // Light theme, whatever the machine is set to.
        "--blink-settings=preferredColorScheme=1",
        "--run-all-compositor-stages-before-draw",
        "--disable-new-content-rendering-timeout",
        `--user-data-dir=${profile}`,
        `--force-device-scale-factor=${scale}`,
        `--window-size=${width},${height}`,
        `--virtual-time-budget=${settleMs}`,
        `--screenshot=${out}`,
        url,
      ],
      { maxBuffer: 1024 * 1024 * 16 },
    );
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
  return (await stat(out)).size;
}

async function buildShots(chrome) {
  try {
    const res = await fetch(`${DEV_URL}/model-town-board`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    throw new Error(
      `Can't reach ${DEV_URL} (${err.message}). Start the app first:\n  npm run dev`,
    );
  }
  const failed = [];
  for (const shot of SHOTS) {
    process.stdout.write(`  ${shot.file.padEnd(24)} `);
    const out = path.join(OUT_DIR, `${shot.file}.png`);
    let size = 0;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      size = await shoot(chrome, {
        ...shot,
        url: DEV_URL + shot.url,
        out,
        settleMs: shot.settleMs * attempt,
      });
      if (size >= shot.minBytes) break;
      process.stdout.write(`(blank, retry ${attempt}) `);
      if (attempt === MAX_ATTEMPTS) failed.push(shot.file);
    }
    // A JPEG is a third of the PNG's size, and Android downloads these
    // before it shows the install sheet. `sips` ships with macOS, as for the
    // social cards.
    const jpg = path.join(OUT_DIR, `${shot.file}.jpg`);
    await execFileAsync("sips", [
      "-s",
      "format",
      "jpeg",
      "-s",
      "formatOptions",
      "80",
      out,
      "--out",
      jpg,
    ]);
    await rm(out);
    size = (await stat(jpg)).size;
    console.log(
      `${(size / 1024).toFixed(0)} kB  ${Math.round(shot.width * shot.scale)}×${Math.round(shot.height * shot.scale)}`,
    );
  }
  if (failed.length) {
    throw new Error(`Came out blank: ${failed.join(", ")}. Look at them.`);
  }
}

async function main() {
  const chrome = await findChrome();
  await mkdir(OUT_DIR, { recursive: true });
  await buildShots(chrome);
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
