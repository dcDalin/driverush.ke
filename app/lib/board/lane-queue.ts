/**
 * The lane options lesson, the way instructors teach it on a real board: every
 * car is set out at once on one road into the roundabout, one car for each
 * option of each lane (2, 1, 2 and 4 cars on the four-lane road, 2, 1 and 5 on
 * the three-lane road), and the learner takes one car at a time to its place.
 *
 * Each car is a turn task of its own, with the other cars standing on the
 * table, so the referee that judges the driving tasks judges these too.
 */
import { CAR } from "./car";
import type { OtherCar, TurnChallenge } from "./challenges";
import { BOARD_CARS, SMALL_CARS, isBig, sizeOf, type BoardCarId } from "./cars";
import {
  ARMS,
  armForTurn,
  laneBearing,
  lanePoint,
  type ArmId,
} from "./geometry";
import { SOLID_TO } from "./full-board";
import { laneOptions, type LaneOption } from "./lessons";

export type QueuePose = { x: number; z: number; heading: number };

export type QueueCar = {
  /** The option's id: one car per way through. */
  id: string;
  arm: ArmId;
  lane: number;
  /** Its place in the lane's line, 0 at the front. */
  slot: number;
  option: LaneOption;
  /** The road and lane it ends in. */
  exit: { arm: ArmId; lane: number };
  paint: string;
  car: BoardCarId;
  plate: string;
  /** How far up the road it waits. */
  along: number;
  start: QueuePose;
};

/** The front car's nose waits where the continuous lines begin. */
const NOSE = SOLID_TO + 0.1;
/**
 * The front car waits behind the painted lane number, its nose where the
 * continuous lines begin. This is where a car's middle is; a longer vehicle's
 * is further back.
 */
export const QUEUE_FRONT = NOSE + CAR.length / 2;
/** From one car to the one behind it, middle to middle, where there is room. */
export const QUEUE_GAP = 6.4;
/** Bumper to bumper, where there is room. */
const BETWEEN = QUEUE_GAP - CAR.length;
/** Closer than this, bumper to bumper, a line is too tight to stand in. */
const TIGHTEST = 0.8;
/** The last vehicle's tail stays this far in from the end of the board. */
const TAIL_ROOM = 0.7;

/**
 * A paint for every car on the longest line-up, easy to tell apart on tarmac.
 * On the table the cars wear the visiting school's paint (owner, 2026-11-22);
 * these are for the flat guide picture, and for a table with no school.
 */
const PAINTS = [
  "#dfe3e8",
  "#1f9d55",
  "#b8141b",
  "#d946a8",
  "#22b8cf",
  "#2456b4",
  "#e89a00",
  "#7c3aed",
  "#f26b1d",
] as const;

const cache = new Map<ArmId, QueueCar[]>();

/**
 * Which model stands in each place of each lane's line, and how far apart
 * they stand bumper to bumper. Vehicles differ in length: a line that would
 * not fit its road with a long one in it gets a car there instead.
 */
function lineModels(
  arm: ArmId,
  counts: readonly number[],
): { models: BoardCarId[][]; between: number } {
  const room = ARMS[arm].length - TAIL_ROOM - NOSE;
  let n = 0;
  const models = counts.map((count) =>
    Array.from({ length: count }, () => {
      const id = BOARD_CARS[n % BOARD_CARS.length].id;
      n += 1;
      return id;
    }),
  );
  const spare = (line: readonly BoardCarId[]) =>
    line.length > 1
      ? (room - line.reduce((sum, id) => sum + sizeOf(id).length, 0)) /
        (line.length - 1)
      : Infinity;
  let small = 0;
  for (const line of models) {
    while (spare(line) < TIGHTEST) {
      // The longest one gives its place to a car.
      let longest = 0;
      line.forEach((id, i) => {
        if (sizeOf(id).length > sizeOf(line[longest]).length) longest = i;
      });
      if (!isBig(line[longest]) && sizeOf(line[longest]).length <= CAR.length) {
        break;
      }
      line[longest] = SMALL_CARS[small % SMALL_CARS.length];
      small += 1;
    }
  }
  // One spacing for the whole road, set by its tightest line.
  const between = Math.min(BETWEEN, ...models.map(spare));
  return { models, between };
}

/**
 * Every car of the lesson on one road, kerb lane first, front car first. With
 * `only`, the cars of those lanes alone (a level that covers part of the
 * road), each where it stands in the whole line-up.
 */
export function queueCars(arm: ArmId, only?: readonly number[]): QueueCar[] {
  const all = allQueueCars(arm);
  return only ? all.filter((car) => only.includes(car.lane)) : all;
}

