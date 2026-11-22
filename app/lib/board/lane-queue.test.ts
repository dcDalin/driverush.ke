import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CAR } from "./car";
import { sizeOf } from "./cars";
import type { TurnChallenge } from "./challenges";
import { goalBox } from "./full-board";
import {
  ARMS,
  EXIT_CLEAR,
  allowedTurns,
  armForTurn,
  bearingOf,
  locate,
  type ArmId,
  type Vec,
} from "./geometry";
import {
  pickable,
  queueCars,
  queueChallenge,
  queueGoal,
  type QueueCar,
  type QueuePose,
} from "./lane-queue";
import type { Fault } from "./referee";
import {
  beginChallenge,
  car,
  drive,
  loadPhysics,
  setVehicle,
  stick,
  stopDriving,
  tick,
} from "./runtime";

const STEP = 1 / 60;
const RELEASE_DECEL = 0.7 * CAR.brake + CAR.coast;

type Outcome = {
  fault?: Fault;
  deviation?: Fault;
  small: Fault[];
  goal: boolean;
};

/** Drive one car along a line with the knob, and stop it in its box. */
function driveAlong(challenge: TurnChallenge, path: Vec[]): Outcome {
  const outcome: Outcome = { small: [], goal: false };
  let over = false;
  beginChallenge(challenge, {
    onFault: (fault) => {
      outcome.fault = fault;
      over = true;
    },
    onSmall: (fault) => outcome.small.push(fault),
    onDeviation: (fault) => {
      outcome.deviation = fault;
    },
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

/** Take every car home, choosing which lane goes next with `choose`. */
function playLesson(arm: ArmId, choose: (front: QueueCar[]) => QueueCar): void {
  const cars = queueCars(arm);
  const rest: Record<string, QueuePose> = {};
  while (Object.keys(rest).length < cars.length) {
    const next = choose(pickable(cars, Object.keys(rest)));
    const challenge = queueChallenge(cars, next, rest);
    // Each is driven at its own size: a lorry takes a lorry's room.
    setVehicle(next.car);
    const outcome = driveAlong(challenge, next.option.route.points);
    expect(outcome.fault, `${next.id} fault`).toBeUndefined();
    expect(outcome.small, `${next.id} small faults`).toEqual([]);
    expect(outcome.goal, `${next.id} reached its box`).toBe(true);
    rest[next.id] = { x: car.x, z: car.z, heading: car.heading };
  }
}

beforeAll(() => loadPhysics());
beforeEach(() => {
  stopDriving();
  setVehicle("saloon");
  drive.seat = "south";
  drive.assist = true;
});

describe("the lane options line-up", () => {
  it("sets out one car for each option: 2124 and 215", () => {
    const count = (arm: ArmId) =>
      Array.from(
        { length: ARMS[arm].lanes },
        (_, i) => queueCars(arm).filter((c) => c.lane === i + 1).length,
      ).join("");
    expect(count("S")).toBe("2124");
    expect(count("W")).toBe("215");
  });

  it("stands every car in its own lane, clear of the others and the board's end", () => {
    for (const arm of ["S", "W"] as const) {
      const cars = queueCars(arm);
      for (const one of cars) {
        const loc = locate(one.start.x, one.start.z);
        expect(loc).toMatchObject({
          kind: "arm",
          arm,
          side: "approach",
          lane: one.lane,
        });
        // its tail is on the board, whatever its length
        expect(one.along + sizeOf(one.car).length / 2).toBeLessThan(
          ARMS[arm].length - 0.5,
        );
        // and its nose clear of the one in front of it in its lane
        const ahead = cars.find(
          (c) => c.lane === one.lane && c.slot === one.slot - 1,
        );
        if (ahead) {
          expect(
            one.along - sizeOf(one.car).length / 2,
            `${one.id} behind ${ahead.id}`,
          ).toBeGreaterThan(ahead.along + sizeOf(ahead.car).length / 2 + 0.5);
        }
        expect(allowedTurns(ARMS[arm].lanes, one.lane)).toContain(
          one.option.turn,
        );
        expect(one.exit.arm).toBe(armForTurn(arm, one.option.turn));
        for (const other of cars) {
          if (other === one) continue;
          const apart = Math.hypot(
            one.start.x - other.start.x,
            one.start.z - other.start.z,
          );
          expect(apart, `${one.id} and ${other.id}`).toBeGreaterThan(3.5);
        }
      }
      expect(new Set(cars.map((c) => c.paint)).size).toBe(cars.length);
    }
    // the long vehicles take their places in a line-up too
    const models = (["S", "W"] as const).flatMap((arm) =>
      queueCars(arm).map((c) => c.car),
    );
    expect(models).toContain("van");
    expect(models).toContain("lorry");
  });

  it("marks every standing car as one that wears the school's paint", () => {
    for (const arm of ["S", "W"] as const) {
      const cars = queueCars(arm);
      const task = queueChallenge(cars, cars[0], {});
      expect(task.otherCars).toHaveLength(cars.length - 1);
      expect(task.otherCars?.every((other) => other.school)).toBe(true);
    }
  });

  it("offers only the front waiting car of each lane", () => {
    const cars = queueCars("S");
    expect(pickable(cars, []).map((c) => c.slot)).toEqual([0, 0, 0, 0]);
    const lane4 = cars.filter((c) => c.lane === 4);
    const after = pickable(cars, [lane4[0].id, lane4[1].id]);
    expect(after.find((c) => c.lane === 4)).toBe(lane4[2]);
    expect(
      pickable(
        cars,
        cars.map((c) => c.id),
      ),
    ).toEqual([]);
  });

  it("puts every green box on its road, and two in one lane apart", () => {
    for (const arm of ["S", "W"] as const) {
      const cars = queueCars(arm);
      for (const one of cars) {
        const sharing = cars.filter(
          (c) =>
            c !== one &&
            c.exit.arm === one.exit.arm &&
            c.exit.lane === one.exit.lane,
        );
        expect(sharing.length).toBeLessThanOrEqual(1);
        const first = queueGoal(cars, one, []);
        expect(first.alongMin).toBeGreaterThan(EXIT_CLEAR + CAR.length);
        expect(first.alongMax + CAR.length / 2).toBeLessThan(
          ARMS[one.exit.arm].length,
        );
        const box = goalBox(first);
        expect(box.x1 - box.x0).toBeGreaterThan(0);
        for (const other of sharing) {
          const second = queueGoal(cars, one, [other.id]);
          // the car already home stopped somewhere in the far box
          expect(second.alongMax + CAR.length).toBeLessThan(
            queueGoal(cars, other, []).alongMin,
          );
        }
      }
    }
  });

  it("can be driven home car by car on the four-lane road, kerb lane first", () => {
    playLesson("S", (front) => front[0]);
  });

  it("can be driven home on the four-lane road, inside lane first", () => {
    playLesson("S", (front) => front[front.length - 1]);
  });

  it("can be driven home car by car on the three-lane road", () => {
    playLesson("W", (front) => front[0]);
    playLesson("W", (front) => front[front.length - 1]);
  });

  it("a car taken out of another exit its lane may take has left its route", () => {
    const cars = queueCars("S");
    const left = cars.find((c) => c.lane === 1 && c.option.turn === "left");
    const straight = cars.find(
      (c) => c.lane === 1 && c.option.turn === "straight",
    );
    if (!left || !straight) throw new Error("lane 1 has both");
    // told to go straight on, it turns left
    const outcome = driveAlong(
      queueChallenge(cars, straight, {}),
      left.option.route.points,
    );
    expect(outcome.goal).toBe(false);
    expect(outcome.fault).toBeUndefined();
    expect(outcome.deviation?.id).toBe("wrong_destination");
  });
});
