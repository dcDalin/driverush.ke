import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useBoardStore } from "../board-store";
import { bearingOf, locate, type ArmId } from "./geometry";
import { createAssist, exitAhead } from "./joystick";
import { queueCars, queueGoal } from "./lane-queue";
import { car, drive, loadPhysics, stick, tick } from "./runtime";

function hold(x: number, y: number, until: () => boolean, most = 30) {
  for (let i = 0; i < most * 60 && !until(); i += 1) {
    stick.x = x;
    stick.y = y;
    tick(1 / 60);
    if (useBoardStore.getState().phase !== "driving") return;
  }
}

/**
 * Take one car of a line-up home the way a thumb does: point a few metres on
 * along its painted line, and let go in the box. The cars in front of it are
 * home already, out of the way.
 */
function driveHome(
  level: string,
  arm: ArmId,
  id: string,
  bias = 0,
  /** How far, in degrees, the thumb wobbles either side of where it means. */
  wobble = 0,
) {
  const cars = queueCars(arm);
  const one = cars.find((c) => c.id === id)!;
  useBoardStore.getState().exit();
  useBoardStore.getState().startLevel(level);
  const ahead = cars.filter((c) => c.lane === one.lane && c.slot < one.slot);
  const rest = Object.fromEntries(
    ahead.map((c, k) => [c.id, { x: 500 + k * 10, z: 500, heading: 0 }]),
  );
  useBoardStore.setState((s) => ({ lanes: { ...s.lanes!, rest } }));
  useBoardStore.getState().pickCar(one.id);
  const goal = queueGoal(cars, one, Object.keys(rest));
  // the painted line, a point every half metre
  const line = one.option.route.points;
  const points = [line[0]];
  for (let k = 1; k < line.length; k += 1) {
    const a = line[k - 1];
    const b = line[k];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5));
    for (let j = 1; j <= n; j += 1) {
      points.push({
        x: a.x + ((b.x - a.x) * j) / n,
        z: a.z + ((b.z - a.z) * j) / n,
      });
    }
  }
  for (let i = 0; i < 90 * 60; i += 1) {
    const now = useBoardStore.getState();
    if (now.lanes?.picked == null || now.phase !== "driving") break;
    const at = locate(car.x, car.z);
    const home =
      at.kind === "arm" &&
      at.arm === goal.arm &&
      at.side === "exit" &&
      at.along > (goal.alongMin + goal.alongMax) / 2 - 1;
    let near = 0;
    for (let k = 1; k < points.length; k += 1) {
      const d = Math.hypot(points[k].x - car.x, points[k].z - car.z);
      if (d < Math.hypot(points[near].x - car.x, points[near].z - car.z)) {
        near = k;
      }
    }
    const aim = points[Math.min(points.length - 1, near + 12)];
    // a thumb can be held a steady `bias` degrees off, and wobble about it
    const t = i / 60;
    const shake =
      0.6 * Math.sin(t * 2 * Math.PI * 1.3) +
      0.4 * Math.sin(t * 2 * Math.PI * 3.1 + 1);
    const knob =
      bearingOf(aim.x - car.x, aim.z - car.z) +
      ((bias + wobble * shake) * Math.PI) / 180;
    // seated south, up on the knob is north
    stick.x = home ? 0 : Math.sin(knob);
    stick.y = home ? 0 : -Math.cos(knob);
    tick(1 / 60);
  }
  const after = useBoardStore.getState();
  return { fault: after.fault, home: after.lanes?.rest[one.id] != null, goal };
}

beforeAll(() => loadPhysics());
beforeEach(() => {
  useBoardStore.getState().exit();
  useBoardStore.getState().resetProgress();
  drive.seat = "south";
  drive.assist = true;
});

