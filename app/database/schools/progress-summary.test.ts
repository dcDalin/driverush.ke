import { describe, expect, it } from "vitest";

import { summarizeProgress } from "./progress-summary";

describe("summarizeProgress", () => {
  it("reads levels, streak, test and mastered signs from saved stores", () => {
    const summary = summarizeProgress({
      board: { json: { state: { learned: ["a", "b", "c"] }, version: 1 } },
      streak: { json: { days: 4, best: 6 } },
      test: { json: { date: "2026-12-06", result: "passed" } },
      pelican: {
        json: { state: { progress: { stop: { box: 2 }, give: { box: 1 } } } },
      },
      signs3d: {
        json: { state: { progress: { stop: { box: 3 }, yield: { box: 2 } } } },
      },
    });
    expect(summary).toEqual({
      levels: 3,
      streakDays: 4,
      testDate: "2026-12-06",
      testResult: "passed",
      signsMastered: 2,
    });
  });

  it("is all zero for a learner with nothing saved, or broken data", () => {
    const empty = {
      levels: 0,
      streakDays: 0,
      testDate: null,
      testResult: null,
      signsMastered: 0,
    };
    expect(summarizeProgress({})).toEqual(empty);
    expect(summarizeProgress(null)).toEqual(empty);
    expect(
      summarizeProgress({ board: { json: "nonsense" }, streak: 5 }),
    ).toEqual(empty);
  });
});
