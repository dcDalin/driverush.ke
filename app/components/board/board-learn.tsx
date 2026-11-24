/**
 * Learn mode: the board with no task and no clock. Four things to look at,
 * each on the table itself: where every lane can take you, what each thing
 * painted on the board means, routes across the whole board, and parking.
 * Tap anything and a car drives it, a step at a time, with the rule for each
 * step.
 */
import * as React from "react";
import { Link } from "react-router";

import { analytics } from "~/lib/analytics";
import { BOARD_PATH } from "~/lib/board-guides";
import { RULES_SOURCE, laneRule } from "~/lib/board/board-rules";
import { OPTION_CODES } from "~/lib/board/geometry";
import { BOARD_FEATURES } from "~/lib/board/features";
import { RING_R } from "~/lib/board/full-board";
import { ARMS, type ArmId } from "~/lib/board/geometry";
import type { Seat } from "~/lib/board/joystick";
import {
  APPROACHES,
  LESSONS,
  ROUTE_COLOR,
  ROUTE_RULES,
  laneOptions,
  lessonPlan,
  lessonRoute,
  type Lesson,
} from "~/lib/board/lessons";
import { shuffleParkingLayout } from "~/lib/board/parking-layouts";
import { cam, fitTable, flyTo, useStage } from "~/lib/board/stage";
import { useBoardStore } from "~/lib/board-store";
import { cn } from "~/lib/utils";

import { Button } from "~/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "~/components/ui/item";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";

import { Icon } from "~/components/brand/icon";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  CloseIcon,
  PlayIcon,
  SettingsIcon,
} from "~/components/brand/icons";
import { useParkingLayout } from "~/components/board/use-parking-layout";
import {
  BoardPlayback,
  StepTags,
  UNSURE_NOTE,
  routeLines,
} from "~/components/board/board-playback";

type Tab = "lanes" | "board" | "routes" | "parking";

const TABS: readonly { id: Tab; label: string }[] = [
  { id: "lanes", label: "Lanes" },
  { id: "board", label: "Board" },
  { id: "routes", label: "Routes" },
  { id: "parking", label: "Parking" },
];

/** What is being played back, for the heading over the steps. */
type Showing = {
  kind: "lane" | "route" | "parking";
  id: string;
  title: string;
  ask: string;
  color: string;
  /** The route rule that picked a route, said under its heading. */
  rule?: string;
};

const chipOff = "border-white/15 bg-white/5 text-white hover:bg-white/10";
/** A pick in a ToggleGroup: the chip's type, a Toggle's colours. */
const pick =
  "h-auto min-h-11 px-3 py-2 text-[13.5px] font-semibold leading-snug whitespace-normal";
const eyebrow =
  "m-0 font-mono text-[10px] font-bold uppercase tracking-widest text-white/55";

/** The roundabout and the road into it, for looking at one road's lanes. */
function approachBox(arm: ArmId) {
  const out = ARMS[arm].out;
  const reach = RING_R + 26;
  return {
    x0: Math.min(-RING_R - 4, out.x * reach),
    x1: Math.max(RING_R + 4, out.x * reach),
    z0: Math.min(-RING_R - 4, out.z * reach),
    z1: Math.max(RING_R + 4, out.z * reach),
  };
}

