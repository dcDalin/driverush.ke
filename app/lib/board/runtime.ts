/**
 * The live drive: one car, the joystick, the table's physics and the referee,
 * stepped at a fixed rate. It sits in module scope on purpose. The scene reads
 * `car` and `view` every frame and the controls write `stick`, and none of it
 * goes through React.
 */
import type { CarInput, CarState } from "./car";
import { sizeOf, type BoardCarId } from "./cars";
import {
  hasReverse,
  isFreeDrive,
  isRouteTask,
  isTurnTask,
  type BoardChallenge,
} from "./challenges";
import {
  createFree,
  freeRefStep,
  type FreeState,
  type Pose,
} from "./free-referee";
import { challengeRoute, taskParks, taskStart } from "./lessons";
import { bearingOf, wrapPi } from "./geometry";
import { poseAt, type Route } from "./network";
import {
  AISLE_SPEED,
  STICK_DEADZONE,
  createAssist,
  stickToInput,
  type AssistState,
  type DriveOptions,
  type Stick,
} from "./joystick";
import type { OtherPose, Physics } from "./physics";
import {
  COLLISION,
  LANE_FAULTS,
  createRef,
  refStep,
  type Fault,
  type RefState,
} from "./referee";
import {
  createRouteRef,
  routeRefStep,
  type RouteRefState,
} from "./route-referee";

const STEP = 1 / 60;
/** A stalled tab mustn't fast-forward the car when it wakes. */
const MAX_FRAME = 0.1;

export const car: CarState = { x: 0, z: 0, heading: 0, speed: 0, steer: 0 };
/** Where the learner is holding the knob. The controls write this. */
export const stick: Stick = { x: 0, y: 0 };
/** Where the learner stands, and whether lane assist is on. Set by the store. */
export const drive: DriveOptions = { seat: "south", assist: true };

/** The vehicle being driven: the physics gives it its own size. */
let vehicle: BoardCarId = "saloon";

/**
 * The learner's vehicle is now this one (the scene says, as it does the
 * seat). A drive already set up is set up again at the new size: the vehicle
 * only changes while the car is standing on its start line.
 */
export function setVehicle(id: BoardCarId) {
  if (id === vehicle) return;
  vehicle = id;
  // Still on the start line: stand where this vehicle fits on the board.
  if (challenge && driving && !moved && snaps.length === 1) {
    Object.assign(car, taskStart(challenge, sizeOf(vehicle)));
    snaps[0].car = { ...car };
    trail.length = 0;
    trail.push({ x: car.x, z: car.z });
    settle();
  }
  if (engine && physics && challenge) {
    physics = engine.createPhysics(challenge, car, vehicle);
    view.others = physics.poses;
  }
}

/**
 * How the drive is judged. On the no-fail first drive a breach of lane
 * discipline is only said, as a small mistake, and the drive carries on. On
 * every other level it ends the attempt.
 */
export const judging = { forgiveLanes: false };

/** What the scene needs to know about the drive, beyond `car`. */
export const view = {
  others: [] as OtherPose[],
  braking: false,
  /** Backing up, for the lamps. */
  reversing: false,
  /** Set for a moment when something is hit, 0 to 1. */
  jolt: 0,
  /** Lane assist: 0 when the learner has the wheel, 1 when the lane is held. */
  hold: 0,
  /** Where on the held lane the assist is aiming, and which way the lane runs. */
  aimX: 0,
  aimZ: 0,
  along: 0,
  /** Holding back for reverse gear: 0 to 1 as it comes in. */
  backing: 0,
};

/**
 * The car as it is drawn: between the last two physics steps, so it moves
 * smoothly on a screen that is faster or slower than the physics.
 */
export const shown = { x: 0, z: 0, heading: 0 };

/** Where the car has been this attempt, a point about every metre. */
export const trail: { x: number; z: number }[] = [];
const TRAIL_GAP = 1;
const TRAIL_MAX = 900;

/**
 * A car leaning on a kerb backs off and touches it again. That is one bump,
 * not several: the next one only counts once the car has moved on this far.
 */
