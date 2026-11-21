/**
 * Lane assist helps, the joystick decides. A thumb that wobbles about the way
 * of its lane is held in it; a thumb that keeps pushing somewhere else gets
 * the car, on the road and on the roundabout, whatever the lines say (the
 * referee judges that, not the assist).
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import type { TurnChallenge } from "./challenges";
import {
  ARMS,
  SOLID_ZONE,
  armForTurn,
  bearingOf,
  laneBearing,
  laneOffset,
  locate,
  wrapPi,
  type ArmId,
  type Turn,
} from "./geometry";
import type { Fault } from "./referee";
import {
  beginChallenge,
  car,
  drive,
  loadPhysics,
  stick,
  stopDriving,
  tick,
  view,
} from "./runtime";

const STEP = 1 / 60;
const DEG = Math.PI / 180;

function task(
  arm: ArmId,
  lane: number,
  along: number,
  turn: Turn = "straight",
): TurnChallenge {
  return {
    id: `assist:${arm}${lane}:${along}`,
    title: "Test",
    prompt: "Test",
    start: { arm, lane, along },
    turn,
    goal: { arm: armForTurn(arm, turn), alongMin: 33, alongMax: 44 },
    otherCars: [],
  };
}

type Sample = {
  t: number;
  x: number;
  z: number;
  heading: number;
  /** How firmly lane assist held the lane, 0 to 1. */
  hold: number;
};

/**
 * Drive with the knob given by `knob(t)` as a world bearing (null: let go),
 * pushed `push` of the way, for `seconds`. Returns every step, and any fault.
 */
function run(
  challenge: TurnChallenge,
  knob: (t: number) => number | null,
  seconds: number,
  push = 0.8,
): { samples: Sample[]; fault?: Fault } {
  let fault: Fault | undefined;
  let over = false;
  beginChallenge(challenge, {
    onFault: (f) => {
      fault = f;
      over = true;
    },
    onSmall: () => {},
    onDeviation: () => {},
    onGoal: () => {
      over = true;
    },
  });
  const samples: Sample[] = [];
  for (let i = 0; i < seconds / STEP && !over; i += 1) {
    const t = i * STEP;
    const k = knob(t);
    stick.x = k == null ? 0 : Math.sin(k) * push;
    stick.y = k == null ? 0 : -Math.cos(k) * push;
    tick(STEP);
    samples.push({
      t,
      x: car.x,
      z: car.z,
      heading: car.heading,
      hold: view.hold,
    });
  }
  stopDriving();
  stick.x = 0;
  stick.y = 0;
  return { samples, fault };
}

/** A shaky thumb: a wobble of `amp` degrees at `hz`, plus a little jitter. */
function shaky(amp: number, hz: number, seed = 1) {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647 - 0.5;
  };
  return (t: number) =>
    (amp * Math.sin(2 * Math.PI * hz * t) + 6 * rand()) * DEG;
}

/** How far the car is to the side of the middle of an approach lane, metres. */
function offLane(arm: ArmId, lane: number, s: Sample): number {
  const a = ARMS[arm];
  const inward = { x: -a.out.z, z: a.out.x };
  // the approach side is to the left of the way in
  const lat = -(s.x * inward.x + s.z * inward.z);
  return Math.abs(Math.abs(lat) - laneOffset(a, lane));
}

beforeAll(() => loadPhysics());
afterEach(() => {
  drive.assist = true;
});

describe("a wobbling thumb is held in its lane", () => {
  for (const amp of [15, 25, 35]) {
    for (const hz of [1, 2, 3]) {
      it(`on the road, ±${amp}° at ${hz} Hz`, () => {
        drive.assist = true;
        const runs = laneBearing("S", "approach");
        const wobble = shaky(amp, hz, amp * 10 + hz);
        const { samples, fault } = run(
          task("S", 2, 60),
          (t) => runs + wobble(t),
          3.2,
        );
        expect(fault).toBeUndefined();
        const worst = Math.max(...samples.map((s) => offLane("S", 2, s)));
        expect(worst, `strayed ${worst.toFixed(2)} m`).toBeLessThan(1.2);
      });
    }
  }

  it("round the roundabout, ±25° at 2 Hz, in its ring lane", () => {
    drive.assist = true;
    const wobble = shaky(25, 2, 7);
    // up lane 2, then along the ring the way it runs where the car is
    const { fault, samples } = run(
      task("S", 2, 50),
      (t) => {
        const r = Math.hypot(car.x, car.z);
        const along =
          r < 22.4
            ? bearingOf(car.x, car.z) + Math.PI / 2
            : laneBearing("S", "approach");
        return along + wobble(t);
      },
      12,
    );
    expect(fault?.id).not.toBe("roundabout_lane_change");
    expect(samples.some((s) => Math.hypot(s.x, s.z) < 22.4)).toBe(true);
  });
});

