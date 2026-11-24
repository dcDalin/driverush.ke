/**
 * Free drive: the whole board with no task. Every rule is judged, each one
 * broken is said once and counted, and nothing ends the drive. A crash or
 * driving against the traffic puts the car back a little; reaching the frame
 * at the end of a road picks the car up and turns it round.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { rulesBroken, useBoardStore } from "../board-store";
import {
  BOARD_CHALLENGES,
  FREE_DRIVE,
  hasParkedCars,
  type FreeChallenge,
} from "./challenges";
import { sizeOf } from "./cars";
import { createRef } from "./referee";
import { createFree, freeRefStep, turnedRound } from "./free-referee";
import {
  ARMS,
  bearingOf,
  lanePoint,
  laneBearing,
  locate,
  ringRadius,
  wrapPi,
  type Vec,
} from "./geometry";
import { lanePath } from "./lane-paths";
import { challengeRoute, taskGoalBox } from "./lessons";
import type { Fault } from "./referee";
import {
  beginChallenge,
  car,
  drive,
  loadPhysics,
  placeCar,
  stick,
  stopDriving,
  tick,
} from "./runtime";

const STEP = 1 / 60;

/** Hold the stick for a while, at sixty frames a second. */
function hold(x: number, y: number, seconds: number) {
  for (let i = 0; i < seconds * 60; i += 1) {
    stick.x = x;
    stick.y = y;
    tick(STEP);
  }
}

beforeAll(() => loadPhysics());
beforeEach(() => {
  useBoardStore.getState().exit();
  useBoardStore.getState().resetProgress();
  drive.assist = true;
});
afterEach(() => {
  drive.assist = true;
  stopDriving();
});

describe("free drive, the task", () => {
  it("has no route and no green box, and is never in a mock round", () => {
    expect(challengeRoute(FREE_DRIVE)).toBeNull();
    expect(taskGoalBox(FREE_DRIVE)).toBeNull();
    expect(BOARD_CHALLENGES).not.toContain(FREE_DRIVE);
    expect(BOARD_CHALLENGES.some((c) => c.id === FREE_DRIVE.id)).toBe(false);
  });

  it("starts in lane 2 of the four-lane road, with reverse and the parked cars", () => {
    useBoardStore.getState().freeDrive("test");
    const s = useBoardStore.getState();
    expect(s.queue[0]).toBe(FREE_DRIVE);
    expect(s.phase).toBe("driving");
    expect(drive.reverse).toBe(true);
    expect(hasParkedCars(FREE_DRIVE)).toBe(true);
    expect(locate(car.x, car.z)).toMatchObject({
      kind: "arm",
      arm: "S",
      side: "approach",
      lane: 2,
    });
  });
});

describe("free drive, in the store", () => {
  /** Up to the roundabout, then round it the wrong way until something is said. */
  function againstTheRoundabout() {
    const before = useBoardStore.getState().noticeCount;
    for (let i = 0; i < 600 && locate(car.x, car.z).kind !== "ring"; i += 1) {
      hold(0, -0.7, 0.05);
    }
    for (
      let i = 0;
      i < 200 && useBoardStore.getState().noticeCount === before;
      i += 1
    ) {
      hold(1, 0, 0.05);
    }
  }

  it("never ends: straight across, to the end of the road and back", () => {
    useBoardStore.getState().freeDrive("test");
    const said: string[] = [];
    let turned = false;
    for (let i = 0; i < 60 * 45; i += 1) {
      stick.x = 0;
      stick.y = -1;
      tick(STEP);
      const s = useBoardStore.getState();
      if (s.notice && !said.includes(`${s.notice.n}`)) {
        said.push(`${s.notice.n}`);
        if (s.notice.turned) turned = true;
      }
      expect(s.phase).toBe("driving");
    }
    // Driven straight up and off the far end: picked up and turned round.
    expect(turned).toBe(true);
    const s = useBoardStore.getState();
    expect(rulesBroken(s.freeLog)).toEqual([]);
    expect(s.faults).toBe(0);
    expect(s.bestStars).toEqual({});
    expect(s.bestScores ?? {}).toEqual({});
  });

  it("puts the car back for driving against the traffic, and counts it", () => {
    useBoardStore.getState().freeDrive("test");
    againstTheRoundabout();
    hold(0, 0, 0.2);
    const s = useBoardStore.getState();
    expect(s.phase).toBe("driving");
    expect(s.notice?.fault.id).toBe("wrong_way");
    expect(s.notice?.back).toBe(true);
    expect(s.freeLog).toHaveLength(1);
    expect(s.freeLog[0]).toMatchObject({ id: "wrong_way", back: true });
    // nothing graded, nothing saved
    expect(s.faults).toBe(0);
    expect(s.progress).toEqual({});
    expect(s.bestStars).toEqual({});
  });

  it("keeps the count over a restart, and a new drive starts it again", () => {
    useBoardStore.getState().freeDrive("test");
    againstTheRoundabout();
    useBoardStore.getState().restart();
    expect(useBoardStore.getState().freeLog).toHaveLength(1);
    useBoardStore.getState().freeDrive("test");
    expect(useBoardStore.getState().freeLog).toHaveLength(0);
  });
});