const BUMP_APART = 5;
const BUMPS = new Set(["kerb", "central_reserve", "island"]);
let lastBump: { x: number; z: number } | null = null;

/**
 * Free drive says each rule once where it is broken: crossing a continuous
 * line and straight back over it is one mistake. The same rule only counts
 * again once the car is this far on.
 */
const RULE_APART = 8;
const lastTold = new Map<string, { x: number; z: number }>();
/** The drive is free drive: nothing ends it (`free-referee.ts`). */
let freeRun = false;
let free: FreeState = createFree();

type Callbacks = {
  /** A serious mistake: the attempt is over. */
  onFault: (fault: Fault) => void;
  /** A small mistake: a star is lost and the drive goes on. */
  onSmall: (fault: Fault) => void;
  /**
   * The car has left the task's route without breaking a rule. Said once. The
   * drive goes on, but reaching the goal is no longer a pass.
   */
  onDeviation?: (fault: Fault) => void;
  onGoal: () => void;
};

// Matter.js lives behind `physics.ts`. It is fetched the first time someone
// starts a drive, so a visitor who only reads the guide never downloads it.
let engine: typeof import("./physics") | null = null;
let loading: Promise<void> | null = null;

let challenge: BoardChallenge | null = null;
let physics: Physics | null = null;
let ref: RefState = createRef();
/** A route task's own referee, and the line it checks the drive against. */
let routeRef: RouteRefState = createRouteRef();
let taskRoute: Route | null = null;
let taskParking = false;
let assist: AssistState = createAssist();

/** What lane assist is doing, for tests and the bench to look at. Read only. */
export function assistState(): Readonly<AssistState> {
  return assist;
}
let callbacks: Callbacks | null = null;
let driving = false;
/** A sheet or a question is over the table: the drive holds still. */
let paused = false;
/**
 * The opening turn round the car is playing (showcase.ts): the car waits on
 * its start line, stick or no stick, and the clock has not started.
 */
let showing = false;
/** The learner has pushed the stick. The clock starts then, not before. */
let moved = false;
let carry = 0;
let elapsed = 0;

/**
 * The drive as it stood a little while ago, kept every couple of metres, so a
 * gentle level can put the car back before a mistake instead of ending.
 */
type Snap = {
  at: number;
  trail: number;
  car: CarState;
  ref: RefState;
  routeRef: RouteRefState;
  assist: AssistState;
};
const snaps: Snap[] = [];
const SNAP_GAP = 2;
const SNAP_MAX = 48;
/** Metres driven this attempt. */
let driven = 0;
/** After a set back the stick is ignored until it has been let go once. */
let letGo = false;
const REST: Stick = { x: 0, y: 0 };

function snapshot(): void {
  if (snaps.length >= SNAP_MAX) snaps.shift();
  snaps.push({
    at: driven,
    trail: trail.length,
    car: { ...car },
    ref: structuredClone(ref),
    routeRef: structuredClone(routeRef),
    assist: { ...assist },
  });
}
const before = { x: 0, z: 0, heading: 0 };
const input: CarInput = { steer: 0, throttle: 0, brake: 0 };

/** Fetch the physics. The car waits on its start line until it's in. */
export function loadPhysics(): Promise<void> {
  loading ??= import("./physics").then((mod) => {
    engine = mod;
    if (driving && challenge && !physics) {
      physics = mod.createPhysics(challenge, car, vehicle);
      view.others = physics.poses;
    }
  });
  return loading;
}

export function resetInput(): void {
  stick.x = 0;
  stick.y = 0;
  input.steer = 0;
  input.throttle = 0;
  input.brake = 0;
}

