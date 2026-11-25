/**
 * Every board vehicle's wheels, as built (scripts/build-real-cars.mjs): each
 * one round about its axle, standing square and on the road, the same either
 * side of the car, and carrying its own radius for the board to roll it by.
 * A wheel that fails any of these wobbles, floats or sticks out on screen.
 */
import path from "node:path";

import { type Node, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { describe, expect, it } from "vitest";

import { BOARD_CARS } from "~/lib/board/cars";

const ROOT = process.cwd();
const SECTORS = 36;

type V3 = [number, number, number];

type Wheel = {
  name: string;
  axle: [number, number, number];
  /** Its radius as the build recorded it. */
  own: number;
  /** How far out its surface reaches in each direction about the axle. */
  reach: number[];
  lowest: number;
  /** The leftmost and rightmost it gets. */
  across: [number, number];
  /** How far its axle leans from the car's cross axis, in degrees. */
  lean: number;
};

async function wheelsOf(
  car: string,
): Promise<{ wheels: Wheel[]; body: [number, number] }> {
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const doc = await io.read(
    path.join(ROOT, `public/assets/board/cars/${car}.glb`),
  );
  const nodes = doc.getRoot().listNodes();
  const trianglesOf = (node: Node) => {
    const m = node.getWorldMatrix();
    const out: [V3, V3, V3][] = [];
    for (const prim of node.getMesh()!.listPrimitives()) {
      const at = prim.getAttribute("POSITION")!;
      const indices = prim.getIndices();
      const count = indices ? indices.getCount() : at.getCount();
      const point = (i: number) => {
        const v = at.getElement(
          indices ? indices.getScalar(i) : i,
          [] as number[],
        ) as V3;
        const p: V3 = [
          m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
          m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
          m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
        ];
        return p;
      };
      for (let i = 0; i < count; i += 3)
        out.push([point(i), point(i + 1), point(i + 2)]);
    }
    return out;
  };

  const paint = nodes.find((n) => n.getName() === "paint")!;
  const xs = trianglesOf(paint)
    .flat()
    .map((p) => p[0]);
  const body: [number, number] = [Math.min(...xs), Math.max(...xs)];

  const wheels = nodes
    .filter((n) => /^wheel_(f|r)(l|r)$/.test(n.getName()))
    .map((node): Wheel => {
      const m = node.getWorldMatrix();
      const axle: [number, number, number] = [m[12], m[13], m[14]];
      const tris = trianglesOf(node);
      const reach = new Array<number>(SECTORS).fill(0);
      let lowest = Infinity;
      const across: [number, number] = [Infinity, -Infinity];
      // By area, about the wheel's own middle: which way it is thinnest.
      const middle = [0, 0, 0];
      let whole = 0;
      const pieces: { at: number[]; area: number }[] = [];
      for (const tri of tris) {
        for (const p of tri) {
          lowest = Math.min(lowest, p[1]);
          across[0] = Math.min(across[0], p[0]);
          across[1] = Math.max(across[1], p[0]);
        }
        // Along its edges too: a tyre of few sides has few corners.
        for (let e = 0; e < 3; e += 1) {
          const a = tri[e]!;
          const b = tri[(e + 1) % 3]!;
          for (let s = 0; s <= 10; s += 1) {
            const y = a[1] + ((b[1] - a[1]) * s) / 10 - axle[1];
            const z = a[2] + ((b[2] - a[2]) * s) / 10 - axle[2];
            const k =
              Math.floor(
                ((Math.atan2(y, z) + Math.PI) / (2 * Math.PI)) * SECTORS,
              ) % SECTORS;
            reach[k] = Math.max(reach[k]!, Math.hypot(y, z));
          }
        }
        const [a, b, c] = tri;
        const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const w: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const area =
          Math.hypot(
            u[1] * w[2] - u[2] * w[1],
            u[2] * w[0] - u[0] * w[2],
            u[0] * w[1] - u[1] * w[0],
          ) / 2;
        const at = [0, 1, 2].map((k) => (a[k]! + b[k]! + c[k]!) / 3);
        pieces.push({ at, area });
        whole += area;
        for (let k = 0; k < 3; k += 1) middle[k]! += at[k]! * area;
      }
      for (let k = 0; k < 3; k += 1) middle[k]! /= whole;
      const cov = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];
      for (const { at, area } of pieces) {
        for (let i = 0; i < 3; i += 1) {
          for (let j = 0; j < 3; j += 1) {
            cov[i]![j]! +=
              (area * (at[i]! - middle[i]!) * (at[j]! - middle[j]!)) / whole;
          }
        }
      }
      const times = (q: number[][], x: number[]) =>
        q.map((row) => row[0]! * x[0]! + row[1]! * x[1]! + row[2]! * x[2]!);
      const unit = (x: number[]) => {
        const l = Math.hypot(...x);
        return x.map((k) => k / l);
      };
      const strongest = (q: number[][], start: number[]) => {
        let x = unit(start);
        for (let i = 0; i < 300; i += 1) x = unit(times(q, x));
        return x;
      };
      const v1 = strongest(cov, [0.1, 1, 0.3]);
      const l1 = times(cov, v1).reduce((sum, x, i) => sum + x * v1[i]!, 0);
      const rest = cov.map((row, i) =>
        row.map((x, j) => x - l1 * v1[i]! * v1[j]!),
      );
      const v2 = strongest(rest, [0.3, 0.2, 1]);
      const axis = unit([
        v1[1]! * v2[2]! - v1[2]! * v2[1]!,
        v1[2]! * v2[0]! - v1[0]! * v2[2]!,
        v1[0]! * v2[1]! - v1[1]! * v2[0]!,
      ]);
      const lean = (Math.acos(Math.min(1, Math.abs(axis[0]!))) * 180) / Math.PI;
      return {
        name: node.getName().slice(6),
        axle,
        own: Number((node.getExtras() as { radius?: number }).radius),
        reach,
        lowest,
        across,
        lean,
      };
    });
  return { wheels, body };
}

