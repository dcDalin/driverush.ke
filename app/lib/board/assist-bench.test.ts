/**
 * A bench, not a test: imperfect thumbs drive every driving level, many
 * times, and it reports how often they pass and how often lane assist
 * surprised them. Run it with `BENCH=1 npx vitest run assist-bench`; the
 * normal test run skips it.
 *
 * A learner's thumb is modelled as: aiming a little way on along the route
 * (how far varies), seen a moment late (a reaction delay), wandering a few
 * degrees, sometimes moved in jerks rather than smoothly, pushed part of the
 * way. Each run draws its own thumb from a seeded random number.
 *
 * Surprises counted:
 * - grabs and lets go: lane assist taking the car or giving it back, which the
 *   learner feels as the car suddenly following something else;
 * - fights: the car turning hard one way while the thumb points clearly the
 *   other way;
 * - ignored: the thumb pointing well off the car's way for a while, and the
 *   car not turning toward it.
 *
 * Three kinds of thumb: "kind" (steady), "rough" (late, wandering, jerky) and
 * "coarse" (aiming 20 m or more ahead, beside the route, in 15 degree steps;
 * it does not line up with the lane network the assist follows).
 *
 * Settings, all optional: SEEDS (thumbs per level, 8), KINDS ("kind,rough,
 * coarse"), ONLY (level ids), ASSIST=0 (assist off), BENCH_OUT (a file to
 * append the JSON report to), TRACE=1 with FAULTS and TAIL (the last samples
 * of the runs that ended in those faults, with what the assist was doing).
 *
 * 2026-11-21, every driving level, 16 thumbs of each kind, pass rate:
 * old assist 97.8 / 73.6 / 18.5 %, path assist (`rails.ts`) 97.0 / 94.0 /
 * 79.6 %, assist off 83.2 / 66.0 / 11.1 %.
 *
 * 2026-11-22, the thumb steering with the assist only steadying it (no lane
 * changes or exits made for it): 100 / 94.3 / 44.8 %, assist off 84.2 /
 * 68.8 / 11.1 %. Coarse thumbs lost most: aiming 20 m or more ahead, a lane
 * change is a few degrees, which the help steadies away, so they reach the
 * roundabout in the wrong lane; and they point across the reserve at a gap.
 * The path assist made those changes for them, which is what learners said
 * felt like the car steering itself.
 */
import { appendFileSync } from "node:fs";

import { beforeAll, beforeEach, describe, it } from "vitest";

import { useBoardStore } from "../board-store";
import { ALL_LEVELS } from "./curriculum";
import { bearingOf, wrapPi } from "./geometry";
import { locate } from "./geometry";
import { challengeRoute } from "./lessons";
import {
  assistState,
  car,
  drive,
  loadPhysics,
  stick,
  tick,
  view,
} from "./runtime";

const STEP = 1 / 60;
const DEG = Math.PI / 180;
const RUN = process.env.BENCH === "1";
const SEEDS = Number(process.env.SEEDS ?? 8);
const OUT = process.env.BENCH_OUT;
const TRACE = process.env.TRACE === "1";

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export type Thumb = {
  /** Aims this far beside the route, metres: at a lane, not its middle. */
  beside?: number;
  /** Moves the knob in steps of this, radians: a thumb on glass is not exact. */
  notch?: number;
  look: number;
  delay: number;
  wander: number;
  jerk: number;
  push: number;
};

export type Kind = "kind" | "rough" | "coarse";

export function drawThumb(seed: number, level: Kind): Thumb {
  const r = rng(seed * 7919 + 13);
  r();
  if (level === "coarse") {
    return {
      look: 18 + r() * 10,
      delay: 0.15 + r() * 0.25,
      wander: (6 + r() * 6) * DEG,
      jerk: r() * 0.4,
      push: 0.55 + r() * 0.45,
      beside: (r() - 0.5) * 3,
      notch: 15 * DEG,
    };
  }
  const rough = level === "rough";
  return {
    look: 5 + r() * (rough ? 10 : 6),
    delay: 0.1 + r() * (rough ? 0.3 : 0.15),
    wander: (rough ? 4 + r() * 10 : 2 + r() * 4) * DEG,
    jerk: rough ? r() * 0.6 : r() * 0.2,
    push: 0.55 + r() * 0.45,
  };
}

export type RunResult = {
  level: string;
  seed: number;
  result: string;
  smalls: number;
  seconds: number;
  grabs: number;
  fightSec: number;
  ignoredSec: number;
  end?: string;
  trace?: string[];
};