/** Put the car on its start line and hand control to the learner. */
export function beginChallenge(next: BoardChallenge, cb: Callbacks): void {
  const start = taskStart(next, sizeOf(vehicle));
  car.x = start.x;
  car.z = start.z;
  car.heading = start.heading;
  routeRef = createRouteRef();
  taskRoute = isRouteTask(next) ? challengeRoute(next) : null;
  taskParking = taskParks(next);
  freeRun = isFreeDrive(next);
  free = createFree();
  drive.reverse = hasReverse(next);
  // Where the task ends in one lane, lane assist joins the roundabout lane
  // that option goes round in and steers out into that lane.
  drive.exitTo =
    isTurnTask(next) && next.goal.lane != null
      ? { arm: next.goal.arm, lane: next.goal.lane }
      : null;
  car.speed = 0;
  car.steer = 0;
  challenge = next;
  callbacks = cb;
  ref = createRef();
  assist = createAssist();
  physics = engine ? engine.createPhysics(next, car, vehicle) : null;
  view.others = physics
    ? physics.poses
    : next.otherCars.map(({ x, z, heading }) => ({ x, z, heading }));
  view.braking = false;
  view.reversing = false;
  view.jolt = 0;
  view.hold = 0;
  view.backing = 0;
  carry = 0;
  elapsed = 0;
  moved = false;
  paused = false;
  trail.length = 0;
  trail.push({ x: car.x, z: car.z });
  lastBump = null;
  lastTold.clear();
  driven = 0;
  letGo = false;
  snaps.length = 0;
  snapshot();
  settle();
  driving = true;
  resetInput();
  if (!engine) void loadPhysics();
}

/**
 * Put the car back where it was about this many metres ago, at rest, and carry
 * on with the same attempt. False when there is nothing to go back to.
 */
export function setBack(metres: number): boolean {
  if (!challenge || !callbacks || !engine || snaps.length === 0) return false;
  const want = driven - metres;
  let i = snaps.length - 1;
  while (i > 0 && snaps[i].at > want) i -= 1;
  const snap = snaps[i];
  snaps.length = i + 1;
  Object.assign(car, snap.car);
  car.speed = 0;
  car.steer = 0;
  ref = structuredClone(snap.ref);
  routeRef = structuredClone(snap.routeRef);
  assist = { ...snap.assist };
  physics = engine.createPhysics(challenge, car, vehicle);
  view.others = physics.poses;
  view.braking = false;
  view.reversing = false;
  view.jolt = 0;
  view.hold = 0;
  view.backing = 0;
  trail.length = Math.max(1, snap.trail);
  driven = snap.at;
  lastBump = null;
  lastTold.clear();
  carry = 0;
  paused = false;
  settle();
  resetInput();
  letGo = true;
  driving = true;
  return true;
}

/**
 * Put the car down here, at rest, and carry on with the same drive: free
 * drive turning the car round at the frame. The rules start afresh from here.
 */
export function placeCar(pose: Pose): void {
  if (!challenge || !engine) return;
  car.x = pose.x;
  car.z = pose.z;
  car.heading = pose.heading;
  car.speed = 0;
  car.steer = 0;
  ref = createRef();
  assist = createAssist();
  physics = engine.createPhysics(challenge, car, vehicle);
  view.others = physics.poses;
  view.braking = false;
  view.reversing = false;
  view.hold = 0;
  view.backing = 0;
  trail.push({ x: car.x, z: car.z });
  // Setting back never goes past here: the road behind is another road now.
  snaps.length = 0;
  snapshot();
  lastBump = null;
  lastTold.clear();
  carry = 0;
  settle();
  resetInput();
  letGo = true;
}

/**
 * How the car left the task's route, if it has. After a set back this is the
 * drive as it stood then, so the car may be back on its route.
 */
export function deviation(): Fault | null {
  if (!challenge) return null;
  return isRouteTask(challenge) ? routeRef.off : ref.off;
}

/** Metres driven this attempt. */
export function drivenMetres(): number {
  return driven;
}

/** Draw the car exactly where it is. */
function settle(): void {
  before.x = shown.x = car.x;
  before.z = shown.z = car.z;
  before.heading = shown.heading = car.heading;
}

export function stopDriving(): void {
  driving = false;
  car.speed = 0;
  view.braking = false;
  view.reversing = false;
  view.hold = 0;
  view.backing = 0;
  settle();
  resetInput();
}

