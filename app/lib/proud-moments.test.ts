/**
 * Proud moments: what earns one, that each is offered once, and that the
 * share link carries numbers only while our page says the words.
 */
import { describe, expect, it } from "vitest";

import {
  COURSE_LEVELS,
  type CourseProgress,
  learnedKey,
  type Level,
  UNITS,
} from "./board/curriculum";
import {
  levelMoment,
  momentKey,
  nextMoment,
  parseOffered,
  streakMoment,
} from "./proud-moments";
import { buildShareLink, resolveShare } from "./share";
import { sharePictureSpec } from "./share-picture";

/** Progress with exactly these levels done. */
function progress(levels: readonly Level[]): CourseProgress {
  const learned: string[] = [];
  const bestStars: Record<string, number> = {};
  for (const l of levels) {
    if (l.kind === "drive") bestStars[l.challenge] = 3;
    else if (l.kind === "watch") learned.push(l.lesson);
    else learned.push(learnedKey(l));
  }
  return { learned, bestStars };
}

const units = UNITS.filter((u) => u.id !== "mock");

describe("which moment a level earns", () => {
  it("is the unit, once its last level is done", () => {
    const lanes = units[1]!;
    const last = lanes.levels[lanes.levels.length - 1]!;
    const before = units[0]!.levels;
    expect(levelMoment(last, progress([...before, ...lanes.levels]))).toEqual({
      moment: "unit",
      n: 2,
    });
    // a level done while the unit still has one to go earns nothing
    expect(
      levelMoment(last, progress([...before, ...lanes.levels.slice(1)])),
    ).toBeNull();
  });

  it("is the whole course when the last level anywhere is done", () => {
    const level = COURSE_LEVELS[10]!;
    expect(levelMoment(level, progress(COURSE_LEVELS))).toEqual({
      moment: "course",
      n: COURSE_LEVELS.length,
    });
  });

  it("is nothing for a level not done", () => {
    expect(levelMoment(COURSE_LEVELS[0]!, progress([]))).toBeNull();
  });
});

describe("streaks and the record of what was offered", () => {
  it("marks a few runs of days, not every day", () => {
    expect(streakMoment(7)).toEqual({ moment: "streak", n: 7 });
    expect(streakMoment(8)).toBeNull();
  });

  it("offers each moment once", () => {
    const unit = { moment: "unit", n: 2 } as const;
    const streak = { moment: "streak", n: 3 } as const;
    expect(nextMoment([unit, streak], [])).toEqual(unit);
    expect(nextMoment([unit, streak], [momentKey(unit)])).toEqual(streak);
    expect(nextMoment([null, streak], ["streak:3"])).toBeNull();
    expect(momentKey({ moment: "passed", n: 0 })).toBe("passed");
  });

  it("reads back only what it wrote", () => {
    expect(parseOffered('["unit:1",3,null]')).toEqual(["unit:1"]);
    expect(parseOffered("not json")).toEqual([]);
  });
});

describe("sharing a moment", () => {
  it("puts only numbers in the link and our words on the page", () => {
    const link = buildShareLink({ kind: "milestone", moment: "unit", n: 2 });
    expect(link.url).toMatch(/\/s\?k=milestone&m=0&n=2$/);
    expect(link.title).toBe("I finished unit 2 of the Model Town Board: Lanes");
    const page = resolveShare(new URL(link.url).searchParams);
    expect(page.valid).toBe(true);
    expect(page.headline).toBe(
      "They finished unit 2 of the Model Town Board: Lanes",
    );
  });

  it("words every moment without em dashes", () => {
    const moments = [
      { moment: "unit", n: 3 },
      { moment: "course", n: COURSE_LEVELS.length },
      { moment: "streak", n: 7 },
      { moment: "passed", n: 0 },
    ] as const;
    for (const m of moments) {
      const link = buildShareLink({ kind: "milestone", ...m });
      const page = resolveShare(new URL(link.url).searchParams);
      const spec = sharePictureSpec({ kind: "milestone", ...m });
      expect(page.valid, m.moment).toBe(true);
      for (const text of [
        link.title,
        link.text,
        page.headline,
        page.detail,
        spec.score,
        spec.label,
        spec.challenge,
      ]) {
        expect(text).not.toContain("—");
      }
    }
    expect(
      buildShareLink({ kind: "milestone", moment: "passed", n: 0 }).title,
    ).toBe("I passed my NTSA driving test!");
  });

  it("falls back on a moment or number that isn't ours", () => {
    for (const q of [
      "k=milestone&m=9&n=1",
      "k=milestone&m=0&n=99",
      "k=milestone&m=x&n=1",
      "k=milestone&m=2&n=0",
    ]) {
      expect(resolveShare(new URLSearchParams(q)).valid, q).toBe(false);
    }
  });
});
