/**
 * One joystick drives the car: push the knob toward where you want it to go on
 * the table, further to go faster, and let go to stop.
 *
 * The learner stands at one side of the table (their seat) and the view never
 * turns, so "up" on the knob always means "away from me". From the south side
 * that is north; from the west side it is east.
 *
 * Lane assist (`rails.ts`): pointing along a real path on the board (a lane,
 * a way round the roundabout and out, a turn), the car keeps to it through a
 * shaky thumb. Pointing further off, the help fades smoothly and the car
 * turns the way the knob points. The learner steers; the assist steadies.
 *
 * Pure, and run once per physics step so the steering tracks the car as it
 * turns.
 */
import { CAR, type CarInput, type CarState } from "./car";
import type { BoardSide } from "./full-board";
import {
  ARMS,
  ARM_ORDER,
  bearingOf,
  laneBearing,
  locate,
  wrapPi,
  type ArmId,
  type Vec,
} from "./geometry";
import { createRails, rails, type RailsState } from "./rails";

export { AISLE_SPEED } from "./rails";

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
   * The road and lane the task ends in. Where the rule allows two exit lanes,
   * lane assist leans toward this one: the two are too close in angle to tell
   * apart by the knob.
   */
  exitTo?: { arm: ArmId; lane: number } | null;
  /**
   * Where the other cars on the table stand. Lane assist never starts a lane
   * change into a lane with a car alongside or just ahead.
   */
  others?: readonly { x: number; z: number }[];
  /** The fastest the car may go forward here, metres a second, whatever the knob says. */
  cap?: number;
  /**
   * The up arrow alone: drive on along the road. Lane assist keeps to it,
   * round the roundabout too, until an exit is asked for (`keyStick`).
   */
  follow?: boolean;
  /**
   * The left arrow on the roundabout: leave at the next exit. Keys cannot
   * point at an exit lane the way a thumb can.
   */
  keyExit?: boolean;
  /**
   * Left or right tapped with the up arrow: a lane change that way, -1 left
   * or 1 right. Keys say so outright; a thumb's lean has to be told from a
   * wobble.
   */
  keyChange?: number;
};

/** What the assist remembers between steps. */
export type AssistState = {
  /** Where on the lane network the car is, and the path it is following. */
  rails: RailsState;
  /** How long the knob has been held back with the car at rest. */
  backTime: number;
  /** Whether the assist is following a path this step, 0 or 1. For the scene. */
  hold: number;
  /** Where on the path the assist is aiming, and which way the path runs. */
  aimX: number;
  aimZ: number;
  along: number;
  /** The path ahead it is following, for the scene. Empty when it is not. */
  path: Vec[];
  /** The lane of the path, on the roundabout's roads. For tests. */
  lane: number | null;
  /** Reverse gear coming in: 0 to 1 while the knob is held back at rest. */
  backing: number;
};

