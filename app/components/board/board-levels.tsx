/**
 * The Board page's working part: the picture, one button that starts the
 * course or carries on with it, and the units. Each unit links to its levels
 * on the levels page (`level-picker.tsx`), where any level can be picked by
 * its picture. All of it is in the server's HTML. What is done, and which
 * level is next, is filled in from this browser's saved progress once the
 * page is running.
 */
import * as React from "react";
import { Link } from "react-router";

import {
  BOARD_LEVELS_PATH,
  BOARD_PLAY_PATH,
  levelHref,
} from "~/lib/board-guides";
import {
  COURSE_LEVELS,
  DAILY_GOAL,
  UNITS,
  doneCount,
  levelDone,
  nextLevel,
  readiness,
  unitState,
  weakestDrive,
  type UnitState,
} from "~/lib/board/curriculum";
import { dayKey, usePracticeStreak } from "~/lib/practice-streak";
import {
  cardStage,
  daysLeft,
  today as todayKey,
  useTestRecord,
  type TestCardStage,
} from "~/lib/test-date";
import { useCourseProgress } from "~/lib/use-course-progress";
import { cn } from "~/lib/utils";

import { BoardThumb } from "~/components/board/board-thumb";
import { CourseLabel } from "~/components/board/course-label";
import { Icon } from "~/components/brand/icon";
import { InstallNudge } from "~/components/brand/install-nudge";
import { TestCard } from "~/components/board/test-card";
import {
  CheckIcon,
  ChevronRightIcon,
  LockIcon,
  PlayIcon,
} from "~/components/brand/icons";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";

const TOTAL = COURSE_LEVELS.length;

const quiet =
  "inline-flex min-h-11 items-center font-sans text-[14.5px] font-bold text-ink underline decoration-rush decoration-2 underline-offset-4 outline-none hover:text-rush focus-visible:text-rush";

