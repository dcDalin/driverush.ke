import { CAR } from "./car";

/** A vehicle's size on the board, in metres. */
export type CarSize = {
  length: number;
  width: number;
  /** Front axle to rear axle: a longer one turns in a wider circle. */
  wheelbase: number;
  /** To the roof, without a school's name board. */
  height: number;
};

/** The size the six cars share: they differ in looks only. */
const CAR_SIZE: CarSize = {
  length: CAR.length,
  width: CAR.width,
  wheelbase: CAR.wheelbase,
  height: 1.5,
};

/**
 * The vehicles the learner can drive on the board. The six cars differ in
 * looks only: each is scaled to the same footprint. A bigger vehicle is true
 * to its own size (`size`), and the board's physics, line-ups and camera go
 * by that (owner, 2026-11-22).
 *
 * `big`: too long for an angle parking bay, which is for small cars. Such a
 * vehicle is never parked in one, and its driver is handed a car for an
 * angle parking task.
 *
 * The models are free ones made by others and cut down by
 * `scripts/build-real-cars.mjs` (who made each: docs/asset-rights.md), then
 * given their wrap templates by `scripts/build-car-wrap.mjs`. They look like
 * the cars Kenyans learn in and drive, but carry generic names here.
 */
/** The car menu pictures' version: bump it when they are taken again. */
const THUMB_V = 4;

export const BOARD_CARS = [
  // `model`: who made it, and its page. A CC BY model must be credited where
  // the cars are chosen (board-settings-sheet); the others are credited too.
  // `?v=7` (`?v=8` for the hatchback and SUV; `?v=3` for the van and lorry
  // and `?v=2` for the crossover, which started later): lamps, tyres, rims,
  // chrome and plates set right by `scripts/finish-cars.mjs`.
  // A new address, so no cache hands out an old one. Keep public/sw.js's
  // BOARD_FILES in step.
  // `thumb`: its small picture for the car menu, taken off the model by
  // `npm run build:car-thumbs` (in each school's paint too: `carThumb`).
  // Take them again when a model or a school's paint changes, and bump
  // THUMB_V here and the `?v=` in sw.js.
  {
    id: "saloon",
    label: "Saloon",
    src: "/assets/board/cars/saloon.glb?v=7",
    thumb: `/assets/board/cars/thumbs/saloon.webp?v=${THUMB_V}`,
    size: CAR_SIZE,
    model: {
      by: "Armored Wave",
      page: "https://sketchfab.com/3d-models/2014-toyota-corolla-e180-eu-with-interior-36f95efb0585464cae43a25a3b3392e8",
      ccBy: true,
    },
  },
  {
    id: "hatchback",
    label: "Hatchback",
    src: "/assets/board/cars/hatchback.glb?v=8",
    thumb: `/assets/board/cars/thumbs/hatchback.webp?v=${THUMB_V}`,
    size: CAR_SIZE,
    model: {
      by: "snowcappedandescrash",
      page: "https://sketchfab.com/3d-models/2016-nissan-note-3929336debbf45a8a2e4096f1fdf5baa",
      ccBy: false,
    },
  },
  {
    id: "wagon",
    label: "Wagon",
    src: "/assets/board/cars/wagon.glb?v=7",
    thumb: `/assets/board/cars/thumbs/wagon.webp?v=${THUMB_V}`,
    size: CAR_SIZE,
    model: {
      by: "tnikita",
      page: "https://sketchfab.com/3d-models/toyota-probox-1b48dd220c69495e8f278376fb7a3add",
      ccBy: true,
    },
  },
  {
    id: "pickup",
    label: "Pickup",
    src: "/assets/board/cars/pickup.glb?v=7",
    thumb: `/assets/board/cars/thumbs/pickup.webp?v=${THUMB_V}`,
    size: CAR_SIZE,
    model: {
      by: "David_Holiday",
      page: "https://sketchfab.com/3d-models/toyota-hilux-417915f419f945c8a424b2a7943eb25a",
      ccBy: true,
    },
  },
  {
    id: "suv",
    label: "SUV",
    src: "/assets/board/cars/suv.glb?v=8",
    thumb: `/assets/board/cars/thumbs/suv.webp?v=${THUMB_V}`,
    size: CAR_SIZE,
    model: {
      by: "Daniel Zhabotinsky",
      page: "https://sketchfab.com/3d-models/urban-10-low-poly-model-2866efdfa943484391ef8313768e074d",
      ccBy: true,
    },
  },
  // The two below are true to size (owner, 2026-11-22), measured off the
  // built models: scripts/build-real-cars.mjs `fit`.
  {
    id: "van",
    label: "Van",
    src: "/assets/board/cars/van.glb?v=3",
    thumb: `/assets/board/cars/thumbs/van.webp?v=${THUMB_V}`,
    size: { length: 4.74, width: 1.85, wheelbase: 2.55, height: 1.92 },
    big: true,
    model: {
      by: "Alvin.Woodly",
      page: "https://sketchfab.com/3d-models/low-poly-2013-toyota-hiace-f83b4ed4d8534efb81def77b6c1b642d",
      ccBy: true,
    },
  },
  {
    id: "lorry",
    label: "Lorry",
    src: "/assets/board/cars/lorry.glb?v=3",
    thumb: `/assets/board/cars/thumbs/lorry.webp?v=${THUMB_V}`,
    // Its axles are 3.2 m apart, but it steers by a car's wheelbase: a
    // cab-over lorry's front wheels turn further than a car's, and the turn
    // through a gap in the central reserve is laid out for a car's circle.
    // With 3.2 it clipped the reserve there (board.test.ts drives it).
    size: { length: 6, width: 1.94, wheelbase: 2.6, height: 2.35 },
    big: true,
    model: {
      by: "igbalabdrahmane",
      page: "https://sketchfab.com/3d-models/isuzu-truck-434367858e7240b2b93db7bedb431157",
      ccBy: true,
    },
  },
  // A car, at the cars' shared size.
  {
    id: "crossover",
    label: "Crossover",
    src: "/assets/board/cars/crossover.glb?v=2",
    thumb: `/assets/board/cars/thumbs/crossover.webp?v=${THUMB_V}`,
    size: CAR_SIZE,
    model: {
      by: "Ruleta",
      page: "https://sketchfab.com/3d-models/nissan-x-trail-11073bb28ecf42d3855457d61ea116bd",
      ccBy: true,
    },
  },
] as const;

