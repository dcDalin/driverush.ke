import { describe, expect, it } from "vitest";

import {
  CHAIR_BACK,
  FLOOR_Y,
  FURNITURE,
  ROOM,
  TABLE,
  WALLS,
  WALL_ITEMS,
  footprint,
  gapToTable,
  onWall,
} from "~/lib/board/room";

describe("the classroom", () => {
  it("has a school banner on every wall", () => {
    for (const wall of WALLS) {
      expect(
        WALL_ITEMS.some((i) => i.wall === wall.id && i.kind === "banner"),
      ).toBe(true);
    }
  });

  it("puts the banners where the opening close-up looks: just above the table", () => {
    for (const b of WALL_ITEMS.filter((i) => i.kind === "banner")) {
      expect(b.y - b.h / 2).toBeGreaterThanOrEqual(-2);
      expect(b.y - b.h / 2).toBeLessThan(10);
    }
  });

  it("keeps everything on a wall inside that wall, off the floor and under the top", () => {
    for (const item of WALL_ITEMS) {
      const wall = WALLS.find((w) => w.id === item.wall)!;
      expect(Math.abs(item.along) + item.w / 2).toBeLessThanOrEqual(
        wall.length / 2 - 4,
      );
      expect(item.y - item.h / 2).toBeGreaterThanOrEqual(FLOOR_Y);
      expect(item.y + item.h / 2).toBeLessThanOrEqual(ROOM.top);
    }
  });

  it("never lets two things on one wall overlap", () => {
    for (const wall of WALLS) {
      const items = WALL_ITEMS.filter((i) => i.wall === wall.id);
      for (const [n, a] of items.entries()) {
        for (const b of items.slice(n + 1)) {
          const apart =
            Math.abs(a.along - b.along) >= (a.w + b.w) / 2 ||
            Math.abs(a.y - b.y) >= (a.h + b.h) / 2;
          expect(apart, `${a.kind} and ${b.kind} on ${wall.id}`).toBe(true);
        }
      }
    }
  });

  it("keeps the desks inside the room and at least 60 units clear of the table", () => {
    for (const f of FURNITURE) {
      const b = footprint(f);
      expect(b.x0).toBeGreaterThan(-ROOM.x);
      expect(b.x1).toBeLessThan(ROOM.x);
      expect(b.z0).toBeGreaterThan(-ROOM.z);
      expect(b.z1).toBeLessThan(ROOM.z);
      expect(gapToTable(b), f.kind).toBeGreaterThanOrEqual(60);
    }
  });

  it("never lets furniture hide the board from the camera's lowest slant", () => {
    // The camera looks down at 40 degrees at least: anything a gap g from
    // the table can rise g * tan(40) above the board before it hides an edge.
    const rise = CHAIR_BACK - 0;
    for (const f of FURNITURE) {
      expect(
        gapToTable(footprint(f)) * Math.tan((40 * Math.PI) / 180),
      ).toBeGreaterThan(rise);
    }
  });

  it("measures along a wall to the right as you face it from inside", () => {
    const north = WALLS.find((w) => w.id === "north")!;
    expect(onWall(north, 10).x).toBeCloseTo(10);
    const east = WALLS.find((w) => w.id === "east")!;
    // facing the east wall (+x) from inside, your right is +z
    expect(onWall(east, 10).z).toBeCloseTo(10);
    expect(onWall(east, 0, 5).x).toBeCloseTo(ROOM.x - 5);
  });

  it("leaves the table inside the room with room to walk round it", () => {
    expect(ROOM.x - TABLE.x).toBeGreaterThan(1.5 * 80);
    expect(ROOM.z - TABLE.z).toBeGreaterThan(1.5 * 80);
  });
});
