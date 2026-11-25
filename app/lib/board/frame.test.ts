/**
 * The frame round the board is solid wood. No vehicle starts with its tail in
 * it, and no part of a car, as it is drawn, ever goes into it, however it is
 * driven at it.
 */
import { describe, expect, it } from "vitest";

import { BOARD_CARS, sizeOf } from "./cars";
import { BOARD_CHALLENGES } from "./challenges";
import {
  BOUNDS,
  carCorners,
  FRAME_ROOM,
  frameShift,
  onTarmac,
} from "./full-board";
import { taskStart } from "./lessons";
import { type Contact, createPhysics, physicsStep } from "./physics";
import { FIRST_DRIVE } from "./warmup";

const DEG = Math.PI / 180;
const TASKS = [FIRST_DRIVE, ...BOARD_CHALLENGES];

/** How far the drawn car reaches into the frame, in metres. */
function intoFrame(
  pose: { x: number; z: number; heading: number },
  length: number,
  width: number,
) {
  let worst = 0;
  for (const c of carCorners(pose, length, width)) {
    worst = Math.max(
      worst,
      BOUNDS.x0 - c.x,
      c.x - BOUNDS.x1,
      BOUNDS.z0 - c.z,
      c.z - BOUNDS.z1,
    );
  }
  return worst;
}

describe("the frame round the board", () => {
  it("every vehicle starts every task clear of it", () => {
    const tight: string[] = [];
    for (const task of TASKS) {
      for (const { id } of BOARD_CARS) {
        const size = sizeOf(id);
        const start = taskStart(task, size);
        const shift = frameShift(
          carCorners(start, size.length, size.width),
          FRAME_ROOM - 0.01,
        );
        if (shift.x !== 0 || shift.z !== 0) tight.push(`${task.id} ${id}`);
      }
    }
    expect(tight).toEqual([]);
  });

  it("a start moves up the road only as far as the vehicle needs", () => {
    // The first drive starts a car's middle 62 m down the road from the
    // roundabout, 2.3 m in from the frame.
    const car = taskStart(FIRST_DRIVE);
    const lorry = taskStart(FIRST_DRIVE, sizeOf("lorry"));
    expect(car.x).toBeCloseTo(lorry.x, 6);
    expect(car.z).toBeGreaterThan(61.4);
    expect(car.z).toBeLessThan(62);
    expect(lorry.z).toBeCloseTo(BOUNDS.z1 - FRAME_ROOM - 3, 1);
  });

  it("a lorry on the first drive stands still and touches nothing", () => {
    const size = sizeOf("lorry");
    const state = { ...taskStart(FIRST_DRIVE, size), speed: 0, steer: 0 };
    const from = { x: state.x, z: state.z };
    const physics = createPhysics(FIRST_DRIVE, state, "lorry");
    const touched: Contact[] = [];
    for (let i = 0; i < 30; i += 1) {
      physicsStep(physics, state, { steer: 0, throttle: 0, brake: 0 });
      touched.push(...physics.contacts);
    }
    expect(touched).toEqual([]);
    expect(Math.hypot(state.x - from.x, state.z - from.z)).toBeLessThan(0.01);
  });

  it("stops a car driven at it, without the car going in", () => {
    // Road ends at the frame (the east side has a kerb before it), driven at
    // head on and at an angle, with the wheel straight and turned.
    const ends = [
      { x: -12, z: BOUNDS.z1 - 10, heading: 180 * DEG },
      { x: -12, z: BOUNDS.z0 + 10, heading: 0 },
      { x: BOUNDS.x0 + 10, z: -4, heading: 270 * DEG },
      { x: 69.35, z: BOUNDS.z0 + 10, heading: 0 },
      { x: 69.35, z: BOUNDS.z1 - 10, heading: 180 * DEG },
    ];
    for (const id of ["saloon", "lorry"] as const) {
      const size = sizeOf(id);
      for (const end of ends) {
        expect(onTarmac(end.x, end.z)).toBe(true);
        for (const tilt of [0, 25 * DEG, -60 * DEG]) {
          for (const steer of [0, 1, -1]) {
            const state = {
              x: end.x,
              z: end.z,
              heading: end.heading + tilt,
              speed: 0,
              steer: 0,
            };
            const physics = createPhysics(FIRST_DRIVE, state, id);
            let worst = 0;
            let hit = false;
            for (let i = 0; i < 60 * 5; i += 1) {
              physicsStep(physics, state, { steer, throttle: 1, brake: 0 });
              hit ||= physics.contacts.includes("end");
              worst = Math.max(
                worst,
                intoFrame(state, size.length, size.width),
              );
            }
            if (tilt === 0 && steer === 0) expect(hit).toBe(true);
            expect(worst).toBeLessThan(0.005);
          }
        }
      }
    }
  });
});
