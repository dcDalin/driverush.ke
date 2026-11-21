/**
 * One joystick drives the car: push the knob toward where you want it to go on
 * the table, further to go faster, and let go to stop.
 *
 * The learner stands at one side of the table (their seat) and the view never
 * turns, so "up" on the knob always means "away from me". From the south side
 * that is north; from the west side it is east.
 *
 * Lane assist: holding a curved lane with a thumb is the hard part, so while
 * the knob points roughly along the lane the car is in, the car steers for the
 * middle of that lane. Lean the knob toward the next lane for a moment, on a
 * road where the lane lines are broken, and it steers into that lane instead.
 * Point clearly somewhere else (an exit, a gap) and the knob is obeyed as it
 * is. The learner still decides everything; the assist only irons out the
 * wobble.
 *
 * Pure, and run once per physics step so the steering tracks the car as it
 * turns.
 */
import { CAR, type CarInput, type CarState } from "./car";
import type { BoardSide } from "./full-board";
import {
  ARMS,
  ARM_ORDER,
  RING_OUTER_R,
  bearingOf,
  dirOf,
  exitLanes,
  laneBearing,
  lanePoint,
  locate,
  ringRadius,
  SOLID_ZONE,
  turnBetween,
  wrapPi,
  type ArmId,
} from "./geometry";
import { network } from "./network";

/** Which side of the table the learner stands at. South is the bottom. */
export type Seat = BoardSide;
export const SEATS: readonly Seat[] = ["south", "west", "north", "east"];

/** The knob, as the screen sees it: `x` right, `y` down, at most 1 from centre. */
export type Stick = { x: number; y: number };

export type DriveOptions = {
  seat: Seat;
  assist: boolean;
  /**
   * Reverse gear, for the parking tasks. Stop, keep the knob pulled back, and
   * the car backs up with its tail going where the knob points.
   */
  reverse?: boolean;
  /**
   * Parking assist. While the car is reversing into or out of a bay, this says
   * which way the line into the bay runs from where the car is, and where on
   * it to aim the tail. Null when there is no such line here.
   */
  guide?: (car: CarState) => { heading: number; along: number } | null;
  /**
   * Carry the car out of the roundabout. Pointing at an exit steers it into
   * the exit lane with the number of the lane it came round in, which is the
   * rule. For the levels that are judged kindly; elsewhere leaving in the
   * right lane is the learner's to do.
   */
  exitHold?: boolean;
  /**
   * The road and lane the task ends in. Where the rule allows two exit lanes,
   * `exitHold` steers for this one: the two are too close in angle to tell
   * apart by the knob.
   */
  exitTo?: { arm: ArmId; lane: number } | null;
};

/** What the assist remembers between steps. */
export type AssistState = {
  /** The lane the car came up the road in, until it has joined the ring. */
  entryLane: number | null;
  /** The road it came up, kept while it goes round. */
  entryArm?: ArmId | null;
  /** How long the knob has been held back with the car at rest. */
  backTime: number;
  /** How firmly the lane is being held this step, 0 to 1. For the scene. */
  hold: number;
  /** Where on that lane the assist is aiming, and which way the lane runs. */
  aimX: number;
  aimZ: number;
  along: number;
  /** Reverse gear coming in: 0 to 1 while the knob is held back at rest. */
  backing: number;
  /**
   * A lane change on a straight road: which road side it is on and the lane
   * it is moving into. Null while the car simply holds its lane.
   */
  change?: { road: string; to: number; dir: number } | null;
  /** How long the knob has leaned one way off the lane, seconds; signed, right positive. */
  lean?: number;
  /** Just changed lane, and the knob still leans on: the next change waits longer. */
  again?: boolean;
  /** The exit road the car has begun to turn off onto, with `exitHold`. */
  leaving?: string | null;
  /**
   * The exit lane it is turning off into, fixed when the turn begins. Read
   * again each step, it would slip outward: driving straight out of an inner
   * lane takes the car across the outer ring lanes on its way to the mouth.
   */
  leavingLane?: number | null;
};

export function createAssist(): AssistState {
  return {
    entryLane: null,
    backTime: 0,
    hold: 0,
    aimX: 0,
    aimZ: 0,
    along: 0,
    backing: 0,
  };
}

/** The compass bearing of "up" on the knob, for each seat. */
const AWAY: Record<Seat, number> = {
  south: 0,
  west: Math.PI / 2,
  north: Math.PI,
  east: -Math.PI / 2,
};

