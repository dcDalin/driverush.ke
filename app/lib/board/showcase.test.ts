import { describe, expect, it } from "vitest";

import {
  SHOW_OUT,
  overCars,
  overFrame,
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

  it("rises over the table's frame when it stands outside it", () => {
    const frame = { x0: -10, x1: 10, z0: -10, z1: 10, top: 2.2 };
    // over the table: no lift needed
    expect(overFrame({ x: 0, z: 0 }, 0, 5, frame)).toBe(0);
    // 20 m out from a car 5 m from the edge: well above the frame's top
    const lift = overFrame({ x: 0, z: 5 }, 0, 20, frame);
    expect(lift).toBeGreaterThan(2.2);
    const narrow = showcasePose({
      left: 2,
      seatAngle: 0,
      car: { x: 0, z: 5 },
      aspect: 0.46,
      halfV,
      frame,
    });
    const cam = showcaseCamera(narrow);
    // the sight line at the frame's edge clears its top
    const atEdge =
      narrow.target.y + ((cam.y - narrow.target.y) * 5) / (cam.z - 5);
    expect(atEdge).toBeGreaterThan(frame.top);
  });

  it("looks over a car standing beside the one it shows, and only there", () => {
    const car = { x: 0, z: 0 };
    // one lane over, pointing the same way (along z)
    const beside = [{ x: 3.5, z: 0, heading: 0 }];
    const toward = Math.PI / 2;
    const dist = 11;
    const steep = overCars(car, toward, dist, beside);
    // the sight line to the shown car's sills clears the standing car's top
    const edge = 3.5 - 0.9 - 0.2;
    expect(0.3 + edge * Math.tan(steep)).toBeGreaterThanOrEqual(2.2 - 1e-9);
    // from the open side, and with nothing standing, the view stays low
    expect(overCars(car, -toward, dist, beside)).toBe(0);
    expect(overCars(car, toward, dist, [])).toBe(0);
    // a car further out than the camera stands is behind it
    expect(overCars(car, toward, 2, beside)).toBe(0);
  });

  it("looks down more steeply over a lorry than over a car", () => {
    const car = { x: 0, z: 0 };
    const beside = { x: 3.6, z: 0, heading: 0 };
    const overCar = overCars(car, Math.PI / 2, 11, [beside]);
    const overLorry = overCars(car, Math.PI / 2, 11, [
      { ...beside, length: 6, width: 2, height: 2.3 },
    ]);
    expect(overLorry).toBeGreaterThan(overCar);
  });

  it("stands further back from a long vehicle, so it fits the screen", () => {
    const pose = (size?: { length: number; height: number }) =>
      showcasePose({
        left: 3,
        seatAngle: 0,
        car: { x: 0, z: 0 },
        aspect: 1.6,
        halfV,
        size,
      });
    expect(pose({ length: 6, height: 2.3 }).dist).toBeGreaterThan(pose().dist);
    expect(pose({ length: 4.2, height: 1.5 }).dist).toBeCloseTo(pose().dist);
  });

  it("eases up to a standing car and down again, never a jump", () => {
    const car = { x: 0, z: 0 };
    const beside = [{ x: 3.5, z: 0, heading: 0 }];
    let last = overCars(car, 0, 11, beside);
    for (let a = 0.02; a <= Math.PI; a += 0.02) {
      const now = overCars(car, a, 11, beside);
      expect(Math.abs(now - last)).toBeLessThan(0.05);
      last = now;
    }
  });
});
