/**
 * Every correct way to the box. A learner who gets there another correct way
 * passes: in full when it is as short, or the answer's own way in another lane
 * its options allow, and a star down when it is clearly longer. The way that
 * cuts through the parking area when another does not is shown, never passed.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { useBoardStore } from "../board-store";
import { CAR } from "./car";
import {
  BOARD_CHALLENGES,
  type BoardChallenge,
  challengeById,
  isRouteTask,
} from "./challenges";
import { bearingOf } from "./geometry";
import {
  BLOCKED_ROUTES,
  challengeWays,
  lessonById,
  lessonPlan,
  LESSONS,
  lessonWays,
  taskParks,
} from "./lessons";
import { poseAt, type Route } from "./network";
import { car, loadPhysics, stick, tick } from "./runtime";
import { shownWays, type Way, wayLimit } from "./ways";

const STEP = 1 / 60;
const RELEASE_DECEL = 0.7 * CAR.brake + CAR.coast;

function point(bearing: number, push = 0.7): void {
  stick.x = Math.sin(bearing) * push;
  stick.y = -Math.cos(bearing) * push;
}

function letGo(): void {
  stick.x = 0;
  stick.y = 0;
}

/**
 * A learner who knows one way: the knob points a few metres down it, they
 * stop at each stop line, and they let go to stop at the end.
 */
function follower(challenge: BoardChallenge, route: Route) {
  const parks = taskParks(challenge);
  const waited = new Set<number>();
  let progress = 0;
  return () => {
    let best = Infinity;
    for (let d = Math.max(0, progress - 3); d <= progress + 8; d += 0.25) {
      const p = poseAt(route, d);
      const gap = Math.hypot(p.x - car.x, p.z - car.z);
      if (gap < best) {
        best = gap;
        progress = d;
      }
    }
    const speed = Math.abs(car.speed);
    const stopping = speed ** 2 / (2 * RELEASE_DECEL);
    for (let i = 0; i < route.steps.length; i += 1) {
      const step = route.steps[i];
      if (step.control !== "stop" || waited.has(i)) continue;
      const left = step.from - progress;
      if (left < 6 && left > -1.5 && left - stopping < 2.5) {
        letGo();
        if (speed < 0.05 && left < 6) waited.add(i);
        return;
      }
    }
    const end = route.length - (parks ? 0 : 6);
    if (progress + stopping >= end - (parks ? 0.15 : 0)) {
      letGo();
      return;
    }
    const aim = poseAt(route, Math.min(route.length, progress + 4.5));
    point(bearingOf(aim.x - car.x, aim.z - car.z));
  };
}

/** Drive a task along one line, through the store, the way the game does. */
function driveAlong(id: string, route?: (ways: Way[]) => Route) {
  useBoardStore.getState().exit();
  useBoardStore.getState().resetProgress();
  useBoardStore.getState().start([id]);
  const challenge = useBoardStore.getState().queue[0];
  const ways = challengeWays(challenge);
  const line = route ? route(ways) : ways[0].route;
  const each = follower(challenge, line);
  for (
    let i = 0;
    i < 300 / STEP && useBoardStore.getState().phase === "driving";
    i += 1
  ) {
    each();
    tick(STEP);
  }
  letGo();
  return useBoardStore.getState();
}

const ALL = [...LESSONS, ...BLOCKED_ROUTES];

describe("the ways a lesson can be driven", () => {
  it("always has the answer first, and it is the route the rules pick", () => {
    for (const lesson of ALL) {
      const ways = lessonWays(lesson);
      expect(ways.length, lesson.id).toBeGreaterThan(0);
      expect(ways[0].kind, lesson.id).toBe("answer");
      expect(
        ways[0].route.edges.map((e) => e.id),
        lesson.id,
      ).toEqual(lessonPlan(lesson)?.route?.edges.map((e) => e.id));
    }
  });

  it("never lists the same way twice, nor one far longer than the answer", () => {
    for (const lesson of ALL) {
      const ways = lessonWays(lesson);
      const signatures = ways.map((one) => one.signature);
      expect(new Set(signatures).size, lesson.id).toBe(signatures.length);
      for (const one of ways) {
        if (one.kind === "wrong_parking") continue;
        expect(one.route.length, lesson.id).toBeLessThanOrEqual(
          wayLimit(ways[0].route.length) + 1e-6,
        );
      }
    }
  });

  it("passes no way that rests on a rule schools still have to confirm", () => {
    for (const lesson of ALL) {
      for (const one of lessonWays(lesson).slice(1)) {
        expect(one.route.confirmed, lesson.id).toBe(true);
      }
    }
  });

  it("shows each way through the board once, whatever the lane", () => {
    for (const lesson of ALL) {
      const shown = shownWays(lessonWays(lesson));
      const shapes = shown.map((one) => one.shape);
      expect(new Set(shapes).size, lesson.id).toBe(shapes.length);
      expect(shown[0].kind, lesson.id).toBe("answer");
    }
  });

  it("finds the second gap on the longest correct route", () => {
    const shown = shownWays(lessonWays(lessonById("long-way-round")!));
    expect(shown.map((one) => one.kind)).toEqual(["answer", "longer"]);
    const gaps = shown.map(
      (one) => one.route.steps.filter((s) => s.maneuver === "u_turn").length,
    );
    expect(gaps).toEqual([1, 1]);
    expect(shown[1].shape).not.toBe(shown[0].shape);
  });

  it("marks a way through the parking area wrong, never passed", () => {
    const ways = lessonWays(lessonById("across-town")!);
    const wrong = ways.filter((one) => one.kind === "wrong_parking");
    expect(wrong).toHaveLength(1);
    expect(wrong[0].route.throughParking).toBe(true);
    const task = BOARD_CHALLENGES.find(
      (c) => isRouteTask(c) && c.lesson === "blocked-street",
    )!;
    expect(
      challengeWays(task).some((one) => one.kind === "wrong_parking"),
    ).toBe(false);
  });

  it("finds every lesson's ways quickly enough for a cheap phone", () => {
    const started = performance.now();
    for (const lesson of ALL) lessonWays({ ...lesson, id: `${lesson.id}:t` });
    // all of them, from cold, well under what one level would ever need
    expect(performance.now() - started).toBeLessThan(1500);
  });
});

