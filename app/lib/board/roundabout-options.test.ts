/**
 * The lane options as Perez's Model Town Board tutorial teaches them
 * (`LANE_OPTIONS`), held to the network, the line-up and the referee: every
 * option has its own way through, goes round in its own roundabout lane and
 * leaves in its own lane, and the referee judges a drive by the same table.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { CAR } from "./car";
import type { TurnChallenge } from "./challenges";
import {
  ARMS,
  armForTurn,
  bearingOf,
  laneRules,
  locate,
  type ArmId,
  type LaneRule,
  type Turn,
  type Vec,
} from "./geometry";
import { lanePath } from "./lane-paths";
import { queueCars } from "./lane-queue";
import { laneOptions } from "./lessons";
import { network, roundaboutWay } from "./network";
import type { Fault } from "./referee";
import {
  beginChallenge,
  car,
  drive,
  loadPhysics,
  stick,
  stopDriving,
  tick,
} from "./runtime";

const ARMS_IN: readonly ArmId[] = ["S", "W"];

function ringEdge(arm: ArmId, lane: number, rule: LaneRule) {
  const name = roundaboutWay(arm, lane, rule.turn, rule.exit);
  return network().edges.find(
    (e) => e.maneuver === "ring" && e.from === `${name}:on`,
  );
}

describe("the lane options table", () => {
  it("gives every option its own way, ring lane and exit lane", () => {
    for (const arm of ARMS_IN) {
      for (let lane = 1; lane <= ARMS[arm].lanes; lane += 1) {
        for (const rule of laneRules(ARMS[arm].lanes, lane)) {
          const ring = ringEdge(arm, lane, rule);
          expect(ring, `${arm}${lane} ${rule.turn}`).toBeDefined();
          expect(ring?.lane).toBe(rule.ring);
          const name = roundaboutWay(arm, lane, rule.turn, rule.exit);
          const out = network().edges.find(
            (e) => e.maneuver === "exit" && e.from === `${name}:off`,
          );
          expect(out?.lane, `${name} exit lane`).toBe(rule.exit);
          expect(out?.road).not.toBe("roundabout");
        }
      }
    }
  });

  it("sets out one car per option, 2124 and 215", () => {
    expect(queueCars("S")).toHaveLength(9);
    expect(queueCars("W")).toHaveLength(8);
    const right = laneOptions("S", 3).find((o) => o.turn === "right");
    expect(right).toMatchObject({ ringLane: 3, exitLane: 2 });
    expect(right?.how).toBe(
      "Maintain lane 3 to exit, into lane 2 of the minor road (minus 1).",
    );
    const four = laneOptions("W", 3);
    expect(four.map((o) => [o.turn, o.ringLane, o.exitLane])).toEqual([
      ["straight", 3, 3],
      ["right", 3, 3],
      ["right", 4, 4],
      ["back", 4, 3],
      ["left", 4, 4],
    ]);
    expect(four.map((o) => o.degrees)).toEqual([
      "0°",
      "90°",
      "90°",
      "180°",
      "270°",
    ]);
    const round = laneOptions("S", 4).find((o) => o.turn === "straight");
    expect(round).toMatchObject({
      degrees: "360°",
      fullCircle: true,
      confirmed: true,
    });
    const left = laneOptions("S", 4).find((o) => o.turn === "left");
    expect(left).toMatchObject({ degrees: "270°", fullCircle: true });
    expect(left?.label).toBe("Q-turn");
  });

  it.each([
    ["S", 4, "straight", 3],
    ["S", 4, "left", 2.5],
    ["W", 3, "left", 2.5],
  ] as const)(
    "draws %s lane %d's %s once right round the island",
    (arm, lane, turn, halfTurns) => {
      const path = lanePath(arm, lane, turn);
      let turned = 0;
      let last: number | null = null;
      for (const p of path) {
        const at = locate(p.x, p.z);
        if (at.kind !== "ring") continue;
        if (last != null) {
          const step = Math.atan2(
            Math.sin(at.bearing - last),
            Math.cos(at.bearing - last),
          );
          turned += Math.max(0, step);
        }
        last = at.bearing;
      }
      // a quarter or half way round to the exit, plus one whole circle
      expect(turned / Math.PI).toBeGreaterThan(halfTurns - 0.3);
    },
  );
});

// ---- the referee judges the same table --------------------------------------

const STEP = 1 / 60;
const RELEASE_DECEL = 0.7 * CAR.brake + CAR.coast;

function task(
  arm: ArmId,
  lane: number,
  turn: Turn,
  exit: number,
): TurnChallenge {
  return {
    id: `test:${arm}${lane}:${turn}`,
    title: "Test",
    prompt: "Test",
    start: { arm, lane, along: Math.min(60, ARMS[arm].length - 8) },
    turn,
    goal: {
      arm: armForTurn(arm, turn),
      lane: exit,
      alongMin: 33,
      alongMax: 44,
    },
    otherCars: [],
  };
}

/** Drive a line with the knob, assist off, and stop in the box. */
function driveLine(challenge: TurnChallenge, path: Vec[]) {
  const outcome: { fault?: Fault; goal: boolean } = { goal: false };
  let over = false;
  beginChallenge(challenge, {
    onFault: (fault) => {
      outcome.fault = fault;
      over = true;
    },
    onSmall: () => {},
    onDeviation: () => {},
    onGoal: () => {
      outcome.goal = true;
      over = true;
    },
  });
  const goal = challenge.goal;
  const middle = (goal.alongMin + goal.alongMax) / 2;
  let nearest = 0;
  for (let i = 0; i < 200 / STEP && !over; i += 1) {
    while (
      nearest < path.length - 1 &&
      Math.hypot(path[nearest + 1].x - car.x, path[nearest + 1].z - car.z) <=
        Math.hypot(path[nearest].x - car.x, path[nearest].z - car.z)
    ) {
      nearest += 1;
    }
    const loc = locate(car.x, car.z);
    const stopping = car.speed ** 2 / (2 * RELEASE_DECEL);
    const home =
      nearest > path.length / 2 &&
      loc.kind === "arm" &&
      loc.arm === goal.arm &&
      loc.side === "exit" &&
      loc.along + stopping >= middle;
    if (home) {
      stick.x = 0;
      stick.y = 0;
    } else {
      let aim = nearest;
      let run = 0;
      while (aim < path.length - 1 && run < 4.5) {
        run += Math.hypot(
          path[aim + 1].x - path[aim].x,
          path[aim + 1].z - path[aim].z,
        );
        aim += 1;
      }
      const bearing = bearingOf(path[aim].x - car.x, path[aim].z - car.z);
      stick.x = Math.sin(bearing) * 0.7;
      stick.y = -Math.cos(bearing) * 0.7;
    }
    tick(STEP);
  }
  stopDriving();
  return outcome;
}

