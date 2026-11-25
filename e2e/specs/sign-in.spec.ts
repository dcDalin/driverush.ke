import { expect, test } from "@playwright/test";

import { freshEmail, signInWithCode, signOut } from "../support/flows";

test("a new learner signs up with an emailed code, then signs out", async ({
  page,
}) => {
  await page.goto("/guides");
  await signInWithCode(page, freshEmail("signup"));
  await signOut(page);
});

test("a wrong email is explained in the field", async ({ page }) => {
  await page.goto("/guides");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email").fill("wanjiru");
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(
    page.getByText("Type a full email address, like name@gmail.com."),
  ).toBeVisible();
});
