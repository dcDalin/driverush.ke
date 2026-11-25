/**
 * Lane assist across the whole board: every driving level can be driven the
 * right way with lane assist on, by a thumb that simply points a little way
 * on along the route, and the assist gives way to a lane change asked for
 * where the lines are broken.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useBoardStore } from "../board-store";
import type { CarInput, CarState } from "./car";
import { ALL_LEVELS } from "./curriculum";
import {
  bearingOf,
  laneBearing,
  lanePoint,
  locate,
  SOLID_ZONE,
} from "./geometry";
import {
  AISLE_SPEED,
  type AssistState,
  createAssist,
  stickToInput,
} from "./joystick";
import { challengeRoute } from "./lessons";
import { car, drive, loadPhysics, stick, tick } from "./runtime";

const STEP = 1 / 60;
const DEG = Math.PI / 180;

beforeAll(() => loadPhysics());
beforeEach(() => {
  useBoardStore.getState().exit();
  useBoardStore.getState().resetProgress();
  drive.seat = "south";
  drive.assist = true;
});

/**
 * Drive the level's task along its own route: point about 6 m on along it
 * (2.5 m when reversing), stop at each stop line, let go at the end. A thumb
 * that is a little off can be given a steady `bias`, in degrees.
 */
function driveLevel(
  id: string,
  bias = 0,
  /** Told after each step how far along the route the car is, of how far. */
  watch?: (along: number, length: number) => void,
): string {
  useBoardStore.getState().startLevel(id);
  const first = useBoardStore.getState();
  const route = challengeRoute(first.queue[first.pos]!);
  if (!route) return "no route";
  const reverse = (d: number) =>
    route.steps.some((s) => s.gear === "reverse" && d >= s.from && d < s.to);
  const stops = route.steps
    .filter((s) => s.control === "stop")
    .map((s) => s.from);
  // the route, a point every half metre
  const points: { x: number; z: number; d: number; back: boolean }[] = [
    { ...route.points[0]!, d: 0, back: reverse(0) },
  ];
  for (let k = 1; k < route.points.length; k += 1) {
    const a = route.points[k - 1]!;
    const b = route.points[k]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5));
    for (let j = 1; j <= n; j += 1) {
      const d = route.at[k - 1]! + ((route.at[k]! - route.at[k - 1]!) * j) / n;
      points.push({
        x: a.x + ((b.x - a.x) * j) / n,
        z: a.z + ((b.z - a.z) * j) / n,
        d,
        back: reverse(d),
      });
    }
  }
  const stopped = new Set<number>();
  let at = 0;
  // the longest level goes most of the way round the board, through the
  // parking aisle at its slow speed
  for (let i = 0; i < 240 * 60; i += 1) {
    if (useBoardStore.getState().phase !== "driving") break;
    // where along the route the car is, never jumping back or far ahead
    let gap = Infinity;
    for (let k = at; k < Math.min(points.length, at + 60); k += 1) {
      const d = Math.hypot(points[k]!.x - car.x, points[k]!.z - car.z);
      if (d < gap) {
        gap = d;
        at = k;
      }
    }
    const back = points[at]!.back;
    let aim = at;
    let run = 0;
    while (
      aim < points.length - 1 &&
      run < (back ? 2.5 : 6) &&
      points[aim + 1]!.back === back
    ) {
      run += Math.hypot(
        points[aim + 1]!.x - points[aim]!.x,
        points[aim + 1]!.z - points[aim]!.z,
      );
      aim += 1;
    }
    // at a change of gear, look across it
    if (aim === at) aim = Math.min(points.length - 1, at + 4);
    let rest = at >= points.length - 2 && gap < 1.2;
    for (const line of stops) {
      if (stopped.has(line)) continue;
      const ahead = line - points[at]!.d;
      if (ahead < 2.2 && ahead > -1) {
        rest = true;
        if (Math.abs(car.speed) < 0.05) stopped.add(line);
      }
    }
    const knob =
      bearingOf(points[aim]!.x - car.x, points[aim]!.z - car.z) + bias * DEG;
    // seated south, up on the knob is north
    stick.x = rest ? 0 : Math.sin(knob);
    stick.y = rest ? 0 : -Math.cos(knob);
    tick(STEP);
    watch?.(points[at]!.d, route.length);
  }
  const after = useBoardStore.getState();
  return after.phase === "fault" ? (after.fault?.id ?? "fault") : after.phase;
}

