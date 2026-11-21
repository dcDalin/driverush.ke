/**
 * The course page's question about the learner's NTSA test. Before the test:
 * "When is your NTSA test?" After the day has gone by: "How did it go?" Which
 * one, and when, is decided by `cardStage` in `test-date.ts`. The answer stays
 * on this device; the date and result go to analytics, so DriveRush can see
 * whether learners pass.
 */
import * as React from "react";

import { analytics } from "~/lib/analytics";
import {
  daysBetween,
  isDay,
  today,
  type TestCardStage,
  type TestRecord,
  type TestResult,
} from "~/lib/test-date";
import { cn } from "~/lib/utils";

import { Button } from "~/components/ui/button";

const linkButton =
  "min-h-11 px-3 text-[13.5px] font-semibold text-ink-2 underline underline-offset-4 outline-none hover:text-ink focus-visible:text-ink";

const card =
  "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md border border-ink/25 bg-surface px-4 py-3 text-left";

/** "3 Dec", the way the test day is said back. */
function shortDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
  });
}

export function TestCard({
  stage,
  record,
  update,
  levelsDone,
  readiness,
  mockBestClean,
  className,
}: {
  stage: TestCardStage;
  record: TestRecord;
  update: (patch: Partial<TestRecord>) => TestRecord;
  levelsDone: number;
  /** 0 to 100, the "Board ready" figure. */
  readiness: number;
  mockBestClean: number;
  className?: string;
}) {
  const [day, setDay] = React.useState("");
  // A word back once it is answered, in place of the question.
  const [thanks, setThanks] = React.useState<string | null>(null);
  const now = today();

  if (thanks) {
    return (
      <div className={cn(card, className)} role="status">
        <p className="m-0 min-w-0 flex-1 basis-48 text-[14px] font-semibold leading-snug text-ink">
          {thanks}
        </p>
      </div>
    );
  }

  if (stage === "result" && record.date) {
    const report = (result: TestResult) => {
      update({ result, resultDay: now });
      analytics.testResultReported({
        result,
        days_after_test: daysBetween(record.date!, now),
        levels_done: levelsDone,
        readiness,
        mock_best_clean: mockBestClean,
      });
      setThanks(
        result === "passed"
          ? "Well done! Thank you for telling us."
          : result === "failed"
            ? "Sorry it didn't go your way. Your progress is saved for the next try."
            : "Thanks. We'll ask again in a couple of weeks.",
      );
    };
    return (
      <div className={cn(card, className)}>
        <p className="m-0 min-w-0 flex-1 basis-48 text-[14px] font-semibold leading-snug text-ink">
          Your NTSA test was on {shortDay(record.date)}. How did it go?
        </p>
        <span className="flex flex-wrap items-center gap-1">
          <Button variant="green" onClick={() => report("passed")}>
            I passed
          </Button>
          <Button variant="paper" onClick={() => report("failed")}>
            Not this time
          </Button>
          <button
            type="button"
            className={linkButton}
            onClick={() => report("not_yet")}
          >
            Not taken yet
          </button>
        </span>
      </div>
    );
  }

  const putOff = (notBooked: boolean) => {
    update({ putOff: now });
    if (notBooked) {
      analytics.testDateSet({ booked: false });
      setThanks("Thanks. We'll ask again in a couple of weeks.");
    } else {
      analytics.testCardDismissed({ stage: "date" });
      setThanks("No problem. We'll ask another time.");
    }
  };
  const valid = isDay(day) && daysBetween(now, day) >= 0;

  return (
    <form
      className={cn(card, className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const days = daysBetween(now, day);
        update({ date: day, putOff: undefined });
        analytics.testDateSet({ booked: true, days_until: days });
        setThanks(
          days === 0
            ? "Saved. Good luck today!"
            : `Saved. Your test is in ${days} ${days === 1 ? "day" : "days"}.`,
        );
      }}
    >
      <label
        htmlFor="test-day"
        className="m-0 min-w-0 flex-1 basis-48 text-[14px] font-semibold leading-snug text-ink"
      >
        When is your NTSA test?
      </label>
      <span className="flex flex-wrap items-center gap-2">
        <input
          id="test-day"
          type="date"
          min={now}
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="h-11 rounded-md border border-ink/25 bg-surface px-3 text-[14.5px] text-ink outline-none focus-visible:border-ink"
        />
        <Button type="submit" variant="ink" disabled={!valid}>
          Save
        </Button>
      </span>
      <span className="flex w-full flex-wrap items-center">
        <button
          type="button"
          className={cn(linkButton, "pl-0")}
          onClick={() => putOff(true)}
        >
          Not booked yet
        </button>
        <button
          type="button"
          className={linkButton}
          onClick={() => putOff(false)}
        >
          Not now
        </button>
      </span>
    </form>
  );
}
