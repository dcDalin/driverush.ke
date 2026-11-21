import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useBoardStore } from "../board-store";
import { locate } from "./geometry";
import { exitAhead } from "./joystick";
import { queueCars } from "./lane-queue";
import { car, drive, loadPhysics, stick, tick } from "./runtime";

function hold(x: number, y: number, until: () => boolean, most = 30) {
  for (let i = 0; i < most * 60 && !until(); i += 1) {
    stick.x = x;
    stick.y = y;
    tick(1 / 60);
    if (useBoardStore.getState().phase !== "driving") return;
  }
}

beforeAll(() => loadPhysics());
beforeEach(() => {
  useBoardStore.getState().exit();
  useBoardStore.getState().resetProgress();
  drive.seat = "south";
  drive.assist = true;
});

describe("lane assist out of the roundabout", () => {
  it("is on for a lesson car and off for a hard level", () => {
    useBoardStore.getState().startLevel("drive-three-lane-back");
    expect(drive.exitHold).toBe(false);
    useBoardStore.getState().exit();
    useBoardStore.getState().startLevel("four-lane");
    const left = queueCars("S").find((one) => one.lane === 1)!;
    useBoardStore.getState().pickCar(left.id);
    expect(drive.exitHold).toBe(true);
  });

  it("takes the lane 1 car left into lane 1 with a plain up, then left", () => {
    useBoardStore.getState().startLevel("four-lane");
    const cars = queueCars("S");
    const left = cars.find(
      (one) => one.lane === 1 && one.option.turn === "left",
    )!;
    useBoardStore.getState().pickCar(left.id);
    // up the road until the car is on the roundabout
    hold(0, -1, () => locate(car.x, car.z).kind === "ring");
    // then simply left, the way the exit road runs
    hold(-1, 0, () => {
      const at = locate(car.x, car.z);
      return at.kind === "arm" && at.arm === "W" && at.along > 37;
    });
    // let go: the car stops in the box
    hold(0, 0, () => useBoardStore.getState().lanes?.picked == null, 4);
    const after = useBoardStore.getState();
    expect(after.runFaultCount).toBe(0);
    expect(after.lanes?.rest[left.id]).toBeDefined();
    const at = locate(car.x, car.z);
    expect(at.kind === "arm" && at.side === "exit" && at.lane).toBe(1);
  });

  it("keeps an inner lane car in its own lane all the way out", () => {
    // Driving straight out of an inner ring lane crosses the outer ring lanes
    // on the way to the mouth. The lane it turns off into must not slip with
    // them, or the car is dragged across to lane 2 against the knob.
    const cars = queueCars("S");
    for (const one of cars.filter((c) => c.option.turn === "straight")) {
      useBoardStore.getState().exit();
      useBoardStore.getState().startLevel("four-lane");
      // the cars in front of it are home already, out of the way
      const ahead = cars.filter(
        (c) => c.lane === one.lane && c.slot < one.slot,
      );
      useBoardStore.setState((s) => ({
        lanes: {
          ...s.lanes!,
          rest: Object.fromEntries(
            ahead.map((c, k) => [
              c.id,
              { x: 500 + k * 10, z: 500, heading: 0 },
            ]),
          ),
        },
      }));
      useBoardStore.getState().pickCar(one.id);
      // nothing but up, the whole way
      hold(0, -1, () => {
        const at = locate(car.x, car.z);
        return at.kind === "arm" && at.arm === "N" && at.along > 38;
      });
      hold(0, 0, () => useBoardStore.getState().lanes?.picked == null, 4);
      const after = useBoardStore.getState();
      expect(after.fault, one.id).toBeNull();
      expect(after.lanes?.rest[one.id], one.id).toBeDefined();
      const at = locate(car.x, car.z);
      expect(at.kind === "arm" && at.side === "exit" && at.lane, one.id).toBe(
        one.lane,
      );
    }
  });

  it("asks for nothing while the knob lies along the ring", () => {
    // on the ring due south of the island, driving clockwise (west)
    const at = { x: 0, z: 14, heading: -Math.PI / 2, speed: 3, steer: 0 };
    expect(locate(at.x, at.z).kind).toBe("ring");
    // pointing east, back the way it came: no exit is ahead that way
    expect(exitAhead(at, Math.PI / 2)).toBeNull();
  });
});
