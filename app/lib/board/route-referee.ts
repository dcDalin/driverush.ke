/**
 * The referee for route tasks: the ones that leave the roundabout's roads for
 * the street, the two-way road and the parking bays. The rules of the road
 * are `road-rules.ts`, the same ones a turn task is held to. This file adds
 * the task: it checks the drive against every correct way to the box
 * (`ways.ts`), the route the rules pick first.
 *
 * A car may go anywhere on the board as long as it breaks no rule. Leaving
 * every correct way is said once as a deviation: the drive goes on, but it is
 * no longer a pass. On a way, it ends the attempt when the car runs one of
 * that way's stop lines, or makes a junction turn from the wrong lane, and no
 * other way is left. It passes the task when the car stops in the green box,
 * or in the bay, straight; the store marks a longer way down a star.
 *
 * Giving way, at a give way line or to people on a crossing, is not enforced:
 * there is no other traffic on the board yet to give way to.
 */
import type { CarState } from "./car";
import { wrapPi } from "./geometry";
import { ROAD_BOX } from "./lessons";
import { poseAt, type Route } from "./network";
import type { Contact } from "./physics";
import type { Fault, RefResult } from "./referee";
import { createRoad, roadStep, type RoadState } from "./road-rules";

/** How the car is getting on along one of the ways a task may be driven. */
export type WayTrack = {
  /** How far along this way the car has got, metres. */
  progress: number;
  offTime: number;
  wrongWayTime: number;
  /** Stop lines the car has stopped at, by the step that starts at them. */
  stopped: number[];
  /** How long the car has come up to a junction turn out of its lane. */
  laneTime: number;
  /** The turn it came up to in the wrong lane, by step, until it is past. */
  wrongLaneAt: number | null;
  /**
   * Still a way the car may be on, or how it stopped being one: left, or
   * broken by running its stop line or making its turn from the wrong lane.
   */
  state: "on" | "left" | Extract<Fault["id"], "stop_line" | "wrong_lane">;
  /** When it was broken, by the referee's clock. */
  brokeAt: number;
};

export type RouteRefState = {
  /** The rules of the road, as they stand for this car. */
  road: RoadState;
  /** The way the car is on, or was last on: hints and the box follow it. */
  way: number;
  /** How far along that way the car has got, metres. */
  progress: number;
  /** One for each way the task may be driven, the answer first. */
  ways: WayTrack[];
  goalTime: number;
  /** How long the car has sat in the bay without being straight in it. */
  askewTime: number;
  /** The learner has been told the car is not straight in the bay. */
  askewTold: boolean;
  /** How the car left the route, once it has. */
  off: Fault | null;
  /** Seconds of driving judged, to tell when a way was broken. */
  clock: number;
};

/** A fresh track along one way. */
export function createWayTrack(): WayTrack {
  return {
    progress: 0,
    offTime: 0,
    wrongWayTime: 0,
    stopped: [],
    laneTime: 0,
    wrongLaneAt: null,
    state: "on",
    brokeAt: 0,
  };
}

export function createRouteRef(): RouteRefState {
  return {
    road: createRoad(),
    way: 0,
    progress: 0,
    ways: [],
    goalTime: 0,
    askewTime: 0,
    askewTold: false,
    off: null,
    clock: 0,
  };
}

/** The car this far from the route's line has left the route. */
const CORRIDOR = 6;
/** Coming up to a junction turn, the car this far off the line is out of its lane. */
const LANE_STRICT = 3;
const OFF_GRACE = 1;
/** This far before a junction turn, the car should be in the lane for it. */
const TURN_APPROACH = 12;
/** Facing within this of the way the turn comes out, the car has made the turn. */
const TURNED = (45 * Math.PI) / 180;
const WRONG_WAY_ANGLE = (115 * Math.PI) / 180;
const WRONG_WAY_GRACE = 0.8;
const MOVING = 0.5;
const STOPPED = 0.2;
const GOAL_HOLD = 0.35;
/** A stop counts from this far before the line to just over it. */
const STOP_BEFORE = 9;
const STOP_AFTER = 2;
/** Past the line by this much without having stopped: the line was run. */
const STOP_RUN = 4.5;
/**
 * In the bay: how far the middle of the car may be from the middle of the bay,
 * along it and across it, and how straight it has to sit. A flush bay is long
 * and narrow; an angle bay is short and wide.
 */
const BAY_FIT = {
  flush_bay: { along: 3, across: 0.6, angle: (14 * Math.PI) / 180 },
  angle_bay: { along: 1.4, across: 1.1, angle: (20 * Math.PI) / 180 },
} as const;
const BAY_NEAR = 4;
const ASKEW_GRACE = 1.4;

/**
 * The nearest point of the route to the car, looking only a little behind
 * where it last was and some way ahead, so a route that crosses itself is not
 * confused with its own other half. A car that has left the route may come
 * back to it anywhere, so then the whole of it is looked at.
 */
