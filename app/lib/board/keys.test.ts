/**
 * The arrow keys steer the car itself, as in a game: up drives on and follows
 * the road, left or right tapped changes lane and held turns, left on the
 * roundabout leaves at the next exit, and down brakes. Checked here as
 * numbers, and by driving every roundabout task with the keys alone.
 */
import { beforeAll, describe, expect, it } from "vitest";

import type { CarInput, CarState } from "./car";
import { BOARD_CHALLENGES, type TurnChallenge } from "./challenges";
import {
  ARMS,
  bearingOf,
  laneBearing,
  locate,
  rulesFor,
  wrapPi,
} from "./geometry";
import {
  createAssist,
  keyStick,
  stickBearing,
  stickToInput,
  type Keys,
} from "./joystick";
import {
  beginChallenge,
  car,
  drive,
  loadPhysics,
  stick,
  stopDriving,
  tick,
} from "./runtime";

const STEP = 1 / 60;
const DEG = Math.PI / 180;
const NONE: Keys = { up: false, down: false, left: false, right: false };

beforeAll(async () => {
  await loadPhysics();
});

describe("the keys as a knob", () => {
  const north = { x: 0, z: 0, heading: 0 };

  it("drives on the way the car points, wherever the learner stands", () => {
    for (const seat of ["south", "west", "north", "east"] as const) {
      const at = keyStick({ ...NONE, up: true }, north, seat, 1);
      expect(Math.abs(wrapPi(stickBearing(at, seat)))).toBeLessThan(1e-9);
      expect(at.follow).toBe(true);
    }
    // From the east seat, the car pointing north points right on the screen.
    const east = keyStick({ ...NONE, up: true }, north, "east", 1);
    expect(east.x).toBeCloseTo(1, 6);
    expect(east.y).toBeCloseTo(0, 6);
  });

  it("does nothing with left or right alone", () => {
    const at = keyStick({ ...NONE, left: true }, north, "south", 1, 2);
    expect(Math.hypot(at.x, at.y)).toBe(0);
  });

  it("leans for a lane change when tapped, and turns when held", () => {
    const tap = keyStick(
      { ...NONE, up: true, left: true },
      north,
      "south",
      1,
      0.1,
    );
    const held = keyStick(
      { ...NONE, up: true, left: true },
      north,
      "south",
      1,
      1,
    );
    expect(stickBearing(tap, "south") / DEG).toBeCloseTo(-28, 3);
    expect(stickBearing(held, "south") / DEG).toBeCloseTo(-50, 3);
    expect(tap.follow).toBe(false);
  });

  it("brakes a moving car with down", () => {
    const state: CarState = { x: 0, z: 30, heading: 0, speed: 4, steer: 0 };
    const input: CarInput = { steer: 0, throttle: 0, brake: 0 };
    const at = keyStick({ ...NONE, down: true }, state, "south", 1);
    stickToInputFor(at, state, input);
    expect(input.brake).toBe(1);
    expect(input.throttle).toBe(0);
  });

  it("points down the next exit with left on the roundabout", () => {
    // On the west of the ring, going round clockwise: north is next.
    const at = keyStick(
      { ...NONE, up: true, left: true },
      { x: -15.3, z: -2, heading: 6 * DEG },
      "south",
      1,
      0.1,
    );
    expect(at.exit).toBe(true);
    expect(stickBearing(at, "south")).toBeCloseTo(laneBearing("N", "exit"), 6);
  });
});

function stickToInputFor(
  at: { x: number; y: number },
  state: CarState,
  input: CarInput,
): void {
  stickToInput(
    at,
    state,
    input,
    { seat: "south", assist: true },
    createAssist(),
  );
}

describe("every roundabout task, with the keys alone", () => {
  const tasks = BOARD_CHALLENGES.filter(
    (c): c is TurnChallenge => "turn" in c && c.id !== "turn-back",
  );
  for (const task of tasks) {
    it(`${task.id}: up, a tap into the right lane, and left as the exit comes up`, () => {
      drive.seat = "east";
      drive.assist = true;
      const faults: string[] = [];
      let goal = false;
      beginChallenge(task, {
        onFault: (fault) => faults.push(fault.id),
        onSmall: (fault) => faults.push(fault.id),
        onGoal: () => {
          goal = true;
        },
      });
      const target = task.goal.arm;
      const exitAt = bearingOf(ARMS[target].out.x, ARMS[target].out.z);
      const lanes = ARMS[task.start.arm].lanes;
      const fits = (lane: number) =>
        rulesFor(lanes, lane, task.turn).some(
          (rule) => task.goal.lane == null || rule.exit === task.goal.lane,
        );
      let need = task.start.lane;
      for (let d = 1; d < 4 && !fits(need); d += 1) {
        if (fits(task.start.lane - d)) need = task.start.lane - d;
        else if (fits(task.start.lane + d)) need = task.start.lane + d;
      }
      const keys: Keys = { ...NONE, up: true };
      let t = 0;
      let tapUntil = -Infinity;
      let tapDir = 0;
      let turnFrom = 0;
      let wasTurning = false;
      let leaving = false;
      // Round far enough that the exit coming up is the one wanted (a U-turn
      // passes its own road on the way in).
      let round = 0;
      let last: number | null = null;
      for (
        let i = 0;
        i < 60 / STEP && !goal && !faults.length;
        i += 1, t += STEP
      ) {
        const loc = locate(car.x, car.z);
        keys.left = keys.right = false;
        if (
          loc.kind === "arm" &&
          loc.arm === task.start.arm &&
          loc.side === "approach" &&
          loc.lane !== need &&
          car.speed > 3 &&
          t > tapUntil + 1.2
        ) {
          tapDir = loc.lane > need ? -1 : 1;
          tapUntil = t + 0.3;
        }
        if (t < tapUntil) {
          keys.left = tapDir < 0;
          keys.right = tapDir > 0;
        }
        if (loc.kind === "ring") {
          if (last != null) round += wrapPi(loc.bearing - last);
          last = loc.bearing;
          const ahead = wrapPi(exitAt - loc.bearing);
          const past = target !== task.start.arm || round > 0.5;
          if (past && ahead > -0.09 && ahead < 1.1) leaving = true;
        }
        if (loc.kind === "arm" && loc.arm === target) leaving = false;
        if (leaving) keys.left = true;
        if (
          loc.kind === "arm" &&
          loc.arm === target &&
          loc.side === "exit" &&
          loc.along > 38
        ) {
          keys.up = false;
        }
        const turning = keys.left || keys.right;
        if (turning && !wasTurning) turnFrom = t;
        wasTurning = turning;
        const at = keyStick(keys, car, drive.seat, 1, t - turnFrom);
        stick.x = at.x;
        stick.y = at.y;
        drive.follow = at.follow;
        drive.keyExit = at.exit;
        drive.keyChange = at.change;
        tick(STEP);
      }
      stopDriving();
      drive.follow = drive.keyExit = false;
      drive.keyChange = 0;
      stick.x = stick.y = 0;
      expect(faults).toEqual([]);
      expect(goal).toBe(true);
    });
  }
});