export function BoardLevels({ className }: { className?: string }) {
  const saved = useCourseProgress();
  const empty = { learned: [], bestStars: {} };
  const done = saved ? doneCount(saved) : 0;
  const next = nextLevel(saved ?? empty);
  const mock = next.kind === "mock";
  const href = mock ? BOARD_PLAY_PATH : levelHref(next.id);
  const label = mock
    ? "Take the mock test"
    : done > 0
      ? `Continue: level ${next.n}`
      : "Start level 1";
  const units = UNITS.filter((unit) => unit.id !== "mock");
  const ready = saved ? readiness(saved) : 0;
  const streak = usePracticeStreak();
  const today =
    saved?.daily && saved.daily.day === dayKey(Date.now())
      ? saved.daily.done
      : 0;
  // With every level done, the one to drive again is the one with fewest stars.
  const weakest = saved && mock ? weakestDrive(saved) : undefined;
  // The NTSA test: asked for after a few levels, asked about once it's past.
  const [test, updateTest] = useTestRecord();
  const now = todayKey();
  const testStage = test && saved ? cardStage(test, done, now) : null;
  const testIn = test ? daysLeft(test, now) : null;
  // Once asked, the card stays for this visit, so its thanks can be read.
  const [testCard, setTestCard] = React.useState<TestCardStage | null>(null);
  React.useEffect(() => {
    if (testStage) setTestCard((was) => was ?? testStage);
  }, [testStage]);

  return (
    <div id="levels" className={cn("grid scroll-mt-20 gap-5", className)}>
      <div className="overflow-hidden rounded-soft border border-ink/25">
        {/* The button below is the link that is read out. This is the same
            way in for anyone who taps the picture. */}
        <Link
          to={href}
          aria-hidden
          tabIndex={-1}
          className="group block outline-none"
        >
          <BoardThumb priority className="aspect-[5/2] sm:aspect-[3/1]" />
        </Link>
        <div className="grid gap-3 bg-surface p-4">
          <Button asChild variant="rush" size="lg" className="w-full">
            <Link to={href}>
              <Icon icon={PlayIcon} size={18} />
              <CourseLabel
                label={label}
                ready={saved != null}
                started={done > 0}
              />
            </Link>
          </Button>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-[14px] font-bold leading-snug text-ink">
                {mock ? "Every level is done." : next.title}
              </span>
              <span className="shrink-0 font-mono text-[10.5px] font-bold uppercase tracking-widest tabular-nums text-ink-3">
                {done} of {TOTAL}
              </span>
            </div>
            <Progress
              value={(done / TOTAL) * 100}
              tone="green"
              showTicks={false}
              aria-label="Levels done"
              className="h-2.5"
            />
          </div>
          {/* Only for a learner who has started: a first visit stays one button. */}
          {saved && done > 0 && (
            <dl className="m-0 grid grid-cols-3 gap-2 border-t border-ink/15 pt-3 text-center">
              <div>
                <dt className="font-mono text-[9.5px] font-bold uppercase tracking-widest text-ink-3">
                  Board ready
                </dt>
                <dd className="m-0 mt-0.5 font-display text-[20px] font-extrabold leading-none tabular-nums text-ink">
                  {ready}%
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[9.5px] font-bold uppercase tracking-widest text-ink-3">
                  Days in a row
                </dt>
                <dd className="m-0 mt-0.5 font-display text-[20px] font-extrabold leading-none tabular-nums text-ink">
                  {streak?.days ?? 0}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[9.5px] font-bold uppercase tracking-widest text-ink-3">
                  Today
                </dt>
                <dd
                  className="m-0 mt-1.5 flex items-center justify-center gap-1.5"
                  aria-label={`${Math.min(today, DAILY_GOAL)} of ${DAILY_GOAL} levels today`}
                >
                  {Array.from({ length: DAILY_GOAL }, (_, i) => (
                    <span
                      key={i}
                      aria-hidden
                      className={cn(
                        "size-3 rounded-full border border-ink/40",
                        i < today ? "bg-kenya-green" : "bg-paper-2",
                      )}
                    />
                  ))}
                </dd>
              </div>
            </dl>
          )}
          {saved && done > 0 && testIn != null && (
            <p className="m-0 text-center text-[13.5px] font-semibold text-ink-2">
              {testIn === 0
                ? "Your NTSA test is today. Good luck!"
                : `Your NTSA test is in ${testIn} ${testIn === 1 ? "day" : "days"}.`}
            </p>
          )}
          {weakest && weakest.kind === "drive" && (
            <Link to={levelHref(weakest.id)} className={quiet}>
              Or get 3 stars on level {weakest.n}: {weakest.title}
            </Link>
          )}
        </div>
      </div>

      {/* After a finished level, not before: a first visit is not asked for
          anything. */}
      {/* One card at a time, and the test comes first. */}
      {test && testCard ? (
        <TestCard
          stage={testCard}
          record={test}
          update={updateTest}
          levelsDone={done}
          readiness={ready}
          mockBestClean={saved?.mockBest?.clean ?? 0}
        />
      ) : (
        done >= 1 && <InstallNudge surface="levels_page" />
      )}

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="m-0 font-display text-[18px] font-extrabold uppercase leading-tight tracking-tight text-ink">
            Units
          </h2>
          <Link to={BOARD_LEVELS_PATH} className={quiet}>
            All levels
          </Link>
        </div>
        <ol className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          {units.map((unit, i) => {
            const unitDone = saved
              ? unit.levels.filter((l) => levelDone(l, saved)).length
              : 0;
            const state: UnitState = saved ? unitState(unit, saved) : "open";
            return (
              <li key={unit.id}>
                <Link
                  to={`${BOARD_LEVELS_PATH}#unit-${unit.id}`}
                  className={cn(
                    "flex h-full min-h-16 items-center gap-3 rounded-soft border px-4 py-3 text-ink no-underline outline-none transition-colors hover:bg-paper-2 focus-visible:bg-paper-2",
                    state === "done"
                      ? "border-success-line bg-state-done-soft"
                      : state === "current"
                        ? "border-2 border-ink bg-surface"
                        : state === "locked"
                          ? "border-dashed border-neutral-line bg-surface"
                          : "border-neutral-line bg-surface",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-ink-3">
                      Unit {i + 1}
                      {state === "current" && (
                        <span className="rounded-soft bg-state-next px-1.5 py-0.5 leading-none text-state-next-foreground">
                          In progress
                        </span>
                      )}
                      {state === "done" && (
                        <span className="text-success-strong">Done</span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "block font-display text-[16px] font-extrabold uppercase leading-tight tracking-tight",
                        state === "locked" && "text-neutral-strong",
                      )}
                    >
                      {unit.title}
                    </span>
                    <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-2">
                      {unit.blurb}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-bold tabular-nums",
                      state === "done"
                        ? "text-success-strong"
                        : "text-neutral-strong",
                    )}
                  >
                    {state === "done" && <Icon icon={CheckIcon} size={12} />}
                    {state === "locked" && (
                      <>
                        <Icon icon={LockIcon} size={12} />
                        <span className="sr-only">Ahead of you.</span>
                      </>
                    )}
                    {unitDone} / {unit.levels.length}
                  </span>
                  <Icon
                    icon={ChevronRightIcon}
                    size={18}
                    className="shrink-0"
                  />
                </Link>
              </li>
            );
          })}
        </ol>
      </div>

      <Link
        to={BOARD_PLAY_PATH}
        className="flex min-h-16 items-center gap-3 border border-ink/25 bg-surface px-4 py-3 text-ink no-underline outline-none transition-colors hover:bg-paper-2 focus-visible:bg-paper-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[16px] font-extrabold uppercase leading-tight tracking-tight">
            Mock test
          </span>
          <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-2">
            Five tasks picked for you, mixed from every unit. Take it any time.
          </span>
          {saved?.mockBest && (
            <span className="mt-1 block font-mono text-[10.5px] font-bold uppercase tracking-widest text-ink-3">
              Best: {saved.mockBest.clean} of {saved.mockBest.total} clean
            </span>
          )}
        </span>
        <Badge variant="rush" className="shrink-0 border px-1.5">
          Drive
        </Badge>
        <Icon icon={ChevronRightIcon} size={18} className="shrink-0" />
      </Link>

      <Link to={`${BOARD_PLAY_PATH}?learn=1`} className={quiet}>
        Explore the board
      </Link>
    </div>
  );
}
