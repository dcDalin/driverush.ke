import { defineConfig, devices } from "@playwright/test";

// End-to-end tests of the key flows in a real browser against the local
// Supabase stack (thinkrush `apps/e2e`). Chromium only, one worker: the specs
// sign real accounts in and share the demo seed.
//
//   locally  reuses the dev server on 5730 if it is up, else starts it
//   CI       builds the app and serves the build (`npm run start`)
const CI = !!process.env.CI;
const PORT = 5730;

export default defineConfig({
  testDir: "./e2e/specs",
  // The specs' own schools and accounts are removed after the run.
  globalTeardown: "./e2e/support/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${PORT}`,
    trace: CI ? "on-first-retry" : "retain-on-failure",
  },
  webServer: {
    command: CI ? `PORT=${PORT} npm run start` : "npm run dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
