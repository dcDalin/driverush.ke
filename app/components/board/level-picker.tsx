/**
 * Every level as a picture to pick from, unit by unit, with a strip on top to
 * jump to a unit. It is the levels page, and the same thing opens over the
 * game so a learner can move to any level without leaving it. Each picture is
 * the flat board zoomed to what the level uses (`routes/board-level-picture.ts`),
 * fetched only as it scrolls into view.
 *
 * All of it is in the server's HTML. What is done, and which level is next, is
 * filled in from this browser's saved progress once the page is running.
 */
import * as React from "react";
import { Link } from "react-router";

import {
  BOARD_PLAY_PATH,
  levelHref,
  levelPictureHref,
} from "~/lib/board-guides";
import {
  KIND_LABEL,
  UNITS,
  levelDone,
  levelState,
  nextLevel,
  unitState,
  type CourseProgress,
  type Level,
  type LevelKind,
  type LevelState,
  type UnitState,
} from "~/lib/board/curriculum";
import { useCourseProgress } from "~/lib/use-course-progress";
import { cn } from "~/lib/utils";

import { Icon } from "~/components/brand/icon";
import { useSkipAhead } from "~/components/board/skip-ahead";
import {
  CheckIcon,
  LockIcon,
  PlayIcon,
  StarIcon,
} from "~/components/brand/icons";
import { Badge, type BadgeProps } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";

const KIND_BADGE: Record<LevelKind, BadgeProps["variant"]> = {
  warmup: "rush",
  slides: "cream",
  lanes: "cream",
  watch: "cyan",
  drive: "rush",
  mock: "rush",
};

/** The board's grass: what shows round the board, and before a picture arrives. */
const GRASS = "#177a2e";