function nearest(route: Route, car: CarState, from: number, wide = false) {
  let best = { distance: from, gap: Infinity, heading: 0 };
  // Where a route goes forward and then back over the same ground, as it does
  // at a bay, the way the car is moving says which of the two it is on.
  const moving =
    car.speed < -0.05 ? "reverse" : car.speed > 0.05 ? "forward" : null;
  for (let i = 0; i < route.points.length - 1; i += 1) {
    if (!wide && (route.at[i + 1] < from - 12 || route.at[i] > from + 30)) {
      continue;
    }
    if (moving) {
      const middle = (route.at[i] + route.at[i + 1]) / 2;
      const step = route.steps.find((s) => middle < s.to);
      if (step && step.gear !== moving) continue;
    }
    const a = route.points[i];
    const b = route.points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const span = dx * dx + dz * dz;
    const t =
      span > 0
        ? Math.min(
            1,
            Math.max(0, ((car.x - a.x) * dx + (car.z - a.z) * dz) / span),
          )
        : 0;
    const gap = Math.hypot(a.x + dx * t - car.x, a.z + dz * t - car.z);
    if (gap < best.gap) {
      best = {
        gap,
        distance: route.at[i] + (route.at[i + 1] - route.at[i]) * t,
        heading: route.headings[i],
      };
    }
  }
  return best;
}

/** Another way has to be this much nearer before the hints follow it instead. */
const SWITCH = 0.5;
/**
 * A way broken this recently, when the last way is left, is the one the car
 * was on: its broken rule ends the attempt. One broken longer ago is a way the
 * car only passed near.
 */
const BROKE_RECENTLY = 3;

type Step = Route["steps"][number];
const isTurn = (s: Step | undefined) =>
  s?.maneuver === "turn_left" || s?.maneuver === "turn_right";

/**
 * One way's own checks for this step: is the car still on it, and has it run
 * one of its stop lines or made one of its turns from the wrong lane.
 */
function followWay(
  t: WayTrack,
  route: Route,
  car: CarState,
  speed: number,
  dt: number,
): { gap: number; distance: number } {
  const at = nearest(route, car, t.progress);
  t.progress = at.distance;
  const index = Math.max(
    0,
    route.steps.findIndex((s) => at.distance < s.to),
  );
  const next = route.steps[index + 1];

  // away from the way's line
  t.offTime = at.gap > CORRIDOR ? t.offTime + dt : 0;
  // facing against the way it runs: turned round, going elsewhere
  const against = Math.abs(wrapPi(car.heading - at.heading)) > WRONG_WAY_ANGLE;
  t.wrongWayTime = against && speed > MOVING ? t.wrongWayTime + dt : 0;
  if (t.offTime > OFF_GRACE || t.wrongWayTime > WRONG_WAY_GRACE) {
    t.state = "left";
    return at;
  }

  // A junction turn is made from the lane the way comes up to it in. Coming
  // up to it in another lane is only noted: another way may go on from there.
  // Making the turn from there is the wrong lane.
  const coming =
    next != null && isTurn(next) && at.distance > next.from - TURN_APPROACH;
  t.laneTime = coming && at.gap > LANE_STRICT ? t.laneTime + dt : 0;
  if (coming && t.laneTime > OFF_GRACE) t.wrongLaneAt = index + 1;
  if (t.wrongLaneAt != null) {
    const turn = route.steps[t.wrongLaneAt];
    if (index > t.wrongLaneAt || (!coming && index < t.wrongLaneAt)) {
      t.wrongLaneAt = null;
    } else if (
      index === t.wrongLaneAt &&
      Math.abs(wrapPi(car.heading - poseAt(route, turn.to).heading)) < TURNED
    ) {
      t.state = "wrong_lane";
      return at;
    }
  }

  // its stop lines: a full stop before the line, every time
  for (let i = 0; i < route.steps.length; i += 1) {
    const line = route.steps[i];
    if (line.control !== "stop" || t.stopped.includes(i)) continue;
    const past = at.distance - line.from;
    if (past > -STOP_BEFORE && past < STOP_AFTER && speed < STOPPED) {
      t.stopped.push(i);
    } else if (past > STOP_RUN && past < STOP_RUN + 20) {
      t.state = "stop_line";
      return at;
    }
  }
  return at;
}

/**
 * One step of a route task. `ways` are the lines the task may be driven along
 * and pass, the answer first (`challengeWays`). The car is on the route while
 * it is on any of them. Each way a car leaves, or breaks by running its stop
 * line or turning from the wrong lane, drops out. With none left, the broken
 * rule ends the attempt, or, with no rule broken, the car has left the route.
 */