/** Inside this the knob counts as let go. */
export const STICK_DEADZONE = 0.18;
/** How hard the wheel turns per radian the car is off its target. */
const STEER_GAIN = 2;
/** Pointing this far behind the car brakes rather than spinning it round. */
const PULL_BACK = (135 * Math.PI) / 180;
/** How much speed a quarter-turn takes off, so tight bends stay holdable. */
const TURN_SLOWDOWN = 0.55;
const QUARTER_TURN = Math.PI / 2;
const RELEASE_BRAKE = 0.7;
/** Within this of the speed asked for, the throttle eases off. Metres a second. */
const THROTTLE_BAND = 1.2;
/** Held back this long at a standstill, the car goes into reverse. */
const REVERSE_DWELL = 0.35;
const STEP = 1 / 60;
/** A lane away from the roundabout is held within this of its middle, metres. */
const ROAD_LANE_REACH = 2.4;
/** Reversing, a thumb is less sure: the parking assist holds over a wider cone. */
const REVERSE_CONE = (50 * Math.PI) / 180;

/** The assist holds while the knob is within this of the lane's direction. */
export const ROAD_CONE = (30 * Math.PI) / 180;
/**
 * The roundabout bends, so a thumb lags behind it: the cone is wider there.
 * It is narrower on the outside, because pointing outward is how you ask for
 * an exit, and the car should leave the ring while the exit is still ahead.
 */
export const RING_CONE_IN = (55 * Math.PI) / 180;
export const RING_CONE_OUT = (38 * Math.PI) / 180;
/**
 * In the outer lane with the knob pointing down an exit close by, the car is
 * leaving: the ring lets go sooner. Holding on, a tight first exit is taken
 * late and wide. Leaving the outer lane crosses no other lane of the ring.
 */
const RING_CONE_LEAVE = (15 * Math.PI) / 180;
/** The cone's edge is soft, so the assist fades rather than snaps. */
const CONE_EDGE = (8 * Math.PI) / 180;
/** Sideways grip the assist drives within on the roundabout, m/s². */
const BEND_GRIP = 3.2;
/** On the roundabout the assist looks this share of the lane's radius ahead. */
const RING_REACH = 0.5;
/** Joined the ring once this close to the middle of its lane, metres. */
const JOINED = 0.9;

/** Leaning the knob this far past the middle of its lane asks for the next lane. */
const LANE_ASK = (15 * Math.PI) / 180;
/** For this long, seconds: a wobble is not a request. */
const LANE_DWELL = 0.25;
/** Leaning on after one change, this long again asks for the lane after. */
const LANE_DWELL_AGAIN = 0.5;
/** Only once the car runs this close to the way of its lane: not mid-turn. */
const LANE_SQUARE = (25 * Math.PI) / 180;
/** A lane change is over once the car is this close to the new lane's middle. */
const LANE_IN = 0.5;
/**
 * Room a change needs before the continuous lines at the roundabout, metres.
 * A change crosses the lane line about halfway over; starting later than
 * this, the car would cross a continuous line. The task routes cross 6 m out.
 */
const CHANGE_ROOM = 5;

/**
 * The lane to hold on a straight road, given the knob. Leaning the knob past
 * the middle of the lane, toward a neighbouring lane, for a moment, where the
 * lines are broken, asks for that lane; the change is held to until the car is
 * in it.
 */
function laneToHold(
  car: CarState,
  loc: { arm: ArmId; side: "approach" | "exit"; lane: number; along: number },
  runs: number,
  ahead: number,
  knob: number | null,
  state: AssistState,
): number {
  const road = `${loc.arm}:${loc.side}`;
  if (state.change && state.change.road !== road) state.change = null;
  // Measured from the way to the middle of its own lane, so steering back to
  // the middle (out of a turn, say) is not a lean.
  const mid = lanePoint(loc.arm, loc.side, loc.lane, ahead);
  const off =
    knob == null ? 0 : wrapPi(knob - bearingOf(mid.x - car.x, mid.z - car.z));
  const square = Math.abs(wrapPi(car.heading - runs)) < LANE_SQUARE;
  const leaning =
    square &&
    Math.abs(off) >= LANE_ASK &&
    Math.abs(wrapPi((knob ?? runs) - runs)) <= ROAD_CONE + CONE_EDGE
      ? Math.sign(off)
      : 0;
  state.lean =
    leaning !== 0 && Math.sign(state.lean ?? 0) === leaning
      ? (state.lean ?? 0) + leaning * STEP
      : leaning * STEP;
  if (leaning === 0) state.again = false;

  const change = state.change;
  if (change) {
    const into = lanePoint(loc.arm, loc.side, change.to, loc.along);
    if (leaning === -change.dir) {
      // leaned back the other way: stay in the lane it is in now
      state.change = null;
      return loc.lane;
    }
    if (Math.hypot(into.x - car.x, into.z - car.z) >= LANE_IN) return change.to;
    // in: leaning on will take it to the next lane, after a moment more
    state.change = null;
    state.lean = 0;
    state.again = true;
    return loc.lane;
  }

  const to = loc.lane + leaning;
  const room =
    loc.side === "approach"
      ? loc.along - CHANGE_ROOM > SOLID_ZONE
      : loc.along > SOLID_ZONE + 1;
  if (
    leaning !== 0 &&
    Math.abs(state.lean) >= (state.again ? LANE_DWELL_AGAIN : LANE_DWELL) &&
    to >= 1 &&
    to <= ARMS[loc.arm].lanes &&
    room
  ) {
    state.change = { road, to, dir: leaning };
    return to;
  }
  return loc.lane;
}