export function BoardLearn({
  seat,
  onSettings,
}: {
  seat: Seat;
  onSettings: () => void;
}) {
  const route = useStage((s) => s.route);
  const step = useStage((s) => s.step);
  const ended = useStage((s) => s.ended);
  const show = useStage((s) => s.show);
  const watch = useStage((s) => s.watch);
  const clear = useStage((s) => s.clear);
  const toStep = useStage((s) => s.toStep);
  const learned = useBoardStore((s) => s.learned);
  const markLearned = useBoardStore((s) => s.markLearned);
  const exit = useBoardStore((s) => s.exit);

  const [tab, setTab] = React.useState<Tab>("lanes");
  const [arm, setArm] = React.useState<ArmId>("S");
  const [lane, setLane] = React.useState(1);
  const [feature, setFeature] = React.useState<string | null>(null);
  const [showing, setShowing] = React.useState<Showing | null>(null);
  // lesson routes are worked out again when the parked cars move
  useParkingLayout();
  const sideways = seat === "east" || seat === "west";

  // On a phone the panel covers the bottom of the screen, so the camera holds
  // what it is looking at above it.
  React.useEffect(() => {
    const tall = window.matchMedia("(max-width: 639px)");
    const update = () => {
      cam.lift = tall.matches ? 0.24 : 0;
      // beside it on a wide screen: the panel is 23.5rem wide
      cam.side = tall.matches ? 0 : Math.min(0.3, 188 / window.innerWidth);
    };
    update();
    tall.addEventListener("change", update);
    return () => {
      tall.removeEventListener("change", update);
      cam.lift = 0;
      cam.side = 0;
    };
  }, []);

  const options = React.useMemo(() => laneOptions(arm, lane), [arm, lane]);
  const picked = BOARD_FEATURES.find((f) => f.id === feature) ?? null;

  // What is painted on the table follows what the panel is showing.
  React.useEffect(() => {
    if (route) {
      show(routeLines(route, step, showing?.color ?? ROUTE_COLOR));
    } else if (tab === "lanes") {
      show(
        options.map((option) => ({
          id: option.id,
          points: option.route.points,
          color: option.color,
          width: 2.2,
        })),
      );
    } else if (tab === "board" && picked) {
      show([], picked.box);
    } else {
      show([]);
    }
  }, [route, step, tab, options, picked, showing, show]);

  // The camera goes to what was picked.
  React.useEffect(() => {
    if (route) return;
    if (tab === "lanes") flyTo(approachBox(arm), sideways);
    else if (tab === "board" && picked) flyTo(picked.box, sideways);
    else fitTable();
  }, [route, tab, arm, picked, sideways]);

  React.useEffect(() => {
    if (ended && showing && showing.kind !== "lane") markLearned(showing.id);
  }, [ended, showing, markLearned]);

  const play = (next: Showing, line: NonNullable<typeof route>) => {
    setShowing(next);
    watch(line);
    analytics.boardLessonViewed({ kind: next.kind, lesson_id: next.id });
  };

  const back = () => {
    clear();
    setShowing(null);
  };

  const pickTab = (next: Tab) => {
    clear();
    setShowing(null);
    // The parked cars stand somewhere new each time, so the farthest free
    // bay is not always the same one.
    if (next === "parking") shuffleParkingLayout();
    setTab(next);
  };

  const lessonRow = (lesson: Lesson) => {
    const line = lessonRoute(lesson);
    if (!line) return null;
    const picked = lesson.group === "routes" ? lessonPlan(lesson)?.rule : null;
    const rule = picked ? ROUTE_RULES[picked] : null;
    const done = learned?.includes(lesson.id);
    return (
      <li key={lesson.id}>
        <Item asChild variant="game" size="sm" className="flex-nowrap">
          <button
            type="button"
            onClick={() =>
              play(
                {
                  kind: lesson.group === "parking" ? "parking" : "route",
                  id: lesson.id,
                  title: lesson.title,
                  ask: lesson.ask,
                  color: ROUTE_COLOR,
                  rule: rule ? `${rule.name}. ${rule.says}` : undefined,
                },
                line,
              )
            }
          >
            <ItemMedia
              variant="icon"
              className={cn(
                "border-2 group-has-[[data-slot=item-description]]/item:self-center",
                done
                  ? "border-kenya-green bg-kenya-green text-kenya-green-foreground"
                  : "border-white/25 bg-transparent text-white",
              )}
            >
              <Icon icon={done ? CheckIcon : PlayIcon} size={14} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{lesson.title}</ItemTitle>
              <ItemDescription className="font-mono text-[10px] font-bold uppercase tracking-widest text-white/55">
                {lesson.level} · {rule ? `${rule.name} · ` : ""}
                {line.steps.length} steps
                {line.steps.some((s) => s.gear === "reverse") && " · reversing"}
              </ItemDescription>
            </ItemContent>
          </button>
        </Item>
      </li>
    );
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end sm:flex-row sm:justify-start">
      <section
        aria-label="Learn the board"
        className="dr-rise pointer-events-auto flex max-h-[54dvh] w-full flex-col border-t-2 border-white/15 bg-[#101114]/95 pb-[env(safe-area-inset-bottom)] text-white sm:h-full sm:max-h-none sm:w-[23.5rem] sm:border-r-2 sm:border-t-0"
      >
        <header className="flex items-center justify-between gap-2 px-3.5 pt-3">
          <h2 className="m-0 font-display text-[19px] font-extrabold uppercase leading-none tracking-tight">
            Learn the board
          </h2>
          <div className="flex items-center gap-1.5">
            <Button
              variant="game-outline"
              size="icon"
              aria-label="Settings"
              onClick={onSettings}
            >
              <Icon icon={SettingsIcon} size={20} />
            </Button>
            <Button
              variant="game-outline"
              size="icon"
              aria-label="Close"
              onClick={exit}
            >
              <Icon icon={CloseIcon} size={20} />
            </Button>
          </div>
        </header>

        <Tabs
          value={tab}
          onValueChange={(next) => pickTab(next as Tab)}
          // Arrow keys only move the focus: a lesson list loads, and the
          // table's lines clear, when a tab is chosen.
          activationMode="manual"
          className="mt-3 min-h-0 flex-1 gap-0"
        >
          <TabsList
            aria-label="What to learn"
            className="grid w-auto grid-cols-4 gap-1 bg-transparent p-0 px-3.5"
          >
            {TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className={cn(
                  "rounded-md border-2 px-0 py-2 font-mono text-[11px] font-bold uppercase tracking-widest focus-visible:outline-white",
                  chipOff,
                  "data-[state=active]:border-game-gold data-[state=active]:bg-game-gold data-[state=active]:text-game-gold-foreground data-[state=active]:shadow-none",
                )}
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent
            value={tab}
            className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 pb-4"
          >
            {route && showing ? (
              <div className="grid gap-3">
                <Button
                  variant="game-link"
                  onClick={back}
                  className="gap-1 self-start pr-4 font-mono text-[12px] font-bold uppercase tracking-widest text-white/80 no-underline focus-visible:underline"
                >
                  <Icon icon={ChevronLeftIcon} size={14} />
                  Back
                </Button>
                <div>
                  <h3 className="m-0 text-[17px] font-bold leading-snug">
                    {showing.title}
                  </h3>
                  <p className="m-0 mt-1 text-[13.5px] leading-snug text-white/75">
                    {showing.ask}
                  </p>
                  {showing.rule && (
                    <p className="m-0 mt-1.5 text-[13px] font-semibold leading-snug text-kenya-gold">
                      {showing.rule}
                    </p>
                  )}
                </div>
                <BoardPlayback className="rounded-md border-2 border-white/15 bg-white/5 p-3" />
                <ol className="m-0 grid list-none gap-1 p-0">
                  {route.steps.map((s, i) => (
                    <li key={`${s.from}-${s.title}`}>
                      <Item
                        asChild
                        variant="game-ghost"
                        size="sm"
                        className={cn(
                          "flex-nowrap items-start gap-2.5 px-2.5 py-2.5",
                          i === step
                            ? "border-white/40 bg-white/10"
                            : "border-transparent",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toStep(i)}
                          aria-current={i === step ? "step" : undefined}
                        >
                          <ItemMedia className="mt-px font-mono text-[11px] font-bold text-white/55">
                            {i + 1}
                          </ItemMedia>
                          <ItemContent>
                            <ItemTitle>
                              {s.title}
                              <span className="ml-1.5 inline-flex gap-1 align-middle font-mono text-[9.5px] font-bold uppercase tracking-widest">
                                <StepTags step={s} />
                              </span>
                            </ItemTitle>
                            {!s.confirmed && (
                              <ItemDescription className="font-semibold text-kenya-gold">
                                {UNSURE_NOTE}
                              </ItemDescription>
                            )}
                          </ItemContent>
                        </button>
                      </Item>
                    </li>
                  ))}
                </ol>
              </div>
            ) : tab === "lanes" ? (
              <div className="grid gap-3">
                <div>
                  <p className={eyebrow}>Coming from</p>
                  <ToggleGroup
                    type="single"
                    variant="game"
                    aria-label="Coming from"
                    value={arm}
                    onValueChange={(next) => {
                      if (!next) return;
                      const picked = next as ArmId;
                      setArm(picked);
                      setLane((n) => Math.min(n, ARMS[picked].lanes));
                    }}
                    className="mt-1.5 grid grid-cols-4 gap-1"
                  >
                    {APPROACHES.map((a) => (
                      <ToggleGroupItem
                        key={a.arm}
                        value={a.arm}
                        className={cn(pick, "px-1 text-center")}
                      >
                        {a.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <p className="m-0 mt-1.5 text-[12.5px] text-white/65">
                    {APPROACHES.find((a) => a.arm === arm)?.road},{" "}
                    {ARMS[arm].lanes} lanes each way. Option code{" "}
                    <strong className="font-mono text-white">
                      {OPTION_CODES[ARMS[arm].lanes]}
                    </strong>
                    : the number of options in each lane, from the kerb.
                  </p>
                </div>
                <div>
                  <p className={eyebrow}>In lane</p>
                  <ToggleGroup
                    type="single"
                    variant="game"
                    aria-label="In lane"
                    value={String(lane)}
                    onValueChange={(next) => next && setLane(Number(next))}
                    className="mt-1.5 flex gap-1"
                  >
                    {Array.from(
                      { length: ARMS[arm].lanes },
                      (_, i) => i + 1,
                    ).map((n) => (
                      <ToggleGroupItem
                        key={n}
                        value={String(n)}
                        className={cn(pick, "flex-1 text-center")}
                      >
                        {n}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <p className="m-0 mt-2 text-[14px] font-semibold leading-snug">
                    {laneRule(ARMS[arm].lanes, lane)}
                  </p>
                  <p className="m-0 mt-1 text-[12.5px] leading-snug text-white/65">
                    Lane 1 is by the kerb. Change lanes only where the lines are
                    broken: mirrors, signal for 3 seconds, then move. Tap a turn
                    to watch it driven.
                  </p>
                </div>
                <ul className="m-0 grid list-none gap-1.5 p-0">
                  {options.map((option) => (
                    <li key={option.id}>
                      <Item
                        asChild
                        variant="game"
                        size="sm"
                        className="flex-nowrap"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            play(
                              {
                                kind: "lane",
                                id: `${arm}${lane}-${option.id}`,
                                title: `Lane ${lane}: ${option.label.toLowerCase()}`,
                                ask: laneRule(ARMS[arm].lanes, lane),
                                color: option.color,
                              },
                              option.route,
                            )
                          }
                        >
                          <ItemMedia
                            aria-hidden
                            className="h-2.5 w-7 rounded-full group-has-[[data-slot=item-description]]/item:self-center"
                            style={{ background: option.color }}
                          />
                          <ItemContent>
                            <ItemTitle>
                              {option.label}{" "}
                              <span className="font-mono text-[11px] text-white/55">
                                {option.degrees}
                              </span>
                            </ItemTitle>
                            <ItemDescription>{option.how}</ItemDescription>
                            {!option.confirmed && (
                              <ItemDescription className="font-semibold text-kenya-gold">
                                {UNSURE_NOTE}
                              </ItemDescription>
                            )}
                          </ItemContent>
                          <ItemActions>
                            <Icon icon={PlayIcon} size={14} />
                          </ItemActions>
                        </button>
                      </Item>
                    </li>
                  ))}
                </ul>
              </div>
            ) : tab === "board" ? (
              <div className="grid gap-3">
                {picked ? (
                  <div className="rounded-md border-2 border-[#f6c416] bg-white/5 p-3">
                    <h3 className="m-0 text-[17px] font-bold leading-snug">
                      {picked.name}
                    </h3>
                    <p className="m-0 mt-1.5 text-[14px] leading-snug text-white/85">
                      {picked.note}
                    </p>
                    {picked.sign && (
                      <Link
                        to={picked.sign.to}
                        className="mt-2 inline-flex items-center gap-1 text-[13px] font-bold text-kenya-gold underline-offset-4 hover:underline"
                      >
                        The {picked.sign.label} sign
                        <Icon icon={ArrowRightIcon} size={13} />
                      </Link>
                    )}
                    <p className="m-0 mt-2 font-mono text-[10px] uppercase tracking-widest text-white/50">
                      {RULES_SOURCE}, Unit 3
                    </p>
                  </div>
                ) : (
                  <p className="m-0 text-[14px] leading-snug text-white/80">
                    Tap anything painted on the board to see it and what it asks
                    of you.
                  </p>
                )}
                <ToggleGroup
                  type="single"
                  variant="game"
                  aria-label="On the board"
                  value={feature ?? ""}
                  onValueChange={(next) => {
                    if (!next) return;
                    setFeature(next);
                    analytics.boardLessonViewed({
                      kind: "feature",
                      lesson_id: next,
                    });
                  }}
                  className="grid grid-cols-2 gap-1.5"
                >
                  {BOARD_FEATURES.map((f) => (
                    <ToggleGroupItem
                      key={f.id}
                      value={f.id}
                      className={cn(pick, "justify-start text-left")}
                    >
                      {f.name}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            ) : (
              <div className="grid gap-3">
                <p className="m-0 text-[14px] leading-snug text-white/80">
                  {tab === "routes"
                    ? "Rule 1: use the shortest correct route without parking. Rule 2: use the longest correct route if needed. Rule 3: parking is only a last option. Tap a route to watch it driven, a step at a time."
                    : "Parking and leaving a bay, forward and in reverse. Tap one to watch it, a step at a time."}
                </p>
                <ul className="m-0 grid list-none gap-1.5 p-0">
                  {LESSONS.filter((l) => l.group === tab).map(lessonRow)}
                </ul>
              </div>
            )}

            <Button
              variant="game-outline"
              asChild
              className="mt-4 h-auto min-h-12 w-full bg-transparent py-2.5 font-mono text-[11px] font-bold uppercase tracking-widest no-underline hover:bg-white/10"
            >
              <Link to={BOARD_PATH} replace>
                Go to the levels
                <Icon icon={ArrowRightIcon} size={14} />
              </Link>
            </Button>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