describe("lane assist out of the roundabout", () => {
  it("is on for a lesson car and off for a hard level", () => {
    useBoardStore.getState().startLevel("drive-three-lane-back");
    expect(drive.exitHold).toBe(false);
    useBoardStore.getState().exit();
    useBoardStore.getState().startLevel("four-lane");
    const left = queueCars("S").find((one) => one.lane === 1)!;
    useBoardStore.getState().pickCar(left.id);
    expect(drive.exitHold).toBe(true);
  });

  it("takes the lane 1 car left into lane 1 with a plain up, then left", () => {
    useBoardStore.getState().startLevel("four-lane");
    const cars = queueCars("S");
    const left = cars.find(
      (one) => one.lane === 1 && one.option.turn === "left",
    )!;
    // the straight-on car in front of it is home already, out of the way
    const ahead = cars.filter((c) => c.lane === 1 && c.slot < left.slot);
    useBoardStore.setState((s) => ({
      lanes: {
        ...s.lanes!,
        rest: Object.fromEntries(
          ahead.map((c, k) => [c.id, { x: 500 + k * 10, z: 500, heading: 0 }]),
        ),
      },
    }));
    useBoardStore.getState().pickCar(left.id);
    // up the road until the car is on the roundabout
    hold(0, -1, () => locate(car.x, car.z).kind === "ring");
    // then simply left, the way the exit road runs
    hold(-1, 0, () => {
      const at = locate(car.x, car.z);
      return at.kind === "arm" && at.arm === "W" && at.along > 37;
    });
    // let go: the car stops in the box
    hold(0, 0, () => useBoardStore.getState().lanes?.picked == null, 4);
    const after = useBoardStore.getState();
    expect(after.runFaultCount).toBe(0);
    expect(after.lanes?.rest[left.id]).toBeDefined();
    const at = locate(car.x, car.z);
    expect(at.kind === "arm" && at.side === "exit" && at.lane).toBe(1);
  });

  it("keeps an inner lane car in its own lane all the way out", () => {
    // Driving straight out of an inner ring lane crosses the outer ring lanes
    // on the way to the mouth. The lane it turns off into must not slip with
    // them, or the car is dragged across to lane 2 against the knob.
    // (Lane 4's straight on goes once round first, which "up" cannot steer.)
    const cars = queueCars("S");
    for (const one of cars.filter(
      (c) => c.option.turn === "straight" && c.option.degrees === "0°",
    )) {
      useBoardStore.getState().exit();
      useBoardStore.getState().startLevel("four-lane");
      // the cars in front of it are home already, out of the way
      const ahead = cars.filter(
        (c) => c.lane === one.lane && c.slot < one.slot,
      );
      useBoardStore.setState((s) => ({
        lanes: {
          ...s.lanes!,
          rest: Object.fromEntries(
            ahead.map((c, k) => [
              c.id,
              { x: 500 + k * 10, z: 500, heading: 0 },
            ]),
          ),
        },
      }));
      useBoardStore.getState().pickCar(one.id);
      // nothing but up, the whole way
      hold(0, -1, () => {
        const at = locate(car.x, car.z);
        return at.kind === "arm" && at.arm === "N" && at.along > 38;
      });
      hold(0, 0, () => useBoardStore.getState().lanes?.picked == null, 4);
      const after = useBoardStore.getState();
      expect(after.fault, one.id).toBeNull();
      expect(after.lanes?.rest[one.id], one.id).toBeDefined();
      const at = locate(car.x, car.z);
      expect(at.kind === "arm" && at.side === "exit" && at.lane, one.id).toBe(
        one.lane,
      );
    }
  });

  it("takes every car of both line-ups home along its line", () => {
    for (const [level, arm] of [
      ["four-lane", "S"],
      ["three-lane", "W"],
    ] as const) {
      for (const one of queueCars(arm)) {
        const { fault, home, goal } = driveHome(level, arm, one.id);
        expect(fault, one.id).toBeNull();
        expect(home, one.id).toBe(true);
        const at = locate(car.x, car.z);
        expect(at.kind === "arm" && at.lane, one.id).toBe(goal.lane);
      }
    }
  });

  it("leaves in the lane it is joining, not one it crosses on the way", () => {
    // Lane 3 of the three-lane road turning left: its exit comes up while the
    // car is still crossing ring lane 2 on its way in to lane 3, level with
    // the line of exit lane 2. It must wait for lane 3, not turn off into 2.
    const state = { ...createAssist(), entryLane: 3, entryArm: "W" as const };
    const at = { x: -13.2, z: -2.6, heading: 1.1, speed: 6, steer: 0 };
    expect(locate(at.x, at.z)).toMatchObject({ kind: "ring", lane: 2 });
    // pointing up the north road, a little out from the way the ring runs
    expect(exitAhead(at, (-5 * Math.PI) / 180, state)).toBe("wait");
  });

  it("goes into lane 4 when the rule allows lane 3 or lane 4", () => {
    const { fault, home } = driveHome("three-lane", "W", "rb:W3:right:4");
    expect(fault).toBeNull();
    expect(home).toBe(true);
    const at = locate(car.x, car.z);
    expect(at.kind === "arm" && at.lane).toBe(4);
  });

  it.each([
    // leaning toward lane 3 from the start: the lane has a car standing in it
    ["four-lane", "S", "rb:S4:straight", -15],
    // leaning out along the ring past the left exit: not asking to leave
    ["three-lane", "W", "rb:W2:straight", -15],
    ["four-lane", "S", "rb:S1:left", 15],
  ] as const)(
    "%s %s %s comes home with a thumb %d degrees off",
    (level, arm, id, bias) => {
      const { fault, home } = driveHome(level, arm, id, bias);
      expect(fault).toBeNull();
      expect(home).toBe(true);
    },
  );

  it("takes lane 3 into lane 4 through a heavy wobble", () => {
    // The exit into lane 4 comes late and tight. A wobble used to drop the
    // turn halfway out, and the car was then held to the ring lane it was
    // crossing, not the one it came round in.
    const { fault, home } = driveHome(
      "three-lane",
      "W",
      "rb:W3:right:4",
      0,
      30,
    );
    expect(fault).toBeNull();
    expect(home).toBe(true);
  });

  it("is not asked for an exit it has already passed", () => {
    // on the ring south-east of the island, going clockwise toward the south
    // exit: the knob swung toward the east road, which is behind the car
    const state = { ...createAssist(), entryArm: "W" as const };
    const at = { x: 5.1, z: 11.1, heading: 3.5, speed: 4, steer: 0 };
    expect(locate(at.x, at.z)).toMatchObject({ kind: "ring" });
    expect(exitAhead(at, (127 * Math.PI) / 180, state)).toBeNull();
  });

  it("is not asked for an exit by a knob held along the ring", () => {
    // in ring lane 2, north-west of the island, driving clockwise: the ring
    // runs north-east here, 45 degrees off the north road's way out
    const state = { ...createAssist(), entryArm: "W" as const };
    const at = { x: -12, z: -11.6, heading: 0.3, speed: 4, steer: 0 };
    expect(locate(at.x, at.z)).toMatchObject({ kind: "ring", lane: 2 });
    expect(exitAhead(at, (47 * Math.PI) / 180, state)).toBeNull();
    // pointing up the north road is asking for it
    expect(exitAhead(at, 0, state)).not.toBeNull();
  });

  it("asks for nothing while the knob lies along the ring", () => {
    // on the ring due south of the island, driving clockwise (west)
    const at = { x: 0, z: 14, heading: -Math.PI / 2, speed: 3, steer: 0 };
    expect(locate(at.x, at.z).kind).toBe("ring");
    // pointing east, back the way it came: no exit is ahead that way
    expect(exitAhead(at, Math.PI / 2)).toBeNull();
  });
});
