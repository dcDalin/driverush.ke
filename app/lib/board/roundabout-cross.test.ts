/**
 * The yellow cross on the roundabout is paint only: it marks the middle of
 * each road so a learner on a phone can find their exit, and cars drive over
 * it going round. Also the drive's view drawing out on the ring.
 */
import { describe, expect, it } from "vitest";

import type { CarState } from "./car";
import {
  continuousLines,
  fullBoardSvg,
  ISLAND_R,
  RING_LANES,
  RING_R,
  roundaboutCross,
} from "./full-board";
import { ringRadius } from "./geometry";
import { createLineState, lineStep } from "./lines";
import { RING_VIEW, ringPull } from "./stage";

const at = (x: number, z: number): CarState => ({
  x,
  z,
  heading: 0,
  speed: 0,
  steer: 0,
});

describe("the roundabout's yellow cross", () => {
  it("runs from the ring's edge to the island on each road's middle", () => {
    const cross = roundaboutCross();
    expect(cross).toHaveLength(4);
    for (const s of cross) {
      expect(Math.hypot(s.ax, s.az)).toBeCloseTo(RING_R, 6);
      expect(Math.hypot(s.bx, s.bz)).toBeCloseTo(ISLAND_R, 6);
      // on an axis: the dual carriageway's reserve or the three-lane road's centre line
      expect(Math.min(Math.abs(s.ax), Math.abs(s.az))).toBe(0);
      expect(Math.min(Math.abs(s.bx), Math.abs(s.bz))).toBe(0);
    }
  });

  it("is painted on the board", () => {
    const svg = fullBoardSvg();
    for (const s of roundaboutCross()) {
      expect(svg).toContain(`M${s.ax} ${s.az} L${s.bx} ${s.bz}`);
    }
  });

  it("is never a line that may not be crossed", () => {
    for (const line of continuousLines()) {
      // every continuous line starts at or outside the ring's edge
      expect(Math.hypot(line.ax, line.az)).toBeGreaterThanOrEqual(
        RING_R - 0.01,
      );
      expect(Math.hypot(line.bx, line.bz)).toBeGreaterThanOrEqual(
        RING_R - 0.01,
      );
    }
  });

  it("costs nothing to drive over, all the way round in every ring lane", () => {
    for (let lane = 1; lane <= RING_LANES; lane += 1) {
      const radius = ringRadius(lane);
      const state = createLineState();
      const crossed: string[] = [];
      // clockwise from the bottom, a little over once round, a degree at a time
      for (let deg = 0; deg <= 400; deg += 1) {
        const a = Math.PI / 2 + (deg * Math.PI) / 180;
        crossed.push(
          ...lineStep(state, at(Math.cos(a) * radius, Math.sin(a) * radius)),
        );
      }
      expect(crossed, `ring lane ${lane}`).toEqual([]);
    }
  });
});

describe("the drive's view on the roundabout", () => {
  it("draws out only a little past the phone's close view", () => {
    // the close view on a phone is 23 m; the whole ring made the car too small
    expect(RING_VIEW).toBeGreaterThan(23);
    expect(RING_VIEW).toBeLessThan(2 * RING_R);
  });

  it("draws all the way out on the ring and not at all up the road", () => {
    for (let lane = 1; lane <= RING_LANES; lane += 1) {
      expect(ringPull(ringRadius(lane))).toBe(1);
    }
    expect(ringPull(RING_R + 1)).toBe(1);
    expect(ringPull(RING_R + 12)).toBe(0);
    expect(ringPull(80)).toBe(0);
  });

  it("eases between the two without a jump", () => {
    let last = ringPull(RING_R);
    for (let d = RING_R; d <= RING_R + 12; d += 0.1) {
      const now = ringPull(d);
      expect(now).toBeLessThanOrEqual(last);
      expect(last - now).toBeLessThan(0.05);
      last = now;
    }
  });
});