/** What a picture shows, for a screen reader, by the kind of level. */
const PICTURE: Record<LevelKind, string> = {
  warmup: "The road you drive along",
  slides: "The part of the board this level teaches",
  lanes: "The cars waiting in each lane",
  watch: "The route this level shows",
  drive: "The route to drive, from the car to the green box",
  mock: "The whole board",
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
}: {
  level: Level;
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
  return (
    <li className={cn(mock && "col-span-full")}>
      <Link
        to={mock ? BOARD_PLAY_PATH : levelHref(level.id)}
        replace={replace}
        data-level={level.id}
        data-state={state}
        aria-current={now ? "true" : next ? "step" : undefined}
        aria-label={
          mock
            ? undefined
            : `Level ${level.n}: ${level.title}. ${now ? "Playing now. " : ""}${STATE_SAID[state]}.`
        }
        onClick={(event) => {
          if (locked && !now) {
            event.preventDefault();
            onLocked(level);
            return;
          }
          onPick?.(level);
        }}
        className={cn(
          "group relative flex h-full overflow-hidden rounded-soft border text-ink no-underline outline-none transition-colors",
          mock ? "flex-row items-stretch" : "flex-col",
          next
            ? "border-2 border-ink bg-state-next text-state-next-foreground"
            : done
              ? "border-success-line bg-state-done-soft hover:brightness-[0.98] focus-visible:brightness-[0.98]"
              : locked
                ? "border-dashed border-neutral-line bg-state-locked-soft hover:bg-paper-2 focus-visible:bg-paper-2"
                : "border-neutral-line bg-surface hover:bg-paper-2 focus-visible:bg-paper-2",
          now &&
            "ring-[3px] ring-state-now ring-offset-2 ring-offset-background",
          "focus-visible:ring-2 focus-visible:ring-ink",
        )}
      >
        <span
          className={cn(
            "relative block shrink-0 overflow-hidden",
            mock ? "w-24 sm:w-32" : "aspect-square w-full",
            locked && "bg-state-locked-soft",
          )}
          // A locked level's picture is grey all through, grass included.
          style={{ backgroundColor: locked ? undefined : GRASS }}
        >
          <img
            src={levelPictureHref(level.id)}
            alt={PICTURE[level.kind]}
            width={320}
            height={320}
            loading="lazy"
            decoding="async"
            className={cn(
              "absolute inset-0 size-full object-cover transition-[transform,filter,opacity] duration-300 group-hover:scale-[1.04] group-focus-visible:scale-[1.04] motion-reduce:transition-none",
              locked && "opacity-45 grayscale group-hover:opacity-70",
            )}
          />
          {!mock && (
            <span
              aria-hidden
              className={cn(
                "absolute left-1.5 top-1.5 flex h-7 min-w-7 items-center justify-center gap-1 rounded-soft px-1.5 font-mono text-[12.5px] font-bold tabular-nums",
                done
                  ? "bg-state-done text-state-done-foreground"
                  : next
                    ? "bg-state-next text-state-next-foreground ring-1 ring-ink"
                    : locked
                      ? "bg-state-locked text-state-locked-foreground"
                      : "bg-[#101114]/85 text-white",
              )}
            >
              {done && <Icon icon={CheckIcon} size={14} />}
              {locked && <Icon icon={LockIcon} size={13} />}
              {level.n}
            </span>
          )}
          {(next || now) && (
            <span
              aria-hidden
              className={cn(
                "absolute right-1.5 top-1.5 rounded-soft px-1.5 py-1 font-mono text-[10px] font-bold uppercase leading-none tracking-widest",
                now
                  ? "bg-state-now text-state-now-foreground"
                  : "bg-state-next text-state-next-foreground ring-1 ring-ink",
              )}
            >
              {now ? "Playing" : "Next"}
            </span>
          )}
          {done && !mock && (
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1 bg-state-done"
            />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
          <span
            className={cn(
              "block font-bold leading-snug",
              mock
                ? "font-display text-[16px] font-extrabold uppercase tracking-tight"
                : "text-[13.5px]",
              locked && "text-neutral-strong",
            )}
          >
            {mock ? "Mock test" : level.title}
          </span>
          {mock && (
            <span className="block text-[13px] leading-snug opacity-80">
              Five tasks picked for you, mixed from every unit. Take it any
              time.
            </span>
          )}
          <span className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {next && !now ? (
              <span className="inline-flex items-center gap-1 rounded-soft bg-ink px-2 py-1 font-mono text-[10.5px] font-bold uppercase leading-none tracking-widest text-paper">
                <Icon icon={PlayIcon} size={11} />
                Start
              </span>
            ) : (
              !mock && (
                <span
                  aria-hidden
                  className={cn(
                    "font-mono text-[10px] font-bold uppercase tracking-widest",
                    done
                      ? "text-success-strong"
                      : next
                        ? "text-state-next-foreground"
                        : "text-neutral-strong",
                  )}
                >
                  {now ? "Playing" : STATE_WORD[state]}
                </span>
              )
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
            <span className="ml-auto inline-flex items-center gap-1.5">
              <Badge
                variant={KIND_BADGE[level.kind]}
                className={cn("border px-1.5", locked && "opacity-60")}
              >
                {KIND_LABEL[level.kind]}
              </Badge>
            </span>
          </span>
        </span>
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
                  "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-soft border px-3 text-[13px] font-bold no-underline outline-none transition-colors hover:bg-paper-2 focus-visible:bg-paper-2",
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
                <p className="m-0 font-mono text-[10px] font-bold uppercase tracking-widest text-ink-3">
                  Unit {i + 1} · {unit.levels.length} levels
                </p>
                <h2
                  id={`unit-${unit.id}-title`}
                  className="m-0 mt-0.5 font-display text-[20px] font-extrabold uppercase leading-tight tracking-tight text-ink"
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
                    <span className="shrink-0 font-mono text-[10.5px] font-bold uppercase tracking-widest tabular-nums text-ink-3">
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
            <ol className="m-0 grid list-none grid-cols-2 gap-2.5 p-0 sm:grid-cols-3 lg:grid-cols-4">
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
