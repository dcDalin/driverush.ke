/**
 * The course, in two parts (owner, 2026-11-28: home says what is next, the
 * Board page is the course's map):
 *
 *   CourseCard   the picture, one button that starts the course or carries
 *                on with it, and how far along the learner is. `full` adds
 *                their numbers (board ready, days in a row, today), the test
 *                date card and "add to home screen": that is the home page
 *                of a learner who has started. The Board page keeps it slim.
 *   BoardLevels  the Board page's working part: the slim card, then the
 *                units, the mock test and "Explore the board".
 *
 * Today's drive and Free drive sit on home only (and in the game's More
 * menu): the Board page had seven ways to drive at once.
 *
 * The units: Each unit links to its levels
 * on the levels page (`level-picker.tsx`), where any level can be picked by
 * its picture. All of it is in the server's HTML. What is done, and which
 * level is next, is filled in from this browser's saved progress once the
 * page is running.
 */
import * as React from "react";
import { Link } from "react-router";

import { BoardThumb } from "~/components/board/board-thumb";
import { CourseLabel } from "~/components/board/course-label";
import { TestCard } from "~/components/board/test-card";
import { Icon } from "~/components/brand/icon";
import {
  CheckIcon,
  ChevronRightIcon,
  LockIcon,
  PlayIcon,
} from "~/components/brand/icons";
import { InstallNudge } from "~/components/brand/install-nudge";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import {
  COURSE_LEVELS,
  DAILY_GOAL,
  doneCount,
  levelDone,
  nextLevel,
  readiness,
  UNITS,
  type UnitState,
  unitState,
  weakestDrive,
} from "~/lib/board/curriculum";
import {
  BOARD_LEVELS_PATH,
  BOARD_PLAY_PATH,
  levelHref,
} from "~/lib/board-guides";
import { dayKey, usePracticeStreak } from "~/lib/practice-streak";
import {
  cardStage,
  type TestCardStage,
  today as todayKey,
  useTestRecord,
} from "~/lib/test-date";
import { planLine, testPlan } from "~/lib/test-plan";
import { linkPrefetch } from "~/lib/ui/link-prefetch";
import { useCourseProgress } from "~/lib/use-course-progress";
import { cn } from "~/lib/utils";

const TOTAL = COURSE_LEVELS.length;
/** More levels today than this are said as "2 of 9", not drawn as dots. */
const MAX_DOTS = 6;

/** Layout for a quiet-rush Button: a long level name wraps. */
const quiet = "h-auto min-h-11 justify-start text-left whitespace-normal";

