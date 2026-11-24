/**
 * The plan a test date buys: how many levels a day get the learner through
 * the course the day before their NTSA test, and how today is going. Every
 * surface that shows it (home, the Board page, the end of a level) says it
 * with `planLine`, so it reads the same wherever the learner lands.
 *
 * Pure: the record, the counts and the day go in, the plan comes out.
 */
import { daysLeft, type TestRecord } from "./test-date";

export type TestPlan =
  /** No date, or the test day has gone by. */
  | { kind: "none" }
  /** The test is today. */
  | { kind: "today" }
  | {
      kind: "levels";
      daysLeft: number;
      levelsLeft: number;
      /** Levels a day to be through the course the day before the test. */
      perDay: number;
      doneToday: number;
      metToday: boolean;
    }
  /** Every level is done: a mock test a day until the test. */
  | { kind: "mock"; daysLeft: number; doneToday: number; metToday: boolean };

export function testPlan(
  record: TestRecord,
  levelsDone: number,
  total: number,
  doneToday: number,
  today: string,
): TestPlan {
  const left = daysLeft(record, today);
  if (left == null) return { kind: "none" };
  if (left === 0) return { kind: "today" };
  const levelsLeft = Math.max(0, total - levelsDone);
  if (levelsLeft === 0) {
    return { kind: "mock", daysLeft: left, doneToday, metToday: false };
  }
  // Ready the day before: with the test in `left` days, there are `left`
  // days of practice counting today, and the last of them is the eve. Today's
  // share is set by where the day started, so finishing levels today does not
  // move today's goal.
  const atDayStart = Math.min(total, levelsLeft + doneToday);
  const perDay = Math.max(1, Math.ceil(atDayStart / Math.max(1, left)));
  return {
    kind: "levels",
    daysLeft: left,
    levelsLeft,
    perDay,
    doneToday,
    metToday: doneToday >= perDay,
  };
}

function days(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

function levels(n: number): string {
  return `${n} ${n === 1 ? "level" : "levels"}`;
}

/** The plan in one sentence, or `null` when there is no plan to say. */
export function planLine(plan: TestPlan): string | null {
  switch (plan.kind) {
    case "none":
      return null;
    case "today":
      return "Your NTSA test is today. Good luck!";
    case "mock":
      return `Test in ${days(plan.daysLeft)}. Every level is done: a mock test a day from here.`;
    case "levels":
      return plan.metToday
        ? `Test in ${days(plan.daysLeft)}. Today's ${plan.perDay} ${plan.perDay === 1 ? "is" : "are"} done. See you tomorrow.`
        : `Test in ${days(plan.daysLeft)}. ${Math.min(plan.doneToday, plan.perDay)} of ${levels(plan.perDay)} today.`;
  }
}

/** What saving a date buys, said back at once: "43 levels in 12 days: 4 a day." */
export function planPromise(plan: TestPlan): string | null {
  switch (plan.kind) {
    case "levels":
      return `${levels(plan.levelsLeft)} in ${days(plan.daysLeft)}: ${plan.perDay} a day.`;
    case "mock":
      return `Every level is done, so a mock test a day until then.`;
    default:
      return null;
  }
}
