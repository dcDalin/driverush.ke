import { describe, expect, it } from "vitest";

import { planLine, planPromise, testPlan } from "./test-plan";

const today = "2026-11-24";
const TOTAL = 53;

describe("testPlan", () => {
  it("has nothing to say without a date, or once the test has gone by", () => {
    expect(testPlan({}, 5, TOTAL, 0, today)).toEqual({ kind: "none" });
    expect(testPlan({ date: "2026-11-20" }, 5, TOTAL, 0, today)).toEqual({
      kind: "none",
    });
  });

  it("wishes luck on the day", () => {
    expect(testPlan({ date: today }, 5, TOTAL, 0, today)).toEqual({
      kind: "today",
    });
  });

  it("paces the levels left to be done the day before", () => {
    // 43 levels, 12 days of practice counting today: 4 a day (rounded up).
    const plan = testPlan({ date: "2026-12-06" }, 10, TOTAL, 1, today);
    expect(plan).toEqual({
      kind: "levels",
      daysLeft: 12,
      levelsLeft: 43,
      perDay: 4,
      doneToday: 1,
      metToday: false,
    });
  });

  it("asks for everything left when the test is tomorrow", () => {
    const plan = testPlan({ date: "2026-11-25" }, 40, TOTAL, 0, today);
    expect(plan.kind === "levels" && plan.perDay).toBe(13);
  });

  it("never asks for less than a level a day", () => {
    const plan = testPlan({ date: "2027-06-01" }, 50, TOTAL, 0, today);
    expect(plan.kind === "levels" && plan.perDay).toBe(1);
  });

  it("knows when today's share is done", () => {
    // 47 left at the start of today, 12 days: 4 a day, and 4 are done.
    const plan = testPlan({ date: "2026-12-06" }, 10, TOTAL, 4, today);
    expect(plan.kind === "levels" && plan.perDay).toBe(4);
    expect(plan.kind === "levels" && plan.metToday).toBe(true);
  });

  it("keeps today's goal where the day started as levels are done", () => {
    // Started the day with 48 left over 12 days (4 a day); 5 done since.
    const plan = testPlan({ date: "2026-12-06" }, 10, TOTAL, 5, today);
    expect(plan.kind === "levels" && plan.perDay).toBe(4);
    expect(planLine(plan)).toBe(
      "Test in 12 days. Today's 4 are done. See you tomorrow.",
    );
    const before = testPlan({ date: "2026-12-06" }, 5, TOTAL, 0, today);
    expect(before.kind === "levels" && before.perDay).toBe(4);
  });

  it("turns to the mock test once every level is done", () => {
    expect(testPlan({ date: "2026-12-06" }, TOTAL, TOTAL, 2, today)).toEqual({
      kind: "mock",
      daysLeft: 12,
      doneToday: 2,
      metToday: false,
    });
  });
});

describe("planLine and planPromise", () => {
  it("say the plan in one sentence, with no em dashes", () => {
    const going = testPlan({ date: "2026-12-06" }, 10, TOTAL, 1, today);
    const met = testPlan({ date: "2026-12-06" }, 10, TOTAL, 5, today);
    const one = testPlan({ date: "2026-11-25" }, 52, TOTAL, 0, today);
    expect(planLine(going)).toBe("Test in 12 days. 1 of 4 levels today.");
    expect(planLine(met)).toBe(
      "Test in 12 days. Today's 4 are done. See you tomorrow.",
    );
    expect(planLine(one)).toBe("Test in 1 day. 0 of 1 level today.");
    expect(planLine({ kind: "today" })).toBe(
      "Your NTSA test is today. Good luck!",
    );
    expect(planLine({ kind: "none" })).toBeNull();
    expect(planPromise(going)).toBe("43 levels in 12 days: 4 a day.");
    for (const line of [planLine(going), planLine(met), planPromise(going)]) {
      expect(line).not.toContain("—");
    }
  });
});