function allQueueCars(arm: ArmId): QueueCar[] {
  const cached = cache.get(arm);
  if (cached) return cached;
  const cars: QueueCar[] = [];
  const heading = laneBearing(arm, "approach");
  const lanes = Array.from({ length: ARMS[arm].lanes }, (_, i) =>
    laneOptions(arm, i + 1),
  );
  // The three-lane road is short for five cars in a line: they close up.
  const { models, between } = lineModels(
    arm,
    lanes.map((options) => options.length),
  );
  lanes.forEach((options, at) => {
    const lane = at + 1;
    // Where the next vehicle's nose goes.
    let nose = NOSE;
    options.forEach((option, slot) => {
      const n = cars.length;
      const car = models[at][slot];
      const length = sizeOf(car).length;
      const along = nose + length / 2;
      nose += length + between;
      cars.push({
        id: option.id,
        arm,
        lane,
        slot,
        option,
        exit: { arm: armForTurn(arm, option.turn), lane: option.exitLane },
        paint: PAINTS[n % PAINTS.length],
        car,
        plate: `KD${String.fromCharCode(65 + n)} ${100 + n * 37}${String.fromCharCode(74 + n)}`,
        along,
        start: { ...lanePoint(arm, "approach", lane, along), heading },
      });
    });
  });
  cache.set(arm, cars);
  return cars;
}

/** The cars that can be taken now: the front waiting car of each lane. */
export function pickable(
  cars: readonly QueueCar[],
  done: readonly string[],
): QueueCar[] {
  const front = new Map<number, QueueCar>();
  for (const car of cars) {
    if (done.includes(car.id)) continue;
    if (!front.has(car.lane)) front.set(car.lane, car);
  }
  return [...front.values()];
}

/** The usual green box of a turn task. */
const BOX = { alongMin: 33, alongMax: 44 };
/**
 * Where two cars end in the same lane of the same road, the first one home
 * goes on to the far box and the second stops behind it.
 */
const FAR_BOX = { alongMin: 46, alongMax: 55 };
const NEAR_BOX = { alongMin: 33, alongMax: 41 };

function sameExit(a: QueueCar, b: QueueCar): boolean {
  return a.exit.arm === b.exit.arm && a.exit.lane === b.exit.lane;
}

/** The box a car must stop in, given the cars already home. */
export function queueGoal(
  cars: readonly QueueCar[],
  car: QueueCar,
  done: readonly string[],
): TurnChallenge["goal"] {
  const sharing = cars.filter((other) => other !== car && sameExit(other, car));
  const band =
    sharing.length === 0
      ? BOX
      : sharing.some((other) => done.includes(other.id))
        ? NEAR_BOX
        : FAR_BOX;
  return { arm: car.exit.arm, lane: car.exit.lane, ...band };
}

function standing(car: QueueCar, pose: QueuePose): OtherCar {
  return {
    ...pose,
    color: "red",
    paint: car.paint,
    car: car.car,
    plate: car.plate,
    school: true,
  };
}

/**
 * Every car of the line-up but one, where it stands now: at its place in the
 * line, or where it stopped once it was driven home.
 */
export function queueStanding(
  cars: readonly QueueCar[],
  rest: Readonly<Record<string, QueuePose>>,
  except?: string,
): OtherCar[] {
  return cars
    .filter((car) => car.id !== except)
    .map((car) => standing(car, rest[car.id] ?? car.start));
}

/** What the learner is asked to do with a car. */
export function queueJob(car: QueueCar): string {
  return `Lane ${car.lane}: ${car.option.label.toLowerCase()}`;
}

/** One car's drive, as a task the referee can judge. */
export function queueChallenge(
  cars: readonly QueueCar[],
  car: QueueCar,
  rest: Readonly<Record<string, QueuePose>>,
): TurnChallenge {
  const done = Object.keys(rest);
  const goal = queueGoal(cars, car, done);
  const road = ARMS[car.exit.arm].lanes === 4 ? "four-lane" : "three-lane";
  return {
    // the box is part of the name: the line drawn to it is kept by this id
    id: `queue:${car.id}:${goal.alongMin}`,
    title: queueJob(car),
    prompt: `Stay in lane ${car.lane}, go ${car.option.fullCircle ? "once all the way round" : "round"} in lane ${car.option.ringLane} of the roundabout, and stop in the green box in lane ${car.exit.lane} of the ${road} road.`,
    start: { arm: car.arm, lane: car.lane, along: car.along },
    turn: car.option.turn,
    goal,
    option: { ring: car.option.ringLane, fullCircle: car.option.fullCircle },
    otherCars: queueStanding(cars, rest, car.id),
  };
}

/** Is this task one car of a lane options lesson? */
export function isQueueTask(id: string): boolean {
  return id.startsWith("queue:");
}
