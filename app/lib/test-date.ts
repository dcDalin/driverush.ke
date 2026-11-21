/**
 * The learner's NTSA test: when it is, and, once the day has passed, how it
 * went. The course page asks for both with a small card (`test-card.tsx`).
 *
 * Kept on this device under its own key, like the practice streak, so adding
 * it never bumps the board store's persist version. Only the date and the
 * result go to analytics (`test_date_set`, `test_result_reported` and the
 * `test_*` person properties), never anything else about the learner.
 *
 * The rules for when the card shows are pure and tested on their own.
 */
import * as React from "react";

import { dayKey } from "./practice-streak";

export const TEST_KEY = "driverush:test";

/** A finished level count before the card first asks for the date. */
export const ASK_AFTER_LEVELS = 3;
/** Days before asking again, after "Not now", "Not booked yet" or "Not taken yet". */
export const ASK_AGAIN_DAYS = 14;

export type TestResult = "passed" | "failed" | "not_yet";

export type TestRecord = {
  /** The test day, `YYYY-MM-DD`, local. */
  date?: string;
  /** The day the card was last put off, `YYYY-MM-DD`. */
  putOff?: string;
  result?: TestResult;
  /** The day the result was given. */
  resultDay?: string;
};

export type TestCardStage = "date" | "result";

/** Whole days from `from` to `to`, both `YYYY-MM-DD`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  // Noon on each day, so a clock change never tips the count by one.
  const a = new Date(fy, fm - 1, fd, 12).getTime();
  const b = new Date(ty, tm - 1, td, 12).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** A real `YYYY-MM-DD` day. */
export function isDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

function recently(day: string | undefined, today: string): boolean {
  return day != null && daysBetween(day, today) < ASK_AGAIN_DAYS;
}

/**
 * Which question the card asks today, or `null` for none.
 *
 *  - A result of passed or failed ends it.
 *  - Once the test day has gone by, it asks how it went. "Not taken yet"
 *    asks again two weeks later.
 *  - With no date, it asks for one after a few finished levels, and not
 *    again for two weeks once put off.
 *  - A date still to come: nothing to ask.
 */
export function cardStage(
  record: TestRecord,
  levelsDone: number,
  today: string,
): TestCardStage | null {
  if (record.result === "passed" || record.result === "failed") return null;
  if (record.date) {
    if (daysBetween(record.date, today) < 1) return null;
    if (record.result === "not_yet" && recently(record.resultDay, today)) {
      return null;
    }
    return "result";
  }
  if (levelsDone < ASK_AFTER_LEVELS) return null;
  if (recently(record.putOff, today)) return null;
  return "date";
}

/** Days until the test, or `null` with no date or once it has gone by. */
export function daysLeft(record: TestRecord, today: string): number | null {
  if (!record.date) return null;
  const days = daysBetween(today, record.date);
  return days >= 0 ? days : null;
}

/** The test's distance in a few bands, for analytics. */
export function testBucket(
  record: TestRecord,
  today: string,
): "none" | "past" | "0-7" | "8-30" | "31+" {
  if (!record.date) return "none";
  const days = daysBetween(today, record.date);
  if (days < 0) return "past";
  if (days <= 7) return "0-7";
  if (days <= 30) return "8-30";
  return "31+";
}

/** The saved record, cleaned of anything that isn't what it should be. */
export function parseTestRecord(raw: string | null): TestRecord {
  try {
    const value = JSON.parse(raw || "{}") as Record<string, unknown>;
    const record: TestRecord = {};
    if (isDay(value.date)) record.date = value.date;
    if (isDay(value.putOff)) record.putOff = value.putOff;
    if (
      value.result === "passed" ||
      value.result === "failed" ||
      value.result === "not_yet"
    ) {
      record.result = value.result;
    }
    if (isDay(value.resultDay)) record.resultDay = value.resultDay;
    return record;
  } catch {
    return {};
  }
}

export function readTestRecord(): TestRecord {
  try {
    return parseTestRecord(window.localStorage.getItem(TEST_KEY));
  } catch {
    return {};
  }
}

function writeTestRecord(record: TestRecord) {
  try {
    window.localStorage.setItem(TEST_KEY, JSON.stringify(record));
  } catch {
    // Private mode or full storage: the card asks again next visit.
  }
}

export function today(): string {
  return dayKey(Date.now());
}

/**
 * The record, read once the page is running (`null` before, so the server
 * and the first render agree), and a way to change it.
 */
export function useTestRecord(): [
  TestRecord | null,
  (patch: Partial<TestRecord>) => TestRecord,
] {
  const [record, setRecord] = React.useState<TestRecord | null>(null);
  React.useEffect(() => setRecord(readTestRecord()), []);
  const update = React.useCallback((patch: Partial<TestRecord>) => {
    const next = { ...readTestRecord(), ...patch };
    writeTestRecord(next);
    setRecord(next);
    return next;
  }, []);
  return [record, update];
}
