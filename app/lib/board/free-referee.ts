/**
 * Watches free drive: no task, no route, no green box. Every rule of the road
 * (`road-rules.ts`) is judged as it is on a task, but nothing ends the drive.
 * Each rule broken is said once and the car carries on from where it is.
 *
 * Some mistakes the car cannot just carry on from: driving against the
 * traffic (it is still doing it, step after step) and reaching the frame of
 * the board at the end of a road. For those the result says how to put the
 * car right: `back` puts it back a little, before the mistake, and `place`
 * turns it round at the frame, the way an instructor picks the toy car up.
 *
 * Pure: give it the car, what it has just touched and the time step.
 */
import type { CarState } from "./car";
import { BOUNDS, ROADS, startOnBoard } from "./full-board";
import { ARMS, laneBearing, lanePoint, locate, wrapPi } from "./geometry";
import type { Contact } from "./physics";
import type { Fault, RefState } from "./referee";
import { roadStep } from "./road-rules";

export type Pose = { x: number; z: number; heading: number };

export type FreeResult = {
  /** Small mistakes made this step. */
  small: Fault[];
  /** A rule broken this step, or the car at the frame. Said once. */
  fault?: Fault;
  /** Put the car back a little before the mistake. */
  back?: boolean;
  /** Put the car here: turned round at the frame. */
  place?: Pose;
};

export const BOARD_EDGE: Fault = { id: "board_edge", serious: false };

/** Moving this fast, the car has driven off from wherever it stood. */
const DRIVING_OFF = 0.5;
/**
 * Standing this long nose to the frame, the car is at the end of its road. The
 * keys and lane assist stop it just short of the wood, so it may never touch.
 */
const AT_END = 0.8;
const STILL = 0.3;

/** What free drive keeps from step to step, beside the rules of the road. */
export type FreeState = { atEnd: number };

export function createFree(): FreeState {
  return { atEnd: 0 };
}

export function freeRefStep(
  ref: RefState,
  free: FreeState,
  car: CarState,
  contacts: readonly Contact[],
  dt: number,
  size: { length: number; width: number },
): FreeResult {
  const road = ref.road;
  const step = roadStep(road, car, contacts, dt, { stopLines: true });
  const result: FreeResult = { small: step.small };
  // A drive that never ends stops in the same places again: each new stop
  // there is a new mistake, once the car has driven off from the last one.
  if (Math.abs(car.speed) > DRIVING_OFF) road.stoodAt.length = 0;

  if (step.fault) {
    result.fault = step.fault;
    if (step.held) {
      // Still doing it: put it back before it started, and start the count again.
      result.back = true;
      road.wrongWayTime = 0;
      road.wrongSideTime = 0;
    }
    if (
      step.fault.id === "missed_exit" ||
      step.fault.id === "roundabout_lane_change"
    ) {
      // One mistake, one notice: this time round is spent, so going on round
      // or leaving by any exit is not judged against it again.
      road.ring = null;
      road.lastApproach = null;
      road.leaving = null;
    }
    return result;
  }

  free.atEnd =
    Math.abs(car.speed) < STILL && noseToFrame(car, size.length / 2 + 1)
      ? free.atEnd + dt
      : 0;
  if (step.frame || free.atEnd > AT_END) {
    free.atEnd = 0;
    result.fault = BOARD_EDGE;
    const place = turnedRound(car, size);
    if (place) result.place = place;
    else result.back = true;
  }
  return result;
}

function onBoard(x: number, z: number): boolean {
  return x > BOUNDS.x0 && x < BOUNDS.x1 && z > BOUNDS.z0 && z < BOUNDS.z1;
}

/** Is the frame this close in front of the car's middle? */
function noseToFrame(car: Pose, reach: number): boolean {
  return !onBoard(
    car.x + Math.sin(car.heading) * reach,
    car.z - Math.cos(car.heading) * reach,
  );
}

/**
 * Where to put a car that has reached the frame. Facing it, at the end of a
 * road: on the other side of the same road, facing back the way it came.
 * Backed into it: a little forward, off the frame. Null when neither fits (a
 * car against the frame side on), and it is put back instead.
 */
export function turnedRound(
  car: Pose,
  size: { length: number; width: number },
): Pose | null {
  const reach = size.length / 2 + 1.5;
  const facing = noseToFrame(car, reach);
  const backedIn = noseToFrame(
    { ...car, heading: car.heading + Math.PI },
    reach,
  );
  const fit = (pose: Pose) => startOnBoard(pose, size.length, size.width);

  if (!facing) {
    return backedIn ? fit({ x: car.x, z: car.z, heading: car.heading }) : null;
  }

  const loc = locate(car.x, car.z);
  if (loc.kind === "arm") {
    const side = loc.side === "exit" ? "approach" : "exit";
    const lane = Math.min(loc.lane, ARMS[loc.arm].lanes);
    const at = lanePoint(loc.arm, side, lane, loc.along);
    return fit({ ...at, heading: laneBearing(loc.arm, side) });
  }
  // The two-way road and the street: the lane beside it, mirrored across the
  // middle of the road.
  const heading = wrapPi(car.heading + Math.PI);
  const { SIDE, STREET } = ROADS;
  if (car.x > SIDE.x0 && car.x < SIDE.x1) {
    return fit({ x: 2 * SIDE.mid - car.x, z: car.z, heading });
  }
  if (car.z > STREET.z0 && car.z < STREET.z1) {
    return fit({ x: car.x, z: 2 * STREET.mid - car.z, heading });
  }
  return null;
}
