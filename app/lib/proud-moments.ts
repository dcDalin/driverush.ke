/**
 * The moments a learner is proud of, and asked to share: a unit of the board
 * finished, the whole course, a run of days practising, and a passed NTSA
 * test. Each is offered once, ever: the ones already offered are kept on this
 * device under their own key, like the practice streak.
 *
 * The share itself is `{ kind: "milestone" }` in `share.ts`; the card that
 * offers it is `proud-share.tsx`. The rules here are pure and tested.
 */
import {
  COURSE_LEVELS,
  UNITS,
  levelDone,
  type CourseProgress,
  type Level,
} from "./board/curriculum";
import type { Milestone } from "./share";

export const PROUD_KEY = "driverush:proud";

/** Days in a row worth a share. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;

export type ProudMoment = { moment: Milestone; n: number };

/** The units that can be finished, in order. */
const COURSE_UNITS = UNITS.filter((unit) => unit.id !== "mock");

/** One name per moment, for the record of those already offered. */
export function momentKey({ moment, n }: ProudMoment): string {
  return moment === "passed" ? "passed" : `${moment}:${n}`;
}

/**
 * What finishing `level` earns, with the progress as it stands after it: the
 * whole course, else its unit, else nothing. Only when the level is part of
 * what it finished, so opening the course later earns nothing.
 */
export function levelMoment(
  level: Level,
  saved: CourseProgress,
): ProudMoment | null {
  if (level.kind === "mock" || !levelDone(level, saved)) return null;
  if (COURSE_LEVELS.every((l) => levelDone(l, saved))) {
    return { moment: "course", n: COURSE_LEVELS.length };
  }
  const index = COURSE_UNITS.findIndex((unit) => unit.id === level.unit);
  if (index < 0) return null;
  const unit = COURSE_UNITS[index];
  if (unit.levels.every((l) => levelDone(l, saved))) {
    return { moment: "unit", n: index + 1 };
  }
  return null;
}

/** A run of days worth a share, or nothing. */
export function streakMoment(days: number): ProudMoment | null {
  return (STREAK_MILESTONES as readonly number[]).includes(days)
    ? { moment: "streak", n: days }
    : null;
}

/** The first of these not offered yet, or nothing. */
export function nextMoment(
  candidates: readonly (ProudMoment | null)[],
  offered: readonly string[],
): ProudMoment | null {
  for (const candidate of candidates) {
    if (candidate && !offered.includes(momentKey(candidate))) return candidate;
  }
  return null;
}

export function parseOffered(raw: string | null): string[] {
  try {
    const value = JSON.parse(raw || "[]") as unknown;
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

export function readOffered(): string[] {
  try {
    return parseOffered(window.localStorage.getItem(PROUD_KEY));
  } catch {
    return [];
  }
}

/** Remember that a moment was offered, so it is not offered again. */
export function markOffered(moment: ProudMoment): void {
  try {
    const offered = readOffered();
    const key = momentKey(moment);
    if (offered.includes(key)) return;
    window.localStorage.setItem(PROUD_KEY, JSON.stringify([...offered, key]));
  } catch {
    // Private mode or full storage: it may be offered again. No harm.
  }
}