export function routeRefStep(
  ref: RouteRefState,
  ways: Route | readonly Route[],
  parks: boolean,
  car: CarState,
  contacts: readonly Contact[],
  dt: number,
): RefResult {
  const routes: readonly Route[] = Array.isArray(ways)
    ? (ways as readonly Route[])
    : [ways as Route];
  while (ref.ways.length < routes.length) ref.ways.push(createWayTrack());
  ref.clock += dt;
  const wasOff = ref.off != null;
  const speed = Math.abs(car.speed);

  // Where the car is on each way it may still be on, and which is nearest.
  let best = -1;
  let bestGap = Infinity;
  if (!wasOff) {
    routes.forEach((route, i) => {
      const t = ref.ways[i];
      if (t.state !== "on") return;
      const at = followWay(t, route, car, speed, dt);
      if (t.state !== "on") {
        t.brokeAt = ref.clock;
        return;
      }
      const nearer = i === ref.way ? at.gap - SWITCH : at.gap;
      if (nearer < bestGap) {
        bestGap = nearer;
        best = i;
      }
    });
    if (best >= 0) ref.way = best;
  }
  const route = routes[ref.way] ?? routes[0];
  const own = ref.ways[ref.way];
  if (wasOff) {
    // Off the route, the car is only somewhere along it again once it is
    // back on its line.
    const at = nearest(route, car, own.progress, true);
    if (at.gap < CORRIDOR) own.progress = at.distance;
  }
  ref.progress = own.progress;
  const index = Math.max(
    0,
    route.steps.findIndex((s) => ref.progress < s.to),
  );
  const step = route.steps[index] ?? route.steps[route.steps.length - 1];

  // Where the route itself crosses the other lane, to turn, turn back or
  // park, keeping left is not judged.
  const crossing =
    !wasOff &&
    (isTurn(step) ||
      step.maneuver === "u_turn" ||
      step.gear === "reverse" ||
      step.road === "angle_bay" ||
      step.road === "flush_bay");
  const road = roadStep(ref.road, car, contacts, dt, {
    crossing,
    stopLines: wasOff,
  });
  const result: RefResult = { small: road.small };
  if (road.fault) {
    result.fault = road.fault;
    return result;
  }
  /** Off the route, with no rule broken: said the first time only. */
  const deviate = (fault: Fault) => {
    if (ref.off) return;
    ref.off = fault;
    result.deviation = fault;
  };

  // The frame of the board is past the end of every road.
  if (road.frame) deviate({ id: "past_end", serious: false });

  if (!wasOff && best < 0) {
    // No way is left. One the car broke a rule on says which rule; with none
    // broken, it has gone elsewhere.
    const broken = ref.ways.find(
      (t, i) =>
        i < routes.length &&
        t.state !== "on" &&
        t.state !== "left" &&
        ref.clock - t.brokeAt <= BROKE_RECENTLY,
    );
    if (broken) {
      result.fault = { id: broken.state as Fault["id"], serious: true };
      return result;
    }
    deviate({ id: "off_route", serious: false });
  }

  const still = speed < STOPPED;
  if (parks) {
    const end = route.points[route.points.length - 1];
    const facing = route.headings[route.headings.length - 1];
    const gap = Math.hypot(car.x - end.x, car.z - end.z);
    const last = route.steps[route.steps.length - 1];
    const fit = BAY_FIT[last?.road === "flush_bay" ? "flush_bay" : "angle_bay"];
    // where the car is in the bay's own frame: along the way it faces, and across
    const fx = Math.sin(facing);
    const fz = -Math.cos(facing);
    const along = (car.x - end.x) * fx + (car.z - end.z) * fz;
    const across = (car.x - end.x) * -fz + (car.z - end.z) * fx;
    const parked =
      Math.abs(along) < fit.along &&
      Math.abs(across) < fit.across &&
      Math.abs(wrapPi(car.heading - facing)) < fit.angle;
    ref.goalTime = parked && still ? ref.goalTime + dt : 0;
    if (ref.goalTime >= GOAL_HOLD) {
      result.goal = true;
      if (!ref.off) result.way = ref.way;
      return result;
    }
    // stopped in the bay, but over a line or at an angle: say so, once in a while
    ref.askewTime = !parked && gap < BAY_NEAR && still ? ref.askewTime + dt : 0;
    // Once an attempt: lining up in a bay takes a few goes, and each of them
    // should not cost another star.
    if (ref.askewTime > ASKEW_GRACE && !ref.askewTold) {
      ref.askewTold = true;
      ref.askewTime = 0;
      result.small.push({ id: "bay_line", serious: false });
    }
    return result;
  }

  const gap = ref.off
    ? nearest(route, car, own.progress, true).gap
    : Math.max(0, bestGap + (best === ref.way ? SWITCH : 0));
  const inBox = ref.progress >= route.length - ROAD_BOX && gap < 2.6;
  ref.goalTime = inBox && still ? ref.goalTime + dt : 0;
  if (ref.goalTime >= GOAL_HOLD) {
    result.goal = true;
    if (!ref.off) result.way = ref.way;
  }
  return result;
}
