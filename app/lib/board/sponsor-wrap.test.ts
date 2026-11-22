/**
 * The board cars' wrap templates (scripts/build-car-wrap.mjs): every triangle
 * of each car's bodywork sits wholly inside one view of its template, so a
 * school's paint never smears across two views, and the landmarks designs are
 * placed by make sense on each car.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize } from "@gltf-transform/functions";
import { MeshoptDecoder } from "meshoptimizer";
import { describe, expect, it } from "vitest";

import { BOARD_CARS, isBig } from "~/lib/board/cars";

const ROOT = process.cwd();

type Layout = {
  atlas: { width: number; height: number };
  views: Record<string, { x: number; y: number; w: number; h: number }>;
  box: { min: number[]; max: number[] };
  landmarks: {
    wheels: { front: { z: number; r: number }; rear: { z: number; r: number } };
    sill: number;
    belt: number;
    screen: { front: number; rear: number };
    door: { z0: number; z1: number; y0: number; y1: number };
  };
};
const layoutOf = (car: string): Layout =>
  JSON.parse(
    readFileSync(
      path.join(ROOT, `public/assets/board/sponsors/${car}-wrap.json`),
      "utf8",
    ),
  );

async function paintOf(car: string) {
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const doc = await io.read(
    path.join(ROOT, `public/assets/board/cars/${car}.glb`),
  );
  await doc.transform(dequantize());
  const paint = doc
    .getRoot()
    .listNodes()
    .find((n) => n.getName() === "paint");
  return paint!.getMesh()!.listPrimitives()[0];
}

describe.each(BOARD_CARS.map((c) => c.id))("the %s's wrap template", (car) => {
  const layout = layoutOf(car);

  it("gives the bodywork UVs, each triangle inside one view", async () => {
    const prim = await paintOf(car);
    const uv = prim.getAttribute("TEXCOORD_0");
    expect(uv).not.toBeNull();
    const idx = prim.getIndices();
    const count = idx ? idx.getCount() : uv!.getCount();
    const at = (i: number) => {
      const [u, v] = uv!.getElement(idx ? idx.getScalar(i) : i, [0, 0]);
      return [u * layout.atlas.width, v * layout.atlas.height];
    };
    const slack = 1.5; // pixels, for the stored UVs' rounding
    const views = Object.values(layout.views);
    let outside = 0;
    for (let t = 0; t < count; t += 3) {
      const corners = [at(t), at(t + 1), at(t + 2)];
      const home = views.some((r) =>
        corners.every(
          ([x, y]) =>
            x >= r.x - slack &&
            x <= r.x + r.w + slack &&
            y >= r.y - slack &&
            y <= r.y + r.h + slack,
        ),
      );
      if (!home) outside += 1;
    }
    expect(outside).toBe(0);
  });

  it("has landmarks a design can rely on", () => {
    const L = layout.landmarks;
    const [, ymin, zmin] = layout.box.min;
    const [, ymax, zmax] = layout.box.max;
    // the window line sits between the sill and the roof
    expect(L.sill).toBeGreaterThanOrEqual(ymin);
    expect(L.belt).toBeGreaterThan(L.sill + 0.3);
    expect(L.belt).toBeLessThan(ymax);
    // the front wheel is nearer the nose, both inside the car
    expect(L.wheels.front.z).toBeLessThan(L.wheels.rear.z);
    expect(L.wheels.front.z).toBeGreaterThan(zmin);
    expect(L.wheels.rear.z).toBeLessThan(zmax);
    // the windscreen is behind the front wheel, but for a van or a lorry,
    // whose driver sits over it
    const cabOver = isBig(car);
    if (!cabOver) expect(L.screen.front).toBeGreaterThan(L.wheels.front.z);
    // the doors' clear band: between the arches, tall enough for a name. On
    // a lorry it is the side of the load body, which runs past the rear wheel.
    expect(L.door.z0).toBeGreaterThan(L.wheels.front.z);
    if (car !== "lorry") expect(L.door.z1).toBeLessThan(L.wheels.rear.z);
    expect(L.door.z1).toBeLessThan(zmax);
    expect(L.door.y0).toBeGreaterThanOrEqual(L.sill);
    expect(L.door.y1).toBeLessThanOrEqual(L.belt);
    expect(L.door.y1 - L.door.y0).toBeGreaterThan(0.2);
  });
});
