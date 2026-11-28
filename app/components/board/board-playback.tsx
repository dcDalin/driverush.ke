/**
 * A route played back on the table, one step at a time: what to do, why, and
 * the controls to play, pause, step and scrub. Learn mode uses it for lessons,
 * and the driving tasks use it for "Show me" and "Watch the right way".
 */
import * as React from "react";

import { Icon } from "~/components/brand/icon";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
} from "~/components/brand/icons";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import { REVERSE_COLOR, ROUTE_COLOR } from "~/lib/board/lessons";
import { type Route, type RouteStep, stepPoints } from "~/lib/board/network";
import {
  cam,
  play,
  PLAY_RATES,
  type StageLine,
  useStage,
} from "~/lib/board/stage";
import { cn } from "~/lib/utils";

/** A route as lines for the table: the step in hand bright, the rest dimmed. */
export function routeLines(
  route: Route,
  active: number,
  color: string = ROUTE_COLOR,
): StageLine[] {
  return route.steps.map((step, i) => ({
    id: `${i}`,
    points: stepPoints(route, i),
    color: step.gear === "reverse" ? REVERSE_COLOR : color,
    width: i === active ? 2.4 : 1.8,
    opacity: i === active ? 1 : 0.55,
  }));
}

const CONTROL_LABEL = {
  stop: "Stop line",
  give_way: "Give way",
  crossing: "Crossing",
} as const;

/** The small labels over a step: reverse gear, paint to obey, a rule in doubt. */
export function StepTags({ step }: { step: RouteStep }) {
  return (
    <>
      {step.gear === "reverse" && (
        <span className="rounded-sm bg-rush px-1.5 py-0.5 text-white">
          Reverse
        </span>
      )}
      {step.control && (
        <span className="rounded-sm bg-white/15 px-1.5 py-0.5 text-white">
          {CONTROL_LABEL[step.control]}
        </span>
      )}
    </>
  );
}

/** Said wherever a step rests on a rule a driving school has not confirmed. */
export const UNSURE_NOTE = "Schools differ here. Ask your instructor.";

/**
 * Where the car is along the route, to drag. It follows the car frame by
 * frame while it plays: only this small part re-renders, not the player.
 */
function PlaybackScrubber({
  length,
  playing,
  follow,
  onSeek,
}: {
  length: number;
  playing: boolean;
  /** Anything that moves the car without playing: a step, the end, a route. */
  follow: unknown[];
  onSeek: (distance: number) => void;
}) {
  const [at, setAt] = React.useState(play.distance);
  React.useEffect(() => {
    let frame = 0;
    const tick = () => {
      setAt(play.distance);
      if (playing) frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, ...follow]);
  return (
    <Slider
      min={0}
      max={length}
      step={0.5}
      value={[at]}
      aria-label="Where the car is along the route"
      onValueChange={(values) => {
        // a one-thumb slider always reports one value
        const next = values[0]!;
        setAt(next);
        onSeek(next);
      }}
      className={cn(
        "h-6 cursor-pointer",
        "[&_[data-slot=slider-track]]:bg-white/15",
        "[&_[data-slot=slider-range]]:bg-game-gold",
        "[&_[data-slot=slider-thumb]]:border-game-gold [&_[data-slot=slider-thumb]]:bg-game-gold",
        "[&_[data-slot=slider-thumb]]:focus-visible:ring-white/40",
      )}
    />
  );
}

/** Step and speed: dimmer than the panel's other buttons when spent. */
const stepButton = "disabled:opacity-35";

export function BoardPlayback({
  note,
  className,
}: {
  /** Said above the step, such as where a drive went wrong. */
  note?: string | null;
  className?: string;
}) {
  const route = useStage((s) => s.route);
  const playing = useStage((s) => s.playing);
  const rate = useStage((s) => s.rate);
  const index = useStage((s) => s.step);
  const ended = useStage((s) => s.ended);
  const setPlaying = useStage((s) => s.setPlaying);
  const setRate = useStage((s) => s.setRate);
  const seek = useStage((s) => s.seek);
  const toStep = useStage((s) => s.toStep);

  // Space plays and pauses, as in any player.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " ") return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName) ||
          target.getAttribute("role") === "slider")
      ) {
        return;
      }
      e.preventDefault();
      const stage = useStage.getState();
      stage.setPlaying(!stage.playing);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!route) return null;
  const step = route.steps[index];
  const total = route.steps.length;

  return (
    <div className={cn("grid gap-3", className)}>
      {step && (
        <div aria-live="polite">
          <p className="m-0 flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-bold tracking-widest text-kenya-gold uppercase">
            Step {index + 1} of {total}
            <StepTags step={step} />
          </p>
          {note && (
            <p className="m-0 mt-1.5 text-[12.5px] leading-snug font-bold text-[#ff9d8a]">
              {note}
            </p>
          )}
          <p className="m-0 mt-1.5 text-[15.5px] leading-snug font-bold text-white">
            {step.title}
          </p>
          <p className="m-0 mt-1 text-[13.5px] leading-snug text-white/80">
            {step.why}
          </p>
          {!step.confirmed && (
            <p className="m-0 mt-1.5 text-[12.5px] leading-snug font-semibold text-kenya-gold">
              {UNSURE_NOTE}
            </p>
          )}
        </div>
      )}

      <PlaybackScrubber
        length={route.length}
        playing={playing}
        follow={[index, ended, route]}
        onSeek={(distance) => {
          setPlaying(false);
          seek(distance);
        }}
      />

      <div className="flex items-center gap-2">
        <Button
          variant="game-outline"
          size="icon"
          aria-label="Previous step"
          className={stepButton}
          disabled={index === 0}
          onClick={() => toStep(index - 1)}
        >
          <Icon icon={ChevronLeftIcon} size={18} />
        </Button>
        <Button
          variant="game-gold"
          aria-label={ended ? "Play again" : playing ? "Pause" : "Play"}
          className="min-w-0 flex-1 gap-0 px-0"
          onClick={() => {
            cam.follow = true;
            setPlaying(!playing);
          }}
        >
          <Icon
            icon={ended ? RefreshIcon : playing ? PauseIcon : PlayIcon}
            size={18}
          />
          <span className="ml-2 font-mono text-[11px] font-bold tracking-widest uppercase">
            {ended ? "Again" : playing ? "Pause" : "Play"}
          </span>
        </Button>
        <Button
          variant="game-outline"
          size="icon"
          aria-label="Next step"
          className={stepButton}
          disabled={index >= total - 1}
          onClick={() => toStep(index + 1)}
        >
          <Icon icon={ChevronRightIcon} size={18} />
        </Button>
        <Button
          variant="game-outline"
          size="icon"
          aria-label={`Playback speed ${rate} times. Change speed.`}
          className={cn(stepButton, "w-14 font-mono text-[12px] font-bold")}
          onClick={() => {
            const next =
              PLAY_RATES[
                (PLAY_RATES.indexOf(rate as 1) + 1) % PLAY_RATES.length
              ]!;
            setRate(next);
          }}
        >
          {rate}x
        </Button>
      </div>
    </div>
  );
}
