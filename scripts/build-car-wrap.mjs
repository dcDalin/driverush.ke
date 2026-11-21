/**
 * Gives the saloon's bodywork a wrap template, so a driving school's paint
 * job can be put on it, and draws that template for the school's designer.
 *
 * Car-wrap shops work from a flat "vehicle template": the car's left side,
 * right side, top, front and back, all at one scale. This does the same. Each
 * triangle of the saloon's `paint` node is laid onto the view it faces most,
 * every view at SCALE pixels per metre, so nothing is stretched. Both sides
 * are drawn the way you see them standing beside the car, so lettering reads
 * normally on each.
 *
 * Writes:
 *   public/assets/board/cars/saloon.glb                 the same car, with UVs
 *   public/assets/board/sponsors/saloon-wrap.json       where each view sits
 *   public/assets/board/sponsors/saloon-template.svg    the template to draw on
 *
 * Run after scripts/build-board-cars.mjs (which writes the car without UVs):
 *   node scripts/build-car-wrap.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import {
  EXTMeshoptCompression,
  KHRMeshQuantization,
} from "@gltf-transform/extensions";
import {
  dequantize,
  meshopt,
  quantize,
  unweld,
  weld,
} from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

const ROOT = process.cwd();
const CAR = path.join(ROOT, "public/assets/board/cars/saloon.glb");
const OUT = path.join(ROOT, "public/assets/board/sponsors");

/** The template picture, in pixels. Schools draw at this size. */
const ATLAS = { width: 2048, height: 1024 };
/** Pixels per metre in every view. */
const SCALE = 230;
/** Room between views, so a view's edge never bleeds into its neighbour. */
const PAD = 24;

// ---- read the car -------------------------------------------------------------

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });
const doc = await io.read(CAR);
await doc.transform(dequantize());

const nodes = doc.getRoot().listNodes();
const node = (name) => {
  const found = nodes.find((n) => n.getName() === name);
  if (!found) throw new Error(`saloon.glb has no "${name}" node`);
  return found;
};

/** A node's triangles in the car's frame (metres, nose down -z). */
function trianglesOf(n) {
  const prim = n.getMesh().listPrimitives()[0];
  const pos = prim.getAttribute("POSITION");
  const t = n.getTranslation();
  const s = n.getScale();
  const at = (i) => {
    const p = pos.getElement(i, []);
    return [t[0] + p[0] * s[0], t[1] + p[1] * s[1], t[2] + p[2] * s[2]];
  };
  const idx = prim.getIndices();
  const corner = (i) => (idx ? idx.getScalar(i) : i);
  const corners = idx ? idx.getCount() : pos.getCount();
  const tris = [];
  for (let i = 0; i < corners; i += 3) {
    tris.push([at(corner(i)), at(corner(i + 1)), at(corner(i + 2))]);
  }
  return tris;
}

const paintNode = node("paint");
// One vertex per triangle corner, so each triangle can take its own view.
await doc.transform(unweld());
const paintTris = trianglesOf(paintNode);
const bodyTris = trianglesOf(node("body"));

const box = {
  min: [Infinity, Infinity, Infinity],
  max: [-Infinity, -Infinity, -Infinity],
};
for (const tri of paintTris) {
  for (const p of tri) {
    for (let k = 0; k < 3; k++) {
      box.min[k] = Math.min(box.min[k], p[k]);
      box.max[k] = Math.max(box.max[k], p[k]);
    }
  }
}
const [xmin, ymin, zmin] = box.min;
const [xmax, ymax, zmax] = box.max;
const L = zmax - zmin;
const W = xmax - xmin;
const H = ymax - ymin;

// ---- the views ----------------------------------------------------------------