export function driveWith(id: string, thumb: Thumb, seed: number): RunResult {
  const r = rng(seed * 104729 + 7);
  useBoardStore.getState().startLevel(id);
  const first = useBoardStore.getState();
  const route = challengeRoute(first.queue[first.pos]);
  const out: RunResult = {
    level: id,
    seed,
    result: "no route",
    smalls: 0,
    seconds: 0,
    grabs: 0,
    fightSec: 0,
    ignoredSec: 0,
  };
  if (!route) return out;
  const reverse = (d: number) =>
    route.steps.some((s) => s.gear === "reverse" && d >= s.from && d < s.to);
  const stops = route.steps
    .filter((s) => s.control === "stop")
    .map((s) => s.from);
  const points: { x: number; z: number; d: number; back: boolean }[] = [
    { ...route.points[0], d: 0, back: reverse(0) },
  ];
  for (let k = 1; k < route.points.length; k += 1) {
    const a = route.points[k - 1];
    const b = route.points[k];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5));
    for (let j = 1; j <= n; j += 1) {
      const d = route.at[k - 1] + ((route.at[k] - route.at[k - 1]) * j) / n;
      points.push({
        x: a.x + ((b.x - a.x) * j) / n,
        z: a.z + ((b.z - a.z) * j) / n,
        d,
        back: reverse(d),
      });
    }
  }
  const stopped = new Set<number>();
  const trace: string[] = [];
  let at = 0;
  // what the thumb sees, `delay` late
  const seen: number[] = [];
  const lag = Math.max(1, Math.round(thumb.delay / STEP));
  let wander = 0;
  let held: number | null = null;
  let heldFor = 0;
  let holding = view.hold > 0.5;
  let since = 0;
  let off = 0;
  let offFor = 0;
  let turnedToward = 0;
  let still = 0;
  let stuck = false;
  for (let i = 0; i < 240 * 60; i += 1) {
    if (useBoardStore.getState().phase !== "driving") break;
    let gap = Infinity;
    for (let k = at; k < Math.min(points.length, at + 60); k += 1) {
      const d = Math.hypot(points[k].x - car.x, points[k].z - car.z);
      if (d < gap) {
        gap = d;
        at = k;
      }
    }
    const back = points[at].back;
    let aim = at;
    let run = 0;
    const look = back ? 2.5 : thumb.look;
    while (
      aim < points.length - 1 &&
      run < look &&
      points[aim + 1].back === back
    ) {
      run += Math.hypot(
        points[aim + 1].x - points[aim].x,
        points[aim + 1].z - points[aim].z,
      );
      aim += 1;
    }
    if (aim === at) aim = Math.min(points.length - 1, at + 4);
    let rest = points[points.length - 1].d - points[at].d < 1.5 && gap < 2;
    for (const line of stops) {
      if (stopped.has(line)) continue;
      const ahead = line - points[at].d;
      if (ahead < 2.2 && ahead > -1) {
        rest = true;
        if (Math.abs(car.speed) < 0.05) stopped.add(line);
      }
    }
    // aiming beside the route: to its left (positive) or right
    let ax = points[aim].x;
    let az = points[aim].z;
    if (thumb.beside && aim > 0) {
      const p = points[aim - 1];
      const dx = ax - p.x;
      const dz = az - p.z;
      const len = Math.hypot(dx, dz) || 1;
      // left of the way along is (dz, -dx) in these axes
      ax += (dz / len) * thumb.beside;
      az += (-dx / len) * thumb.beside;
    }
    const want = bearingOf(ax - car.x, az - car.z);
    seen.push(want);
    const late = seen.length > lag ? seen[seen.length - 1 - lag] : seen[0];
    // a slow random wander, about `wander` across
    wander += (-wander * 1.5 + (r() - 0.5) * 2 * thumb.wander * 4) * STEP;
    let knob = late + wander;
    if (thumb.notch) knob = Math.round(knob / thumb.notch) * thumb.notch;
    // a jerky thumb is moved now and then, and held still between
    if (thumb.jerk > 0) {
      heldFor += STEP;
      if (held == null || heldFor >= thumb.jerk) {
        held = knob;
        heldFor = 0;
      }
      knob = held;
    }
    const push = back ? Math.max(thumb.push, 0.7) : thumb.push;
    stick.x = rest ? 0 : Math.sin(knob) * push;
    stick.y = rest ? 0 : -Math.cos(knob) * push;
    tick(STEP);
    if (TRACE && i % 6 === 0) {
      const a = assistState();
      const loc = locate(car.x, car.z);
      const where =
        loc.kind === "ring"
          ? `ring${loc.lane} b${((loc.bearing * 180) / Math.PI).toFixed(0)}`
          : loc.kind === "arm"
            ? `${loc.arm}${loc.side === "approach" ? "in" : "out"}${loc.lane}@${loc.along.toFixed(0)}`
            : loc.kind;
      trace.push(
        `${out.seconds.toFixed(1)} ${where} h${((car.heading * 180) / Math.PI).toFixed(0)} knob${((knob * 180) / Math.PI).toFixed(0)} want${((want * 180) / Math.PI).toFixed(0)} hold${a.hold.toFixed(0)} ${a.rails.changing ? "CHG" : ""} e=${a.rails.edge} plan=${a.rails.plan.slice(1, 3).join(",")} v${car.speed.toFixed(1)}`,
      );
      if (trace.length > 600) trace.shift();
    }

    // surprises
    if (!rest && !back) {
      const now = view.hold > 0.5;
      since += STEP;
      if (now !== holding && since > 0.25) {
        out.grabs += 1;
        since = 0;
      }
      holding = now;
      off = wrapPi(knob - car.heading);
      if (Math.abs(off) > 15 * DEG && Math.abs(car.steer) > 0.3) {
        if (Math.sign(car.steer) !== Math.sign(off)) out.fightSec += STEP;
      }
      if (Math.abs(off) > 25 * DEG && car.speed > 1) {
        offFor += STEP;
        if (
          Math.sign(car.steer) === Math.sign(off) &&
          Math.abs(car.steer) > 0.15
        ) {
          turnedToward += STEP;
        }
        if (offFor > 0.4 && turnedToward < 0.1) out.ignoredSec += STEP;
      } else {
        offFor = 0;
        turnedToward = 0;
      }
    } else {
      offFor = 0;
      turnedToward = 0;
    }
    out.seconds += STEP;
    still = !rest && Math.abs(car.speed) < 0.05 ? still + STEP : 0;
    if (still > 8) {
      stuck = true;
      break;
    }
  }
  const after = useBoardStore.getState();
  out.result = stuck
    ? "stuck"
    : after.phase === "fault"
      ? (after.fault?.id ?? "fault")
      : after.phase;
  out.smalls = after.faults;
  out.trace = trace;
  out.end = `${car.x.toFixed(1)},${car.z.toFixed(1)} h${((car.heading * 180) / Math.PI).toFixed(0)} v${car.speed.toFixed(1)} at ${points[at].d.toFixed(0)}/${route.length.toFixed(0)}`;
  return out;
}

