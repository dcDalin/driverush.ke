/**
 * The roundabout and the four roads into it, as the rules see them: lanes,
 * turns, and "where is this point?". The numbers come from `full-board.ts`,
 * which lays out the whole board, so the rules and the drawing cannot disagree.
 * No three.js in here, so the rules can be tested on their own.
 *
 * Top view, metres. `x` runs east and `z` runs south, which matches both SVG
 * (x right, y down) and the three.js ground plane. Bearings are compass angles
 * in radians: 0 is north, a quarter turn clockwise is east.
 */
import {
  type ArmId,
  ARMS as BOARD_ARMS,
  ISLAND_R as BOARD_ISLAND_R,
  LANE,
  type OtherRoad,
  otherRoad,
  reserveAt,
  RING_LANE,
  RING_LANES as BOARD_RING_LANES,
  RING_R,
  SOLID_TO,
} from "./full-board";

export type { ArmId } from "./full-board";

/** A lane on a road. The roundabout's own lanes are a little wider. */
export const LANE_W = LANE;
export const RING_LANE_W = RING_LANE;
export const ISLAND_R = BOARD_ISLAND_R;
export const RING_LANES = BOARD_RING_LANES;
export const RING_OUTER_R = RING_R;
/**
 * Lane lines are continuous for this far before the roundabout: choose your lane
 * before them, because a continuous white line means no changing lanes.
 */
export const SOLID_ZONE = SOLID_TO;
/** A car has left the roundabout once it is this far out along an arm. */
export const EXIT_CLEAR = RING_OUTER_R + 3;

export type Vec = { x: number; z: number };

/** Clockwise, the way traffic goes round. */
export const ARM_ORDER: readonly ArmId[] = ["S", "W", "N", "E"];

export type Arm = {
  id: ArmId;
  /** Lanes each way. */
  lanes: number;
  /** Half the width of the central reserve, or 0 where there is only a line. */
  medianHalf: number;
  /** Unit vector from the centre out along the arm. */
  out: Vec;
  /** How far the arm runs from the centre. */
  length: number;
};

const arm = (id: ArmId): Arm => ({
  id,
  lanes: BOARD_ARMS[id].lanes,
  medianHalf: BOARD_ARMS[id].reserve,
  out: BOARD_ARMS[id].out,
  length: BOARD_ARMS[id].length,
});

export const ARMS: Record<ArmId, Arm> = {
  S: arm("S"),
  W: arm("W"),
  N: arm("N"),
  E: arm("E"),
};

export type Side = "approach" | "exit";
export type Turn = "left" | "straight" | "right" | "back";

// ---- small maths --------------------------------------------------------------

export const TAU = Math.PI * 2;

/** Wrap an angle to (-π, π]. */
export function wrapPi(a: number): number {
  let r = a % TAU;
  if (r > Math.PI) r -= TAU;
  if (r <= -Math.PI) r += TAU;
  return r;
}

/** Compass bearing of a direction or of a point seen from the centre. */
export function bearingOf(x: number, z: number): number {
  return Math.atan2(x, -z);
}

/** Unit vector for a bearing. */
export function dirOf(bearing: number): Vec {
  return { x: Math.sin(bearing), z: -Math.cos(bearing) };
}

/** The left-hand side of a direction of travel. Kenya keeps left. */
export function leftOf(v: Vec): Vec {
  return { x: v.z, z: -v.x };
}

// ---- lanes -------------------------------------------------------------------

export function armHalfWidth(arm: Arm): number {
  return arm.medianHalf + arm.lanes * LANE_W;
}

/** Lane 1 is the outermost lane, by the kerb. Distance from the arm's centre line. */
export function laneOffset(arm: Arm, lane: number): number {
  return arm.medianHalf + (arm.lanes - lane + 0.5) * LANE_W;
}

/** Which way traffic faces on one side of an arm. */
export function laneBearing(armId: ArmId, side: Side): number {
  const { out } = ARMS[armId];
  return side === "exit" ? bearingOf(out.x, out.z) : bearingOf(-out.x, -out.z);
}

/** A point in the middle of a lane, `along` metres from the centre. */
export function lanePoint(
  armId: ArmId,
  side: Side,
  lane: number,
  along: number,
): Vec {
  const arm = ARMS[armId];
  const heading = side === "exit" ? arm.out : { x: -arm.out.x, z: -arm.out.z };
  const left = leftOf(heading);
  const off = laneOffset(arm, lane);
  return {
    x: arm.out.x * along + left.x * off,
    z: arm.out.z * along + left.z * off,
  };
}

/** Ring lane 1 is the outermost, lane 4 hugs the island. */
export function ringRadius(lane: number): number {
  return RING_OUTER_R - (lane - 0.5) * RING_LANE_W;
}

