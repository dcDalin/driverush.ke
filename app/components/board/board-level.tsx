/**
 * A level of the course that is read or watched, not driven: cards that point
 * the camera at a part of the board and say its rule, the lanes of one road
 * and where each may go, or a car driving a route a step at a time. It ends
 * with the way on to the next level.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";

import { LevelCheer } from "~/components/board/board-cheer";
import {
  BoardPlayback,
  routeLines,
  StepTags,
  UNSURE_NOTE,
} from "~/components/board/board-playback";
import { BoardSpotPicks } from "~/components/board/board-spot-picks";
import { DailyDriveLink } from "~/components/board/daily-drive-row";
import { LevelTestNote } from "~/components/board/level-test-note";
import { useOpenLevels } from "~/components/board/levels-sheet-context";
import { useParkingLayout } from "~/components/board/use-parking-layout";
import { Icon } from "~/components/brand/icon";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  CloseIcon,
  GridIcon,
  PlayIcon,
  SettingsIcon,
} from "~/components/brand/icons";
import { analytics } from "~/lib/analytics";
import { BLOCK_SOURCE, laneRule, RULES_SOURCE } from "~/lib/board/board-rules";
import {
  COURSE_LEVELS,
  learnedKey,
  type Level,
  levelAfter,
  unitOf,
} from "~/lib/board/curriculum";
import { findSpots, levelSlides } from "~/lib/board/curriculum-content";
import { RING_R } from "~/lib/board/full-board";
import { type ArmId, ARMS, OPTION_CODES } from "~/lib/board/geometry";
import type { Seat } from "~/lib/board/joystick";
import { pickable, queueCars } from "~/lib/board/lane-queue";
import {
  APPROACHES,
  lessonPlan,
  LESSONS,
  lessonWays,
  ROUTE_COLOR,
  ROUTE_RULES,
} from "~/lib/board/lessons";
import type { Route } from "~/lib/board/network";
import { shuffleParkingLayout } from "~/lib/board/parking-layouts";
import {
  cam,
  fitTable,
  flyTo,
  redraw,
  setMarks,
  useStage,
} from "~/lib/board/stage";
import { shownWays, type Way } from "~/lib/board/ways";
import { BOARD_LEVELS_PATH, levelHref } from "~/lib/board-guides";
import { useBoardStore } from "~/lib/board-store";
import { cn } from "~/lib/utils";

const chip =
  "min-h-11 rounded-md border-2 px-3 py-2 text-left text-[13.5px] font-semibold leading-snug outline-none transition-colors focus-visible:border-white";
const chipOff = "border-white/15 bg-white/5 text-white hover:bg-white/10";
const eyebrow =
  "m-0 font-mono text-[10px] font-bold uppercase tracking-widest text-white/55";
const primary =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border-2 border-[#f6c416] bg-[#f6c416] px-4 py-2.5 text-center text-[14.5px] font-bold leading-snug text-[#17181b] outline-none transition-colors hover:bg-[#ffd84d] focus-visible:border-white disabled:opacity-40";
const secondary =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border-2 border-white/25 px-4 py-2.5 text-center font-mono text-[11px] font-bold uppercase tracking-widest text-white outline-none transition-colors hover:bg-white/10 focus-visible:border-white disabled:opacity-40";
const iconButton =
  "inline-flex size-11 items-center justify-center rounded-md border-2 border-white/15 outline-none transition-colors hover:bg-white/15 focus-visible:border-white";

const quiet =
  "inline-flex min-h-10 items-center justify-center text-center text-[13px] font-semibold text-white/75 underline underline-offset-4 outline-none hover:text-white focus-visible:text-white";

/**
 * The panel's foot: where the one thing to do next always sits, under the
 * scrolling part, so it is never scrolled out of sight. Levels put their
 * buttons here with `PanelActions`.
 */
const FootSlot = React.createContext<HTMLElement | null>(null);

function PanelActions({ children }: { children: React.ReactNode }) {
  const slot = React.useContext(FootSlot);
  return slot ? createPortal(children, slot) : null;
}