const levels = ALL_LEVELS.filter(
  (level) => level.kind === "drive" || level.kind === "warmup",
)
  .map((level) => level.id)
  .filter(
    (id) => !process.env.ONLY || process.env.ONLY.split(",").includes(id),
  );

describe.runIf(RUN)("assist bench", () => {
  beforeAll(() => loadPhysics());
  beforeEach(() => {
    useBoardStore.getState().exit();
    useBoardStore.getState().resetProgress();
    drive.seat = "south";
    drive.assist = process.env.ASSIST !== "0";
  });

  const kinds = (process.env.KINDS ?? "kind,rough,coarse").split(",") as Kind[];
  for (const kind of kinds) {
    it(`${kind} thumbs`, { timeout: 30 * 60 * 1000 }, () => {
      const rows: RunResult[] = [];
      for (const id of levels) {
        for (let seed = 1; seed <= SEEDS; seed += 1) {
          useBoardStore.getState().exit();
          useBoardStore.getState().resetProgress();
          rows.push(driveWith(id, drawThumb(seed, kind), seed));
        }
      }
      const pass = rows.filter((row) => row.result === "passed");
      const minutes = rows.reduce((s, row) => s + row.seconds, 0) / 60;
      const sum = (f: (row: RunResult) => number) =>
        rows.reduce((s, row) => s + f(row), 0);
      const faults: Record<string, number> = {};
      for (const row of rows) {
        if (row.result !== "passed") {
          faults[row.result] = (faults[row.result] ?? 0) + 1;
        }
      }
      const perLevel: Record<string, number> = {};
      for (const row of rows) {
        if (row.result !== "passed") {
          perLevel[row.level] = (perLevel[row.level] ?? 0) + 1;
        }
      }
      const stuck = rows
        .filter((row) => row.result === "driving" || row.result === "stuck")
        .slice(0, 12)
        .map((row) => `${row.level}#${row.seed} ${row.end}`);
      const traces = TRACE
        ? Object.fromEntries(
            (
              process.env.FAULTS ??
              "roundabout_lane_change,exit_lane,wrong_exit,u_turn_lane,collision,wrong_lane"
            )
              .split(",")
              .map((id) => [
                id,
                rows
                  .filter((row) => row.result === id)
                  .slice(0, 2)
                  .map((row) => [
                    `${row.level}#${row.seed}`,
                    ...(row.trace ?? []).slice(-Number(process.env.TAIL ?? 30)),
                  ]),
              ]),
          )
        : undefined;
      const report = {
        traces,
        stuck,
        kind,
        assist: drive.assist,
        runs: rows.length,
        passRate: +(pass.length / rows.length).toFixed(3),
        smallsPerRun: +(sum((row) => row.smalls) / rows.length).toFixed(2),
        grabsPerMin: +(sum((row) => row.grabs) / minutes).toFixed(2),
        fightSecPerMin: +(sum((row) => row.fightSec) / minutes).toFixed(2),
        ignoredSecPerMin: +(sum((row) => row.ignoredSec) / minutes).toFixed(2),
        faults,
        failsByLevel: perLevel,
      };
      const text = JSON.stringify(report);
      if (OUT) {
        appendFileSync(OUT, `${text}\n`);
      } else {
        console.log(text);
      }
    });
  }
});
