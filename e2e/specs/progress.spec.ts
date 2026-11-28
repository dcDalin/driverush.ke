import { expect, test } from "@playwright/test";

import {
  freshEmail,
  signInWithPassword,
  signOut,
  signUp,
} from "../support/flows";

const STREAK = "driverush:streak";
const SAVED = JSON.stringify({ days: 4, best: 6, lastDay: "2026-11-25" });

test("a guest's progress lasts the visit and is gone on the next", async ({
  context,
}) => {
  const first = await context.newPage();
  await first.goto("/guides");
  await first.evaluate(([key, value]) => localStorage.setItem(key, value), [
    STREAK,
    SAVED,
  ] as const);
  await first.reload();
  expect(await first.evaluate((key) => localStorage.getItem(key), STREAK)).toBe(
    SAVED,
  );

  // A new tab is a new visit.
  const next = await context.newPage();
  await next.goto("/guides");
  expect(
    await next.evaluate((key) => localStorage.getItem(key), STREAK),
  ).toBeNull();
});

test("a signed-in learner's progress is saved and comes back after signing out", async ({
  page,
}) => {
  const email = freshEmail("progress");
  await page.goto("/guides");
  await signUp(page, email);
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [
    STREAK,
    SAVED,
  ] as const);
  // The sync uploads changed stores every few seconds.
  await page.waitForTimeout(7000);

  await signOut(page);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STREAK),
  ).toBeNull();

  await signInWithPassword(page, email);
  // The same data comes back (the database may reorder an object's keys).
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown,
        STREAK,
      ),
    )
    .toEqual(JSON.parse(SAVED));
});
