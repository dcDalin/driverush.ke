import { describe, expect, it } from "vitest";

import { BOARD_CHALLENGES, challengeById, isRouteTask } from "./challenges";
import {
  ALL_LEVELS,
  COURSE_LEVELS,
  doneCount,
  learnedKey,
  levelAfter,
  levelBefore,
  levelById,
  levelDone,
  levelState,
  nextLevel,
  UNITS,
  unitState,
} from "./curriculum";
import { levelSlides } from "./curriculum-content";
import { BOARD_FEATURES } from "./features";
import { LESSONS } from "./lessons";

const EMPTY = { learned: [], bestStars: {} };

describe("the course", () => {
  it("numbers the levels straight through, with ids that are all different", () => {
    expect(ALL_LEVELS.map((l) => l.n)).toEqual(ALL_LEVELS.map((_, i) => i + 1));
    expect(new Set(ALL_LEVELS.map((l) => l.id)).size).toBe(ALL_LEVELS.length);
  });

  it("drives every task exactly once, under the task's own title", () => {
    const driven = ALL_LEVELS.flatMap((l) =>
      l.kind === "drive" ? [l.challenge] : [],
    );
    expect([...driven].sort()).toEqual(
      BOARD_CHALLENGES.map((c) => c.id).sort(),
    );
    for (const level of ALL_LEVELS) {
      if (level.kind !== "drive") continue;
      expect(challengeById(level.challenge)?.title).toBe(level.title);
    }
  });

  it("plays every lesson exactly once, under the lesson's own title and level", () => {
    const watched = ALL_LEVELS.flatMap((l) =>
      l.kind === "watch" ? [l.lesson] : [],
    );
    expect([...watched].sort()).toEqual(LESSONS.map((l) => l.id).sort());
    for (const level of ALL_LEVELS) {
      if (level.kind !== "watch") continue;
      const lesson = LESSONS.find((l) => l.id === level.lesson);
      expect(lesson?.title).toBe(level.title);
      expect(lesson?.level).toBe(level.difficulty);
    }
  });

  it("shows every painted thing on the board exactly once", () => {
    const shown = ALL_LEVELS.flatMap((l) =>
      l.kind === "slides"
        ? l.slides.flatMap((s) => ("feature" in s ? [s.feature] : []))
        : [],
    );
    expect([...shown].sort()).toEqual(BOARD_FEATURES.map((f) => f.id).sort());
  });

  it("has words and a place to look for every card", () => {
    for (const level of ALL_LEVELS) {
      if (level.kind !== "slides") continue;
      const cards = levelSlides(level);
      expect(cards.length).toBe(level.slides.length);
      for (const card of cards) {
        expect(card.title.length).toBeGreaterThan(0);
        expect(card.note.length).toBeGreaterThan(0);
        expect(card.box).not.toBeNull();
        // House rule: no em dashes in anything a learner reads.
        expect(card.title + card.note).not.toContain("—");
      }
    }
  });

  it("teaches before it asks: no unit drives before it has taught", () => {
    for (const unit of UNITS) {
      if (unit.id === "mock") continue;
      expect(unit.levels[0]!.kind).not.toBe("drive");
    }
    // The board and the lanes come before any driving at all.
    const firstDrive = ALL_LEVELS.findIndex((l) => l.kind === "drive");
    const before = ALL_LEVELS.slice(0, firstDrive).map((l) => l.unit);
    expect(before).toContain("board");
    expect(before).toContain("lanes");
  });

  it("shows a route driven before the learner drives it", () => {
    for (const level of ALL_LEVELS) {
      if (level.kind !== "drive") continue;
      const task = challengeById(level.challenge);
      if (!task || !isRouteTask(task)) continue;
      if (task.block) {
        // A blocked road is worked out, not watched: the rule comes first.
        const rule = ALL_LEVELS.find((l) => l.id === "blocked-roads");
        expect(rule, level.id).toBeDefined();
        expect(rule!.n).toBeLessThan(level.n);
        continue;
      }
      const shown = ALL_LEVELS.find(
        (l) => l.kind === "watch" && l.lesson === task.lesson,
      );
      expect(shown, level.id).toBeDefined();
      expect(shown!.n).toBeLessThan(level.n);
    }
  });
});