export function CourseCard({
  full = false,
  className,
}: {
  /** The learner's numbers, the test date card and the install nudge too. */
  full?: boolean;
  className?: string;
}) {
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
  // What the date buys: levels a day to be ready in time, and today's share.
  const plan = test
    ? testPlan(test, done, TOTAL, today, now)
    : ({ kind: "none" } as const);
  const goal = plan.kind === "levels" ? plan.perDay : DAILY_GOAL;
  // Once asked, the card stays for this visit, so its thanks can be read.
  const [testCard, setTestCard] = React.useState<TestCardStage | null>(null);
  React.useEffect(() => {
    if (testStage) setTestCard((was) => was ?? testStage);
  }, [testStage]);

  return (
    <div className={cn("grid gap-5", className)}>
      <div className="overflow-hidden rounded-soft border border-ink/25">
        {/* The button below is the link that is read out. This is the same
            way in for anyone who taps the picture. */}
        <Link
          prefetch={linkPrefetch()}
          to={href}
          aria-hidden
          tabIndex={-1}
          className="group block outline-none"
        >
          <BoardThumb priority className="aspect-[5/2] sm:aspect-[3/1]" />
        </Link>
        <div className="grid gap-3 bg-surface p-4">
          <Button asChild variant="rush" size="lg" className="w-full">
            <Link prefetch={linkPrefetch()} to={href}>
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
              <span className="min-w-0 text-[14px] leading-snug font-bold text-ink">
                {mock ? "Every level is done." : next.title}
              </span>
              <span className="shrink-0 font-mono text-[10.5px] font-bold tracking-widest text-ink-3 uppercase tabular-nums">
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
          {full && saved && done > 0 && (
            <dl className="m-0 grid grid-cols-3 gap-2 border-t border-ink/15 pt-3 text-center">
              <div>
                <dt className="font-mono text-[9.5px] font-bold tracking-widest text-ink-3 uppercase">
                  Board ready
                </dt>
                <dd className="m-0 mt-0.5 font-display text-[20px] leading-none font-extrabold text-ink tabular-nums">
                  {ready}%
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[9.5px] font-bold tracking-widest text-ink-3 uppercase">
                  Days in a row
                </dt>
                <dd className="m-0 mt-0.5 font-display text-[20px] leading-none font-extrabold text-ink tabular-nums">
                  {streak?.days ?? 0}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[9.5px] font-bold tracking-widest text-ink-3 uppercase">
                  Today
                </dt>
                {/* With a test date, today's share of the plan; more than
                    a row of dots holds is said as a count. */}
                {goal > MAX_DOTS ? (
                  <dd className="m-0 mt-0.5 font-display text-[20px] leading-none font-extrabold text-ink tabular-nums">
                    {Math.min(today, goal)}
                    <span className="text-[13px] text-ink-3"> of {goal}</span>
                  </dd>
                ) : (
                  <dd
                    className="m-0 mt-1.5 flex items-center justify-center gap-1.5"
                    aria-label={`${Math.min(today, goal)} of ${goal} levels today`}
                  >
                    {Array.from({ length: goal }, (_, i) => (
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
                )}
              </div>
            </dl>
          )}
          {full && saved && planLine(plan) && (
            <p className="m-0 text-center text-[14px] font-bold text-ink">
              {planLine(plan)}
            </p>
          )}
          {weakest && weakest.kind === "drive" && (
            <Button variant="quiet-rush" asChild className={quiet}>
              <Link prefetch={linkPrefetch()} to={levelHref(weakest.id)}>
                Or get 3 stars on level {weakest.n}: {weakest.title}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* After a finished level, not before: a first visit is not asked for
          anything. */}
      {/* One card at a time, and the test comes first. */}
      {!full ? null : test && testCard ? (
        <TestCard
          stage={testCard}
          record={test}
          update={updateTest}
          levelsDone={done}
          doneToday={today}
          readiness={ready}
          mockBestClean={saved?.mockBest?.clean ?? 0}
          surface="course_page"
        />
      ) : (
        done >= 1 && <InstallNudge surface="levels_page" />
      )}
    </div>
  );
}

export function BoardLevels({ className }: { className?: string }) {
  const saved = useCourseProgress();
  const units = UNITS.filter((unit) => unit.id !== "mock");
  return (
    <div id="levels" className={cn("grid scroll-mt-20 gap-5", className)}>
      <CourseCard />

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="m-0 font-display text-[18px] leading-tight font-extrabold tracking-tight text-ink uppercase">
            Units
          </h2>
          <Button variant="quiet-rush" asChild className={quiet}>
            <Link prefetch={linkPrefetch()} to={BOARD_LEVELS_PATH}>
              All levels
            </Link>
          </Button>
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
                  prefetch={linkPrefetch()}
                  to={`${BOARD_LEVELS_PATH}#unit-${unit.id}`}
                  className={cn(
                    "flex h-full min-h-16 items-center gap-3 rounded-soft border px-4 py-3 text-ink no-underline transition-colors outline-none hover:bg-paper-2 focus-visible:bg-paper-2",
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
                    <span className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-widest text-ink-3 uppercase">
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
                        "block font-display text-[16px] leading-tight font-extrabold tracking-tight uppercase",
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
        prefetch={linkPrefetch()}
        to={BOARD_PLAY_PATH}
        className="flex min-h-16 items-center gap-3 border border-ink/25 bg-surface px-4 py-3 text-ink no-underline transition-colors outline-none hover:bg-paper-2 focus-visible:bg-paper-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[16px] leading-tight font-extrabold tracking-tight uppercase">
            Mock test
          </span>
          <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-2">
            Five tasks picked for you, mixed from every unit. Take it any time.
          </span>
          {saved?.mockBest && (
            <span className="mt-1 block font-mono text-[10.5px] font-bold tracking-widest text-ink-3 uppercase">
              Best: {saved.mockBest.clean} of {saved.mockBest.total} clean
            </span>
          )}
        </span>
        <Badge variant="rush" className="shrink-0 border px-1.5">
          Drive
        </Badge>
        <Icon icon={ChevronRightIcon} size={18} className="shrink-0" />
      </Link>

      <Button variant="quiet-rush" asChild className={quiet}>
        <Link prefetch={linkPrefetch()} to={`${BOARD_PLAY_PATH}?learn=1`}>
          Explore the board
        </Link>
      </Button>
    </div>
  );
}
