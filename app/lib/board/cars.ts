/**
 * The cars the learner can drive on the board. They differ in looks only:
 * every one is scaled to the same footprint, so the rules treat them alike.
 *
 * The models are built by `scripts/build-board-cars.mjs`.
 */
export const BOARD_CARS = [
  // `?v=2`: every car gained its wrap template (scripts/build-car-wrap.mjs).
  // A new address, so no cache hands out the old one. Keep public/sw.js's
  // BOARD_FILES in step.
  {
    id: "saloon",
    label: "Saloon",
    src: "/assets/board/cars/saloon.glb?v=2",
  },
  { id: "suv", label: "SUV", src: "/assets/board/cars/suv.glb?v=2" },
  { id: "pickup", label: "Pickup", src: "/assets/board/cars/pickup.glb?v=2" },
] as const;

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
