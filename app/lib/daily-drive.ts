/**
 * Today's drive: one driving task a day, the same for every learner in Kenya,
 * like a daily puzzle. It keeps the practice streak going
 * (`practice-streak.ts`: any practice counts, this is the quickest), and a
 * clean pass is worth sharing because everyone drove the same task.
 *
 * The day is Nairobi's (UTC+3, no daylight saving), so the drive changes at
 * midnight in Kenya for everyone, whatever a phone's clock zone says. The
 * tasks come round in a fixed shuffled order, every one before any repeats.
 *
 * Pure apart from the small record of today's pass, kept on the device under
 * its own key like the streak and the test date.
 */
import * as React from "react";

import { TASK_NAMES, type TaskName } from "./board/task-names";
import { BOARD_PLAY_PATH } from "./board-guides";

export const DAILY_KEY = "driverush:daily-drive";

/** Nairobi is three hours ahead of UTC all year. */
const NAIROBI_MS = 3 * 60 * 60 * 1000;

/** The Kenyan calendar day at `now`, `YYYY-MM-DD`. */
export function kenyaDay(now: number): string {
  return new Date(now + NAIROBI_MS).toISOString().slice(0, 10);
}

/** Whole days from 1 Jan 1970 to `day` (`YYYY-MM-DD`). */
function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y!, m! - 1, d) / 86_400_000);
}

/** A small seeded random, so the order is the same on every phone. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Every task, in the fixed order the days take them. Shuffled once with a
 * fixed seed, so neighbouring days get unlike tasks, not the list's order.
 */
export function dailyOrder(tasks: readonly TaskName[] = TASK_NAMES): string[] {
  const ids = tasks.map((t) => t.id);
  const random = seeded(20261124);
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  }
  return ids;
}

const ORDER = dailyOrder();

/** The task id for a Kenyan day. */
export function dailyDriveId(day: string, order: readonly string[] = ORDER) {
  const n = order.length;
  // the index is always inside the list, which is never empty
  return order[((dayNumber(day) % n) + n) % n]!;
}

/** Where today's drive opens. */
export function dailyDriveHref(id: string): string {
  return `${BOARD_PLAY_PATH}?task=${encodeURIComponent(id)}&daily=1`;
}

/** Is this the drive of `day`, opened as the daily drive? */
export function isDailyDrive(
  taskId: string | null | undefined,
  dailyParam: string | null,
  day: string,
): boolean {
  return dailyParam === "1" && taskId != null && taskId === dailyDriveId(day);
}

export type DailyRecord = {
  /** The Kenyan day of the last pass of that day's drive. */
  day: string;
  id: string;
  /** No mistake and no hint. */
  clean: boolean;
};

export function parseDailyRecord(raw: string | null): DailyRecord | null {
  try {
    const v = JSON.parse(raw || "null") as Partial<DailyRecord> | null;
    if (!v || typeof v.day !== "string" || typeof v.id !== "string") {
      return null;
    }
    return { day: v.day, id: v.id, clean: v.clean === true };
  } catch {
    return null;
  }
}

/** Today's drive was passed: kept, cleanest pass of the day wins. */
export function recordDailyPass(id: string, clean: boolean, now = Date.now()) {
  if (typeof window === "undefined") return;
  const day = kenyaDay(now);
  try {
    const before = parseDailyRecord(window.localStorage.getItem(DAILY_KEY));
    const wasClean = before?.day === day && before.id === id && before.clean;
    window.localStorage.setItem(
      DAILY_KEY,
      JSON.stringify({ day, id, clean: clean || wasClean }),
    );
    // Pages listening for the record (home, the Board page) hear it now.
    window.dispatchEvent(new Event(DAILY_EVENT));
  } catch {
    // Private mode or full storage: it just won't show as done.
  }
}

const DAILY_EVENT = "driverush:daily-drive";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("focus", onChange);
  window.addEventListener(DAILY_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("focus", onChange);
    window.removeEventListener(DAILY_EVENT, onChange);
  };
}

function readRaw(): string {
  try {
    return window.localStorage.getItem(DAILY_KEY) ?? "";
  } catch {
    return "";
  }
}

export type DailyDrive = {
  task: TaskName;
  href: string;
  /** Passed today, and whether cleanly. */
  done: boolean;
  clean: boolean;
};

/**
 * Today's drive and whether it is done, for the pages that offer it. `null`
 * on the server and during hydration: the day and the record are the
 * device's, so they wait for the browser.
 */
export function useDailyDrive(): DailyDrive | null {
  const raw = React.useSyncExternalStore(subscribe, readRaw, () => null);
  return React.useMemo(() => {
    if (raw == null) return null;
    const day = kenyaDay(Date.now());
    const id = dailyDriveId(day);
    const task = TASK_NAMES.find((t) => t.id === id);
    if (!task) return null;
    const record = parseDailyRecord(raw || null);
    const done = record?.day === day && record.id === id;
    return {
      task,
      href: dailyDriveHref(id),
      done,
      clean: done && record.clean,
    };
  }, [raw]);
}
