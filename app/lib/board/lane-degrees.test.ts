/**
 * The lane options held to their degrees (owner, 2026-11-22): a car drives one
 * of its lane's options and no more. Lanes 1 to 3 never go on past their last
 * exit, lane 4 goes once round only for the Q-turn and the 360°, and a car of
 * a lane options lesson drives the option it was given and no other.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { faultTip } from "./board-rules";
import { CAR } from "./car";
import type { TurnChallenge } from "./challenges";
import {
  armForTurn,
  type ArmId,
  ARMS,
  bearingOf,
  laneRules,
  locate,
  loopsAt,
  optionSweep,
  type Turn,
  turnSweep,
  type Vec,
} from "./geometry";
import { lanePath } from "./lane-paths";
import { queueCars, queueChallenge } from "./lane-queue";
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

const STEP = 1 / 60;
const RELEASE_DECEL = 0.7 * CAR.brake + CAR.coast;
const ARMS_IN: readonly ArmId[] = ["S", "W"];

function task(
  arm: ArmId,
  lane: number,
  turn: Turn,
  exit?: number,
): TurnChallenge {
  return {
    id: `test:${arm}${lane}:${turn}`,
    title: "Test",
    prompt: "Test",
    start: { arm, lane, along: Math.min(60, ARMS[arm].length - 8) },
    turn,
    goal: {
      arm: armForTurn(arm, turn),
      ...(exit != null ? { lane: exit } : {}),
      alongMin: 33,
      alongMax: 44,
    },
    otherCars: [],
  };
}

type Outcome = { fault?: Fault; goal: boolean; onRing: boolean };

/** Drive a line with the knob, assist off, and stop in the box. */
function driveLine(challenge: TurnChallenge, path: Vec[]): Outcome {
  const outcome: Outcome = { goal: false, onRing: false };
  let over = false;
  beginChallenge(challenge, {
    onFault: (fault) => {
      outcome.fault = fault;
      outcome.onRing = locate(car.x, car.z).kind === "ring";
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
  for (let i = 0; i < 240 / STEP && !over; i += 1) {
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

describe("the degrees of each option", () => {
  it("counts 90° to 360°, and a loop on top for the Q-turn and the 360°", () => {
    const deg = (rad: number) => Math.round((rad * 180) / Math.PI);
    const four = laneRules(4, 4).map((rule) => deg(optionSweep(rule)));
    // right, U-turn, Q-turn, straight after a full loop: past the middle of
    // the road in, clockwise, to the middle of the road out
    expect(four).toEqual([270, 360, 450, 540]);
    expect(loopsAt("left", (400 * Math.PI) / 180)).toBe(1);
    expect(loopsAt("back", (330 * Math.PI) / 180)).toBe(0);
    expect(loopsAt("straight", turnSweep("straight") - 0.9)).toBe(0);
  });
});

describe("no option goes round further than it should", () => {
  beforeAll(() => loadPhysics());
  afterEach(() => {
    drive.assist = true;
  });

  it("still passes every option driven along its own line", () => {
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

  it("stops every option driven once more round, on the roundabout", () => {
    drive.assist = false;
    for (const arm of ARMS_IN) {
      for (let lane = 1; lane <= ARMS[arm].lanes; lane += 1) {
        for (const rule of laneRules(ARMS[arm].lanes, lane)) {
          const outcome = driveLine(
            task(arm, lane, rule.turn, rule.exit),
            lanePath(arm, lane, rule.turn, 62, 56, 1, rule),
          );
          const id = `${arm}${lane} ${rule.turn} via ring ${rule.ring}, once more round`;
          expect(outcome.fault, id).toMatchObject({
            id: "missed_exit",
            lane,
            ring: rule.ring,
          });
          expect(outcome.onRing, id).toBe(true);
          expect(outcome.goal, id).toBe(false);
        }
      }
    }
  });

  it.each([
    ["S", 1, "right"],
    ["S", 1, "back"],
    ["S", 2, "right"],
    ["S", 3, "back"],
    ["W", 1, "right"],
    ["W", 2, "back"],
  ] as const)(
    "stops %s lane %d going on to %s, past its last exit",
    (arm, lane, turn) => {
      drive.assist = false;
      const outcome = driveLine(
        task(arm, lane, turn),
        lanePath(arm, lane, turn, 62, 56),
      );
      expect(outcome.fault).toMatchObject({ id: "missed_exit", lane });
      expect(outcome.onRing).toBe(true);
    },
  );
});

describe("a lesson car drives its own option", () => {
  beforeAll(() => loadPhysics());
  afterEach(() => {
    drive.assist = true;
  });

  /** One car of the line-up on its own, the others out of its way. */
  function lessonTask(arm: ArmId, id: (turn: Turn, ring: number) => boolean) {
    const cars = queueCars(arm);
    const one = cars.find((c) => id(c.option.turn, c.option.ringLane));
    if (!one) throw new Error("no such car");
    return {
      car: one,
      challenge: { ...queueChallenge(cars, one, {}), otherCars: [] },
    };
  }

  it("stops lane 1 told to turn left that goes straight", () => {
    drive.assist = false;
    const { car: one, challenge } = lessonTask(
      "S",
      (turn, ring) => turn === "left" && ring === 1,
    );
    const outcome = driveLine(
      challenge,
      lanePath("S", one.lane, "straight", 62, 56),
    );
    expect(outcome.fault).toMatchObject({
      id: "wrong_option",
      lane: 1,
      turn: "straight",
      asked: "left",
    });
  });

  it("stops minor-road lane 3 told to shift to ring lane 4 that stays in 3", () => {
    drive.assist = false;
    const { challenge } = lessonTask(
      "W",
      (turn, ring) => turn === "right" && ring === 4,
    );
    const outcome = driveLine(
      challenge,
      lanePath("W", 3, "right", 62, 56, 0, { ring: 3, exit: 3 }),
    );
    expect(outcome.fault).toMatchObject({
      id: "wrong_option",
      lane: 3,
      ring: 3,
      askedRing: 4,
    });
  });

  it("passes each car driven along its own option", () => {
    drive.assist = false;
    for (const arm of ARMS_IN) {
      for (const one of queueCars(arm)) {
        const challenge = {
          ...queueChallenge(queueCars(arm), one, {}),
          otherCars: [],
        };
        const outcome = driveLine(
          challenge,
          lanePath(arm, one.lane, one.option.turn, 62, 56, 0, {
            ring: one.option.ringLane,
            exit: one.option.exitLane,
          }),
        );
        expect(outcome.fault, one.id).toBeUndefined();
        expect(outcome.goal, one.id).toBe(true);
      }
    }
  });
});

describe("the words for these faults", () => {
  it("names the lane, the option and the degrees, with no em dash", () => {
    const missed = faultTip({
      id: "missed_exit",
      serious: true,
      lane: 4,
      lanes: 4,
      ring: 4,
    });
    expect(missed.reason).toContain("never goes round twice");
    const wrong = faultTip({
      id: "wrong_option",
      serious: true,
      lane: 3,
      lanes: 3,
      turn: "right",
      ring: 3,
      asked: "right",
      askedRing: 4,
    });
    expect(wrong.reason).toContain("turn right into lane 4 (90°)");
    expect(wrong.reason).toContain("turn right into lane 3 (90°)");
    for (const tip of [missed, wrong]) {
      expect(`${tip.title} ${tip.rule} ${tip.reason}`).not.toContain("—");
    }
  });
});