export function ringLaneAt(r: number): number {
  const lane = Math.floor((RING_OUTER_R - r) / RING_LANE_W) + 1;
  return Math.min(RING_LANES, Math.max(1, lane));
}

// ---- where is this point? ----------------------------------------------------

export type Location =
  | { kind: "ring"; lane: number; r: number; bearing: number }
  | { kind: "arm"; arm: ArmId; side: Side; lane: number; along: number }
  /** One of the board's other roads: the street, the two-way road, parking. */
  | { kind: "road"; what: OtherRoad }
  | { kind: "off"; what: "island" | "median" | "verge" };

export function locate(x: number, z: number): Location {
  const r = Math.hypot(x, z);
  if (r < ISLAND_R) return { kind: "off", what: "island" };
  if (r <= RING_OUTER_R) {
    return { kind: "ring", lane: ringLaneAt(r), r, bearing: bearingOf(x, z) };
  }
  for (const id of ARM_ORDER) {
    const arm = ARMS[id];
    const along = x * arm.out.x + z * arm.out.z;
    if (along <= 0 || along > arm.length) continue;
    // Positive on the side that drives toward the roundabout.
    const inward = leftOf({ x: -arm.out.x, z: -arm.out.z });
    const lat = x * inward.x + z * inward.z;
    const dist = Math.abs(lat);
    if (dist > armHalfWidth(arm)) continue;
    // A gap in the reserve is road: the innermost lane of whichever side.
    if (dist < arm.medianHalf && reserveAt(id, along)) {
      return { kind: "off", what: "median" };
    }
    const fromCentre = Math.max(0, dist - arm.medianHalf);
    const lane = Math.min(
      arm.lanes,
      Math.max(1, arm.lanes - Math.floor(fromCentre / LANE_W)),
    );
    return {
      kind: "arm",
      arm: id,
      side: lat > 0 ? "approach" : "exit",
      lane,
      along,
    };
  }
  const other = otherRoad(x, z);
  if (other) return { kind: "road", what: other };
  return { kind: "off", what: "verge" };
}

// ---- turns -------------------------------------------------------------------

/** The turn you make by entering on one arm and leaving on another. */
export function turnBetween(entry: ArmId, exit: ArmId): Turn {
  const steps = (ARM_ORDER.indexOf(exit) - ARM_ORDER.indexOf(entry) + 4) % 4;
  return (["back", "left", "straight", "right"] as const)[steps]!;
}

/** The arm you reach from `entry` by making `turn`. */
export function armForTurn(entry: ArmId, turn: Turn): ArmId {
  const steps = { back: 0, left: 1, straight: 2, right: 3 }[turn];
  return ARM_ORDER[(ARM_ORDER.indexOf(entry) + steps) % 4]!;
}

/** One option of one approach lane: the way it goes through the roundabout. */
export type LaneRule = {
  turn: Turn;
  /** The roundabout lane it goes round in, 1 outermost to 4 by the island. */
  ring: number;
  /** The lane of the road out that it leaves in. */
  exit: number;
  /** The turn's angle as driving schools count it. */
  degrees: number;
  /** It goes once right round the roundabout before it leaves. */
  fullCircle?: boolean;
};

/**
 * Every lane's options, as driving schools teach them on the Model Town Board
 * (Perez's Model Town Board animation tutorial, which the owner chose as the
 * reference, and the NTSA learner handbook's option codes).
 *
 * The four-lane road is "2124": lane 1 straight or left, lane 2 straight,
 * lane 3 straight or right, lane 4 right, back (180°), and left (270°) or
 * straight (360°) after going once right round the island. The degrees add
 * up as the car turns: once round and then left is 270°. Turning onto the three-lane road from
 * lane 3 or 4 you leave one lane further out: right from lane 3 is the middle
 * lane, from lane 4 the third.
 *
 * The three-lane road is "215": lanes 1 and 2 the same, and lane 3 has five.
 * Its first two (straight, and right into lane 3) go round in the roundabout's
 * third lane. The last three (right into lane 4, back, and left at 270° into
 * lane 4, once round first) go round in its fourth lane, beside the island.
 */
export const LANE_OPTIONS: Record<
  number,
  Record<number, readonly LaneRule[]>
