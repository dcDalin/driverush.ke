/**
 * Runs after `react-router build`. Sends the client source maps to PostHog so
 * errors in error tracking show the real file and line instead of minified
 * code, then deletes the maps so the site never serves them.
 *
 * Needs, on the host that builds (Vercel → Settings → Environment Variables):
 *   POSTHOG_CLI_API_KEY     a personal API key with "error tracking: write"
 *   POSTHOG_CLI_PROJECT_ID  the PostHog project id (the number in its URL)
 *
 * Without the key it does nothing, and `vite.config.ts` builds no maps either.
 * A failed upload never fails the build: the site still ships, just with
 * unreadable stack traces for that release.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const CLIENT = "build/client";

if (!process.env.POSTHOG_CLI_API_KEY) {
  console.log("[sourcemaps] POSTHOG_CLI_API_KEY not set, skipping upload");
  process.exit(0);
}

const version = (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7);

const result = spawnSync(
  "posthog-cli",
  [
    "sourcemap",
    "process",
    "--directory",
    CLIENT,
    "--release-name",
    "driverush-web",
    "--release-version",
    version,
    "--delete-after",
  ],
  { stdio: "inherit", shell: process.platform === "win32" },
);

if (result.status !== 0) {
  console.warn("[sourcemaps] upload failed; continuing without them");
}

// Belt and braces: whatever the upload did, no map is left to be served.
let removed = 0;
for (const entry of readdirSync(CLIENT, { recursive: true })) {
  if (String(entry).endsWith(".map")) {
    rmSync(join(CLIENT, String(entry)));
    removed += 1;
  }
}
if (removed) console.log(`[sourcemaps] removed ${removed} leftover map files`);