export function createAssist(): AssistState {
  return {
    rails: createRails(),
    backTime: 0,
    hold: 0,
    aimX: 0,
    aimZ: 0,
    along: 0,
    path: [],
    lane: null,
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

/** The arrow keys held, on a computer. */
export type Keys = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

/**
 * Left or right, tapped, leans the knob this far off the car: about where
 * the lane beside lies, looked at a few metres ahead, so on a road with
 * broken lines lane assist moves over a lane.
 */
const KEY_LANE = (28 * Math.PI) / 180;
/** Held on, it swings out to this: off every lane, so the car turns. */
const KEY_TURN = (50 * Math.PI) / 180;
/** A key held this long, seconds, is a turn rather than a lane change. */
const KEY_TAP = 0.4;
/** And the knob swings from one to the other over this long. */
const KEY_SWING = 0.2;

/**
 * The arrow keys steer the car itself, the way a game does, wherever the
 * learner stands: up drives on, left or right with it tapped changes lane
 * and held turns, and down brakes and then backs up, its tail going left or
 * right with left or right. Left and right alone do nothing. The keys become a knob
 * position, worked out afresh every frame from the way the car points, so
 * lane assist and everything after it treat keys and thumb alike. (The thumb
 * stays "toward where you want to go on the screen".)
 *
 * Up alone follows the road (`follow`): lane assist holds the lane, onto the
 * roundabout and round it. There, left (outward) is "leave at the next exit"
 * (`exit`): the knob points down that exit road, as a thumb asking for it
 * does, and the car is helped into the exit lane. Steered out by hand, which
 * exit lane the car got depended on the moment the key went down.
 */
export function keyStick(
  keys: Keys,
  car: { x: number; z: number; heading: number },
  seat: Seat,
  push: number,
  /** How long left or right has been held, seconds. */
  turnHeld = Infinity,
): Stick & { follow: boolean; exit: boolean; change: number } {
  const go = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
  if (go === 0) return { x: 0, y: 0, follow: false, exit: false, change: 0 };
  // Bearings grow clockwise, so the car's left is the smaller bearing.
  const turn = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const swing = Math.max(0, Math.min(1, (turnHeld - KEY_TAP) / KEY_SWING));
  const lean = turn * (KEY_LANE + swing * (KEY_TURN - KEY_LANE));
  let bearing = go > 0 ? car.heading + lean : car.heading + Math.PI - lean;
  const out = go > 0 && turn < 0 ? nextExit(car.x, car.z) : null;
  if (out) bearing = laneBearing(out, "exit");
  const onScreen = bearing - AWAY[seat];
  return {
    x: Math.sin(onScreen) * push,
    y: -Math.cos(onScreen) * push,
    follow: go > 0 && turn === 0,
    exit: out != null,
    change: go > 0 && !out && turnHeld < KEY_TAP ? turn : 0,
  };
}

/**
 * Past the middle of an exit, the car has missed it: the next one is asked
 * for. Its own lanes are reached before the middle, going round.
 */
const MISSED = (5 * Math.PI) / 180;

/** On the roundabout, the next exit road coming up. Null off the ring. */
function nextExit(x: number, z: number): ArmId | null {
  const loc = locate(x, z);
  if (loc.kind !== "ring") return null;
  let best: ArmId | null = null;
  let nearest = Infinity;
  for (const id of ARM_ORDER) {
    const at = bearingOf(ARMS[id].out.x, ARMS[id].out.z);
    // Round the ring is clockwise, the way bearings grow.
    let ahead = wrapPi(at - loc.bearing + MISSED);
    if (ahead < 0) ahead += 2 * Math.PI;
    if (ahead < nearest) {
      nearest = ahead;
      best = id;
    }
  }
  return best;
}

/** Inside this the knob counts as let go: about 9 px of the 72 px stick. */
export const STICK_DEADZONE = 0.12;
/**
 * Speed grows as the push to this power. 1, straight in proportion: tried on
 * a phone at 1.3, a comfortable thumb (30 to 45 px of the 72) only crept
 * along, and clean drives took twice the par time.
 */
const SPEED_CURVE = 1;
/** On a gentle push, a sideways slip this big (of a full push, so 9 px) is ignored. */
const SLIP = 0.12;
/** Up to this push the whole slip is ignored; less of it after. */
const SOFT = 0.3;
/** From this push on, the knob is read exactly as it points. */
const FIRM = 0.6;
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
/** Reversing, a thumb is less sure: the parking assist holds over a wider cone. */
const REVERSE_CONE = (50 * Math.PI) / 180;
/** The parking assist's cone has a soft edge, so it fades rather than snaps. */
const CONE_EDGE = (8 * Math.PI) / 180;

/** The world direction the knob is pointing, for a learner at `seat`. */
export function stickBearing(stick: Stick, seat: Seat): number {
  return wrapPi(Math.atan2(stick.x, -stick.y) + AWAY[seat]);
}

/**
 * Where the knob points, as the car is steered by it. Pushed gently, the knob
 * is a short lever: a thumb slipping a few pixels sideways turns it 30
 * degrees, where the same slip on a firm push turns it 10, so a careful
 * learner got the twitchiest car. Here a sideways slip of up to `SLIP` from
 * the way the car points does not count on a gentle push, fading out by a
 * `FIRM` one. A clear push sideways, or back, is read as it is.
 */
export function knobBearing(stick: Stick, seat: Seat, heading: number): number {
  const raw = stickBearing(stick, seat);
  const push = Math.min(1, Math.hypot(stick.x, stick.y));
  const slack = SLIP * Math.max(0, Math.min(1, (FIRM - push) / (FIRM - SOFT)));
  if (slack === 0) return raw;
  const off = wrapPi(raw - heading);
  const ahead = push * Math.cos(off);
  if (ahead <= 0) return raw;
  const side = push * Math.sin(off);
  const kept = Math.sign(side) * Math.max(0, Math.abs(side) - slack);
  return wrapPi(heading + Math.atan2(kept, ahead));
}

export function stickToInput(
  stick: Stick,
  car: CarState,
  input: CarInput,
  options: DriveOptions,
  state: AssistState,
): void {
  const push = Math.min(1, Math.hypot(stick.x, stick.y));
  const knob = knobBearing(stick, options.seat, car.heading);
  const pushed = push >= STICK_DEADZONE;
  // Lane assist keeps track of the car even while it is let go or reversing.
  const path =
    options.assist && !(options.reverse && car.speed < -0.05)
      ? rails(car, pushed ? knob : null, state.rails, {
          ask: options.keyExit
            ? "exit"
            : options.follow
              ? "follow"
              : options.keyChange
                ? "change"
                : "point",
          side: options.keyChange,
          others: options.others,
          exitTo: options.exitTo,
        })
      : null;
  state.hold = 0;
  state.backing = 0;
  state.path = [];
  state.lane = path?.lane ?? null;

  if (!pushed) {
    // Let go: come to a stop, wheels straight.
    input.steer = 0;
    input.throttle = 0;
    input.brake = car.speed > 0 ? RELEASE_BRAKE : 0;
    return;
  }

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
  let cap: number = options.cap ?? CAR.maxSpeed;
  if (path && path.weight > 0) {
    // The thumb steers; the lane only steadies it. Pointing along the lane,
    // the car keeps to it; pointing further off, the path's share fades, so
    // the car turns the way the knob points, by as much as it points.
    const w = path.weight;
    target = wrapPi(knob + w * wrapPi(path.heading - knob));
    cap = Math.min(cap, CAR.maxSpeed + w * (path.cap - CAR.maxSpeed));
    state.hold = w;
    state.aimX = path.aim.x;
    state.aimZ = path.aim.z;
    state.along = path.along;
    state.path = path.path;
  }

  const off = wrapPi(target - car.heading);
  input.steer = Math.max(-1, Math.min(1, off * STEER_GAIN));

  const reach = (push - STICK_DEADZONE) / (1 - STICK_DEADZONE);
  const turning = Math.min(1, Math.abs(off) / QUARTER_TURN);
  const speed = Math.min(
    cap,
    CAR.maxSpeed * reach ** SPEED_CURVE * (1 - TURN_SLOWDOWN * turning),
  );
  // Ease onto the speed asked for, rather than switching the engine on and
  // off round it.
  input.throttle = Math.max(
    0,
    Math.min(1, (speed - car.speed) / THROTTLE_BAND),
  );
  input.brake = car.speed > speed + 1 ? 0.5 : 0;
}