describe("the referee follows the table", () => {
  beforeAll(() => loadPhysics());
  afterEach(() => {
    drive.assist = true;
  });

  it("passes every option driven along its own line", () => {
    drive.assist = false;
    for (const arm of ARMS_IN) {
      for (let lane = 1; lane <= ARMS[arm].lanes; lane += 1) {
        for (const rule of laneRules(ARMS[arm].lanes, lane)) {
          const outcome = driveLine(
            task(arm, lane, rule.turn, rule.exit),
            lanePath(arm, lane, rule.turn, 62, 56, 0, rule),
          );
          const id = `${arm}${lane} ${rule.turn} via ring ${rule.ring}`;
          expect(outcome.fault, id).toBeUndefined();
          expect(outcome.goal, id).toBe(true);
        }
      }
    }
  });

  it("does not let lane 4 go straight on without going once round", () => {
    drive.assist = false;
    const outcome = driveLine(
      task("S", 4, "straight", 4),
      // one circle fewer than the option: straight out the first time past
      lanePath("S", 4, "straight", 62, 56, -1),
    );
    expect(outcome.fault).toMatchObject({ id: "wrong_exit", circle: true });
  });

  it.each([
    ["S", 4, 3],
    ["W", 3, 4],
  ] as const)(
    "does not let %s lane %d turn left at 270° without going once round",
    (arm, lane, exit) => {
      drive.assist = false;
      const outcome = driveLine(
        task(arm, lane, "left", exit),
        lanePath(arm, lane, "left", 62, 56, -1),
      );
      expect(outcome.fault).toMatchObject({ id: "wrong_exit", circle: true });
    },
  );

  it("leaves right from lane 3 in the middle lane, not lane 3", () => {
    drive.assist = false;
    const outcome = driveLine(
      task("S", 3, "right", 3),
      lanePath("S", 3, "right", 62, 56, 0, { ring: 3, exit: 3 }),
    );
    expect(outcome.fault?.id).toBe("exit_lane");
  });

  it("does not let lane 3 of the minor road come back through ring lane 3", () => {
    drive.assist = false;
    const outcome = driveLine(
      task("W", 3, "back", 3),
      lanePath("W", 3, "back", 62, 56, 0, { ring: 3, exit: 3 }),
    );
    // ring lane 3's last exit is the right turn: it is stopped going past it
    expect(outcome.fault).toMatchObject({ id: "missed_exit", ring: 3 });
  });
});