type Said = { small: Fault[]; serious: Fault[]; goal: boolean };

/** A free drive with the given cars, along a line with the knob, assist off. */
function driveFree(
  path: Vec[],
  seconds: number,
  others = FREE_DRIVE.otherCars,
) {
  const said: Said = { small: [], serious: [], goal: false };
  const task: FreeChallenge = { ...FREE_DRIVE, otherCars: others };
  beginChallenge(task, {
    onFault: (fault) => said.serious.push(fault),
    onSmall: (fault) => said.small.push(fault),
    onDeviation: () => {
      throw new Error("free drive has no route to leave");
    },
    onGoal: () => {
      said.goal = true;
    },
  });
  // start from the line's own first point, and let go once so the car answers
  placeCar({
    x: path[0].x,
    z: path[0].z,
    heading: bearingOf(path[1].x - path[0].x, path[1].z - path[0].z),
  });
  stick.x = 0;
  stick.y = 0;
  tick(STEP);
  let nearest = 0;
  for (let i = 0; i < seconds / STEP && said.serious.length === 0; i += 1) {
    while (
      nearest < path.length - 1 &&
      Math.hypot(path[nearest + 1].x - car.x, path[nearest + 1].z - car.z) <=
        Math.hypot(path[nearest].x - car.x, path[nearest].z - car.z)
    ) {
      nearest += 1;
    }
    if (nearest >= path.length - 1) break;
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
    tick(STEP);
  }
  return said;
}

describe("free drive, in the runtime", () => {
  it("says a missed exit once, and drives on round and out", () => {
    drive.assist = false;
    // Lane 2 only goes straight: round to the right, past its exit, and out.
    const said = driveFree(lanePath("S", 2, "right", 62, 50), 120, []);
    expect(said.serious).toEqual([]);
    expect(said.goal).toBe(false);
    const missed = said.small.filter((f) => f.id === "missed_exit");
    expect(missed).toHaveLength(1);
    // the visit was spent on that one mistake: leaving is not judged again
    expect(said.small.some((f) => f.id === "wrong_exit")).toBe(false);
  });

  it("puts the car back once for hitting a car", () => {
    drive.assist = false;
    const ahead = lanePoint("S", "approach", 2, 45);
    const said = driveFree(lanePath("S", 2, "straight", 62, 50), 30, [
      {
        ...ahead,
        heading: laneBearing("S", "approach"),
        color: "red",
      },
    ]);
    expect(said.serious.map((f) => f.id)).toEqual(["collision"]);
    expect(said.goal).toBe(false);
  });
});

describe("free drive, parking", () => {
  it.each([true, false])(
    "lets the car into an angle bay, with lane assist %s",
    (assist) => {
      const park = BOARD_CHALLENGES.find((c) => c.id === "park-angle")!;
      const route = challengeRoute(park)!;
      drive.assist = assist;
      // only the forward stretch: up the aisle and nose first into the bay
      const said = driveFree(route.points, 120, []);
      const end = route.points[route.points.length - 1];
      expect(said.serious).toEqual([]);
      expect(Math.hypot(car.x - end.x, car.z - end.z)).toBeLessThan(2.5);
    },
  );
});

describe("free drive, reversing", () => {
  it.each([true, false])(
    "backs the car out of an angle bay, with lane assist %s",
    (assist) => {
      const park = BOARD_CHALLENGES.find((c) => c.id === "park-angle")!;
      const route = challengeRoute(park)!;
      const n = route.points.length;
      const end = route.points[n - 1];
      const before = route.points[n - 2];
      drive.assist = assist;
      const said: Fault[] = [];
      beginChallenge(
        { ...FREE_DRIVE, otherCars: [] },
        {
          onFault: (fault) => said.push(fault),
          onSmall: () => {},
          onGoal: () => {},
        },
      );
      const heading = bearingOf(end.x - before.x, end.z - before.z);
      placeCar({ ...end, heading });
      hold(0, 0, 0.5);
      // pull the stick back the way the car came, and hold it
      hold(-Math.sin(heading), Math.cos(heading), 3);
      expect(said).toEqual([]);
      expect(car.speed).toBeLessThan(0);
      expect(Math.hypot(car.x - end.x, car.z - end.z)).toBeGreaterThan(3);
    },
  );
});