describe("progress through the course", () => {
  it("starts at level 1 and ends at the mock test", () => {
    expect(nextLevel(EMPTY).n).toBe(1);
    const all = {
      learned: [
        ...LESSONS.map((l) => l.id),
        ...COURSE_LEVELS.map((l) => learnedKey(l)),
      ],
      bestStars: Object.fromEntries(BOARD_CHALLENGES.map((c) => [c.id, 1])),
    };
    expect(doneCount(all)).toBe(COURSE_LEVELS.length);
    expect(nextLevel(all).kind).toBe("mock");
  });

  it("counts lessons watched and tasks passed before there were levels", () => {
    const saved = { learned: ["straight-over"], bestStars: { straight: 2 } };
    expect(levelDone(levelById("watch-straight-over")!, saved)).toBe(true);
    expect(levelDone(levelById("drive-straight")!, saved)).toBe(true);
    expect(levelDone(levelById("roads")!, saved)).toBe(false);
    // Having passed a task, the first drive counts as had. Continue goes to
    // the first thing not done, which is the first reading level.
    expect(nextLevel(saved).id).toBe("roads");
  });

  it("skips what is done when finding where to continue", () => {
    const first = ALL_LEVELS[0]!;
    const saved = { learned: [learnedKey(first)], bestStars: {} };
    expect(nextLevel(saved).n).toBe(2);
    expect(levelAfter(first)?.n).toBe(2);
    expect(levelAfter(ALL_LEVELS[ALL_LEVELS.length - 1]!)).toBeUndefined();
    expect(levelBefore(first)).toBeUndefined();
    expect(levelBefore(ALL_LEVELS[1]!)).toBe(first);
  });

  it("marks each level done, next, open or locked", () => {
    const state = (id: string, saved: Parameters<typeof levelState>[1]) =>
      levelState(levelById(id) ?? ALL_LEVELS[Number(id) - 1]!, saved);
    // A first visit: level 1 is next, everything after is locked, the mock
    // test can be taken any time.
    expect(state("1", EMPTY)).toBe("next");
    expect(state("2", EMPTY)).toBe("locked");
    expect(state("mock-test", EMPTY)).toBe("open");
    expect(unitState(UNITS[0]!, EMPTY)).toBe("current");
    expect(unitState(UNITS[1]!, EMPTY)).toBe("locked");

    // Levels 1 to 9 done: 10 is next, 11 locked.
    const nine = {
      learned: COURSE_LEVELS.slice(0, 9).flatMap((l) => [
        learnedKey(l),
        ...(l.kind === "watch" ? [l.lesson] : []),
      ]),
      bestStars: Object.fromEntries(
        COURSE_LEVELS.slice(0, 9).flatMap((l) =>
          l.kind === "drive" ? [[l.challenge, 1]] : [],
        ),
      ),
    };
    for (let n = 1; n <= 9; n++) expect(state(String(n), nine)).toBe("done");
    expect(state("10", nine)).toBe("next");
    expect(state("11", nine)).toBe("locked");
    expect(unitState(UNITS[0]!, nine)).toBe("done");

    // Skipped ahead to 14 and finished it: 10 still next, 11 to 13 open
    // behind, 15 open after it, 16 locked.
    const l14 = ALL_LEVELS[13]!;
    const skipped = {
      learned: [
        ...nine.learned,
        learnedKey(l14),
        ...(l14.kind === "watch" ? [l14.lesson] : []),
      ],
      bestStars: {
        ...nine.bestStars,
        ...(l14.kind === "drive" ? { [l14.challenge]: 1 } : {}),
      },
    };
    expect(state("14", skipped)).toBe("done");
    expect(state("10", skipped)).toBe("next");
    for (const n of [11, 12, 13, 15])
      expect(state(String(n), skipped)).toBe("open");
    expect(state("16", skipped)).toBe("locked");

    // Everything done: nothing is next or locked.
    const all = {
      learned: [
        ...LESSONS.map((l) => l.id),
        ...COURSE_LEVELS.map((l) => learnedKey(l)),
      ],
      bestStars: Object.fromEntries(BOARD_CHALLENGES.map((c) => [c.id, 1])),
    };
    expect(COURSE_LEVELS.every((l) => levelState(l, all) === "done")).toBe(
      true,
    );
    expect(state("mock-test", all)).toBe("open");
  });

  it("never locks the level after a finished one", () => {
    for (const level of COURSE_LEVELS) {
      const saved = {
        learned: [
          learnedKey(level),
          ...(level.kind === "watch" ? [level.lesson] : []),
        ],
        bestStars: level.kind === "drive" ? { [level.challenge]: 1 } : {},
      };
      const after = levelAfter(level);
      if (after) expect(levelState(after, saved)).not.toBe("locked");
    }
  });
});
