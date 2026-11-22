import { describe, expect, it } from "vitest";

import { CAR } from "./car";
import {
  BOARD_CARS,
  SMALL_CARS,
  carsBeside,
  isBig,
  modelBeside,
  parkedModel,
  resolveCar,
  sizeOf,
} from "./cars";
import { BOARD_CHALLENGES } from "./challenges";
import { taskUsesAngleBay } from "./lessons";

describe("board cars", () => {
  it("gives the car the learner chose, whatever the roll", () => {
    for (const car of BOARD_CARS) {
      expect(resolveCar(car.id, 0)).toBe(car.id);
      expect(resolveCar(car.id, 0.99)).toBe(car.id);
    }
  });

  it("spreads a random choice over every car", () => {
    const seen = new Set(
      BOARD_CARS.map((_, i) => (i + 0.5) / BOARD_CARS.length).map((roll) =>
        resolveCar("random", roll),
      ),
    );
    expect(seen.size).toBe(BOARD_CARS.length);
    expect(resolveCar(undefined, 0)).toBe(BOARD_CARS[0].id);
  });

  it("survives a roll at the edges and a setting it does not know", () => {
    expect(resolveCar("random", 1)).toBe(BOARD_CARS[BOARD_CARS.length - 1].id);
    expect(resolveCar("tractor" as never, 0)).toBe(BOARD_CARS[0].id);
  });

  it("lists the cars beside the one driven", () => {
    expect(carsBeside("suv")).toEqual([
      "saloon",
      "hatchback",
      "wagon",
      "pickup",
      "van",
      "lorry",
      "minibus",
    ]);
  });

  it("knows every vehicle's size, and a car's for one it does not know", () => {
    for (const car of BOARD_CARS) {
      const size = sizeOf(car.id);
      expect(size.length).toBeGreaterThanOrEqual(CAR.length);
      expect(size.wheelbase).toBeLessThan(size.length);
      // too long for an angle bay means longer than a car
      if (isBig(car.id)) expect(size.length).toBeGreaterThan(CAR.length);
    }
    expect(sizeOf("nothing" as never).length).toBe(CAR.length);
  });

  it("stands only small cars where a task does not name the vehicle", () => {
    for (const car of BOARD_CARS) {
      for (let i = 0; i < 12; i += 1) {
        const beside = modelBeside(car.id, undefined, i);
        expect(SMALL_CARS).toContain(beside);
        expect(beside).not.toBe(car.id);
        // an angle bay never takes a long vehicle
        expect(SMALL_CARS).toContain(parkedModel(i));
      }
    }
    expect(modelBeside("saloon", "pickup", 3)).toBe("pickup");
  });

  it("knows the tasks that use an angle parking bay", () => {
    const uses = BOARD_CHALLENGES.filter(taskUsesAngleBay).map((t) => t.id);
    expect(uses).toContain("park-angle");
    expect(uses).toContain("leave-angle");
    expect(uses).not.toContain("straight");
    expect(uses.some((id) => id.includes("flush"))).toBe(false);
  });
});
