import { expect, test } from "@playwright/test";

import { resetPassword, signInWithPassword } from "../support/flows";

test("DriveRush staff create a school for an owner who has not signed up", async ({
  page,
}) => {
  await page.goto("/guides");
  await signInWithPassword(page, "admin@driverush.test");
  await page.goto("/console/schools");
  const slug = `e2e-${Date.now().toString(36)}`;
  await page.getByRole("link", { name: "New school" }).click();
  await expect(page).toHaveURL(/\/console\/schools\/new$/);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("School name").fill("E2E Driving School");
  await dialog.getByLabel("Short name (for links)").fill(slug);
  await dialog.getByLabel("Owner's email (optional)").fill(`${slug}@e2e.test`);
  await dialog.getByRole("button", { name: "Create school" }).click();
  // Straight to the school, a modal over the list: live, its owner invited.
  await expect(
    page.getByRole("heading", { name: "E2E Driving School" }),
  ).toBeVisible();
  // (The list under the modal names the owner too: look in the school.)
  await expect(
    page.getByRole("dialog").getByText(`Invited ${slug}@e2e.test`),
  ).toBeVisible();
  // And the list finds it by search.
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page).toHaveURL(/\/console\/schools$/);
  await page.getByLabel("Search schools").fill(slug);
  await expect(
    page.getByRole("link", { name: /E2E Driving School/ }),
  ).toBeVisible();
});

test("staff set a school up first, then hand it over", async ({ page }) => {
  await page.goto("/guides");
  await signInWithPassword(page, "admin@driverush.test");
  await page.goto("/console/schools");
  const slug = `e2e-setup-${Date.now().toString(36)}`;
  await page.getByRole("link", { name: "New school" }).click();
  await expect(page).toHaveURL(/\/console\/schools\/new$/);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("School name").fill("E2E Set Up School");
  await dialog.getByLabel("Short name (for links)").fill(slug);
  await dialog.getByRole("button", { name: "Create school" }).click();
  await expect(
    page.getByRole("heading", { name: "E2E Set Up School" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Setting up").first(),
  ).toBeVisible();
  // Handing over is a smaller modal stacked over the school's Set-up tab.
  // (The header's button and the checklist's Owner step both open it.)
  await page
    .getByRole("link", { name: "Hand over", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/hand-over$/);
  const handOver = page.getByRole("dialog", { name: /Hand over/ });
  await handOver.getByLabel("Owner's email").fill(`${slug}@e2e.test`);
  await handOver.getByRole("button", { name: "Hand over and go live" }).click();
  await expect(page.getByText(/Handed over/)).toBeVisible();
  // (The list under the modal names the owner too: look in the school.)
  await expect(
    page.getByRole("dialog").getByText(`Invited ${slug}@e2e.test`),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Active").first(),
  ).toBeVisible();
});

test("staff who signed in with a reset code, not their password, are asked to sign in again", async ({
  page,
}) => {
  await page.goto("/guides");
  await resetPassword(page, "admin@driverush.test");
  await page.goto("/console");
  await expect(
    page.getByRole("heading", { name: "Sign in again" }),
  ).toBeVisible();
});

test("staff look inside a school from the console, never from its dashboard", async ({
  page,
}) => {
  await page.goto("/guides");
  await signInWithPassword(page, "admin@driverush.test");
  await page.goto("/console/schools");
  await page.getByLabel("Search schools").fill("heltz");
  // The search reaches the address a moment later; the school keeps it.
  await expect(page).toHaveURL(/q=heltz/);
  await page.getByRole("link", { name: /Heltz Driving Academy/ }).click();
  const school = page.getByRole("dialog");
  // Staff's part and the owner's part are told apart, with no way across.
  await expect(
    school.getByRole("heading", { name: "Your part" }),
  ).toBeVisible();
  await expect(
    school.getByRole("heading", { name: /The owner's part/ }),
  ).toBeVisible();
  await expect(school.getByRole("link", { name: /dashboard/i })).toHaveCount(0);

  // A read-only look inside.
  await school.getByRole("link", { name: "Inside" }).click();
  await expect(page).toHaveURL(/\/inside\?q=heltz$/);
  await expect(school.getByText("amina@learner.test")).toBeVisible();
  await expect(
    school.getByRole("button", { name: /Release|Move|Remove/ }),
  ).toHaveCount(0);

  // The school's own dashboard turns staff back to the console.
  const id = page.url().match(/schools\/([0-9a-f-]{36})/)![1];
  await page.goto(`/school/${id}`);
  await expect(
    page.getByRole("heading", { name: "This is the school's own dashboard" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open it in the console" }).click();
  await expect(page).toHaveURL(new RegExp(`/console/schools/${id}$`));
});
