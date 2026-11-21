/**
 * The opening close-up: on the first try of a drive the camera closes in on
 * the learner's car, circles it once, and settles back on the learner's own
 * side of the table, so they see the car's paint (and the school whose paint
 * it is) up close before they drive.
 *
 * This is the one time the board's camera turns (owner, 2026-11-21). The turn
 * starts and ends on the learner's own side, so going in and coming out are
 * a straight pull along their line of sight. A push of the stick, or taking
 * the view with a drag or pinch, glides out at once.
 *
 * Pure numbers, so it can be tested; `board-table.tsx` places the camera.
 */

/** Closing in from the seat's view, in seconds. */
export const SHOW_IN = 0.7;
/** One full turn round the car. */
export const SHOW_SPIN = 3.2;
/** Back out to the seat's view. */
export const SHOW_OUT = 0.9;
export const SHOW_TOTAL = SHOW_IN + SHOW_SPIN + SHOW_OUT;

/** Low enough to see the doors and their lettering. */
const TILT = (24 * Math.PI) / 180;
/** What the close-up frames, in metres: the car and a little road round it. */
const FRAME_ACROSS = 6;
const FRAME_DEEP = 4.5;
/** The camera looks at the car's middle, not the road under it. */
const TARGET_Y = 0.6;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Slow at both ends, for the turn. */
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export type ShowcasePose = {
  /** How much of the camera is the close-up's: 0 the seat's view, 1 all close-up. */
  weight: number;
  /** Where round the car the camera is, as a seat angle (radians). */
  angle: number;
  tilt: number;
  /** How far from the car, in metres. */
  dist: number;
  target: { x: number; y: number; z: number };
};

/**
 * The close-up with `left` seconds of it to go.
 *
 * `halfV` is half the camera's vertical field of view (radians); `aspect` is
 * the screen's width over its height.
 */
export function showcasePose({
  left,
  seatAngle,
  car,
  aspect,
  halfV,
}: {
  left: number;
  seatAngle: number;
  car: { x: number; z: number };
  aspect: number;
  halfV: number;
}): ShowcasePose {
  const t = SHOW_TOTAL - clamp(left, 0, SHOW_TOTAL);
  const weight =
    t < SHOW_IN
      ? smooth(t / SHOW_IN)
      : left < SHOW_OUT
        ? smooth(left / SHOW_OUT)
        : 1;
  const spun = easeInOut(clamp((t - SHOW_IN) / SHOW_SPIN, 0, 1));
  // Far enough that the car fits both ways: a tall phone screen is narrow, so
  // there the width decides.
  const tanV = Math.tan(halfV);
  const tanH = tanV * Math.max(0.1, aspect);
  const dist = Math.max(FRAME_DEEP / (2 * tanV), FRAME_ACROSS / (2 * tanH));
  return {
    weight,
    angle: seatAngle + spun * 2 * Math.PI,
    tilt: TILT,
    dist,
    target: { x: car.x, y: TARGET_Y, z: car.z },
  };
}

/** Cutting the close-up short: glide straight out, never a jump, never longer. */
export function skipTo(left: number): number {
  return Math.min(left, SHOW_OUT);
}

/** Where the camera stands for a pose (the same frame as the board's camera). */
export function showcaseCamera(pose: ShowcasePose) {
  const { target: c, dist, tilt, angle } = pose;
  return {
    x: c.x + dist * Math.cos(tilt) * Math.sin(angle),
    y: c.y + dist * Math.sin(tilt),
    z: c.z + dist * Math.cos(tilt) * Math.cos(angle),
  };
}