/** How far up its approach the car is, metres from the middle. */
const alongS = () => car.z;

/**
 * The first time, after `from` seconds, that the car is a lane's width off the
 * middle of the lane it started in.
 */
function leftLaneAfter(
  arm: ArmId,
  lane: number,
  samples: Sample[],
  from = 0,
): number | null {
  const hit = samples.find((s) => s.t >= from && offLane(arm, lane, s) > 1.8);
  return hit ? hit.t - from : null;
}

/** Up lane 2 from 60 m, pushing `angle` once the car is closer in than `at`. */
function pushFrom(angle: number, at: number) {
  const runs = laneBearing("S", "approach");
  let pushedAt: number | null = null;
  const result = run(
    task("S", 2, 60),
    (t) => {
      if (pushedAt == null && alongS() < at) pushedAt = t;
      return pushedAt == null ? runs : runs + angle * DEG;
    },
    11,
  );
  return { ...result, pushedAt };
}

describe("a thumb that keeps pushing gets the car", () => {
  for (const angle of [25, 30]) {
    it(`changes lane where the lines are broken, pushing ${angle}°`, () => {
      drive.assist = true;
      const { samples, pushedAt } = pushFrom(angle, 55);
      expect(pushedAt).not.toBeNull();
      const after = leftLaneAfter("S", 2, samples, pushedAt!);
      expect(after, "never changed lane").not.toBeNull();
      expect(after!).toBeLessThan(2);
    });
  }

  // A sloppy thumb 20 to 25 degrees off is held at the continuous lines;
  // only a push past the lane's cone takes the car across them.
  for (const angle of [40, 50]) {
    it(`leaves its lane at the continuous lines, pushing ${angle}°`, () => {
      const times: (number | null)[] = [];
      for (const assist of [false, true]) {
        drive.assist = assist;
        const { samples, pushedAt } = pushFrom(angle, SOLID_ZONE - 1);
        expect(pushedAt).not.toBeNull();
        times.push(leftLaneAfter("S", 2, samples, pushedAt!));
      }
      const [off, on] = times;
      expect(off, "assist off never left the lane").not.toBeNull();
      expect(on, `assist on never left the lane (off: ${off})`).not.toBeNull();
      // no more than a moment behind a car with assist off: the push has to
      // be told from a shake, so a gentle push takes a little longer
      expect(on! - off!).toBeLessThan(0.6);
    });
  }

  it("lets go of the roundabout when the knob points out", () => {
    drive.assist = true;
    let onRingAt: number | null = null;
    const { samples, fault } = run(
      task("S", 2, 50),
      (t) => {
        const r = Math.hypot(car.x, car.z);
        if (r < 20 && onRingAt == null) onRingAt = t;
        const tangent = bearingOf(car.x, car.z) + Math.PI / 2;
        if (onRingAt != null && t > onRingAt + 0.8) {
          // out: turned back 35° from the way the ring runs
          return tangent - 35 * DEG;
        }
        return r < 22.4 ? tangent : laneBearing("S", "approach");
      },
      12,
    );
    expect(onRingAt).not.toBeNull();
    const pushedAt = onRingAt! + 0.8;
    // the assist lets go within a moment of the push
    const freed = samples.find((s) => s.t > pushedAt && s.hold === 0);
    expect(freed, "the ring was never let go").toBeDefined();
    expect(freed!.t - pushedAt).toBeLessThan(0.6);
    // and the car goes out across the ring, or is stopped for doing so
    const at = samples.find((s) => s.t >= pushedAt)!;
    const out = samples.find(
      (s) =>
        s.t > pushedAt && Math.hypot(s.x, s.z) > Math.hypot(at.x, at.z) + 2,
    );
    expect(out ?? fault?.id === "roundabout_lane_change").toBeTruthy();
  });

  it("lets go of the road at the continuous lines within a moment", () => {
    drive.assist = true;
    const { samples, pushedAt } = pushFrom(40, SOLID_ZONE - 1);
    const freed = samples.find((s) => s.t > pushedAt! && s.hold === 0);
    expect(freed, "the lane was never let go").toBeDefined();
    expect(freed!.t - pushedAt!).toBeLessThan(0.6);
  });

  it("never hovers between lanes under a steady 40° push", () => {
    drive.assist = true;
    const { samples, pushedAt } = pushFrom(40, SOLID_ZONE - 1);
    // between lanes: 0.9 to 2.7 m off the middle of lane 2
    let longest = 0;
    let span = 0;
    for (const s of samples) {
      if (s.t < (pushedAt ?? 0)) continue;
      const off = offLane("S", 2, s);
      span = off > 0.9 && off < 2.7 ? span + STEP : 0;
      longest = Math.max(longest, span);
    }
    expect(longest).toBeLessThan(1);
  });
});

