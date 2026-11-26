import { expect, test } from "@playwright/test";

import {
  accountButton,
  freshEmail,
  signInWithCode,
  signInWithPassword,
  signOut,
} from "../support/flows";

test("the owner adds a student; a branch admin sees only their branch", async ({
  page,
}) => {
  await page.goto("/guides");
  await signInWithPassword(page, "owner@heltz.test");
  await page.goto("/school");
  await expect(
    page.getByRole("heading", { name: "Heltz Driving Academy" }),
  ).toBeVisible();

  const email = freshEmail("student");
  await page.getByLabel("Student's email").fill(email);
  await page.getByRole("button", { name: "Add student" }).click();
  await expect(page.getByText("Student added.")).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByLabel("Student's email")).toHaveValue("");
  await signOut(page);

  await signInWithPassword(page, "westlands.admin@heltz.test");
  await page.goto("/school");
  // A branch admin's dashboard: Students and Passes, no Team tab.
  await expect(page.getByRole("tab", { name: "Team" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Passes" })).toBeVisible();
  await expect(page.getByText(email)).toHaveCount(0);
  await expect(page.getByText("brian@learner.test")).toBeVisible();
});

test("a learner added by a school wears its livery once they sign up", async ({
  page,
}) => {
  const email = freshEmail("joiner");
  await page.goto("/guides");
  await signInWithPassword(page, "owner@heltz.test");
  await page.goto("/school");
  await page.getByLabel("Student's email").fill(email);
  await page.getByRole("button", { name: "Add student" }).click();
  await expect(page.getByText("Student added.")).toBeVisible();
  await signOut(page);

  await signInWithCode(page, email);
  await accountButton(page, "Your account").click();
  await expect(
    page.getByText(/With Heltz Driving Academy until/),
  ).toBeVisible();

  await page.goto("/model-town-board/play");
  await expect(page.getByText(/Board by Heltz/)).toBeVisible();
});

test("an owner reaches their school from the account menu, finds a student and sees who paid", async ({
  page,
}) => {
  await page.goto("/guides");
  await signInWithPassword(page, "owner@heltz.test");
  await accountButton(page, "Your account").click();
  await page
    .getByRole("navigation", { name: "Your places" })
    .getByRole("link", { name: /Heltz Driving Academy/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Heltz Driving Academy" }),
  ).toBeVisible();

  // Search, kept in the address.
  await page.getByLabel("Search by name or email").fill("amina");
  await expect(page).toHaveURL(/sq=amina/);
  await expect(page.getByText("amina@learner.test")).toBeVisible();
  await expect(page.getByText("brian@learner.test")).toHaveCount(0);
  await expect(page.getByText(/Paid through you until/)).toBeVisible();

  // Tabs, kept in the address too: a reload stays on Passes.
  await page.getByRole("tab", { name: "Passes" }).click();
  await expect(page).toHaveURL(/tab=passes/);
  await page.reload();
  await expect(
    page.getByText("https://driverush.ke/pass?code=HELTZ"),
  ).toBeVisible();
  await expect(page.getByText(/^Paid to/)).toBeVisible();
});
