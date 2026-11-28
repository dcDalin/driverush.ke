import { expect, type Page, test } from "@playwright/test";

import {
  accountButton,
  freshEmail,
  signInWithPassword,
  signOut,
  signUp,
} from "../support/flows";

/** "Add student" from the overview: a modal route over the students list. */
async function addStudent(page: Page, email: string) {
  await page.getByRole("link", { name: "Add student" }).click();
  await expect(page).toHaveURL(/\/students\/add$/);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Student's email").fill(email);
  await dialog.getByRole("button", { name: "Add student" }).click();
  await expect(page.getByText("Student added.")).toBeVisible();
}

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
  await addStudent(page, email);
  // The modal closes back to the list, which now shows them.
  await expect(page).toHaveURL(/\/students$/);
  await expect(page.getByText(email)).toBeVisible();
  await signOut(page);

  await signInWithPassword(page, "westlands.admin@heltz.test");
  await page.goto("/school");
  // A branch admin's menu: Students and Passes, no Team.
  const menu = page.getByRole("navigation", { name: "School" });
  await expect(menu.getByRole("link", { name: "Team" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "Passes" })).toBeVisible();
  await menu.getByRole("link", { name: "Students" }).click();
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
  await addStudent(page, email);
  await signOut(page);

  await signUp(page, email);
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
  const menu = page.getByRole("navigation", { name: "School" });
  await menu.getByRole("link", { name: "Students" }).click();
  await page.getByLabel("Search by name or email").fill("amina");
  await expect(page).toHaveURL(/sq=amina/);
  await expect(page.getByText("amina@learner.test")).toBeVisible();
  await expect(page.getByText("brian@learner.test")).toHaveCount(0);
  await expect(page.getByText(/Paid through you until/)).toBeVisible();

  // Each section is its own page: a reload stays on Passes.
  await menu.getByRole("link", { name: "Passes" }).click();
  await expect(page).toHaveURL(/\/passes$/);
  await page.reload();
  await expect(
    page.getByText("https://driverush.ke/pass?code=HELTZ"),
  ).toBeVisible();
  await expect(page.getByText(/^Paid to/)).toBeVisible();
  // Earnings stream in after the page: the totals arrive.
  await expect(page.getByText("Last month", { exact: true })).toBeVisible();
});

test("an owner's changes open as modals over their list and close back", async ({
  page,
}) => {
  await page.goto("/guides");
  await signInWithPassword(page, "owner@heltz.test");
  await page.goto("/school");
  const menu = page.getByRole("navigation", { name: "School" });

  // A branch: saved as it is, so the seed stays the same.
  await menu.getByRole("link", { name: "Branches" }).click();
  await page.getByRole("link", { name: "Edit" }).first().click();
  await expect(page).toHaveURL(/\/branches\/[0-9a-f-]{36}\/edit$/);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save branch" })
    .click();
  await expect(page.getByText("Branch saved.")).toBeVisible();
  await expect(page).toHaveURL(/\/branches$/);

  // An admin's branches, the same way.
  await menu.getByRole("link", { name: "Team" }).click();
  await page.getByRole("link", { name: "Change branches" }).first().click();
  await expect(page).toHaveURL(/\/team\/[0-9a-f-]{36}\/branches$/);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save branches" })
    .click();
  await expect(page.getByText("Branches saved.")).toBeVisible();
  await expect(page).toHaveURL(/\/team$/);

  // Moving a student asks first; Cancel goes back with the filters kept.
  await menu.getByRole("link", { name: "Students" }).click();
  await page.getByLabel("Search by name or email").fill("amina");
  await expect(page).toHaveURL(/sq=amina/);
  await page.getByRole("link", { name: "Move" }).click();
  const move = page.getByRole("dialog");
  await expect(move.getByRole("heading", { name: /^Move / })).toBeVisible();
  await move.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/students\?sq=amina$/);

  // The profile is a summary; its form is a modal.
  await menu.getByRole("link", { name: "Profile" }).click();
  await page.getByRole("link", { name: "Edit profile" }).click();
  await expect(page).toHaveURL(/\/profile\/edit$/);
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Save profile" }),
  ).toBeVisible();
});
