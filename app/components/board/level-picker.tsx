/**
 * Every level as a card to pick from, unit by unit, with a strip on top to
 * jump to a unit. It is the levels page, and the same thing opens over the
 * game so a learner can move to any level without leaving it. The cards carry
 * no picture of the board: a picture showed the route to drive, which is the
 * answer the level asks for.
 *
 * All of it is in the server's HTML. What is done, and which level is next, is
 * filled in from this browser's saved progress once the page is running.
 */
import * as React from "react";
import { Link } from "react-router";

import { useSkipAhead } from "~/components/board/skip-ahead";
import { Icon } from "~/components/brand/icon";
import {
  CheckIcon,
  ChevronRightIcon,
  LockIcon,
  PlayIcon,
  StarIcon,
} from "~/components/brand/icons";
import { Badge, type BadgeProps } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import {
  type CourseProgress,
  KIND_LABEL,
  type Level,
  levelDone,
  type LevelKind,
  type LevelState,
  levelState,
  nextLevel,
  UNITS,
  type UnitState,
  unitState,
} from "~/lib/board/curriculum";
import { passHref, usePaywall } from "~/lib/board/use-paywall";
import { BOARD_PLAY_PATH, levelHref } from "~/lib/board-guides";
import { linkPrefetch } from "~/lib/ui/link-prefetch";
import { useCourseProgress } from "~/lib/use-course-progress";
import { cn } from "~/lib/utils";

const KIND_BADGE: Record<LevelKind, BadgeProps["variant"]> = {
  warmup: "rush",
  slides: "cream",
  lanes: "cream",
  watch: "cyan",
  drive: "rush",
  mock: "rush",
};

const EMPTY: CourseProgress = { learned: [], bestStars: {} };

/** The word under each card, so a state never rests on colour alone. */
const STATE_WORD: Record<LevelState, string> = {
  done: "Done",
  next: "Start",
  open: "Not done",
  locked: "Locked",
};

/** The same, read out with the level's name. */
const STATE_SAID: Record<LevelState, string> = {
  done: "Done",
  next: "Next",
  open: "Not done",
  locked: "Ahead of you, locked",
};