/** An exit is being asked for when its mouth is within this of the car, metres. */
const EXIT_NEAR = 24;
/** The knob must point within this of the way the exit road runs. */
const EXIT_CONE = (50 * Math.PI) / 180;
/** The car turns off once it is this close to the line of the exit lane, metres. */
const EXIT_LEVEL = 2.4;
/** Turning off, it aims this far on down the exit lane from where it is. */
const EXIT_AIM = 6;
/** The speed it waits for the exit and turns off at, metres a second. */
const EXIT_SPEED = 4.2;

/**
 * On the roundabout, with the knob pointing down an exit road that is close.
 * Until the car is level with that road's lane it should stay on the ring
 * (`"wait"`): cutting straight for the exit clips the kerb at the corner.
 * Once level, the answer is the way to steer for the exit lane. Null when no
 * exit is being asked for.
 */
export function exitAhead(
  car: CarState,
  knob: number,
  state?: AssistState,
  exitTo?: DriveOptions["exitTo"],
): number | "wait" | null {
  const loc = locate(car.x, car.z);
  if (loc.kind !== "ring") return null;
  for (const id of ARM_ORDER) {
    const runs = laneBearing(id, "exit");
    if (Math.abs(wrapPi(knob - runs)) > EXIT_CONE) continue;
    const dir = dirOf(runs);
    const turning = state?.leaving === id && state.leavingLane != null;
    // The lanes the rule allows out of the lane it came round in. Still
    // joining the ring, that is the lane it is joining, not the one it is
    // crossing on the way.
    const ring = state?.entryLane ?? loc.lane;
    const from = state?.entryArm;
    const allowed = turning
      ? [state.leavingLane!]
      : from
        ? exitLanes(
            ARMS[from].lanes,
            ring,
            turnBetween(from, id),
            ARMS[id].lanes,
          )
        : [Math.min(ring, ARMS[id].lanes)];
    // Where the rule allows two, the task's lane, or else the one the knob
    // points down.
    const task = exitTo?.arm === id && allowed.includes(exitTo.lane);
    let lane = task ? exitTo.lane : allowed[0];
    let best = Infinity;
    for (const one of task ? [] : allowed) {
      const aim = lanePoint(id, "exit", one, RING_OUTER_R + EXIT_AIM);
      const miss = Math.abs(
        wrapPi(bearingOf(aim.x - car.x, aim.z - car.z) - knob),
      );
      if (miss < best) {
        best = miss;
        lane = one;
      }
    }
    const mouth = lanePoint(id, "exit", lane, RING_OUTER_R);
    const dx = car.x - mouth.x;
    const dz = car.z - mouth.z;
    if (Math.hypot(dx, dz) > EXIT_NEAR) continue;
    // How far down the exit lane's line the car is, and how far off to its side.
    const along = dx * dir.x + dz * dir.z;
    const side = Math.abs(dx * -dir.z + dz * dir.x);
    // Once it has begun to turn off it keeps to that exit, even if the turn
    // carries it a little wide of the line.
    if (side > EXIT_LEVEL && !turning) return "wait";
    if (state && !turning) {
      state.leaving = id;
      state.leavingLane = lane;
    }
    const ahead = along + EXIT_AIM;
    return bearingOf(
      mouth.x + dir.x * ahead - car.x,
      mouth.z + dir.z * ahead - car.z,
    );
  }
  if (state) {
    state.leaving = null;
    state.leavingLane = null;
  }
  return null;
}