const px = (m) => Math.round(m * SCALE);
const views = {
  left: { x: PAD, y: PAD, w: px(L), h: px(H) },
  right: { x: PAD, y: 2 * PAD + px(H), w: px(L), h: px(H) },
  front: { x: PAD, y: 3 * PAD + 2 * px(H), w: px(W), h: px(H) },
  back: { x: 2 * PAD + px(W), y: 3 * PAD + 2 * px(H), w: px(W), h: px(H) },
  top: { x: 2 * PAD + px(L), y: PAD, w: px(L), h: px(W) },
  bottom: { x: 2 * PAD + px(L), y: 2 * PAD + px(W), w: px(L), h: px(W) },
};
for (const [name, v] of Object.entries(views)) {
  if (v.x + v.w > ATLAS.width - PAD / 2 || v.y + v.h > ATLAS.height - PAD / 2) {
    throw new Error(`the ${name} view does not fit the template; lower SCALE`);
  }
}

/** Which view a triangle faces most. */
function viewOf([a, b, c]) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const [ax, ay, az] = n.map(Math.abs);
  if (ay >= ax && ay >= az) return n[1] > 0 ? "top" : "bottom";
  if (ax >= az) return n[0] > 0 ? "right" : "left";
  return n[2] > 0 ? "back" : "front";
}

/**
 * Where a point of the car lands in a view, in template pixels. The driver's
 * right is +x; the nose is -z.
 */
function place(view, [x, y, z]) {
  const v = views[view];
  const s = SCALE;
  switch (view) {
    // Standing at the car's left, the nose is on your left.
    case "left":
      return [v.x + (z - zmin) * s, v.y + (ymax - y) * s];
    // Standing at its right, the nose is on your right.
    case "right":
      return [v.x + (zmax - z) * s, v.y + (ymax - y) * s];
    // From above, nose to the right, the car's left side at the top.
    case "top":
      return [v.x + (zmax - z) * s, v.y + (x - xmin) * s];
    case "bottom":
      return [v.x + (zmax - z) * s, v.y + (xmax - x) * s];
    // Facing the nose, the car's right is on your left.
    case "front":
      return [v.x + (xmax - x) * s, v.y + (ymax - y) * s];
    case "back":
      return [v.x + (x - xmin) * s, v.y + (ymax - y) * s];
  }
  throw new Error(view);
}

// ---- UVs on the paint ---------------------------------------------------------

const prim = paintNode.getMesh().listPrimitives()[0];
const count = prim.getAttribute("POSITION").getCount();
const uv = new Float32Array(count * 2);
const paintIdx = prim.getIndices();
const laid = { left: [], right: [], top: [], bottom: [], front: [], back: [] };
paintTris.forEach((tri, t) => {
  const view = viewOf(tri);
  const flat = tri.map((p) => place(view, p));
  laid[view].push(flat);
  flat.forEach(([x, y], k) => {
    const i = paintIdx ? paintIdx.getScalar(t * 3 + k) : t * 3 + k;
    uv[i * 2] = x / ATLAS.width;
    uv[i * 2 + 1] = y / ATLAS.height;
  });
});
prim.setAttribute(
  "TEXCOORD_0",
  doc
    .createAccessor("uv")
    .setType("VEC2")
    .setArray(uv)
    .setBuffer(doc.getRoot().listBuffers()[0]),
);

await doc.transform(
  weld(),
  quantize({ quantizePosition: 14, quantizeColor: 8, quantizeTexcoord: 14 }),
  meshopt({ encoder: MeshoptEncoder, level: "high" }),
);
await io.write(CAR, doc);

// ---- the layout, for the app and the art scripts ------------------------------

mkdirSync(OUT, { recursive: true });
const layout = {
  note: "Written by scripts/build-car-wrap.mjs. Pixels in the saloon's wrap template.",
  atlas: ATLAS,
  scale: SCALE,
  car: {
    length: +L.toFixed(3),
    width: +W.toFixed(3),
    height: +H.toFixed(3),
    min: box.min.map((n) => +n.toFixed(3)),
    max: box.max.map((n) => +n.toFixed(3)),
  },
  views,
};
writeFileSync(
  path.join(OUT, "saloon-wrap.json"),
  `${JSON.stringify(layout, null, 2)}\n`,
);

