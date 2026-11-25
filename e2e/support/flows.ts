/**
 * Steps the specs share, done the way a person does them: through the
 * sign-in sheet and the pages, never by calling the API behind them.
 *
 * Buttons are looked up where they live: the account button in the top bar
 * (`banner`), the sheet's submit inside the sheet (`dialog`). Pages such as
 * `/school` show their own "Sign in" button to a signed-out visitor, so an
 * unscoped lookup would find two.
 */
import { expect, type Page } from "@playwright/test";

import { latestCode } from "./mail";

export const DEMO_PASSWORD = "driverush-local-1";

export function freshEmail(label: string) {
  return `e2e-${label}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@e2e.test`;
}

/** The top bar's account button: "Sign in" for a guest, "Your account" once signed in. */
export function accountButton(page: Page, name: "Sign in" | "Your account") {
  return page.getByRole("banner").getByRole("button", { name, exact: true });
}

function sheetSubmit(page: Page) {
  return page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in", exact: true });
}

async function openSheet(page: Page) {
  await accountButton(page, "Sign in").click();
  await expect(
    page.getByRole("heading", { name: /Sign in|Save your progress/ }),
  ).toBeVisible();
}

export async function signInWithCode(page: Page, email: string) {
  await openSheet(page);
  await page.getByLabel("Email").fill(email);
  const sent = Date.now();
  await page.getByRole("button", { name: "Email me a code" }).click();
  const code = await latestCode(email, sent);
  await page.getByLabel("Code").fill(code);
  await sheetSubmit(page).click();
  await expect(accountButton(page, "Your account")).toBeVisible();
}

export async function signInWithPassword(
  page: Page,
  email: string,
  password = DEMO_PASSWORD,
) {
  await openSheet(page);
  await page.getByRole("button", { name: "Sign in with a password" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await sheetSubmit(page).click();
  await expect(accountButton(page, "Your account")).toBeVisible();
}

/**
 * Signs out, then waits for the reload that follows: the app clears the
 * phone's progress and reloads once signed out (`progress-sync.tsx`), so the
 * next step must not start before that page has loaded.
 */
export async function signOut(page: Page) {
  await accountButton(page, "Your account").click();
  const reloaded = page.waitForEvent("load");
  await page.getByRole("button", { name: "Sign out" }).click();
  await reloaded;
  await expect(accountButton(page, "Sign in")).toBeVisible();
}