function LevelCard({
  level,
  state,
  now,
  stars,
  replace,
  onPick,
  onLocked,
  walled = false,
}: {
  level: Level;
  /** Needs a pass (`~/lib/board/use-paywall`): opens the pass page instead. */
  walled?: boolean;
  /** Before saved progress is read, every level shows as open. */
  state: LevelState;
  /** The level the game is on, when the picker is open over it. */
  now: boolean;
  stars: number;
  replace?: boolean;
  onPick?: (level: Level) => void;
  onLocked: (level: Level) => void;
}) {
  const mock = level.kind === "mock";
  const done = state === "done";
  const next = state === "next";
  const locked = state === "locked";
  // No picture of the board: it gave the route away before the level began.
  return (
    <li className={cn(mock && "col-span-full")}>
      <Link
        // Behind the paywall, the level links to the pass itself: a real
        // link, so it can be opened, prefetched and read out as one.
        to={
          walled && !now
            ? passHref(level)
            : mock
              ? BOARD_PLAY_PATH
              : levelHref(level.id)
        }
        replace={replace && !(walled && !now)}
        prefetch={linkPrefetch()}
        data-level={level.id}
        data-state={state}
        aria-current={now ? "true" : next ? "step" : undefined}
        aria-label={
          mock
            ? undefined
            : `Level ${level.n}: ${level.title}. ${now ? "Playing now. " : ""}${STATE_SAID[state]}.`
        }
        onClick={(event) => {
          if (walled && !now) return;
          if (locked && !now) {
            event.preventDefault();
            onLocked(level);
            return;
          }
          onPick?.(level);
        }}
        className={cn(
          "group relative flex h-full min-h-[76px] items-center gap-3 rounded-soft border p-3 text-ink no-underline transition-[background-color,border-color,transform] outline-none active:scale-[0.99] motion-reduce:transition-none",
          next
            ? "border-2 border-ink bg-state-next text-state-next-foreground"
            : done
              ? "border-success-line bg-state-done-soft hover:brightness-[0.98] focus-visible:brightness-[0.98]"
              : locked
                ? "border-dashed border-neutral-line bg-state-locked-soft hover:bg-paper-2 focus-visible:bg-paper-2"
                : "border-neutral-line bg-surface hover:border-ink/40 hover:bg-paper-2 focus-visible:bg-paper-2",
          now &&
            "ring-[3px] ring-state-now ring-offset-2 ring-offset-background",
          "focus-visible:ring-2 focus-visible:ring-ink",
        )}
      >
        {/* The level's number, with its state on it. */}
        <span
          aria-hidden
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-soft font-mono text-[16px] font-bold tabular-nums",
            mock
              ? "bg-rush text-white"
              : done
                ? "bg-state-done text-state-done-foreground"
                : next
                  ? "bg-ink text-paper"
                  : locked
                    ? "bg-state-locked text-state-locked-foreground"
                    : "border border-neutral-line bg-paper-2 text-ink",
          )}
        >
          {mock ? (
            <Icon icon={PlayIcon} size={18} />
          ) : done ? (
            <Icon icon={CheckIcon} size={20} />
          ) : locked ? (
            <Icon icon={LockIcon} size={17} />
          ) : (
            level.n
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-1.5">
            {!mock && (done || locked) && (
              <span
                aria-hidden
                className="font-mono text-[10.5px] font-bold text-ink-3 tabular-nums"
              >
                {level.n}
              </span>
            )}
            <span
              className={cn(
                "block min-w-0 leading-snug font-bold",
                mock
                  ? "font-display text-[16px] font-extrabold tracking-tight uppercase"
                  : "text-[14px]",
                locked && "text-neutral-strong",
              )}
            >
              {mock ? "Mock test" : level.title}
            </span>
          </span>
          {mock && (
            <span className="block text-[13px] leading-snug opacity-80">
              Five tasks picked for you, mixed from every unit. Take it any
              time.
            </span>
          )}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge
              variant={KIND_BADGE[level.kind]}
              className={cn("border px-1.5", locked && "opacity-60")}
            >
              {KIND_LABEL[level.kind]}
            </Badge>
            {!mock && (
              <span
                aria-hidden
                className={cn(
                  "font-mono text-[10px] font-bold tracking-widest uppercase",
                  now
                    ? "text-state-now"
                    : done
                      ? "text-success-strong"
                      : next
                        ? "text-state-next-foreground"
                        : "text-neutral-strong",
                )}
              >
                {now ? "Playing" : STATE_WORD[state]}
              </span>
            )}
            {level.kind === "drive" && stars > 0 && (
              <span
                role="img"
                aria-label={`Best: ${stars} of 3 stars`}
                className="inline-flex gap-0.5"
              >
                {[1, 2, 3].map((n) => (
                  <Icon
                    key={n}
                    icon={StarIcon}
                    size={12}
                    className={n <= stars ? "text-kenya-gold" : "opacity-25"}
                  />
                ))}
              </span>
            )}
          </span>
        </span>
        {next && !now && (
          <Icon
            icon={ChevronRightIcon}
            size={20}
            aria-hidden
            className="shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        )}
      </Link>
    </li>
  );
}

/** What each look means, once, above the units. */
function StateKey() {
  const item =
    "inline-flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-widest text-ink-3";
  return (
    <p className="m-0 flex flex-wrap gap-x-4 gap-y-1.5" aria-hidden>
      <span className={item}>
        <span className="flex size-4 items-center justify-center rounded-[4px] bg-state-done text-state-done-foreground">
          <Icon icon={CheckIcon} size={11} />
        </span>
        Done
      </span>
      <span className={item}>
        <span className="size-4 rounded-[4px] bg-state-next ring-1 ring-ink" />
        Next
      </span>
      <span className={item}>
        <span className="size-4 rounded-[4px] border border-neutral-line bg-surface" />
        Not done
      </span>
      <span className={item}>
        <span className="flex size-4 items-center justify-center rounded-[4px] bg-state-locked text-state-locked-foreground">
          <Icon icon={LockIcon} size={11} />
        </span>
        Ahead
      </span>
    </p>
  );
}

export function LevelPicker({
  current,
  replace,
  onPick,
  reveal = false,
  stripClassName,
  className,
}: {
  /** The level the game is on, when the picker is open over it. */
  current?: string;
  /** Picking a level takes the place of this page in the history. */
  replace?: boolean;
  onPick?: (level: Level) => void;
  /** Bring the level the learner is on into view when it opens. */
  reveal?: boolean;
  /** Where the unit strip sticks: under the site's bar, or at the top of a sheet. */
  stripClassName?: string;
  className?: string;
}) {
  const saved = useCourseProgress();
  const next = nextLevel(saved ?? EMPTY);
  const root = React.useRef<HTMLDivElement>(null);
  const inGame = current != null;
  const paywall = usePaywall();
  const skip = useSkipAhead({
    next,
    replace,
    surface: inGame ? "levels_sheet" : "levels_page",
    dark: inGame,
    onGo: onPick,
  });

  // Open on the level the learner is at, not on level 1 every time. Once, and
  // never over an address that already points at a unit.
  const target = current ?? (saved && next.n > 1 ? next.id : null);
  const revealed = React.useRef(false);
  React.useEffect(() => {
    if (!reveal || revealed.current || !target) return;
    if (!current && window.location.hash) return;
    revealed.current = true;
    root.current
      ?.querySelector(`[data-level="${CSS.escape(target)}"]`)
      ?.scrollIntoView({ block: "center" });
  }, [reveal, target, current]);

  const jump = (event: React.MouseEvent, id: string) => {
    // Moved by hand, so the game's own address is left alone.
    event.preventDefault();
    root.current
      ?.querySelector(`#unit-${CSS.escape(id)}`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <div ref={root} className={cn("grid gap-6", className)}>
      <div
        className={cn(
          "sticky z-10 -mx-1 grid gap-2 bg-background px-1 py-2",
          stripClassName ?? "top-0",
        )}
      >
        <nav
          aria-label="Units"
          className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {UNITS.map((unit, i) => {
            const count = saved
              ? unit.levels.filter((l) => levelDone(l, saved)).length
              : 0;
            const mock = unit.id === "mock";
            const state: UnitState = saved ? unitState(unit, saved) : "open";
            return (
              <a
                key={unit.id}
                href={`#unit-${unit.id}`}
                onClick={(event) => jump(event, unit.id)}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-soft border px-3 text-[13px] font-bold no-underline transition-colors outline-none hover:bg-paper-2 focus-visible:bg-paper-2",
                  state === "done"
                    ? "border-success-line bg-state-done-soft text-ink"
                    : state === "current"
                      ? "border-2 border-ink bg-state-next text-state-next-foreground hover:bg-state-next focus-visible:bg-state-next"
                      : state === "locked"
                        ? "border-dashed border-neutral-line bg-surface text-neutral-strong"
                        : "border-neutral-line bg-surface text-ink",
                )}
              >
                {!mock &&
                  (state === "done" ? (
                    <span className="flex size-4 items-center justify-center rounded-full bg-state-done text-state-done-foreground">
                      <Icon icon={CheckIcon} size={10} />
                      <span className="sr-only">Done:</span>
                    </span>
                  ) : state === "locked" ? (
                    <Icon icon={LockIcon} size={13} />
                  ) : (
                    <span className="font-mono text-[11px] tabular-nums opacity-70">
                      {i + 1}
                    </span>
                  ))}
                <span className="whitespace-nowrap">{unit.title}</span>
                {!mock && saved && (
                  <span
                    className={cn(
                      "font-mono text-[10.5px] tabular-nums",
                      state === "done"
                        ? "text-success-strong"
                        : state === "current"
                          ? "opacity-80"
                          : "text-neutral-strong",
                    )}
                  >
                    {count}/{unit.levels.length}
                  </span>
                )}
              </a>
            );
          })}
        </nav>
        {saved && <StateKey />}
      </div>

      {UNITS.map((unit, i) => {
        const mock = unit.id === "mock";
        const count = saved
          ? unit.levels.filter((l) => levelDone(l, saved)).length
          : 0;
        return (
          <section
            key={unit.id}
            id={`unit-${unit.id}`}
            aria-labelledby={`unit-${unit.id}-title`}
            className="scroll-mt-40"
          >
            {!mock && (
              <header className="mb-3">
                <p className="m-0 font-mono text-[10px] font-bold tracking-widest text-ink-3 uppercase">
                  Unit {i + 1} · {unit.levels.length} levels
                </p>
                <h2
                  id={`unit-${unit.id}-title`}
                  className="m-0 mt-0.5 font-display text-[20px] leading-tight font-extrabold tracking-tight text-ink uppercase"
                >
                  {unit.title}
                </h2>
                <p className="m-0 mt-1 text-[14px] leading-snug text-ink-2">
                  {unit.blurb}
                </p>
                {saved && (
                  <div className="mt-2 flex max-w-sm items-center gap-2.5">
                    <Progress
                      value={(count / unit.levels.length) * 100}
                      tone="green"
                      showTicks={false}
                      aria-label={`${unit.title}: levels done`}
                      className="h-1.5 flex-1"
                    />
                    <span className="shrink-0 font-mono text-[10.5px] font-bold tracking-widest text-ink-3 uppercase tabular-nums">
                      {count} of {unit.levels.length} done
                    </span>
                  </div>
                )}
              </header>
            )}
            {mock && (
              <h2 id={`unit-${unit.id}-title`} className="sr-only">
                Mock test
              </h2>
            )}
            <ol className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {unit.levels.map((level) => (
                <LevelCard
                  key={level.id}
                  level={level}
                  state={saved ? levelState(level, saved) : "open"}
                  now={level.id === current}
                  stars={
                    saved && level.kind === "drive"
                      ? (saved.bestStars[level.challenge] ?? 0)
                      : 0
                  }
                  replace={replace}
                  onPick={onPick}
                  onLocked={skip.ask}
                  walled={paywall.walled(level)}
                />
              ))}
            </ol>
          </section>
        );
      })}
      {skip.dialog}
    </div>
  );
}
