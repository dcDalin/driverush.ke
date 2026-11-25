/**
 * The question about the learner's NTSA test, on the course page and, from
 * the third finished level, at the end of a level in the game. Before the
 * test: "When is your NTSA test?", and the answer buys a plan (levels a day,
 * `test-plan.ts`) and a daily reminder in their own calendar
 * (`test-reminder.ts`). After the day has gone by: "How did it go?" Which
 * one, and when, is decided by `cardStage` in `test-date.ts`. The answer stays
 * on this device; the date and result go to analytics, so DriveRush can see
 * whether learners pass.
 */
import * as React from "react";

import { ProudShare } from "~/components/board/proud-share";
import { Icon } from "~/components/brand/icon";
import { CalendarIcon } from "~/components/brand/icons";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { analytics } from "~/lib/analytics";
import { COURSE_LEVELS } from "~/lib/board/curriculum";
import {
  daysBetween,
  isDay,
  type TestCardStage,
  type TestRecord,
  type TestResult,
  today,
} from "~/lib/test-date";
import { planPromise, testPlan } from "~/lib/test-plan";
import { googleCalendarUrl, ICS_NAME, icsHref } from "~/lib/test-reminder";
import { cn } from "~/lib/utils";

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

/** A day as "2026-12-03" and back, in the learner's own time zone. */
function dayToDate(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dateToDay(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/**
 * The test day, picked on a calendar (shadcn's date picker): a button that
 * says the day, and a month to choose it from. Days before today are out.
 */
function TestDayPicker({
  id,
  describedBy,
  day,
  now,
  onPick,
}: {
  id: string;
  describedBy: string;
  day: string;
  now: string;
  onPick: (day: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const picked = isDay(day) ? dayToDate(day) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="paper"
          aria-describedby={describedBy}
          className={cn(
            "min-w-44 justify-start font-medium",
            !picked && "text-ink-3",
          )}
        >
          <Icon icon={CalendarIcon} size={18} />
          {picked
            ? picked.toLocaleDateString("en-KE", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "Pick the day"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={picked}
          defaultMonth={picked ?? dayToDate(now)}
          disabled={{ before: dayToDate(now) }}
          onSelect={(date) => {
            if (!date) return;
            onPick(dateToDay(date));
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

/** A daily practice reminder in the learner's own calendar, two ways in. */
function Reminder({ record, now }: { record: TestRecord; now: string }) {
  const google = googleCalendarUrl(record, now);
  const ics = icsHref(record, now, Date.now());
  if (!google || !ics || !record.date) return null;
  const days_until = daysBetween(now, record.date);
  return (
    <span className="flex w-full flex-wrap items-center gap-x-1">
      <span className="text-[13.5px] text-ink-2">
        Remind me to practise every evening:
      </span>
      <a
        href={google}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(linkButton, "inline-flex items-center")}
        onClick={() =>
          analytics.testReminderAdded({ calendar: "google", days_until })
        }
      >
        Google Calendar
      </a>
      <a
        href={ics}
        download={ICS_NAME}
        className={cn(linkButton, "inline-flex items-center")}
        onClick={() =>
          analytics.testReminderAdded({ calendar: "ics", days_until })
        }
      >
        iPhone or other calendar
      </a>
    </span>
  );
}

export function TestCard({
  stage,
  record,
  update,
  levelsDone,
  doneToday,
  readiness,
  mockBestClean,
  surface,
  tone = "page",
  className,
}: {
  stage: TestCardStage;
  record: TestRecord;
  update: (patch: Partial<TestRecord>) => TestRecord;
  levelsDone: number;
  /** Levels finished today, for the plan said back on saving. */
  doneToday: number;
  /** 0 to 100, the "Board ready" figure. */
  readiness: number;
  mockBestClean: number;
  /** Where it is asked, for analytics. */
  surface: "course_page" | "level_done";
  /** `game` sits on the board's dark cards. */
  tone?: "page" | "game";
  className?: string;
}) {
  const [day, setDay] = React.useState("");
  // A word back once it is answered, in place of the question; with a date
  // saved, the calendar reminder under it.
  const [thanks, setThanks] = React.useState<{
    text: string;
    remind?: TestRecord;
    /** They passed: the proudest moment there is, offered for sharing. */
    passed?: boolean;
  } | null>(null);
  const now = today();
  // On the game's cards the tokens take their dark values.
  const shell = cn(card, tone === "game" && "dark bg-paper-2", className);

  React.useEffect(() => {
    analytics.testCardShown({ stage, surface });
  }, [stage, surface]);

  if (thanks?.passed) {
    return (
      <ProudShare
        moment={{ moment: "passed", n: 0 }}
        tone={tone}
        className={className}
      />
    );
  }
  if (thanks) {
    return (
      <div className={shell} role="status">
        <p className="m-0 min-w-0 flex-1 basis-48 text-[14px] leading-snug font-semibold text-ink">
          {thanks.text}
        </p>
        {thanks.remind && <Reminder record={thanks.remind} now={now} />}
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
      setThanks({
        passed: result === "passed",
        text:
          result === "passed"
            ? "Well done! Thank you for telling us."
            : result === "failed"
              ? "Sorry it didn't go your way. Your progress is saved for the next try."
              : "Thanks. We'll ask again in a couple of weeks.",
      });
    };
    return (
      <div className={shell}>
        <p className="m-0 min-w-0 flex-1 basis-48 text-[14px] leading-snug font-semibold text-ink">
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
      analytics.testDateSet({ booked: false, surface });
      setThanks({ text: "Thanks. We'll ask again in a couple of weeks." });
    } else {
      analytics.testCardDismissed({ stage: "date" });
      setThanks({ text: "No problem. We'll ask another time." });
    }
  };
  const valid = isDay(day) && daysBetween(now, day) >= 0;

  return (
    <form
      className={shell}
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const days = daysBetween(now, day);
        const saved = update({ date: day, putOff: undefined });
        analytics.testDateSet({ booked: true, days_until: days, surface });
        const promise = planPromise(
          testPlan(saved, levelsDone, COURSE_LEVELS.length, doneToday, now),
        );
        setThanks({
          text:
            days === 0
              ? "Saved. Good luck today!"
              : promise
                ? `Saved. ${promise}`
                : `Saved. Your test is in ${days} ${days === 1 ? "day" : "days"}.`,
          remind: saved,
        });
      }}
    >
      <span className="m-0 min-w-0 flex-1 basis-48 text-[14px] leading-snug text-ink">
        <label htmlFor={`test-day-${surface}`} className="block font-semibold">
          When is your NTSA test?
        </label>
        <span id={`test-day-${surface}-why`}>
          Set it and we'll plan your levels so you're ready in time.
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <TestDayPicker
          id={`test-day-${surface}`}
          describedBy={`test-day-${surface}-why`}
          day={day}
          now={now}
          onPick={setDay}
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