describe("the free referee", () => {
  const size = sizeOf("saloon");

  it("turns a car round at the end of an exit road, facing back in", () => {
    const length = ARMS.N.length;
    const at = lanePoint("N", "exit", 1, length - 1);
    const pose = turnedRound(
      { ...at, heading: laneBearing("N", "exit") },
      size,
    );
    expect(pose).not.toBeNull();
    expect(locate(pose!.x, pose!.z)).toMatchObject({
      kind: "arm",
      arm: "N",
      side: "approach",
      lane: 1,
    });
    expect(
      Math.abs(wrapPi(pose!.heading - laneBearing("N", "approach"))),
    ).toBeLessThan(0.01);
  });

  it("only moves a car backed into the frame forward, the way it faces", () => {
    const length = ARMS.S.length;
    const at = lanePoint("S", "approach", 2, length - 0.5);
    const heading = laneBearing("S", "approach");
    const pose = turnedRound({ ...at, heading }, size);
    expect(pose).not.toBeNull();
    expect(pose!.heading).toBe(heading);
    const loc = locate(pose!.x, pose!.z);
    expect(loc).toMatchObject({ kind: "arm", arm: "S", side: "approach" });
  });

  it("calls the frame the edge of the board, and puts the car on the road", () => {
    const ref = createRef();
    const at = lanePoint("N", "exit", 1, ARMS.N.length - 1);
    const result = freeRefStep(
      ref,
      createFree(),
      { ...at, heading: laneBearing("N", "exit"), speed: 1, steer: 0 },
      ["end"],
      STEP,
      size,
    );
    expect(result.fault?.id).toBe("board_edge");
    expect(result.place).toBeDefined();
  });

  it("picks up a car standing nose to the frame, though it never touched it", () => {
    const ref = createRef();
    const state = createFree();
    // stopped a little short of the wood, at the end of an exit road
    const at = lanePoint("N", "exit", 1, ARMS.N.length - size.length / 2 - 0.6);
    let result = null as ReturnType<typeof freeRefStep> | null;
    for (let i = 0; i < 2 / STEP && !result?.fault; i += 1) {
      result = freeRefStep(
        ref,
        state,
        { ...at, heading: laneBearing("N", "exit"), speed: 0, steer: 0 },
        [],
        STEP,
        size,
      );
    }
    expect(result?.fault?.id).toBe("board_edge");
    expect(result?.place).toBeDefined();
  });

  it("puts the car back for driving the wrong way, and starts the count again", () => {
    const ref = createRef();
    const r = ringRadius(2);
    let result = null as ReturnType<typeof freeRefStep> | null;
    // anticlockwise round the ring
    for (let i = 0; i < 120 && !result?.fault; i += 1) {
      const b = 0.4 - i * 0.02;
      result = freeRefStep(
        ref,
        createFree(),
        {
          x: Math.sin(b) * r,
          z: -Math.cos(b) * r,
          heading: b - Math.PI / 2,
          speed: 2,
          steer: 0,
        },
        [],
        STEP,
        size,
      );
    }
    expect(result?.fault?.id).toBe("wrong_way");
    expect(result?.back).toBe(true);
    expect(ref.road.wrongWayTime).toBe(0);
  });

  it("says each new stop on a crossing, once the car has driven off", () => {
    const ref = createRef();
    const said: string[] = [];
    // stand still in the middle of the roundabout's lane: on the ring
    const r = ringRadius(1);
    const at = {
      x: Math.sin(1) * r,
      z: -Math.cos(1) * r,
      heading: 1 + Math.PI / 2,
    };
    const stand = (seconds: number, speed: number) => {
      for (let i = 0; i < seconds / STEP; i += 1) {
        const result = freeRefStep(
          ref,
          createFree(),
          { ...at, speed, steer: 0 },
          [],
          STEP,
          size,
        );
        said.push(...result.small.map((f) => f.id));
      }
    };
    stand(7, 0);
    stand(0.5, 1);
    stand(7, 0);
    expect(said.filter((id) => id === "roundabout_stop")).toHaveLength(2);
  });
});