describe("driving another correct way", () => {
  beforeAll(() => loadPhysics());
  afterEach(() => {
    useBoardStore.getState().exit();
    useBoardStore.getState().resetProgress();
  });

  it("the answer is a clean pass", () => {
    const s = driveAlong("long-way-round");
    expect(s.phase).toBe("passed");
    expect(s.lastWay).toBeNull();
    expect(s.lastStars).toBe(3);
  });

  it("a clearly longer way passes, a star down, and says so", () => {
    // the second gap in the central reserve, not the first
    const s = driveAlong(
      "long-way-round",
      (ways) => ways.find((one) => one.kind === "longer")!.route,
    );
    expect(s.offRoute).toBeNull();
    expect(s.phase).toBe("passed");
    expect(s.lastWay).toBe("longer");
    expect(s.lastStars).toBe(2);
    expect(s.runFaultRules).toEqual(["longer_way"]);
  });

  it("the answer's way in another lane option is a full pass", () => {
    // right to the two-way road from lane 3, not lane 4
    const s = driveAlong("to-two-way", (ways) => {
      const other = ways.find(
        (one) => one.kind === "also" && one.shape === ways[0].shape,
      );
      return other!.route;
    });
    expect(s.offRoute).toBeNull();
    expect(s.phase).toBe("passed");
    expect(s.lastWay).toBe("also");
    expect(s.lastStars).toBe(3);
  });

  it("coming back through the gap instead of round the roundabout passes, a star down", () => {
    const s = driveAlong(
      "blocked-ring",
      (ways) => ways.find((one) => one.kind === "longer")!.route,
    );
    expect(s.offRoute).toBeNull();
    expect(s.phase).toBe("passed");
    expect(s.lastWay).toBe("longer");
  });

  it("the way through the parking area is not a pass", () => {
    const lesson = lessonById("blocked-street")!;
    const wrong = lessonWays(lesson).find(
      (one) => one.kind === "wrong_parking",
    )!;
    const s = driveAlong("blocked-street", () => wrong.route);
    expect(s.offRoute).not.toBeNull();
    expect(s.phase).not.toBe("passed");
  });
});

it("every route task still has its answer as its first way", () => {
  for (const challenge of BOARD_CHALLENGES.filter(isRouteTask)) {
    const ways = challengeWays(challengeById(challenge.id)!);
    expect(ways[0]?.kind, challenge.id).toBe("answer");
  }
});

describe("the levels with only one correct way", () => {
  const ONE_WAY: Record<string, string> = {
    "parking-only": "last_resort",
    "parking-only-long": "last_resort",
    "blocked-gaps": "longest",
    "blocked-lane-exit": "shortest",
  };
  for (const [id, rule] of Object.entries(ONE_WAY)) {
    it(`"${id}" leaves one way through the board, by ${rule}`, () => {
      const lesson = lessonById(id)!;
      expect(lessonPlan(lesson)?.rule).toBe(rule);
      const shapes = new Set(
        lessonWays(lesson)
          .filter((one) => one.kind !== "wrong_parking")
          .map((one) => one.shape),
      );
      expect(shapes.size).toBe(1);
      // and an open board would have had another way
      expect(lessonPlan(lesson)?.closed).not.toBeNull();
    });
  }

  it("goes through the parking area only where nothing else is left", () => {
    for (const id of ["parking-only", "parking-only-long"]) {
      expect(lessonPlan(lessonById(id)!)?.route?.throughParking, id).toBe(true);
    }
  });
});