/** Hold the drive still, clock and all, while something is over the table. */
export function setPaused(value: boolean): void {
  paused = value;
  if (value) resetInput();
}

const showingListeners = new Set<() => void>();

/** Hold the car still while the opening turn round it plays. */
export function setShowing(value: boolean): void {
  if (value === showing) return;
  showing = value;
  for (const listener of showingListeners) listener();
}

/** Is the opening turn playing? For the screen's own parts to make way. */
export function isShowing(): boolean {
  return showing;
}

export function subscribeShowing(listener: () => void): () => void {
  showingListeners.add(listener);
  return () => showingListeners.delete(listener);
}

/** Has the learner set off yet? */
export function hasMoved(): boolean {
  return moved;
}

export function isDriving(): boolean {
  return driving;
}

/** Seconds spent driving this attempt. */
export function elapsedSeconds(): number {
  return elapsed;
}

/** The drive's options with lane assist off, for getting into or out of a bay. */
const HANDS_ON: DriveOptions = { seat: "south", assist: false };

/**
 * Is the car at a parking bay, going in or coming out? Lane assist lets go
 * there: holding the lane is the opposite of what the learner is trying to do.
 */
function manoeuvring(): boolean {
  if (!taskRoute) return false;
  const at = routeRef.progress;
  const near = taskRoute.steps.some(
    (step) =>
      (step.road === "angle_bay" || step.road === "flush_bay") &&
      at > step.from - 7 &&
      at < step.to + 2,
  );
  if (!near) return false;
  HANDS_ON.seat = drive.seat;
  HANDS_ON.reverse = drive.reverse;
  // Lane assist lets go, and parking assist takes over for the reversing.
  HANDS_ON.guide = drive.assist ? reverseLine : undefined;
  // It keeps the aisle's slow speed on into the bay, as a driver would.
  HANDS_ON.cap = drive.assist ? AISLE_SPEED : undefined;
  return true;
}

/**
 * The line a reversing car should follow, from where it is: the stretch of the
 * task's route that is driven in reverse.
 */
function reverseLine(at: CarState): { heading: number; along: number } | null {
  if (!taskRoute) return null;
  const progress = routeRef.progress;
  const step = taskRoute.steps.find(
    (s) => s.gear === "reverse" && progress > s.from - 6 && progress < s.to,
  );
  if (!step) return null;
  const from = Math.max(step.from, progress);
  const aim = poseAt(taskRoute, Math.min(step.to, from + 2.6));
  // reversing, the car travels the opposite way to the way it faces
  const along = wrapPi(aim.heading + Math.PI);
  const gap = Math.hypot(aim.x - at.x, aim.z - at.z);
  return {
    along,
    heading: gap > 0.6 ? bearingOf(aim.x - at.x, aim.z - at.z) : along,
  };
}

/** Say a step's small mistakes. A kerb leaned on is one bump, not several. */
function saySmall(small: readonly Fault[], impact: number): void {
  for (const fault of small) {
    view.jolt = Math.max(view.jolt, 0.6 * Math.max(0.5, impact));
    if (BUMPS.has(fault.id)) {
      const again =
        lastBump !== null &&
        Math.hypot(car.x - lastBump.x, car.z - lastBump.z) < BUMP_APART;
      lastBump = { x: car.x, z: car.z };
      if (again) continue;
    }
    callbacks?.onSmall(fault);
  }
}

/** Free drive: is this a new mistake, and not the one just said here? */
function newHere(fault: Fault): boolean {
  const last = lastTold.get(fault.id);
  if (last && Math.hypot(car.x - last.x, car.z - last.z) < RULE_APART) {
    return false;
  }
  lastTold.set(fault.id, { x: car.x, z: car.z });
  return true;
}

