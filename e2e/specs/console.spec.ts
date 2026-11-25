import { expect, test } from "@playwright/test";

import { signInWithCode, signInWithPassword } from "../support/flows";

test("DriveRush staff create a school for an owner who has not signed up", async ({
  page,
}) => {
  await page.goto("/guides");
  await signInWithPassword(page, "admin@driverush.test");
  await page.goto("/console");
  const slug = `e2e-${Date.now().toString(36)}`;
  await page.getByLabel("School name").fill("E2E Driving School");
  await page.getByLabel("Short name (for links)").fill(slug);
  await page.getByLabel("Owner's email", { exact: true }).fill(`${slug}@e2e.test`);
  await page.getByRole("button", { name: "Create school" }).click();
  await expect(page.getByText("School created.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "E2E Driving School" }).first(),
  ).toBeVisible();
});

test("staff on an emailed-code session see the staff-only page", async ({
  page,
}) => {
  await page.goto("/guides");
  await signInWithCode(page, "admin@driverush.test");
  await page.goto("/console");
  await expect(page.getByRole("heading", { name: "Staff only" })).toBeVisible();
});