/**
 * A vehicle's menu picture in a driving school's paint and roof board, as it
 * is driven while that school is on the board (from its livery, in
 * Supabase Storage); the plain one with no school or no picture.
 */
export function carThumb(
  car: BoardCarId,
  school: { thumbs: Partial<Record<BoardCarId, string>> } | null,
): string {
  return (
    school?.thumbs[car] ?? `/assets/board/cars/thumbs/${car}.webp?v=${THUMB_V}`
  );
}

/** The size every `thumb` is saved at: scripts/build-car-thumbs.mjs. */
export const CAR_THUMB_SIZE = { width: 320, height: 166 } as const;

/** The licence most of the models are shared under, which asks for a credit. */
export const CC_BY = "https://creativecommons.org/licenses/by/4.0/";

export type BoardCarId = (typeof BOARD_CARS)[number]["id"];
/** What the learner asked for. "random" is a different car each visit. */
export type BoardCarSetting = BoardCarId | "random";

const IDS: readonly BoardCarId[] = BOARD_CARS.map((car) => car.id);

type Entry = { id: BoardCarId; size: CarSize; big?: boolean };
const ENTRIES: readonly Entry[] = BOARD_CARS;

/** How big a vehicle is. An id that is not on the list is a car's size. */
export function sizeOf(id: BoardCarId | undefined): CarSize {
  return ENTRIES.find((car) => car.id === id)?.size ?? CAR_SIZE;
}

/** Too long for an angle parking bay. */
export function isBig(id: BoardCarId | undefined): boolean {
  return ENTRIES.find((car) => car.id === id)?.big === true;
}

/** The vehicles that fit an angle parking bay: the cars. */
export const SMALL_CARS: readonly BoardCarId[] = ENTRIES.filter(
  (car) => !car.big,
).map((car) => car.id);

/**
 * The car for this visit. `roll` is a number from 0 up to (not including) 1,
 * drawn once per visit, so the car does not change between tasks.
 */
export function resolveCar(
  setting: BoardCarSetting | undefined,
  roll: number,
  /**
   * The cars a learner who has not chosen may be given: the ones the visit's
   * sponsoring school has paint for. Left out, any car.
   */
  allowed?: readonly BoardCarId[],
): BoardCarId {
  if (setting && setting !== "random" && IDS.includes(setting)) return setting;
  const pool = allowed?.filter((id) => IDS.includes(id)).length
    ? allowed.filter((id) => IDS.includes(id))
    : IDS;
  const at = Math.min(
    pool.length - 1,
    Math.max(0, Math.floor(roll * pool.length)),
  );
  return pool[at]!;
}

const BIG_CARS: readonly BoardCarId[] = ENTRIES.filter((car) => car.big).map(
  (car) => car.id,
);

/**
 * Which model stands parked in the `i`th taken bay. An angle bay takes a
 * small car; a flush box, the long vehicles where there are any.
 */
export function parkedModel(i: number, flush = false): BoardCarId {
  const pool = flush && BIG_CARS.length ? BIG_CARS : SMALL_CARS;
  return pool[i % pool.length]!;
}

/** The cars the learner is not driving, for the others on the board. */
export function carsBeside(driven: BoardCarId): BoardCarId[] {
  return IDS.filter((id) => id !== driven);
}

/**
 * Which model the `i`th other car on the table is: its own where the task
 * says, or else the next of the ones the learner is not driving. The scene
 * and the physics both ask here, so a car is as big as it looks.
 */
export function modelBeside(
  driven: BoardCarId,
  own: BoardCarId | undefined,
  i: number,
): BoardCarId {
  if (own) return own;
  // A big vehicle is on the table only where the task names it: the spaces
  // the unnamed cars stand in (bays, blocked roads) are a car's size.
  const beside = SMALL_CARS.filter((id) => id !== driven);
  return beside[i % beside.length]!;
}