/** Advance the drive by one rendered frame. */
export function tick(frameSeconds: number): void {
  if (
    !driving ||
    paused ||
    showing ||
    !challenge ||
    !callbacks ||
    !physics ||
    !engine
  ) {
    return;
  }
  const { physicsStep } = engine;
  carry += Math.min(frameSeconds, MAX_FRAME);
  while (carry >= STEP) {
    carry -= STEP;
    before.x = car.x;
    before.z = car.z;
    before.heading = car.heading;
    const pushed = Math.hypot(stick.x, stick.y) > STICK_DEADZONE;
    if (letGo && !pushed) letGo = false;
    if (!moved && pushed && !letGo) moved = true;
    if (moved) elapsed += STEP;
    view.jolt = Math.max(0, view.jolt - STEP * 2.5);

    if (physics.crashed) {
      // The bump plays out, then the examiner calls it.
      if (physicsStep(physics, car, input)) {
        stopDriving();
        callbacks.onFault(
          physics.hitBlock ? { ...COLLISION, block: true } : COLLISION,
        );
        return;
      }
      continue;
    }

    // lane assist keeps clear of the other cars
    drive.others = view.others;
    stickToInput(
      letGo ? REST : stick,
      car,
      input,
      manoeuvring() ? HANDS_ON : drive,
      assist,
    );
    view.braking = input.brake > 0 && car.speed > 0.05;
    view.hold = assist.hold;
    view.aimX = assist.aimX;
    view.aimZ = assist.aimZ;
    view.along = assist.along;
    view.backing = assist.backing;
    physicsStep(physics, car, input);
    view.reversing = car.speed < -0.05;
    driven += Math.abs(car.speed) * STEP;
    if (driven - snaps[snaps.length - 1].at > SNAP_GAP) snapshot();
    const last = trail[trail.length - 1];
    if (
      trail.length < TRAIL_MAX &&
      Math.hypot(car.x - last.x, car.z - last.z) > TRAIL_GAP
    ) {
      trail.push({ x: car.x, z: car.z });
    }

    if (physics.crashed) {
      view.jolt = Math.max(0.5, physics.impact);
      view.braking = false;
      continue;
    }

    if (freeRun) {
      const said = freeRefStep(
        ref,
        free,
        car,
        physics.contacts,
        STEP,
        sizeOf(vehicle),
      );
      saySmall(said.small, physics.impact);
      if (said.place) {
        placeCar(said.place);
        callbacks.onSmall(said.fault!);
        continue;
      }
      if (said.fault && said.back) {
        // The store puts the car back a little before the mistake.
        stopDriving();
        callbacks.onFault(said.fault);
        return;
      }
      if (said.fault && newHere(said.fault)) callbacks.onSmall(said.fault);
      continue;
    }

    const result = isRouteTask(challenge)
      ? taskRoute
        ? routeRefStep(
            routeRef,
            taskRoute,
            taskParking,
            car,
            physics.contacts,
            STEP,
          )
        : { small: [] }
      : isTurnTask(challenge)
        ? refStep(ref, challenge, car, physics.contacts, STEP)
        : { small: [] };
    saySmall(result.small, physics.impact);
    if (
      result.fault &&
      judging.forgiveLanes &&
      LANE_FAULTS.has(result.fault.id)
    ) {
      callbacks.onSmall(result.fault);
    } else if (result.fault) {
      stopDriving();
      callbacks.onFault(result.fault);
      return;
    }
    if (result.deviation) {
      // Against the frame of the board: a bump, and the drive goes on.
      if (result.deviation.id === "past_end") {
        view.jolt = Math.max(view.jolt, 0.6 * Math.max(0.5, physics.impact));
      }
      callbacks.onDeviation?.(result.deviation);
      // A no-fail drive may have put the car back: start the next step clean.
      continue;
    }
    if (result.goal) {
      stopDriving();
      callbacks.onGoal();
      return;
    }
  }
  // What is left of the frame is a share of the next step: draw the car that
  // far on from where it was a step ago.
  const part = carry / STEP;
  shown.x = before.x + (car.x - before.x) * part;
  shown.z = before.z + (car.z - before.z) * part;
  shown.heading = before.heading + wrapPi(car.heading - before.heading) * part;
}