describe("a sloppy thumb is not a push", () => {
  for (const angle of [20, 25]) {
    it(`keeps its lane at the continuous lines, leaning ${angle}°`, () => {
      drive.assist = true;
      const { samples, pushedAt, fault } = pushFrom(angle, SOLID_ZONE - 1);
      expect(pushedAt).not.toBeNull();
      expect(fault?.id).not.toBe("solid_line");
      // up to the roundabout's edge, where the approach ends
      const after = samples.filter((s) => s.t >= pushedAt! && s.z > 23);
      const worst = Math.max(...after.map((s) => offLane("S", 2, s)));
      expect(worst, `strayed ${worst.toFixed(2)} m`).toBeLessThan(1.2);
    });
  }

  it("keeps its ring lane with a thumb lagging behind the bend", () => {
    drive.assist = true;
    const wobble = shaky(15, 1.5, 11);
    // the thumb turns with the ring, but behind it and a little wide, so it
    // points outward of the lane all the way round
    let knob: number | null = null;
    let held = 0;
    let onRing = 0;
    const { fault, samples } = run(
      task("S", 2, 50),
      (t) => {
        const r = Math.hypot(car.x, car.z);
        const want =
          r < 22.4
            ? bearingOf(car.x, car.z) + Math.PI / 2
            : laneBearing("S", "approach");
        knob = knob == null ? want : knob + wrapPi(want - knob) * (STEP / 0.4);
        if (r < 22.4) {
          held += view.hold;
          onRing += 1;
        }
        return knob - 10 * DEG + wobble(t);
      },
      12,
    );
    expect(fault?.id).not.toBe("roundabout_lane_change");
    expect(samples.some((s) => Math.hypot(s.x, s.z) < 22.4)).toBe(true);
    expect(held / onRing).toBeGreaterThan(0.9);
  });
});

describe("the car still goes where it is pointed", () => {
  it("follows a heading with assist on as closely as with it off", () => {
    // pointing 40° off the lane toward the kerb, where there is no lane to
    // move into: well past any hold, so the thumb has the car
    const runs = laneBearing("S", "approach");
    const ends: number[] = [];
    for (const assist of [false, true]) {
      drive.assist = assist;
      const { samples } = run(task("S", 1, 60), () => runs - 40 * DEG, 1.5);
      const last = samples[samples.length - 1];
      ends.push(Math.abs(wrapPi(last.heading - (runs - 40 * DEG))));
    }
    expect(ends[1]).toBeLessThan(ends[0] + 5 * DEG);
  });
});

describe("a firm push toward the lane beside", () => {
  // Learners stuck in a blocked lane pushed hard toward the next one and the
  // car stayed put: a hard push held a moment was taken for aiming at a
  // roundabout exit, and a short one handed over a car pointing across the
  // road, then pulled it back in when the thumb straightened up.
  const runs = laneBearing("S", "approach");
  const laneAt = () => {
    const at = locate(car.x, car.z);
    return at.kind === "arm" ? at.lane : null;
  };

  for (const angle of [45, 60, 90]) {
    for (const hold of [0.5, 1]) {
      it(`moves over a lane for a ${angle}° push held ${hold} s`, () => {
        drive.assist = true;
        // from lane 4, toward lane 3 on the left, then straight on
        const { samples, fault } = run(
          task("S", 4, 58),
          (t) => (t > 0.8 && t < 0.8 + hold ? runs - angle * DEG : runs),
          4,
          0.7,
        );
        expect(fault).toBeUndefined();
        expect(laneAt()).toBe(3);
        // the assist did it: the thumb never had a car pointing across
        expect(samples.every((s) => s.hold > 0)).toBe(true);
      });
    }
  }

  it("moves over to the right the same way", () => {
    drive.assist = true;
    run(
      task("S", 2, 58),
      (t) => (t > 0.8 && t < 1.4 ? runs + 90 * DEG : runs),
      4,
      0.7,
    );
    expect(laneAt()).toBe(3);
  });

  it("makes one change, then the thumb has the car if it keeps pushing", () => {
    drive.assist = true;
    // held hard all the way: one lane over, then the thumb steers
    const { samples } = run(
      task("S", 4, 58),
      (t) => (t > 0.8 ? runs - 60 * DEG : runs),
      4.5,
      0.7,
    );
    expect(samples.some((s) => s.hold === 0)).toBe(true);
    // and it was in lane 3 when the thumb took it, not still crossing
    const first = samples.findIndex((s) => s.hold === 0);
    const at = locate(samples[first].x, samples[first].z);
    expect(at.kind === "arm" && at.lane).toBe(3);
  });
});

describe("where the car is", () => {
  it("starts on the approach it was put on", () => {
    run(task("S", 2, 60), () => null, 0.1);
    const at = locate(car.x, car.z);
    expect(at.kind === "arm" && at.arm === "S" && at.lane).toBe(2);
  });
});