> = {
  4: {
    1: [
      { turn: "straight", ring: 1, exit: 1, degrees: 0 },
      { turn: "left", ring: 1, exit: 1, degrees: 90 },
    ],
    2: [{ turn: "straight", ring: 2, exit: 2, degrees: 0 }],
    3: [
      { turn: "straight", ring: 3, exit: 3, degrees: 0 },
      { turn: "right", ring: 3, exit: 2, degrees: 90 },
    ],
    4: [
      { turn: "right", ring: 4, exit: 3, degrees: 90 },
      { turn: "back", ring: 4, exit: 4, degrees: 180 },
      { turn: "left", ring: 4, exit: 3, degrees: 270, fullCircle: true },
      { turn: "straight", ring: 4, exit: 4, degrees: 360, fullCircle: true },
    ],
  },
  3: {
    1: [
      { turn: "straight", ring: 1, exit: 1, degrees: 0 },
      { turn: "left", ring: 1, exit: 1, degrees: 90 },
    ],
    2: [{ turn: "straight", ring: 2, exit: 2, degrees: 0 }],
    3: [
      { turn: "straight", ring: 3, exit: 3, degrees: 0 },
      { turn: "right", ring: 3, exit: 3, degrees: 90 },
      { turn: "right", ring: 4, exit: 4, degrees: 90 },
      { turn: "back", ring: 4, exit: 3, degrees: 180 },
      { turn: "left", ring: 4, exit: 4, degrees: 270, fullCircle: true },
    ],
  },
};

/** Every option of one approach lane, in the order schools list them. */
export function laneRules(lanes: number, lane: number): readonly LaneRule[] {
  return LANE_OPTIONS[lanes]?.[lane] ?? [];
}

/**
 * The options of one lane for one turn, optionally only those going round in
 * one roundabout lane.
 */
export function rulesFor(
  lanes: number,
  lane: number,
  turn: Turn,
  ring?: number | null,
): LaneRule[] {
  return laneRules(lanes, lane).filter(
    (rule) => rule.turn === turn && (ring == null || rule.ring === ring),
  );
}

/** The turns one approach lane may make (`LANE_OPTIONS`). */
export function allowedTurns(lanes: number, lane: number): readonly Turn[] {
  return [...new Set(laneRules(lanes, lane).map((rule) => rule.turn))];
}

/** The roundabout lanes one approach lane goes round in, outermost first. */
export function ringLanes(lanes: number, lane: number, turn?: Turn): number[] {
  const rules = turn
    ? rulesFor(lanes, lane, turn)
    : [...laneRules(lanes, lane)];
  return [...new Set(rules.map((rule) => rule.ring))].sort((a, b) => a - b);
}

/** The approach lanes that may make a turn, lowest first. */
export function lanesForTurn(lanes: number, turn: Turn): number[] {
  const out: number[] = [];
  for (let lane = 1; lane <= lanes; lane += 1) {
    if (allowedTurns(lanes, lane).includes(turn)) out.push(lane);
  }
  return out;
}

// ---- degrees round the roundabout --------------------------------------------

/**
 * How far round, clockwise, from the middle of the road in to the middle of the
 * road out: a quarter turn for left, half for straight, three quarters for
 * right, and the whole circle to come back. A car leaves before it reaches the
 * middle of the road out, since that road's way out is the half before it.
 */
export function turnSweep(turn: Turn): number {
  return { left: 0.5, straight: 1, right: 1.5, back: 2 }[turn] * Math.PI;
}

/**
 * How far round one option goes, loop included: 90° to 360° of sweep, plus a
 * whole circle for the Q-turn and the 360°.
 */
export function optionSweep(rule: LaneRule): number {
  return turnSweep(rule.turn) + (rule.fullCircle ? TAU : 0);
}

/**
 * How many full loops a car made before leaving by `turn`, from how far round
 * it had come from the middle of its road in. It always leaves less than a
 * quarter circle before the middle of the road out, so rounding is safe.
 */
export function loopsAt(turn: Turn, progress: number): number {
  return Math.round((progress - turnSweep(turn)) / TAU) || 0;
}

/**
 * The furthest round one approach lane may go in one roundabout lane: the
 * sweep of its last exit. Past the middle of that road there is no exit left.
 */
export function lastExitSweep(
  lanes: number,
  lane: number,
  ring: number,
): number {
  const sweeps = laneRules(lanes, lane)
    .filter((rule) => rule.ring === ring)
    .map(optionSweep);
  return sweeps.length ? Math.max(...sweeps) : 0;
}

/** The option code for a road: how many options each lane has, kerb lane first. */
export const OPTION_CODES: Record<number, string> = { 4: "2124", 3: "215" };

/**
 * The lanes a car may leave the roundabout in, for one approach lane and turn,
 * from `LANE_OPTIONS`. Given the roundabout lane it went round in, only that
 * option's exit lane. Empty when the lane may not make the turn.
 */
export function exitLanes(
  entryLanes: number,
  entryLane: number,
  turn: Turn,
  ring?: number | null,
): number[] {
  return [
    ...new Set(
      rulesFor(entryLanes, entryLane, turn, ring).map((rule) => rule.exit),
    ),
  ];
}