describe("lane assist on every driving level", () => {
  const levels = ALL_LEVELS.filter(
    (level) => level.kind === "drive" || level.kind === "warmup",
  );
  it.each(levels.map((level) => [level.id]))(
    "%s can be driven the right way",
    (id) => {
      expect(driveLevel(id)).toBe("passed");
    },
  );
});

describe("lane assist lets go for a tight first exit", () => {
  // From lane 1 into the first exit, the turn is tight. Holding the ring until
  // the knob pointed well outward, the car turned off late and came out wide,
  // in lane 2, for a thumb only a little off.
  it.each([["drive-from-two-way"], ["drive-blocked-street"]])(
    "%s with a thumb 8 degrees off",
    (id) => {
      expect(driveLevel(id, 8)).toBe("passed");
    },
  );
});

describe("lane assist keeps the aisle's speed into a bay", () => {
  // It lets go of the steering about 7 m before the bay. The aisle's speed
  // limit used to go with it, so a full push took the car in at about 6 m/s.
  it.each([["drive-park-angle"], ["drive-blocked-parking"]])(
    "%s goes into its bay no faster than the aisle",
    (id) => {
      let fastest = 0;
      const result = driveLevel(id, 0, (along, length) => {
        if (along > length - 12) fastest = Math.max(fastest, car.speed);
      });
      expect(result).toBe("passed");
      expect(fastest).toBeLessThanOrEqual(AISLE_SPEED + 0.05);
    },
  );
});

describe("lane changes are the thumb's", () => {
  // up the four-lane road in lane 2, well before the continuous lines
  function onApproach(along: number): CarState {
    const at = lanePoint("S", "approach", 2, along);
    return {
      x: at.x,
      z: at.z,
      heading: laneBearing("S", "approach"),
      speed: 5,
      steer: 0,
    };
  }
  /**
   * Hold the knob this far right of the lane for a while, the car standing
   * still: how much of the steering the lane then has (0 to 1).
   */
  function lean(
    from: CarState,
    angle: number,
    seconds: number,
    state: AssistState = createAssist(),
    others: { x: number; z: number }[] = [],
  ): number {
    const input: CarInput = { steer: 0, throttle: 0, brake: 0 };
    const heading = laneBearing("S", "approach") + angle;
    // seated south, up on the knob is north
    const knob = { x: Math.sin(heading), y: -Math.cos(heading) };
    for (let t = 0; t < seconds; t += STEP) {
      stickToInput(
        knob,
        from,
        input,
        { seat: "south", assist: true, others },
        state,
      );
    }
    return state.hold;
  }

  it("never makes a lane change for a thumb leaning toward one", () => {
    // a 20° lean is the thumb's own: the lane lets go of it, and the assist
    // never picks the lane beside to steer into
    expect(lean(onApproach(56), 20 * DEG, 0.6)).toBe(0);
    expect(lean(onApproach(56), -20 * DEG, 0.6)).toBe(0);
  });

  it("steadies a slight lean", () => {
    expect(lean(onApproach(56), 4 * DEG, 2)).toBe(1);
    expect(lean(onApproach(56), 10 * DEG, 2)).toBeGreaterThan(0.5);
  });

  it("steadies a sloppy lean at the continuous lines", () => {
    const close = onApproach(SOLID_ZONE - 3);
    expect(locate(close.x, close.z)).toMatchObject({ kind: "arm", lane: 2 });
    expect(lean(close, 20 * DEG, 2)).toBe(1);
    // and a clear push across them is the thumb's (the referee judges it)
    expect(lean(close, 50 * DEG, 2)).toBe(0);
  });
});
