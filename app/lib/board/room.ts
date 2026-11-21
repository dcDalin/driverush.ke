/**
 * The classroom the board's table stands in: four walls, what hangs on them,
 * and a few desks. Pure layout, in scene units (the board's metres): the
 * table is 62 tall, a real ~0.78 m, so a real metre is about 80 units.
 *
 * A driving school's branding goes on every wall (a banner at about the
 * table's height, which the opening close-up's turn sweeps past), so the
 * learner faces one from whichever side of the table they stand on.
 *
 * `board-room.ts` builds it; this file only says where things go.
 */

/** A real metre, in scene units. */
export const METRE = 80;

/** The floor's height, under the table's legs. */
export const FLOOR_Y = -62;

/** The table's footprint (the board, its frame and the margin round it). */
export const TABLE = { x: 78.5, z: 117.6 } as const;

/** The room: walls at ±x and ±z, 3 m tall, no ceiling. About 6.3 × 7.3 m. */
export const ROOM = { x: 250, z: 290, top: FLOOR_Y + 3 * METRE } as const;

export type WallId = "north" | "south" | "east" | "west";

export type WallItemKind =
  | "banner"
  | "poster-logo"
  | "poster-lessons"
  | "whiteboard"
  | "chart"
  | "window"
  | "door"
  | "clock";

/**
 * Something on a wall. `along` is its centre's distance from the wall's
 * middle, to the right as you face the wall from inside the room; `y` is its
 * centre's height; `w` and `h` its size.
 */
export type WallItem = {
  kind: WallItemKind;
  wall: WallId;
  along: number;
  y: number;
  w: number;
  h: number;
};

export type Wall = {
  id: WallId;
  /** The wall's middle, at floor height. */
  x: number;
  z: number;
  /** Which way it faces, into the room (radians about y; 0 faces +z). */
  turn: number;
  length: number;
};

export const WALLS: readonly Wall[] = [
  { id: "north", x: 0, z: -ROOM.z, turn: 0, length: 2 * ROOM.x },
  { id: "south", x: 0, z: ROOM.z, turn: Math.PI, length: 2 * ROOM.x },
  { id: "west", x: -ROOM.x, z: 0, turn: Math.PI / 2, length: 2 * ROOM.z },
  { id: "east", x: ROOM.x, z: 0, turn: -Math.PI / 2, length: 2 * ROOM.z },
];

/**
 * Where a wall point lands in the room: `along` to the right as you face the
 * wall from inside, `out` towards the room's middle.
 */
export function onWall(wall: Wall, along: number, out = 0) {
  // The wall faces f = (sin turn, cos turn). Facing the wall from inside you
  // look along -f, so your right is (f.z, -f.x): the same way a plane turned
  // by `turn` runs its +x, so pictures on it read the right way round.
  const fx = Math.sin(wall.turn);
  const fz = Math.cos(wall.turn);
  return {
    x: wall.x + fz * along + fx * out,
    z: wall.z - fx * along + fz * out,
  };
}

const BANNER = { w: 3.2 * METRE, h: 0.6 * METRE };

/** Everything on the walls. */
export const WALL_ITEMS: readonly WallItem[] = [
  // A school's banner on every wall, from the table's height up: the band the
  // opening close-up sees as it turns.
  ...(["north", "south", "east", "west"] as const).map(
    (wall): WallItem => ({
      kind: "banner",
      wall,
      along: 0,
      y: BANNER.h / 2,
      w: BANNER.w,
      h: BANNER.h,
    }),
  ),
  // The teaching wall: the whiteboard, and the road-signs chart.
  { kind: "whiteboard", wall: "west", along: -170, y: 100, w: 160, h: 80 },
  { kind: "chart", wall: "west", along: 170, y: 96, w: 128, h: 72 },
  // Daylight on the other long wall.
  { kind: "window", wall: "east", along: -160, y: 98, w: 112, h: 96 },
  { kind: "window", wall: "east", along: 160, y: 98, w: 112, h: 96 },
  // The school's posters either side of its banner.
  { kind: "poster-logo", wall: "north", along: -180, y: 84, w: 52, h: 72 },
  { kind: "poster-lessons", wall: "north", along: 180, y: 84, w: 52, h: 72 },
  // The way in, and the clock over the class.
  {
    kind: "door",
    wall: "south",
    along: -185,
    y: FLOOR_Y + 85,
    w: 76,
    h: 170,
  },
  { kind: "clock", wall: "south", along: 175, y: 120, w: 30, h: 30 },
];

export type Furniture = {
  kind: "desk" | "chair";
  x: number;
  z: number;
  /** Footprint: across (x) and deep (z), before turning. */
  w: number;
  d: number;
  /** Turn about y, radians: a chair's back is on its +z side at 0. */
  turn: number;
};

/** A few desks, in the corners, all well clear of the table. */
export const FURNITURE: readonly Furniture[] = [
  // The teacher's desk, by the posters, the chair against the wall.
  { kind: "desk", x: 130, z: -232, w: 112, d: 56, turn: 0 },
  { kind: "chair", x: 130, z: -268, w: 36, d: 36, turn: Math.PI },
  // Two learners' desks by the door wall, facing the table.
  { kind: "desk", x: -170, z: 222, w: 96, d: 48, turn: 0 },
  { kind: "chair", x: -170, z: 258, w: 36, d: 36, turn: 0 },
  { kind: "desk", x: -50, z: 222, w: 96, d: 48, turn: 0 },
  { kind: "chair", x: -50, z: 258, w: 36, d: 36, turn: 0 },
];

/** Heights of the furniture, in scene units (real desk 0.75 m, chair back 0.9 m). */
export const DESK_TOP = FLOOR_Y + 0.75 * METRE;
export const SEAT = FLOOR_Y + 0.45 * METRE;
export const CHAIR_BACK = FLOOR_Y + 0.9 * METRE;

/** A piece's footprint as an axis-aligned box (pieces turn by quarters). */
export function footprint(f: Furniture) {
  const quarter = Math.round(f.turn / (Math.PI / 2)) % 2 !== 0;
  const hw = (quarter ? f.d : f.w) / 2;
  const hd = (quarter ? f.w : f.d) / 2;
  return { x0: f.x - hw, x1: f.x + hw, z0: f.z - hd, z1: f.z + hd };
}

/** The gap between a footprint and the table, in scene units. */
export function gapToTable(b: {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}) {
  const dx = Math.max(0, -TABLE.x - b.x1, b.x0 - TABLE.x);
  const dz = Math.max(0, -TABLE.z - b.z1, b.z0 - TABLE.z);
  return Math.hypot(dx, dz);
}
