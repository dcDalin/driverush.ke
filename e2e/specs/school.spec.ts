import { expect, test } from "@playwright/test";

import {
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
    page.getByRole("heading", { name: "Heltz Driving School" }),
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
  await expect(page.getByRole("heading", { name: "Team" })).toHaveCount(0);
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
  await page.getByRole("button", { name: "Your account" }).click();
  await expect(page.getByText(/With Heltz Driving School until/)).toBeVisible();

  await page.goto("/model-town-board/play");
  await expect(page.getByText(/Board by Heltz/)).toBeVisible();
});
