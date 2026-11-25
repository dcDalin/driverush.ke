/**
 * A learner's saved progress, boiled down for a school's list: levels of the
 * board course done, the practice streak, and their NTSA test date and
 * result. Reads the rows `school_student_progress` returns (one object per
 * store, each `{ json: <the store's saved value> }`).
 */
import { MASTERED_BOX } from "~/lib/pelican-progress";

export type ProgressSummary = {
  levels: number;
  streakDays: number;
  testDate: string | null;
  testResult: string | null;
  signsMastered: number;
};

type Stored = Record<string, unknown>;

function json(progress: Stored, store: string): Record<string, unknown> | null {
  const row = progress[store];
  if (!row || typeof row !== "object") return null;
  const value = (row as { json?: unknown }).json;
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function state(
  progress: Stored,
  store: string,
): Record<string, unknown> | null {
  const value = json(progress, store);
  const inner = value?.state;
  return inner && typeof inner === "object"
    ? (inner as Record<string, unknown>)
    : null;
}

/** Signs in the top Leitner box of a trainer's saved progress. */
function mastered(progress: Stored, store: string): Set<string> {
  const boxes = state(progress, store)?.progress;
  const out = new Set<string>();
  if (!boxes || typeof boxes !== "object") return out;
  for (const [id, entry] of Object.entries(boxes as Record<string, unknown>)) {
    const box =
      entry && typeof entry === "object"
        ? (entry as { box?: unknown }).box
        : undefined;
    if (typeof box === "number" && box >= MASTERED_BOX) out.add(id);
  }
  return out;
}

export function summarizeProgress(progress: unknown): ProgressSummary {
  const stored = (
    progress && typeof progress === "object" ? progress : {}
  ) as Stored;
  const learned = state(stored, "board")?.learned;
  const streak = json(stored, "streak");
  const test = json(stored, "test");
  const signs = new Set([
    ...mastered(stored, "pelican"),
    ...mastered(stored, "signs3d"),
  ]);
  return {
    levels: Array.isArray(learned) ? learned.length : 0,
    streakDays: typeof streak?.days === "number" ? streak.days : 0,
    testDate: typeof test?.date === "string" ? test.date : null,
    testResult: typeof test?.result === "string" ? test.result : null,
    signsMastered: signs.size,
  };
}
