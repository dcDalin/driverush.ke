/**
 * A road's lane options can be taught over more than one level (the
 * three-lane road is split in two). Every car of the road is in exactly one
 * level, and progress and links from before the split still count.
 */
import { describe, expect, it } from "vitest";

import { COURSE_LEVELS, levelById, levelDone, type Level } from "./curriculum";
import { ARMS } from "./geometry";
import { queueCars } from "./lane-queue";

type LanesLevel = Level & { kind: "lanes" };

const lanesLevels = COURSE_LEVELS.filter(
  (l): l is LanesLevel => l.kind === "lanes",
);

describe("lane options levels", () => {
  it("put every car of a road in exactly one level", () => {
    for (const arm of new Set(lanesLevels.map((l) => l.arm))) {
      const ids = lanesLevels
        .filter((l) => l.arm === arm)
        .flatMap((l) => queueCars(arm, l.lanes).map((c) => c.id));
      expect(ids.sort()).toEqual(
        queueCars(arm)
          .map((c) => c.id)
          .sort(),
      );
    }
  });

  it("name lanes the road has", () => {
    for (const l of lanesLevels) {
      for (const lane of l.lanes ?? []) {
        expect(lane).toBeGreaterThanOrEqual(1);
        expect(lane).toBeLessThanOrEqual(ARMS[l.arm].lanes);
      }
    }
  });

  it("split the three-lane road: lanes 1 and 2, then lane 3", () => {
    const parts = lanesLevels.filter((l) => l.arm === "W");
    expect(parts.map((l) => l.lanes)).toEqual([[1, 2], [3]]);
    expect(parts[1].n).toBe(parts[0].n + 1);
    expect(queueCars("W", parts[0].lanes)).toHaveLength(3);
    expect(queueCars("W", parts[1].lanes)).toHaveLength(5);
  });

  it("count the old whole-road level as both parts done", () => {
    const saved = { learned: ["lv:three-lane"], bestStars: {} };
    for (const l of lanesLevels.filter((one) => one.arm === "W")) {
      expect(levelDone(l, saved), l.id).toBe(true);
    }
    expect(levelDone(levelById("four-lane")!, saved)).toBe(false);
  });

  it("open the first part from an old link to the whole road", () => {
    expect(levelById("three-lane")?.id).toBe("three-lane-1-2");
  });
});
