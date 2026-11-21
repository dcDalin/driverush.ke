/**
 * The saloon's wrap template (scripts/build-car-wrap.mjs): every triangle of
 * its bodywork sits wholly inside one view of the template, so a school's
 * paint never smears across two views.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import {
  EXTMeshoptCompression,
  KHRMeshQuantization,
} from "@gltf-transform/extensions";
import { dequantize } from "@gltf-transform/functions";
import { MeshoptDecoder } from "meshoptimizer";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const layout = JSON.parse(
  readFileSync(
    path.join(ROOT, "public/assets/board/sponsors/saloon-wrap.json"),
    "utf8",
  ),
) as {
  atlas: { width: number; height: number };
  views: Record<string, { x: number; y: number; w: number; h: number }>;
};

async function paintUvs() {
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const doc = await io.read(
    path.join(ROOT, "public/assets/board/cars/saloon.glb"),
  );
  await doc.transform(dequantize());
  const paint = doc
    .getRoot()
    .listNodes()
    .find((n) => n.getName() === "paint");
  const prim = paint!.getMesh()!.listPrimitives()[0];
  return { prim, uv: prim.getAttribute("TEXCOORD_0") };
}

describe("the saloon's wrap template", () => {
  it("gives the bodywork UVs, each triangle inside one view", async () => {
    const { prim, uv } = await paintUvs();
    expect(uv).not.toBeNull();
    const idx = prim.getIndices();
    const count = idx ? idx.getCount() : uv!.getCount();
    const at = (i: number) => {
      const [u, v] = uv!.getElement(idx ? idx.getScalar(i) : i, []);
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
});
