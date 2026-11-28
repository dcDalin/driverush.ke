import { expect, test } from "@playwright/test";

import { resetPassword, signInWithPassword } from "../support/flows";

test("DriveRush staff create a school for an owner who has not signed up", async ({
  page,
}) => {
  await page.goto("/guides");
  await signInWithPassword(page, "admin@driverush.test");
  await page.goto("/console");
  const slug = `e2e-${Date.now().toString(36)}`;
  await page.getByRole("button", { name: "New school" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("School name").fill("E2E Driving School");
  await dialog.getByLabel("Short name (for links)").fill(slug);
  await dialog.getByLabel("Owner's email (optional)").fill(`${slug}@e2e.test`);
  await dialog.getByRole("button", { name: "Create school" }).click();
  // Straight to the school's own page, live, with its owner invited.
  await expect(
    page.getByRole("heading", { name: "E2E Driving School" }),
  ).toBeVisible();
  await expect(page.getByText(`Invited ${slug}@e2e.test`)).toBeVisible();
  // And the list finds it by search.
  await page.getByRole("link", { name: "All schools" }).click();
  await page.getByLabel("Search schools").fill(slug);
  await expect(
    page.getByRole("link", { name: /E2E Driving School/ }),
  ).toBeVisible();
});

test("staff set a school up first, then hand it over", async ({ page }) => {
  await page.goto("/guides");
  await signInWithPassword(page, "admin@driverush.test");
  await page.goto("/console");
  const slug = `e2e-setup-${Date.now().toString(36)}`;
  await page.getByRole("button", { name: "New school" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("School name").fill("E2E Set Up School");
  await dialog.getByLabel("Short name (for links)").fill(slug);
  await dialog.getByRole("button", { name: "Create school" }).click();
  await expect(
    page.getByRole("heading", { name: "E2E Set Up School" }),
  ).toBeVisible();
  await expect(page.getByText("Setting up").first()).toBeVisible();
  await page.getByLabel("Owner's email").fill(`${slug}@e2e.test`);
  await page.getByRole("button", { name: "Hand over and go live" }).click();
  await expect(page.getByText(/Handed over/)).toBeVisible();
  await expect(page.getByText(`Invited ${slug}@e2e.test`)).toBeVisible();
  await expect(page.getByText("Active").first()).toBeVisible();
});

test("staff who signed in with a reset code, not their password, see the staff-only page", async ({
  page,
}) => {
  await page.goto("/guides");
  await resetPassword(page, "admin@driverush.test");
  await page.goto("/console");
  await expect(page.getByRole("heading", { name: "Staff only" })).toBeVisible();
});