describe.each(BOARD_CARS.map((c) => c.id))("the %s's wheels", (car) => {
  it("are four, each true on its axle", async () => {
    const { wheels } = await wheelsOf(car);
    expect(wheels.map((w) => w.name).sort()).toEqual(["fl", "fr", "rl", "rr"]);
    for (const wheel of wheels) {
      const out = Math.max(...wheel.reach);
      const inn = Math.min(...wheel.reach);
      // Round: a tyre of few sides dips a little between its corners.
      expect(out - inn, `${wheel.name} out of round`).toBeLessThan(
        Math.max(0.006, out * 0.05),
      );
      // Square: a leaning wheel wobbles as it turns.
      expect(wheel.lean, `${wheel.name} leans`).toBeLessThan(0.5);
      // The radius it is rolled by is the one it has.
      expect(Math.abs(wheel.own - out), `${wheel.name} radius`).toBeLessThan(
        0.01,
      );
    }
  });

  it("stand on the road", async () => {
    const { wheels } = await wheelsOf(car);
    for (const wheel of wheels) {
      expect(Math.abs(wheel.lowest), `${wheel.name} off the road`).toBeLessThan(
        0.01,
      );
      expect(
        Math.abs(wheel.axle[1] - wheel.own),
        `${wheel.name} axle height`,
      ).toBeLessThan(0.01);
    }
  });

  it("are the same either side of the car, and inside its width", async () => {
    const { wheels, body } = await wheelsOf(car);
    const at = (name: string) => wheels.find((w) => w.name === name)!;
    // the bodywork is centred
    expect(Math.abs(body[0] + body[1])).toBeLessThan(0.01);
    for (const end of ["f", "r"]) {
      const left = at(`${end}l`);
      const right = at(`${end}r`);
      expect(
        Math.abs(left.axle[0] + right.axle[0]),
        `${end} axle off centre`,
      ).toBeLessThan(0.01);
      expect(
        Math.abs(left.axle[2] - right.axle[2]),
        `${end} axle askew`,
      ).toBeLessThan(0.01);
      expect(Math.abs(left.own - right.own), `${end} pair's size`).toBeLessThan(
        0.005,
      );
      expect(left.axle[0]).toBeLessThan(0);
      // a tyre may stand a little proud of the bodywork, never far
      expect(left.across[0], `${end}l sticks out`).toBeGreaterThan(
        body[0] - 0.04,
      );
      expect(right.across[1], `${end}r sticks out`).toBeLessThan(
        body[1] + 0.04,
      );
    }
    // the front axle is ahead of the rear one
    expect(at("fl").axle[2]).toBeLessThan(at("rl").axle[2]);
  });
});
