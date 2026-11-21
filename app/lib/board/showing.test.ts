/**
 * The opening turn round the car (showcase.ts) plays before the learner
 * drives: while it plays the car waits, stick or no stick, and the clock has
 * not started.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useBoardStore } from "../board-store";
import { car, hasMoved, loadPhysics, setShowing, stick, tick } from "./runtime";
import { WARMUP_LEVEL_ID } from "./warmup";

function hold(x: number, y: number, seconds: number) {
  for (let i = 0; i < seconds * 60; i += 1) {
    stick.x = x;
    stick.y = y;
    tick(1 / 60);
  }
}

beforeAll(() => loadPhysics());
beforeEach(() => {
  useBoardStore.getState().exit();
  useBoardStore.getState().resetProgress();
});
afterEach(() => setShowing(false));

describe("the opening turn round the car", () => {
  it("holds the car still, stick or no stick, and the clock with it", () => {
    useBoardStore.getState().startLevel(WARMUP_LEVEL_ID);
    const from = { x: car.x, z: car.z };
    setShowing(true);
    hold(0, -1, 2);
    expect(car.x).toBe(from.x);
    expect(car.z).toBe(from.z);
    expect(hasMoved()).toBe(false);
  });

  it("lets the car go once it ends", () => {
    useBoardStore.getState().startLevel(WARMUP_LEVEL_ID);
    const from = car.z;
    setShowing(true);
    hold(0, -1, 1);
    setShowing(false);
    hold(0, -1, 1);
    expect(car.z).not.toBe(from);
    expect(hasMoved()).toBe(true);
  });
});
