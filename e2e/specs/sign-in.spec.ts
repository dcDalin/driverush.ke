import { expect, test } from "@playwright/test";

import { accountButton, freshEmail, signOut, signUp } from "../support/flows";

test("a new learner makes an account, confirms the email, then signs out", async ({
  page,
}) => {
  await page.goto("/guides");
  await signUp(page, freshEmail("signup"));
  await signOut(page);
});

test("a wrong email is explained in the field", async ({ page }) => {
  await page.goto("/guides");
  await accountButton(page, "Sign in").click();
  await page.getByLabel("Email").fill("wanjiru");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByText("Type a full email address, like name@gmail.com."),
  ).toBeVisible();
});
