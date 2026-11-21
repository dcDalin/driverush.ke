import { describe, expect, it } from "vitest";

import {
  SHOW_OUT,
  SHOW_TOTAL,
  showcaseCamera,
  showcasePose,
  skipTo,
} from "~/lib/board/showcase";

const halfV = (16 * Math.PI) / 180;
const at = (left: number, aspect = 1.6, seatAngle = 0.7) =>
  showcasePose({ left, seatAngle, car: { x: 3, z: -4 }, aspect, halfV });

describe("the opening close-up", () => {
  it("starts and ends on the learner's own side, after one full turn", () => {
    expect(at(SHOW_TOTAL).angle).toBeCloseTo(0.7);
    expect(at(0).angle).toBeCloseTo(0.7 + 2 * Math.PI);
    // still on the seat's line while closing in and coming out
    expect(at(SHOW_TOTAL - 0.3).angle).toBeCloseTo(0.7);
    expect(at(0.3).angle).toBeCloseTo(0.7 + 2 * Math.PI);
  });

  it("turns steadily one way, never back", () => {
    let last = -Infinity;
    for (let left = SHOW_TOTAL; left >= 0; left -= 0.05) {
      const { angle } = at(left);
      expect(angle).toBeGreaterThanOrEqual(last - 1e-9);
      last = angle;
    }
  });

  it("hands over from and back to the seat's view", () => {
    expect(at(SHOW_TOTAL).weight).toBeCloseTo(0);
    expect(at(0).weight).toBeCloseTo(0);
    expect(at(SHOW_TOTAL / 2).weight).toBe(1);
  });

  it("looks at the car", () => {
    const pose = at(2);
    expect(pose.target.x).toBe(3);
    expect(pose.target.z).toBe(-4);
    const cam = showcaseCamera(pose);
    const flat = Math.hypot(cam.x - 3, cam.z + 4);
    expect(flat).toBeCloseTo(pose.dist * Math.cos(pose.tilt));
    expect(cam.y).toBeGreaterThan(pose.target.y);
  });

  it("stands further back on a tall phone screen, so the car fits", () => {
    expect(at(2, 0.46).dist).toBeGreaterThan(at(2, 1.6).dist);
  });

  it("is cut short by gliding out, never lengthened", () => {
    expect(skipTo(SHOW_TOTAL)).toBe(SHOW_OUT);
    expect(skipTo(0.2)).toBe(0.2);
    expect(skipTo(0)).toBe(0);
  });
});
