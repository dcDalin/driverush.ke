/**
 * The cars the learner can drive on the board. They differ in looks only:
 * every one is scaled to the same footprint, so the rules treat them alike.
 *
 * The models are free ones made by others and cut down by
 * `scripts/build-real-cars.mjs` (who made each: docs/asset-rights.md), then
 * given their wrap templates by `scripts/build-car-wrap.mjs`. They look like
 * the cars Kenyans learn in and drive, but carry generic names here.
 */
export const BOARD_CARS = [
  // `model`: who made it, and its page. A CC BY model must be credited where
  // the cars are chosen (board-settings-sheet); the others are credited too.
  // `?v=5`: the realistic cars, each with the place of its roof board.
  // A new address, so no cache hands out an old one. Keep public/sw.js's
  // BOARD_FILES in step.
  {
    id: "saloon",
    label: "Saloon",
    src: "/assets/board/cars/saloon.glb?v=5",
    model: {
      by: "Armored Wave",
      page: "https://sketchfab.com/3d-models/2014-toyota-corolla-e180-eu-with-interior-36f95efb0585464cae43a25a3b3392e8",
      ccBy: true,
    },
  },
  {
    id: "hatchback",
    label: "Hatchback",
    src: "/assets/board/cars/hatchback.glb?v=5",
    model: {
      by: "snowcappedandescrash",
      page: "https://sketchfab.com/3d-models/2016-nissan-note-3929336debbf45a8a2e4096f1fdf5baa",
      ccBy: false,
    },
  },
  {
    id: "wagon",
    label: "Wagon",
    src: "/assets/board/cars/wagon.glb?v=5",
    model: {
      by: "tnikita",
      page: "https://sketchfab.com/3d-models/toyota-probox-1b48dd220c69495e8f278376fb7a3add",
      ccBy: true,
    },
  },
  {
    id: "pickup",
    label: "Pickup",
    src: "/assets/board/cars/pickup.glb?v=5",
    model: {
      by: "David_Holiday",
      page: "https://sketchfab.com/3d-models/toyota-hilux-417915f419f945c8a424b2a7943eb25a",
      ccBy: true,
    },
  },
  {
    id: "suv",
    label: "SUV",
    src: "/assets/board/cars/suv.glb?v=5",
    model: {
      by: "Daniel Zhabotinsky",
      page: "https://sketchfab.com/3d-models/urban-10-low-poly-model-2866efdfa943484391ef8313768e074d",
      ccBy: true,
    },
  },
] as const;

/** The licence most of the models are shared under, which asks for a credit. */
export const CC_BY = "https://creativecommons.org/licenses/by/4.0/";

export type BoardCarId = (typeof BOARD_CARS)[number]["id"];
/** What the learner asked for. "random" is a different car each visit. */
export type BoardCarSetting = BoardCarId | "random";

const IDS: readonly BoardCarId[] = BOARD_CARS.map((car) => car.id);

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
  return pool[at];
}

/** The cars the learner is not driving, for the others on the board. */
export function carsBeside(driven: BoardCarId): BoardCarId[] {
  return IDS.filter((id) => id !== driven);
}