// ---- the template for designers -----------------------------------------------

const poly = (pts, attrs) =>
  `<polygon points="${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}" ${attrs}/>`;

/** Body parts that are not paint (glass, lamps, trim), for context in a view. */
const bodyIn = (view) =>
  bodyTris
    .filter((tri) => viewOf(tri) === view)
    .map((tri) =>
      poly(
        tri.map((p) => place(view, p)),
        'fill="#c9d3dc"',
      ),
    )
    .join("");

/** The part of the side between the wheel arches and under the windows. */
function doorBox(view) {
  const front = place(view, [0, 0.82, -0.62]);
  const rear = place(view, [0, 0.46, 0.92]);
  const x = Math.min(front[0], rear[0]);
  return {
    x,
    y: front[1],
    w: Math.abs(rear[0] - front[0]),
    h: rear[1] - front[1],
  };
}
function roofBox() {
  const a = place("top", [xmin + 0.22, 0, -0.55]);
  const b = place("top", [xmax - 0.22, 0, 0.75]);
  return {
    x: Math.min(a[0], b[0]),
    y: a[1],
    w: Math.abs(b[0] - a[0]),
    h: b[1] - a[1],
  };
}
const safe = (r, label) =>
  `<rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${r.w.toFixed(1)}" height="${r.h.toFixed(1)}" fill="none" stroke="#0a8f3c" stroke-width="3" stroke-dasharray="14 8"/>` +
  `<text x="${(r.x + 8).toFixed(1)}" y="${(r.y + 22).toFixed(1)}" font-size="18" fill="#0a8f3c">${label}</text>`;

const names = {
  left: "LEFT SIDE (driver's left, nose on the left)",
  right: "RIGHT SIDE (driver's right, nose on the right)",
  top: "TOP: bonnet, roof, boot (nose on the right)",
  bottom: "UNDERSIDE (not seen)",
  front: "FRONT",
  back: "BACK",
};
const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${ATLAS.width}" height="${ATLAS.height}" viewBox="0 0 ${ATLAS.width} ${ATLAS.height}" font-family="Helvetica, Arial, sans-serif">`,
  `<!-- DriveRush.ke saloon wrap template. Draw the school's paint in each view, at this size, and save as a PNG or SVG with the same size. White = paintwork; blue-grey = glass, lamps and trim (not painted). Keep lettering inside the green boxes. -->`,
  `<rect width="100%" height="100%" fill="#eeeeee"/>`,
  ...Object.entries(views).map(([name, v]) =>
    [
      `<g id="${name}">`,
      `<rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" fill="#f9f9f9" stroke="#999" stroke-width="2" stroke-dasharray="6 6"/>`,
      `<g id="${name}-paint">${laid[name].map((t) => poly(t, 'fill="#ffffff" stroke="#b0b0b0" stroke-width="0.6"')).join("")}</g>`,
      `<g id="${name}-body">${bodyIn(name)}</g>`,
      `<text x="${v.x + 6}" y="${v.y + v.h + 18}" font-size="16" fill="#555">${names[name]}</text>`,
      `</g>`,
    ].join(""),
  ),
  safe(doorBox("left"), "name and lettering"),
  safe(doorBox("right"), "name and lettering"),
  safe(roofBox(), "roof: the part learners read"),
  `</svg>`,
].join("\n");
writeFileSync(path.join(OUT, "saloon-template.svg"), `${svg}\n`);

const counts = Object.fromEntries(
  Object.entries(laid).map(([k, v]) => [k, v.length]),
);
console.log("saloon wrap:", {
  size: `${L.toFixed(2)} x ${W.toFixed(2)} x ${H.toFixed(2)} m`,
  triangles: counts,
});