/** Is the knob pointing down an exit road whose mouth is close? */
function exitNear(car: CarState, knob: number): boolean {
  return ARM_ORDER.some((id) => {
    if (Math.abs(wrapPi(knob - laneBearing(id, "exit"))) > EXIT_CONE) {
      return false;
    }
    const mouth = lanePoint(id, "exit", 1, RING_OUTER_R);
    return Math.hypot(car.x - mouth.x, car.z - mouth.z) <= EXIT_NEAR;
  });
}

/** The world direction the knob is pointing, for a learner at `seat`. */
export function stickBearing(stick: Stick, seat: Seat): number {
  return wrapPi(Math.atan2(stick.x, -stick.y) + AWAY[seat]);
}

/** Where the lane the car is in would take it, if it has one. */
function laneAhead(
  car: CarState,
  state: AssistState,
  knob: number | null,
): {
  /** Where to steer to hold the lane. */
  heading: number;
  /** Which way the lane runs where the car is. */
  along: number;
  /** How far the knob may point left and right of that and still be held. */
  left: number;
  right: number;
  cap: number;
  /** The point on the lane being steered for. */
  aim: { x: number; z: number };
} | null {
  const loc = locate(car.x, car.z);
  const reach = 3.5 + 0.35 * car.speed;

  if (loc.kind === "arm") {
    state.entryLane = loc.side === "approach" ? loc.lane : null;
    state.entryArm = loc.side === "approach" ? loc.arm : null;
    const toward = loc.side === "approach" ? -1 : 1;
    const runs = laneBearing(loc.arm, loc.side);
    const aim = lanePoint(
      loc.arm,
      loc.side,
      laneToHold(car, loc, runs, loc.along + toward * reach, knob, state),
      loc.along + toward * reach,
    );
    return {
      heading: bearingOf(aim.x - car.x, aim.z - car.z),
      along: runs,
      left: ROAD_CONE,
      right: ROAD_CONE,
      cap: CAR.maxSpeed,
      aim,
    };
  }

  if (loc.kind === "ring") {
    // On the way in, head for the ring lane with the approach lane's number.
    // After that, hold whichever lane the car is in.
    let lane = loc.lane;
    if (state.entryLane != null) {
      if (Math.abs(loc.r - ringRadius(state.entryLane)) < JOINED) {
        state.entryLane = null;
      } else {
        lane = state.entryLane;
      }
    }
    const r = ringRadius(lane);
    const leaving = lane === 1 && knob != null && exitNear(car, knob);
    // Aim a short way round the lane: short enough on the tight inner lanes
    // that the car doesn't cut the corner on its way in.
    const dir = dirOf(loc.bearing + Math.min(reach, r * RING_REACH) / r);
    return {
      heading: bearingOf(dir.x * r - car.x, dir.z * r - car.z),
      // Clockwise: the lane runs a quarter turn on from the car's bearing.
      along: loc.bearing + Math.PI / 2,
      left: leaving ? RING_CONE_LEAVE : RING_CONE_OUT,
      right: RING_CONE_IN,
      cap: Math.sqrt(BEND_GRIP * r),
      aim: { x: dir.x * r, z: dir.z * r },
    };
  }

  if (loc.kind === "road") {
    // The two-way road, the street and the parking aisle: hold whichever of
    // their lanes the car is in and facing along.
    for (const lane of network().roadLanes) {
      const dir = dirOf(lane.heading);
      const d = (car.x - lane.a.x) * dir.x + (car.z - lane.a.z) * dir.z;
      if (d < -1 || d > lane.length + 1) continue;
      const side = (car.x - lane.a.x) * -dir.z + (car.z - lane.a.z) * dir.x;
      if (Math.abs(side) > ROAD_LANE_REACH) continue;
      if (Math.abs(wrapPi(car.heading - lane.heading)) > Math.PI / 3) continue;
      const ahead = d + reach;
      return {
        heading: bearingOf(
          lane.a.x + dir.x * ahead - car.x,
          lane.a.z + dir.z * ahead - car.z,
        ),
        along: lane.heading,
        left: ROAD_CONE,
        right: ROAD_CONE,
        cap: lane.road === "aisle" ? 4 : CAR.maxSpeed,
        aim: { x: lane.a.x + dir.x * ahead, z: lane.a.z + dir.z * ahead },
      };
    }
  }

  return null;
}

