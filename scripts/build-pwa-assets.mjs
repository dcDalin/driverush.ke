#!/usr/bin/env node
/**
 * Make the pictures the installed app needs, into `public/pwa/`:
 *
 *  - Maskable icons. Android cuts an app icon to its own shape (circle,
 *    squircle, …) and keeps only the middle 80% for sure. Our logo PNG is
 *    see-through, so Android would put it on white in a small circle; these
 *    give it a full white square with the logo inside the safe middle.
 *  - Install screenshots. Chrome on Android shows them in a richer install
 *    sheet ("app store" style) instead of the one-line prompt.
 *
 * Headless Chrome takes the pictures, the same way `build-og-images.mjs`
 * captures the social cards. The icons come from a small page written on the
 * fly; the screenshots from the running app.
 *
 * Usage:
 *   npm run dev                 # terminal 1 (only the screenshots need it)
 *   npm run build:pwa           # terminal 2: icons and screenshots
 *   npm run build:pwa -- icons  # just the icons, no app needed
 *   DEV_URL=http://localhost:5180 npm run build:pwa
 *
 * Requires Google Chrome. Keep the names in step with
 * `public/manifest.webmanifest`.
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "pwa");
const LOGO = path.join(ROOT, "public", "android-chrome-512x512.png");
const DEV_URL = process.env.DEV_URL ?? "http://localhost:5173";

/** The light theme's `--surface`, the same white as the status bar. */
const ICON_FILL = "#ffffff";
/**
 * Size of the logo PNG against the icon. Above 1 because the PNG has its own
 * see-through margin: at 1.1 the letters reach about 38% from the middle,
 * just inside the 40% circle Android keeps.
 */
const LOGO_SHARE = 1.1;

const ICONS = [
  { file: "icon-maskable-512.png", size: 512 },
  { file: "icon-maskable-192.png", size: 192 },
];

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
  {
    file: "screen-drive",
    url: "/model-town-board/play?level=four-lane",
    width: 540,
    height: 960,
    scale: 2,
    settleMs: 30000,
    minBytes: 200_000,
  },
  {
    file: "screen-drive-wide",
    url: "/model-town-board/play?level=four-lane",
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

async function buildIcons(chrome) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "dr-icon-"));
  try {
    for (const icon of ICONS) {
      const page = path.join(dir, `${icon.size}.html`);
      const logo = Math.round(icon.size * LOGO_SHARE);
      await writeFile(
        page,
        `<!doctype html><html><body style="margin:0;width:${icon.size}px;height:${icon.size}px;position:relative;overflow:hidden;background:${ICON_FILL}"><img src="${pathToFileURL(LOGO).href}" width="${logo}" height="${logo}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)"></body></html>`,
      );
      const out = path.join(OUT_DIR, icon.file);
      const size = await shoot(chrome, {
        url: pathToFileURL(page).href,
        out,
        width: icon.size,
        height: icon.size,
        scale: 1,
        settleMs: 500,
      });
      console.log(`  ${icon.file.padEnd(24)} ${(size / 1024).toFixed(0)} kB`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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
  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const chrome = await findChrome();
  await mkdir(OUT_DIR, { recursive: true });
  if (!only.length || only.includes("icons")) await buildIcons(chrome);
  if (!only.length || only.includes("screens")) await buildShots(chrome);
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
