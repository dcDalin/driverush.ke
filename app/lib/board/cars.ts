/**
 * The cars the learner can drive on the board. They differ in looks only:
 * every one is scaled to the same footprint, so the rules treat them alike.
 *
 * The models are built by `scripts/build-board-cars.mjs`.
 */
export const BOARD_CARS = [
  // `?v=2`: the saloon gained its wrap template (scripts/build-car-wrap.mjs).
  // A new address, so no cache hands out the old one. Keep public/sw.js's
  // BOARD_FILES in step.
  {
    id: "saloon",
    label: "Saloon",
    src: "/assets/board/cars/saloon.glb?v=2",
  },
  { id: "suv", label: "SUV", src: "/assets/board/cars/suv.glb" },
  { id: "pickup", label: "Pickup", src: "/assets/board/cars/pickup.glb" },
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
   * The car to give a learner who has not chosen one: the saloon, when a
   * sponsoring school's paint is waiting for it.
   */
  prefer?: BoardCarId,
): BoardCarId {
  if (setting && setting !== "random" && IDS.includes(setting)) return setting;
  if (prefer) return prefer;
  const at = Math.min(
    IDS.length - 1,
    Math.max(0, Math.floor(roll * IDS.length)),
  );
  return IDS[at];
}

/** The cars the learner is not driving, for the others on the board. */
export function carsBeside(driven: BoardCarId): BoardCarId[] {
  return IDS.filter((id) => id !== driven);
}