/** Folded detail: open on a tap, closed by default on every screen. */
function Fold({
  label,
  children,
  defaultOpen = false,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="grid gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border-2 border-white/15 px-3 text-left text-[13.5px] font-semibold transition-colors outline-none hover:bg-white/10 focus-visible:border-white"
      >
        {label}
        <Icon
          icon={ChevronDownIcon}
          size={16}
          className={cn(
            "shrink-0 transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
      {open && children}
    </div>
  );
}

/**
 * The way on from a finished level: one button to the next level, and a quiet
 * link to every level. Rendered into the panel's foot.
 */
export function LevelNext({
  level,
  children,
}: {
  level: Level;
  /** Another quiet choice beside "All levels", like reading it again. */
  children?: React.ReactNode;
}) {
  const next = levelAfter(level);
  const openLevels = useOpenLevels();
  return (
    <PanelActions>
      {next && (
        <Link to={levelHref(next.id)} replace className={primary}>
          <span className="min-w-0">
            {next.kind === "mock"
              ? "Next: the mock test"
              : `Next: level ${next.n}, ${next.title}`}
          </span>
          <Icon icon={ArrowRightIcon} size={16} className="shrink-0" />
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-center gap-x-5">
        {children}
        {openLevels ? (
          <button type="button" onClick={openLevels} className={quiet}>
            All levels
          </button>
        ) : (
          <Link to={BOARD_LEVELS_PATH} replace className={quiet}>
            All levels
          </Link>
        )}
      </div>
    </PanelActions>
  );
}

/** A level done before this visit: the way on, without finishing it again. */
function SkipOn({ level }: { level: Level }) {
  const next = levelAfter(level);
  if (!next) return null;
  return (
    <PanelActions>
      <p className="m-0 text-center text-[12.5px] leading-snug text-white/65">
        You have done this level before.
      </p>
      <Link to={levelHref(next.id)} replace className={secondary}>
        {next.kind === "mock" ? "Go to the mock test" : `Go to level ${next.n}`}
        <Icon icon={ArrowRightIcon} size={14} />
      </Link>
    </PanelActions>
  );
}

/** Done: a tick, the level's cheer, and the install ask, at the top. */
function LevelDone({
  level,
  children,
}: {
  level: Level;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 rounded-md border-2 border-kenya-green/50 bg-kenya-green/10 p-3">
      <DoneNote>{children}</DoneNote>
      <LevelCheer level={level} />
      <LevelTestNote levelId={level.id} surface="level_done" />
      <DailyDriveLink surface="level_done" />
    </div>
  );
}

function DoneNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="m-0 flex items-center gap-2 text-[14px] leading-snug font-bold text-white"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-kenya-green text-kenya-green-foreground">
        <Icon icon={CheckIcon} size={14} />
      </span>
      {children}
    </p>
  );
}

/** The steps of the route being played, to tap through. */
function RouteSteps({ route, step }: { route: Route; step: number }) {
  const toStep = useStage((s) => s.toStep);
  return (
    <ol className="m-0 grid list-none gap-1 p-0">
      {route.steps.map((s, i) => (
        <li key={`${s.from}-${s.title}`}>
          <button
            type="button"
            onClick={() => toStep(i)}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "flex min-h-11 w-full items-start gap-2.5 rounded-md border-2 px-2.5 py-2.5 text-left transition-colors outline-none focus-visible:border-white",
              i === step
                ? "border-white/40 bg-white/10"
                : "border-transparent hover:bg-white/5",
            )}
          >
            <span className="mt-px font-mono text-[11px] font-bold text-white/55">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 text-[13.5px] leading-snug font-semibold">
              {s.title}
              <span className="ml-1.5 inline-flex gap-1 align-middle font-mono text-[9.5px] font-bold tracking-widest uppercase">
                <StepTags step={s} />
              </span>
              {!s.confirmed && (
                <span className="mt-0.5 block text-[12px] font-semibold text-kenya-gold">
                  {UNSURE_NOTE}
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

// ---- cards -----------------------------------------------------------------------------

function SlidesLevel({
  level,
  sideways,
  done,
  onDone,
}: {
  level: Level & { kind: "slides" };
  sideways: boolean;
  done: boolean;
  onDone: () => void;
}) {
  const show = useStage((s) => s.show);
  const setBlock = useStage((s) => s.setBlock);
  const cards = React.useMemo(() => levelSlides(level), [level]);
  // Closed part-way through, a deck opens again on the card it was left at.
  const keepPlace = useBoardStore((s) => s.keepPlace);
  const [at, setAt] = React.useState(() => {
    const kept = useBoardStore.getState().places?.[level.id] ?? 0;
    return kept < cards.length - 1 ? kept : 0;
  });
  React.useEffect(() => keepPlace(level.id, at), [keepPlace, level.id, at]);
  const [finished, setFinished] = React.useState(false);
  const card = cards[Math.min(at, cards.length - 1)];
  const last = at >= cards.length - 1;

  // After the cards, one thing to do: find one of them on the table. Nothing
  // is scored, and a wrong pin only says what it is.
  const spots = React.useMemo(() => findSpots(level), [level]);
  const [target] = React.useState(() =>
    spots.length > 0 ? spots[Math.floor(Math.random() * spots.length)] : null,
  );
  const [finding, setFinding] = React.useState(false);
  const [wrong, setWrong] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (!finding) return;
    show([]);
    const pad = 14;
    flyTo(
      {
        x0: Math.min(...spots.map((spot) => spot.x)) - pad,
        x1: Math.max(...spots.map((spot) => spot.x)) + pad,
        z0: Math.min(...spots.map((spot) => spot.z)) - pad,
        z1: Math.max(...spots.map((spot) => spot.z)) + pad,
      },
      sideways,
    );
    setMarks(spots);
    return () => setMarks([]);
  }, [finding, spots, sideways, show]);
  const lastWrong = spots.find((spot) => spot.id === wrong[wrong.length - 1]);
  const letter = (id: string) =>
    "ABCDEFGH"[spots.findIndex((spot) => spot.id === id)];

  // A card about a blocked road stands the upside-down car on the board.
  const cardBlock = card?.block ?? null;
  React.useEffect(() => {
    setBlock(cardBlock);
    return () => setBlock(null);
  }, [cardBlock, setBlock]);

  React.useEffect(() => {
    if (finding) return;
    if (!card?.box) {
      show([]);
      fitTable();
      return;
    }
    show([], card.box);
    flyTo(card.box, sideways);
  }, [card, sideways, show, finding]);

  if (!card) return null;
  if (finding && target) {
    return (
      <div className="grid gap-3">
        <BoardSpotPicks
          spots={spots}
          wrong={wrong}
          onPick={(id) => {
            if (id !== target.id) {
              setWrong((was) => [...was, id]);
              return;
            }
            setFinding(false);
            setFinished(true);
            onDone();
          }}
        />
        <div
          aria-live="polite"
          className="rounded-md border-2 border-[#f6c416] bg-white/5 p-3"
        >
          <p className={eyebrow}>Find it on the board</p>
          <h3 className="m-0 mt-1 text-[17px] leading-snug font-bold">
            Which pin is on: {target.name}?
          </h3>
          <p className="m-0 mt-1.5 text-[14px] leading-snug text-white/85">
            {lastWrong
              ? `Pin ${letter(lastWrong.id)} is: ${lastWrong.name}. Try another.`
              : "Tap a pin on the table."}
          </p>
        </div>
        <PanelActions>
          <button
            type="button"
            className={secondary}
            onClick={() => {
              setFinding(false);
              setWrong([]);
            }}
          >
            <Icon icon={ChevronLeftIcon} size={16} />
            Back to the cards
          </button>
        </PanelActions>
      </div>
    );
  }
  const ended = finished || (done && last);
  const after = levelAfter(level);
  return (
    <div className="grid gap-3">
      {ended && <LevelDone level={level}>Level {level.n} done.</LevelDone>}
      <div
        aria-live="polite"
        className="rounded-md border-2 border-[#f6c416] bg-white/5 p-3"
      >
        <p className={eyebrow}>
          {at + 1} of {cards.length}
        </p>
        <h3 className="m-0 mt-1 text-[17px] leading-snug font-bold">
          {card.title}
        </h3>
        <p className="m-0 mt-1.5 text-[14px] leading-snug text-white/85">
          {card.note}
        </p>
        {card.sign && (
          <Link
            to={card.sign.to}
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-[13px] font-bold text-kenya-gold underline-offset-4 hover:underline"
          >
            The {card.sign.label} sign
            <Icon icon={ArrowRightIcon} size={13} />
          </Link>
        )}
        <p className="m-0 mt-2 font-mono text-[10px] tracking-widest text-white/50 uppercase">
          {card.block ? BLOCK_SOURCE : `${RULES_SOURCE}, Unit 3`}
        </p>
      </div>

      {ended ? (
        <LevelNext level={level}>
          <button
            type="button"
            className={quiet}
            onClick={() => {
              setFinished(false);
              setAt(0);
            }}
          >
            Read it again
          </button>
        </LevelNext>
      ) : (
        <PanelActions>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Previous card"
              disabled={at === 0}
              onClick={() => setAt((n) => Math.max(0, n - 1))}
              className={cn(secondary, "w-14 shrink-0 px-0")}
            >
              <Icon icon={ChevronLeftIcon} size={18} />
            </button>
            <button
              type="button"
              className={primary}
              onClick={() => {
                if (!last) {
                  setAt((n) => n + 1);
                  return;
                }
                if (target) {
                  setWrong([]);
                  setFinding(true);
                  return;
                }
                setFinished(true);
                onDone();
              }}
            >
              {last
                ? target
                  ? "Find it on the board"
                  : "Got it"
                : "Next card"}
              <Icon
                icon={last && !target ? CheckIcon : ArrowRightIcon}
                size={16}
              />
            </button>
          </div>
          {done && after && (
            <Link to={levelHref(after.id)} replace className={quiet}>
              Done before. Skip to level {after.n}
            </Link>
          )}
        </PanelActions>
      )}
    </div>
  );
}

/** "lane 4", "lanes 1 and 2", "lanes 1, 2 and 3". */
function laneList(lanes: readonly number[]): string {
  if (lanes.length === 1) return `lane ${lanes[0]}`;
  return `lanes ${lanes.slice(0, -1).join(", ")} and ${lanes[lanes.length - 1]}`;
}

// ---- the lanes of one road --------------------------------------------------------------

/**
 * What the camera holds while the cars wait. On a wide screen it is the
 * line-up and the roundabout. On a phone that would make the cars too small to
 * tap one from the next, so it is the line-up alone.
 */
function lineUpBox(arm: ArmId, close: boolean, only?: readonly number[]) {
  const out = ARMS[arm].out;
  const cars = queueCars(arm, only);
  const back = Math.max(...cars.map((car) => car.along)) + 5;
  if (close) {
    const xs = cars.map((car) => car.start.x);
    const zs = cars.map((car) => car.start.z);
    const pad = 5;
    return {
      x0: Math.min(...xs) - pad,
      x1: Math.max(...xs) + pad,
      z0: Math.min(...zs) - pad,
      z1: Math.max(...zs) + pad,
    };
  }
  const reach = Math.max(RING_R + 26, back);
  return {
    x0: Math.min(-RING_R - 4, out.x * reach),
    x1: Math.max(RING_R + 4, out.x * reach),
    z0: Math.min(-RING_R - 4, out.z * reach),
    z1: Math.max(RING_R + 4, out.z * reach),
  };
}

/**
 * Every car of one road is out on the table, one for each option of each
 * lane. The learner takes the front car of a lane and drives it to its place;
 * this is the list of them, and what is left to do.
 */
function LanesLevel({
  level,
  sideways,
  done,
}: {
  level: Level & { kind: "lanes" };
  sideways: boolean;
  done: boolean;
}) {
  const arm = level.arm;
  const lanes = ARMS[arm].lanes;
  const rest = useBoardStore((s) => s.lanes?.rest);
  const pickCar = useBoardStore((s) => s.pickCar);
  const show = useStage((s) => s.show);
  const only = level.lanes;
  const cars = React.useMemo(() => queueCars(arm, only), [arm, only]);
  const home = React.useMemo(() => Object.keys(rest ?? {}), [rest]);
  const front = React.useMemo(() => pickable(cars, home), [cars, home]);
  const road = APPROACHES.find((a) => a.arm === arm);
  const allHome = home.length >= cars.length;
  // What can be driven right now: the front car of each lane not yet home.
  // The full list of options stays folded on every screen.
  const ready = front.filter((car) => !home.includes(car.id));

  React.useEffect(() => {
    show([]);
    const phone = window.matchMedia("(max-width: 639px)").matches;
    flyTo(lineUpBox(arm, phone, only), sideways);
  }, [arm, only, sideways, show]);

  const carRow = (car: (typeof cars)[number], compact: boolean) => {
    const isHome = home.includes(car.id);
    const canTake = front.includes(car) && !isHome;
    return (
      <button
        type="button"
        disabled={!canTake}
        onClick={() => pickCar(car.id)}
        className={cn(
          chip,
          canTake
            ? "border-[#f6c416]/70 bg-white/5 text-white hover:bg-white/10"
            : chipOff,
          "flex w-full items-center gap-3 disabled:hover:bg-white/5",
          // On a phone the panel has half the screen: one line per car.
          compact && "max-sm:min-h-10 max-sm:py-1.5",
          !canTake && !isHome && "opacity-55",
        )}
      >
        <span
          aria-hidden
          // The colour of its way through, as the line on the table is drawn:
          // the cars themselves all wear the school's paint.
          className="h-4 w-7 shrink-0 rounded-[5px] border border-white/40"
          style={{ background: car.option.color }}
        />
        <span className="min-w-0 flex-1">
          {compact && (
            <span className="block font-mono text-[10px] font-bold tracking-widest text-white/55 uppercase max-sm:mr-1.5 max-sm:inline">
              Lane {car.lane}
            </span>
          )}
          <span className={cn(compact && "max-sm:truncate")}>
            {car.option.label}{" "}
            <span className="font-mono text-[11px] text-white/55">
              {car.option.degrees}
            </span>
          </span>
          {!compact && (
            <span className="mt-0.5 block text-[12px] leading-snug text-white/60">
              {car.option.how}
            </span>
          )}
          {!car.option.confirmed && (
            <span
              className={cn(
                "mt-0.5 block text-[12px] font-semibold text-kenya-gold",
                // The full list under "Where each lane may go" still says it.
                compact && "max-sm:hidden",
              )}
            >
              {UNSURE_NOTE}
            </span>
          )}
        </span>
        {isHome ? (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-kenya-green text-kenya-green-foreground">
            <Icon icon={CheckIcon} size={12} />
            <span className="sr-only">Home</span>
          </span>
        ) : canTake ? (
          <span className="shrink-0 rounded-[4px] bg-[#f6c416] px-2 py-1 font-mono text-[10.5px] leading-none font-bold tracking-widest text-[#17181b] uppercase">
            Drive
          </span>
        ) : (
          <span className="shrink-0 font-mono text-[10px] font-bold tracking-widest text-white/55 uppercase">
            Waiting
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="grid gap-3 max-sm:gap-2">
      {allHome && (
        <LevelDone level={level}>
          Every car is home. Level {level.n} done.
        </LevelDone>
      )}
      {!allHome && (
        <div className="grid gap-2 rounded-md border-2 border-[#f6c416] bg-white/5 p-3 max-sm:gap-1.5 max-sm:p-2.5">
          <p className={cn(eyebrow, "max-sm:hidden")}>Do this</p>
          <p className="m-0 text-[14.5px] leading-snug font-semibold text-white max-sm:text-[14px]">
            {/* One line on a phone, so the panel fits a short screen. */}
            <span className="max-sm:hidden">
              Drive each car to its place. Tap a car marked Drive, here or on
              the table.
            </span>
            <span className="sm:hidden">
              Tap a car marked Drive and take it home.
            </span>
          </p>
          <div className="flex items-center justify-between gap-3">
            <p aria-live="polite" className={eyebrow}>
              {home.length} of {cars.length} cars home
            </p>
            <span aria-hidden className="flex gap-1">
              {cars.map((car) => (
                <span
                  key={car.id}
                  className={cn(
                    "size-2.5 rounded-full border border-white/40",
                    home.includes(car.id) ? "bg-state-done" : "bg-state-locked",
                  )}
                />
              ))}
            </span>
          </div>
        </div>
      )}

      {ready.length > 0 && (
        <section
          aria-label="Cars you can drive now"
          className="grid gap-1.5 max-sm:gap-1"
        >
          <p className={cn(eyebrow, "max-sm:hidden")}>Drive now</p>
          <ul className="m-0 grid list-none gap-1.5 p-0 max-sm:gap-1">
            {ready.map((car) => (
              <li key={car.id}>{carRow(car, true)}</li>
            ))}
          </ul>
        </section>
      )}

      <Fold label="Where each lane may go">
        <p className="m-0 text-[13.5px] leading-snug text-white/80">
          {road?.road}, {lanes} lanes each way. Its option code is{" "}
          <strong className="font-mono text-white">
            {OPTION_CODES[lanes]}
          </strong>
          : the number of options in each lane, counted from the kerb. There is
          one car for each option.
          {only && ` This level has the cars of ${laneList(only)}.`}
        </p>
        {(only ?? Array.from({ length: lanes }, (_, i) => i + 1)).map(
          (lane) => (
            <section key={lane} aria-label={`Lane ${lane}`}>
              <p className="m-0 text-[13px] leading-snug font-semibold text-white/80">
                {laneRule(lanes, lane)}
              </p>
              <ul className="m-0 mt-1.5 grid list-none gap-1.5 p-0">
                {cars
                  .filter((car) => car.lane === lane)
                  .map((car) => (
                    <li key={car.id}>{carRow(car, false)}</li>
                  ))}
              </ul>
            </section>
          ),
        )}
      </Fold>

      {allHome ? <LevelNext level={level} /> : done && <SkipOn level={level} />}
    </div>
  );
}

// ---- a route, driven for the learner ----------------------------------------------------

/** Each correct way that is not the answer, on the table and in its chip. */
const OTHER_WAY_COLOR = "#7dd3fc";
/** The way through the parking area, the wrong answer. */
const WRONG_WAY_COLOR = "#ff6b5e";

const wayColor = (way: Way) =>
  way.kind === "answer"
    ? ROUTE_COLOR
    : way.kind === "wrong_parking"
      ? WRONG_WAY_COLOR
      : OTHER_WAY_COLOR;

/** What a way is, in a few words, for its chip. */
function wayLabel(way: Way, answer: Way): string {
  switch (way.kind) {
    case "answer":
      return "The answer";
    case "also":
      return "Also correct, just as good";
    case "longer": {
      const more = Math.round((way.route.length - answer.route.length) / 5) * 5;
      return `Also correct, ${more} m longer`;
    }
    case "wrong_parking":
      return "Wrong: through the parking";
  }
}

/** What the way means for a drive, said under the chips. */
function wayMeans(way: Way, rule: string | null): string {
  switch (way.kind) {
    case "answer":
      return rule
        ? `${rule} picks this way. It is the one an examiner wants.`
        : "The way an examiner wants.";
    case "also":
      return "No rule is broken and it is no longer, so it passes in full.";
    case "longer":
      return "No rule is broken, so it passes, but a star down: Rule 1 wants the shortest correct route.";
    case "wrong_parking":
      return "Shorter, but it cuts through the parking area. Rule 3: parking only when there is no other way. It is not a pass.";
  }
}

function WatchLevel({
  level,
  done,
  onDone,
}: {
  level: Level & { kind: "watch" };
  done: boolean;
  onDone: () => void;
}) {
  const route = useStage((s) => s.route);
  const step = useStage((s) => s.step);
  const ended = useStage((s) => s.ended);
  const show = useStage((s) => s.show);
  const watch = useStage((s) => s.watch);
  const clear = useStage((s) => s.clear);
  // The farthest free bay moves with the parked cars.
  const layout = useParkingLayout();
  const lesson = LESSONS.find((l) => l.id === level.lesson);
  const parking = lesson?.group === "parking";

  React.useEffect(() => {
    if (parking) shuffleParkingLayout();
  }, [parking]);

  // Every way worth showing, one per way through the board, the answer first.
  const ways = React.useMemo(
    () => (lesson ? shownWays(lessonWays(lesson)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see `layout`
    [lesson, layout],
  );
  const [pick, setPick] = React.useState(0);
  // The way that was played last: only the answer finishes the level.
  const [played, setPlayed] = React.useState(0);
  const chosen = ways[pick] ?? ways[0];
  const line = chosen?.route ?? null;
  const picked = lesson && !parking ? lessonPlan(lesson)?.rule : null;
  const rule = picked ? ROUTE_RULES[picked] : null;

  // Before Play, every way lies on the table, the chosen one brightest.
  React.useEffect(() => {
    if (route) show(routeLines(route, step, wayColor(ways[played] ?? ways[0])));
    else if (line) {
      show([
        ...ways
          .map((way, i) => ({ way, i }))
          .filter(({ i }) => i !== pick)
          .map(({ way, i }) => ({
            id: `way-${i}`,
            points: way.route.points,
            color: wayColor(way),
            width: 1.2,
            opacity: 0.35,
          })),
        { id: "whole", points: line.points, color: wayColor(chosen), width: 2 },
      ]);
      fitTable();
    }
  }, [route, step, line, show, ways, pick, played, chosen]);

  React.useEffect(() => {
    if (ended && route && played === 0) onDone();
  }, [ended, route, played, onDone]);

  if (!lesson || !line || !chosen) {
    return (
      <p className="m-0 text-[14px] leading-snug text-white/80">
        This route could not be worked out. Try another level.
      </p>
    );
  }

  const choose = (i: number) => {
    if (route) clear();
    setPick(i);
  };

  const wayRow = ways.length > 1 && (!route || ended) && (
    <div className="grid gap-2">
      <p className={eyebrow}>{ways.length} ways to get there</p>
      <div
        role="radiogroup"
        aria-label="Ways to get there"
        className="grid gap-1.5"
      >
        {ways.map((way, i) => (
          <button
            key={way.signature}
            type="button"
            role="radio"
            aria-checked={i === pick}
            onClick={() => choose(i)}
            className={cn(
              chip,
              i === pick
                ? "border-[#f6c416]/80 bg-white/10 text-white"
                : chipOff,
              "flex w-full items-center gap-3",
            )}
          >
            <span
              aria-hidden
              className="h-1.5 w-7 shrink-0 rounded-full"
              style={{ background: wayColor(way) }}
            />
            <span className="min-w-0 flex-1">
              <span className="font-mono text-[10px] font-bold tracking-widest text-white/55 uppercase">
                Way {i + 1}
              </span>{" "}
              {wayLabel(way, ways[0])}
            </span>
          </button>
        ))}
      </div>
      <p className="m-0 text-[12.5px] leading-snug text-white/75">
        {wayMeans(chosen, rule?.name ?? null)}
      </p>
    </div>
  );

  return (
    <div className="grid gap-3">
      {route && ended && played === 0 && (
        <LevelDone level={level}>Level {level.n} done.</LevelDone>
      )}
      <div>
        <p className={eyebrow}>The examiner might say</p>
        <p className="m-0 mt-1 text-[14.5px] leading-snug font-semibold">
          {lesson.ask}
        </p>
        {rule && (
          <p className="m-0 mt-1.5 text-[13px] leading-snug font-semibold text-kenya-gold">
            {rule.name}. {rule.says}
          </p>
        )}
      </div>

      {route ? (
        <>
          <BoardPlayback className="rounded-md border-2 border-white/15 bg-white/5 p-3" />
          <Fold label={`Steps (${route.steps.length})`}>
            <RouteSteps route={route} step={step} />
          </Fold>
          {ended && wayRow}
          {ended ? (
            <LevelNext level={level} />
          ) : (
            done && <SkipOn level={level} />
          )}
        </>
      ) : (
        <>
          {wayRow}
          <p className="m-0 text-[12.5px] leading-snug text-white/65">
            {line.steps.length} steps
            {line.steps.some((s) => s.gear === "reverse") && ", with reversing"}
            . You can pause, step back and slow it down.
          </p>
          <PanelActions>
            <button
              type="button"
              className={primary}
              onClick={() => {
                setPlayed(pick);
                watch(line);
                analytics.boardLessonViewed({
                  kind: parking ? "parking" : "route",
                  lesson_id: lesson.id,
                  ...(ways.length > 1
                    ? {
                        way: pick + 1,
                        ways: ways.length,
                        way_kind: chosen.kind,
                      }
                    : {}),
                });
              }}
            >
              <Icon icon={PlayIcon} size={16} />
              {ways.length > 1
                ? pick === 0
                  ? "Watch the answer"
                  : `Watch way ${pick + 1}`
                : "Watch the car drive it"}
            </button>
            {done && levelAfter(level) && (
              <Link
                to={levelHref(levelAfter(level)!.id)}
                replace
                className={quiet}
              >
                Done before. Skip to level {levelAfter(level)!.n}
              </Link>
            )}
          </PanelActions>
        </>
      )}
    </div>
  );
}

// ---- the panel ---------------------------------------------------------------------------

export function BoardLevel({
  level,
  seat,
  onSettings,
}: {
  level: Level;
  seat: Seat;
  onSettings: () => void;
}) {
  const exit = useBoardStore((s) => s.exit);
  const openLevels = useOpenLevels();
  const completeLevel = useBoardStore((s) => s.completeLevel);
  const learned = useBoardStore((s) => s.learned);
  const sideways = seat === "east" || seat === "west";
  // Done before this visit. A level can always be opened again.
  const [wasDone] = React.useState(() =>
    Boolean(
      learned?.includes(
        level.kind === "watch" ? level.lesson : learnedKey(level),
      ),
    ),
  );

  // On a phone the panel covers the bottom of the screen, so the camera holds
  // what it is looking at above it: by half the share of the screen the panel
  // takes, which changes as the panel folds and opens. On a wide screen the
  // panel is at the side.
  const panel = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    const tall = window.matchMedia("(max-width: 639px)");
    const update = () => {
      const covered = panel.current
        ? panel.current.offsetHeight / Math.max(1, window.innerHeight)
        : 0.48;
      cam.lift = tall.matches ? Math.min(0.27, Math.max(0, covered / 2)) : 0;
      cam.side = tall.matches ? 0 : Math.min(0.3, 188 / window.innerWidth);
      redraw();
    };
    update();
    tall.addEventListener("change", update);
    const watcher =
      panel.current && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(update)
        : null;
    if (panel.current) watcher?.observe(panel.current);
    return () => {
      tall.removeEventListener("change", update);
      watcher?.disconnect();
      cam.lift = 0;
      cam.side = 0;
    };
  }, []);

  const unit = unitOf(level);
  const [foot, setFoot] = React.useState<HTMLDivElement | null>(null);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end sm:flex-row sm:justify-start">
      <section
        ref={panel}
        aria-label={`Level ${level.n}: ${level.title}`}
        className="dr-rise pointer-events-auto flex max-h-[54dvh] w-full flex-col border-t-2 border-white/15 bg-[#101114]/95 pb-[env(safe-area-inset-bottom)] text-white sm:h-full sm:max-h-none sm:w-[23.5rem] sm:border-t-0 sm:border-r-2"
      >
        <header className="flex items-start justify-between gap-2 px-3.5 pt-3">
          <div className="min-w-0">
            <p className={eyebrow}>
              Level {level.n} of {COURSE_LEVELS.length} · {unit.title}
            </p>
            <h2 className="m-0 mt-1 font-display text-[19px] leading-[1.05] font-extrabold tracking-tight uppercase">
              {level.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {openLevels && (
              <button
                type="button"
                aria-label="All levels"
                onClick={openLevels}
                className={iconButton}
              >
                <Icon icon={GridIcon} size={20} />
              </button>
            )}
            <button
              type="button"
              aria-label="Settings"
              onClick={onSettings}
              className={iconButton}
            >
              <Icon icon={SettingsIcon} size={20} />
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={exit}
              className={iconButton}
            >
              <Icon icon={CloseIcon} size={20} />
            </button>
          </div>
        </header>

        <FootSlot.Provider value={foot}>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 pb-4 max-sm:mt-2 max-sm:pb-3">
            {level.kind === "slides" ? (
              <SlidesLevel
                level={level}
                sideways={sideways}
                done={wasDone}
                onDone={completeLevel}
              />
            ) : level.kind === "lanes" ? (
              <LanesLevel level={level} sideways={sideways} done={wasDone} />
            ) : level.kind === "watch" ? (
              <WatchLevel level={level} done={wasDone} onDone={completeLevel} />
            ) : null}
          </div>
        </FootSlot.Provider>
        {/* The one thing to do next, never scrolled away. Empty, it takes no room. */}
        <div
          ref={setFoot}
          className="grid shrink-0 gap-1.5 border-t-2 border-white/10 px-3.5 pt-3 pb-3 empty:hidden"
        />
      </section>
    </div>
  );
}
