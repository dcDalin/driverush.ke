import { describe, expect, it } from "vitest";

import type { Entitlement } from "~/database/types";

import { ALL_LEVELS, COURSE_LEVELS, MOCK_LEVEL_ID } from "./curriculum";
import { FREE_LEVELS, levelPaywalled } from "./paywall";

const free = { tier: "free", full_access: false } as Entitlement;
const paid = { tier: "paid", full_access: true } as Entitlement;
const school = { tier: "school", full_access: true } as Entitlement;
const linkedOnly = { tier: "school", full_access: false } as Entitlement;

const level = (n: number) => COURSE_LEVELS.find((l) => l.n === n)!;
const mock = ALL_LEVELS.find((l) => l.id === MOCK_LEVEL_ID)!;

describe("levelPaywalled", () => {
  it("ends the free part on the first graded drive", () => {
    const firstDrive = COURSE_LEVELS.find((l) => l.kind === "drive");
    expect(firstDrive?.n).toBe(FREE_LEVELS);
  });

  it("keeps levels 1 to 16 open to guests and free learners", () => {
    for (const n of [1, FREE_LEVELS]) {
      expect(levelPaywalled(level(n), null)).toBe(false);
      expect(levelPaywalled(level(n), free)).toBe(false);
    }
  });

  it("asks for a pass from level 17", () => {
    expect(levelPaywalled(level(FREE_LEVELS + 1), null)).toBe(true);
    expect(levelPaywalled(level(COURSE_LEVELS.length), free)).toBe(true);
  });

  it("opens everything with a pass of their own or their school's", () => {
    for (const e of [paid, school]) {
      expect(levelPaywalled(level(COURSE_LEVELS.length), e)).toBe(false);
      expect(levelPaywalled(mock, e, { mockTriesUsed: 9 })).toBe(false);
    }
  });

  it("keeps a learner linked to a school but without a pass on the free levels", () => {
    expect(levelPaywalled(level(FREE_LEVELS), linkedOnly)).toBe(false);
    expect(levelPaywalled(level(FREE_LEVELS + 1), linkedOnly)).toBe(true);
  });

  it("gives one free try at the mock test", () => {
    expect(levelPaywalled(mock, free, { mockTriesUsed: 0 })).toBe(false);
    expect(levelPaywalled(mock, free, { mockTriesUsed: 1 })).toBe(true);
  });
});
