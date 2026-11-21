import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useBoardStore } from "../board-store";
import type { CarState } from "./car";
import { bearingOf, locate, wrapPi, type ArmId } from "./geometry";
import { network } from "./network";
import { createRails, rails } from "./rails";
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
  // Where along the line the thumb has got to. It follows the line in order,
  // so a line that comes round past the same place twice (a full loop) is not
  // skipped ahead on the first time past.
  let along = 0;
  for (let i = 0; i < 90 * 60; i += 1) {
    const now = useBoardStore.getState();
    if (now.lanes?.picked == null || now.phase !== "driving") break;
    const at = locate(car.x, car.z);
    const home =
      at.kind === "arm" &&
      at.arm === goal.arm &&
      at.side === "exit" &&
      at.along > (goal.alongMin + goal.alongMax) / 2 - 1;
    let near = along;
    for (let k = along + 1; k < Math.min(points.length, along + 40); k += 1) {
      const d = Math.hypot(points[k].x - car.x, points[k].z - car.z);
      if (d < Math.hypot(points[near].x - car.x, points[near].z - car.z)) {
        near = k;
      }
    }
    along = near;
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

  it("lets a once-round car take the exit it points at on the first pass", () => {
    // The learner is in control: pointing straight up the road ahead, the
    // lane 4 car is helped out there on its first pass instead of being held
    // round. The referee says why that is wrong; the assist does not stop it.
    const cars = queueCars("S");
    const one = cars.find((c) => c.id === "rb:S4:straight")!;
    useBoardStore.getState().exit();
    useBoardStore.getState().startLevel("four-lane");
    const ahead = cars.filter((c) => c.lane === one.lane && c.slot < one.slot);
    useBoardStore.setState((s) => ({
      lanes: {
        ...s.lanes!,
        rest: Object.fromEntries(
          ahead.map((c, k) => [c.id, { x: 500 + k * 10, z: 500, heading: 0 }]),
        ),
      },
    }));
    useBoardStore.getState().pickCar(one.id);
    let reachedTop = false;
    hold(0, -1, () => {
      const at = locate(car.x, car.z);
      if (at.kind === "arm" && at.arm === "N" && at.side === "exit") {
        reachedTop = true;
      }
      return reachedTop || useBoardStore.getState().fault != null;
    });
    const after = useBoardStore.getState();
    expect(reachedTop || after.fault?.id === "wrong_exit").toBe(true);
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
    // car is still crossing the outer ring lanes on its way in. It leaves
    // into its own exit lane, not one of those it crosses.
    const { fault, home, goal } = driveHome("three-lane", "W", "rb:W3:left");
    expect(fault).toBeNull();
    expect(home).toBe(true);
    const at = locate(car.x, car.z);
    expect(at.kind === "arm" && at.arm === "N" && at.lane).toBe(goal.lane);
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
});

/**
 * A car on one of the network's own ways round, `along` metres from its start
 * (from its end, if negative), facing the way it runs there.
 */
function onWay(id: string, from: number): CarState {
  const edge = network().edges.find((e) => e.id.startsWith(id))!;
  const along = from >= 0 ? from : edge.length + from;
  let gone = 0;
  for (let i = 1; i < edge.points.length; i += 1) {
    const a = edge.points[i - 1];
    const b = edge.points[i];
    gone += Math.hypot(b.x - a.x, b.z - a.z);
    if (gone >= along) {
      return {
        x: b.x,
        z: b.z,
        heading: bearingOf(b.x - a.x, b.z - a.z),
        speed: 4,
        steer: 0,
      };
    }
  }
  throw new Error(`${id} is shorter than ${along} m`);
}

/** Hold the knob at `knob` (degrees) for half a second; the path it follows. */
function choose(
  at: CarState,
  knob: number,
  entry: { arm: ArmId; lane: number },
): { plan: string; free: boolean } {
  const state = createRails();
  state.entry = entry;
  for (let i = 0; i < 30; i += 1) rails(at, (knob * Math.PI) / 180, state);
  return { plan: state.plan.join(" "), free: state.free };
}

describe("which way out of the roundabout", () => {
  const DEG = 180 / Math.PI;

  it("takes the exit the knob points down, into its option's lane", () => {
    // lane 1 from the south, on the ring with the west road coming up
    const at = onWay("rb:S1:left:on>", 4);
    expect(choose(at, -90, { arm: "S", lane: 1 }).plan).toMatch(/>W:out:1@/);
  });

  it("keeps round the ring for a knob held along it", () => {
    const at = onWay("rb:S1:left:on>", 4);
    // along the ring, a little in toward the island: going on round
    const along = at.heading * DEG + 10;
    const { plan, free } = choose(at, along, { arm: "S", lane: 1 });
    expect(free).toBe(false);
    expect(plan).not.toMatch(/>W:out:/);
  });

  it("never steers out of an exit it has already passed", () => {
    // due west of the island, past the west road's mouth, pointing down it
    const at = onWay("rb:S1:straight:on>", 14);
    expect(locate(at.x, at.z).kind).toBe("ring");
    expect(
      Math.abs(wrapPi(bearingOf(at.x, at.z) + Math.PI / 2)) * DEG,
    ).toBeLessThan(20);
    expect(choose(at, -95, { arm: "S", lane: 1 }).plan).not.toMatch(/>W:out:/);
  });

  it("leaves from an inner lane into its own exit lane", () => {
    // lane 3 of the three-lane road turning left, the north road just ahead,
    // pointing up it: out into the lane its option leaves in
    const ring = network().edges.find((e) =>
      e.id.startsWith("rb:W3:left:on>"),
    )!;
    const out = network()
      .out.get(ring.to)!
      .find((e) => e.maneuver === "exit")!;
    const lane = /N:out:(\d)@/.exec(out.to)![1];
    const at = onWay("rb:W3:left:on>", -6);
    expect(choose(at, 0, { arm: "W", lane: 3 }).plan).toMatch(
      new RegExp(`>N:out:${lane}@`),
    );
  });
});
