/**
 * Each demo learner's saved progress, worked out from their ordinal so every
 * run gives the same numbers (the hash is thinkrush's bot seed's
 * `hashFraction01`). Values are what the app's stores save
 * (`learner_progress.data` is `{ json: <the store's saved value> }`), built
 * from the app's own course list so the levels are real ones.
 */
import { COURSE_LEVELS, learnedKey } from "~/lib/board/curriculum";
import { dailyDriveId, kenyaDay } from "~/lib/daily-drive";
import type { ProgressStore } from "~/lib/progress/keys";

/** A fraction in [0, 1) from an ordinal and a salt: FNV-1a, then a Mulberry32 step. */
export function hashFraction01(ordinal: number, salt: string) {
  let h = 0x811c9dc5;
  for (const ch of `${salt}:${ordinal}`)
    h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  h = (h + 0x6d2b79f5) | 0;
  let t = Math.imul(h ^ (h >>> 15), h | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const DAY = 86_400_000;

function day(offsetDays: number, now: number) {
  return kenyaDay(now + offsetDays * DAY);
}

function boardState(levelsDone: number, ordinal: number) {
  const learned: string[] = [];
  const bestStars: Record<string, number> = {};
  for (const [i, level] of COURSE_LEVELS.slice(0, levelsDone).entries()) {
    if (level.kind === "drive") {
      bestStars[level.challenge] =
        1 + Math.floor(hashFraction01(ordinal * 100 + i, "stars") * 3);
    } else if (level.kind === "watch") {
      learned.push(level.lesson);
    } else if (level.kind !== "mock") {
      learned.push(learnedKey(level));
    }
  }
  return {
    state: {
      learned,
      bestStars,
      progress: {},
      bestScores: {},
      places: {},
      homes: {},
    },
    version: 1,
  };
}

export type ProgressRows = Partial<Record<ProgressStore, unknown>>;

/** The stores this learner has saved, keyed by store. */
export function progressFor(ordinal: number, now = Date.now()): ProgressRows {
  const f = (salt: string) => hashFraction01(ordinal, salt);
  const rows: ProgressRows = {};

  const levelsDone = Math.floor(
    f("levels") ** 0.8 * (COURSE_LEVELS.length + 1),
  );
  if (levelsDone > 0) rows.board = boardState(levelsDone, ordinal);

  // Most keep a streak going; some let it lapse a few days ago.
  const days = 1 + Math.floor(f("streak") * 21);
  const lapsed = f("lapsed") < 0.3;
  rows.streak = {
    days,
    best: days + Math.floor(f("best") * 6),
    lastDay: day(lapsed ? -(2 + Math.floor(f("gap") * 6)) : 0, now),
  };

  // The NTSA test card: booked ahead, passed, failed, or not booked yet.
  const test = f("test");
  if (test < 0.35)
    rows.test = { date: day(7 + Math.floor(f("when") * 40), now) };
  else if (test < 0.5) {
    rows.test = {
      date: day(-10, now),
      result: "passed",
      resultDay: day(-9, now),
    };
  } else if (test < 0.6) {
    rows.test = {
      date: day(-12, now),
      result: "failed",
      resultDay: day(-11, now),
    };
  }

  // Did today's drive.
  if (f("daily") < 0.5) {
    const today = day(0, now);
    rows["daily-drive"] = {
      day: today,
      id: dailyDriveId(today),
      clean: f("clean") < 0.6,
    };
  }

  return rows;
}
