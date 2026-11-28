import { expect, test } from "@playwright/test";

// A dropped download in the 3D sign trainer must never reach the root error
// page ("Oops!"). Requests are blocked in the page itself, so the service
// worker is kept out of the way.
test.use({ serviceWorkers: "block" });

const MODELS = "**/assets/road-signs/models/*.glb";
const LOGO = "**/assets/pelican-signs-logo.jpg";

test("a sign that fails to download offers another go", async ({ page }) => {
  await page.route(MODELS, (route) => route.abort("internetdisconnected"));
  await page.goto("/road-signs/3d");

  const failed = page
    .getByRole("alert")
    .filter({ hasText: "The sign did not finish loading" });
  await expect(failed).toBeVisible();
  await expect(page.getByText("Oops!")).toHaveCount(0);

  await page.unroute(MODELS);
  await failed.getByRole("button", { name: "Try again" }).click();
  await expect(failed).toHaveCount(0);
  await expect(page.locator("canvas").first()).toBeVisible();
});

test("the sign shows without the Pelican sticker when its picture fails", async ({
  page,
}) => {
  await page.route(LOGO, (route) => route.abort("internetdisconnected"));
  const model = page.waitForResponse(
    (response) =>
      /\/assets\/road-signs\/models\/.+\.glb$/.test(response.url()) &&
      response.ok(),
  );
  await page.goto("/road-signs/3d");
  await model;

  await expect(page.locator("canvas").first()).toBeVisible();
  // Past both asks at the picture (1.5 s apart), nothing has gone wrong.
  await page.waitForTimeout(3000);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Oops!")).toHaveCount(0);
});