export function stickToInput(
  stick: Stick,
  car: CarState,
  input: CarInput,
  options: DriveOptions,
  state: AssistState,
): void {
  const push = Math.min(1, Math.hypot(stick.x, stick.y));
  // Keep the assist's memory of the approach lane fresh even when coasting.
  const lane = options.assist
    ? laneAhead(
        car,
        state,
        push < STICK_DEADZONE ? null : stickBearing(stick, options.seat),
      )
    : null;
  state.hold = 0;
  state.backing = 0;

  if (push < STICK_DEADZONE) {
    // Let go: come to a stop, wheels straight.
    input.steer = 0;
    input.throttle = 0;
    input.brake = car.speed > 0 ? RELEASE_BRAKE : 0;
    return;
  }

  const knob = stickBearing(stick, options.seat);

  if (options.reverse) {
    const reversing = car.speed < -0.05;
    const behind = Math.abs(wrapPi(knob - car.heading));
    // Parking assist: the line into the bay from here, if the car is at one.
    const line = options.guide?.(car) ?? null;
    const alongLine =
      line != null && Math.abs(wrapPi(knob - line.along)) < REVERSE_CONE;
    // Once backing up, the knob only has to stay in the half behind the car.
    // At a bay, pointing down the line into it is asking for reverse too.
    if (
      behind > (reversing ? Math.PI / 2 : PULL_BACK) ||
      (alongLine && car.speed < 0.3 && behind > Math.PI / 2)
    ) {
      if (car.speed > 0.3) {
        input.steer = 0;
        input.throttle = 0;
        input.brake = 1;
        return;
      }
      state.backTime += STEP;
      state.backing = Math.min(1, state.backTime / REVERSE_DWELL);
      if (!reversing && state.backTime < REVERSE_DWELL) {
        input.steer = 0;
        input.throttle = 0;
        input.brake = 1;
        return;
      }
      // The tail goes where the knob points, so the nose faces away from it.
      // Backing up, the wheel works the other way round.
      // Parking assist: while the knob points roughly along the line into the
      // bay, the tail is steered down the middle of it.
      let tail = knob;
      if (line) {
        const away = Math.abs(wrapPi(knob - line.along));
        const hold = Math.max(
          0,
          Math.min(1, (REVERSE_CONE + CONE_EDGE - away) / (2 * CONE_EDGE)),
        );
        tail = knob + hold * wrapPi(line.heading - knob);
      }
      const off = wrapPi(tail + Math.PI - car.heading);
      const reach = (push - STICK_DEADZONE) / (1 - STICK_DEADZONE);
      input.steer = Math.max(-1, Math.min(1, -off * STEER_GAIN));
      input.throttle = -Math.max(0.25, reach);
      input.brake = 0;
      return;
    }
    state.backTime = 0;
  }

  if (Math.abs(wrapPi(knob - car.heading)) > PULL_BACK) {
    input.steer = 0;
    input.throttle = 0;
    input.brake = 1;
    return;
  }

  let target = knob;
  let cap: number = CAR.maxSpeed;
  if (lane) {
    const off = wrapPi(knob - lane.along);
    const cone = off < 0 ? lane.left : lane.right;
    const hold = Math.max(
      0,
      Math.min(1, (cone + CONE_EDGE - Math.abs(off)) / (2 * CONE_EDGE)),
    );
    target = knob + hold * wrapPi(lane.heading - knob);
    cap = CAR.maxSpeed + hold * (lane.cap - CAR.maxSpeed);
    state.hold = hold;
    state.aimX = lane.aim.x;
    state.aimZ = lane.aim.z;
    state.along = lane.along;
  }
  // Asked for an exit: the ring is held until the car is level with the exit
  // lane, and then that lane is steered for.
  if (options.exitHold && lane) {
    const out = exitAhead(car, knob, state, options.exitTo);
    if (out === "wait") {
      target = lane.heading;
      cap = Math.min(lane.cap, EXIT_SPEED);
      state.hold = 1;
    } else if (out != null) {
      target = out;
      cap = EXIT_SPEED;
      state.hold = 1;
    }
  }

  const off = wrapPi(target - car.heading);
  input.steer = Math.max(-1, Math.min(1, off * STEER_GAIN));

  const reach = (push - STICK_DEADZONE) / (1 - STICK_DEADZONE);
  const turning = Math.min(1, Math.abs(off) / QUARTER_TURN);
  const speed = Math.min(
    cap,
    CAR.maxSpeed * reach * (1 - TURN_SLOWDOWN * turning),
  );
  // Ease onto the speed asked for, rather than switching the engine on and
  // off round it.
  input.throttle = Math.max(
    0,
    Math.min(1, (speed - car.speed) / THROTTLE_BAND),
  );
  input.brake = car.speed > speed + 1 ? 0.5 : 0;
}
