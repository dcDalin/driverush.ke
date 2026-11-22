/**
 * The opening turn: on every try of a drive the camera closes in on the
 * learner's car, goes once all the way round it, and settles back on the
 * learner's own side of the table, so they see the car's paint, and the
 * school whose paint it is, up close before they drive. The car waits for it:
 * the stick does nothing until it ends (owner, 2026-11-21: "every instance
 * before user plays", "users must really know the driving school").
 *
 * This is the one time the board's camera turns. The turn starts and ends on
 * the learner's own side, so going in and coming out are a straight pull
 * along their line of sight. Taking the view with a drag or pinch glides out;
 * with reduced motion asked for, there is no turn.
 *
 * Pure numbers, so it can be tested; `board-table.tsx` places the camera.
 */

/** Closing in from the seat's view, in seconds. */
export const SHOW_IN = 0.8;
/** One full turn round the car: slow enough to read the school's name. */
export const SHOW_SPIN = 5.5;
/** Back out to the seat's view. */
export const SHOW_OUT = 0.9;
export const SHOW_TOTAL = SHOW_IN + SHOW_SPIN + SHOW_OUT;

/**
 * Low, nearly level: the car side-on, and behind it, as the camera turns, the
 * classroom's walls with the school's banner at the table's height.
 */
const TILT = (7 * Math.PI) / 180;
/**
 * How much higher the camera stands halfway round, so the turn shows the
 * bonnet and roof as well as the sides.
 */
const RISE = (11 * Math.PI) / 180;
/** What the close-up frames, in metres: the car, filling most of the screen. */
const FRAME_ACROSS = 5.4;
const FRAME_DEEP = 3.9;
/** The camera looks at the car's middle, not the road under it. */
const TARGET_Y = 0.6;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Slow at both ends and even in the middle, for the turn. */
const easeInOut = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

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
  frame,
  cars,
}: {
  left: number;
  seatAngle: number;
  car: { x: number; z: number };
  aspect: number;
  halfV: number;
  /**
   * The table's frame: its outer edge and its top. When the camera stands
   * outside it (a tall phone screen stands it further back), it rises just
   * enough to see the car over the frame.
   */
  frame?: { x0: number; x1: number; z0: number; z1: number; top: number };
  /**
   * The other cars standing on the table (a lane lesson's line-up). They stay
   * where they are for the turn, which shows the board as it is (owner,
   * 2026-11-22): passing one, the camera rises to look over it.
   */
  cars?: readonly Standing[];
}): ShowcasePose {
  const t = SHOW_TOTAL - clamp(left, 0, SHOW_TOTAL);
  const weight =
    t < SHOW_IN
      ? smooth(t / SHOW_IN)
      : left < SHOW_OUT
        ? smooth(left / SHOW_OUT)
        : 1;
  const round = clamp((t - SHOW_IN) / SHOW_SPIN, 0, 1);
  const spun = easeInOut(round);
  // Far enough that the car fits both ways: a tall phone screen is narrow, so
  // there the width decides.
  const tanV = Math.tan(halfV);
  const tanH = tanV * Math.max(0.1, aspect);
  let dist = Math.max(FRAME_DEEP / (2 * tanV), FRAME_ACROSS / (2 * tanH));
  const angle = seatAngle + spun * 2 * Math.PI;
  let tilt = TILT + RISE * Math.sin(Math.PI * round);
  if (cars?.length) tilt = Math.max(tilt, overCars(car, angle, dist, cars));
  if (frame) {
    const lift = overFrame(car, angle, dist * Math.cos(tilt), frame);
    if (lift > dist * Math.sin(tilt)) {
      const across = dist * Math.cos(tilt);
      tilt = Math.atan2(lift, across);
      dist = Math.hypot(lift, across);
    }
  }
  return {
    weight,
    angle,
    tilt,
    dist,
    target: { x: car.x, y: TARGET_Y, z: car.z },
  };
}

/** A car standing on the table: where its middle is and which way it points. */
export type Standing = { x: number; z: number; heading: number };

/** A standing car's top, with a school's name board on its roof (metres). */
const CAR_TOP = 2.2;
/** The lowest part of the shown car the camera must still see: its sills. */
const SILL = 0.3;
const HALF_LONG = 2.1;
const HALF_WIDE = 0.9;
/** The steepest the camera looks down to clear a car right beside it. */
const STEEPEST = (56 * Math.PI) / 180;
/** A car this far off the line of sight (radians) is fully in the way... */
const IN_THE_WAY = (28 * Math.PI) / 180;
/** ...and one this far off it is not in the way at all. */
const OUT_OF_THE_WAY = (72 * Math.PI) / 180;

/**
 * How steeply the camera must look down, `dist` metres out at `angle`, to
 * see the car over the cars standing between it and the camera. It eases up
 * and down as the camera passes each one, so the turn stays smooth. 0 with
 * nothing in the way.
 */
export function overCars(
  car: { x: number; z: number },
  angle: number,
  dist: number,
  cars: readonly Standing[],
): number {
  let need = 0;
  for (const other of cars) {
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const away = Math.hypot(dx, dz);
    if (away < 0.5) continue;
    const bearing = Math.atan2(dx, dz);
    // How much of it lies toward the shown car, given the way it points.
    const turned = bearing - other.heading;
    const reach =
      Math.abs(Math.cos(turned)) * HALF_LONG +
      Math.abs(Math.sin(turned)) * HALF_WIDE;
    const edge = Math.max(0.8, away - reach - 0.2);
    // Further out than the camera stands: behind it, not in the way.
    if (edge >= dist) continue;
    const off = Math.abs(
      Math.atan2(Math.sin(angle - bearing), Math.cos(angle - bearing)),
    );
    const inWay =
      1 -
      smooth(clamp((off - IN_THE_WAY) / (OUT_OF_THE_WAY - IN_THE_WAY), 0, 1));
    if (inWay <= 0) continue;
    const steep = Math.min(STEEPEST, Math.atan2(CAR_TOP - SILL, edge));
    need = Math.max(need, steep * inWay);
  }
  return need;
}

/** Clearance over the frame's top, in metres. */
const OVER = 0.5;

/**
 * How high above the car's middle the camera must stand, `across` metres out
 * at `angle`, to see the car over the table's frame. 0 while the camera is
 * still over the table.
 */
export function overFrame(
  car: { x: number; z: number },
  angle: number,
  across: number,
  frame: { x0: number; x1: number; z0: number; z1: number; top: number },
): number {
  const dx = Math.sin(angle);
  const dz = Math.cos(angle);
  // How far from the car, this way, the frame's outer edge is.
  const toEdge = Math.min(
    dx > 1e-9
      ? (frame.x1 - car.x) / dx
      : dx < -1e-9
        ? (frame.x0 - car.x) / dx
        : Infinity,
    dz > 1e-9
      ? (frame.z1 - car.z) / dz
      : dz < -1e-9
        ? (frame.z0 - car.z) / dz
        : Infinity,
  );
  if (across <= toEdge) return 0;
  // The sight line passes the edge at frame.top + OVER, so it rises by that
  // over toEdge metres, and in step all the way out to the camera.
  const rise = frame.top + OVER - TARGET_Y;
  return (rise * across) / Math.max(toEdge, 0.5);
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
