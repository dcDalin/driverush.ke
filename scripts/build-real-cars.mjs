/**
 * Builds the Model Town Board's realistic cars from free models downloaded
 * from Sketchfab (who made each one, and its licence: docs/asset-rights.md).
 *
 * Each model is cut down to what the board needs and written as a small GLB
 * in public/assets/board/cars, in the board's car frame: metres, nose down
 * -z, wheels standing on y = 0, origin at the middle of the body, scaled to
 * the same footprint as every other board car.
 *
 * Each GLB holds these nodes, the same as the older low-poly cars
 * (scripts/build-board-cars.mjs) plus `glass`:
 *   body      everything that keeps the model's own look (one part per material)
 *   paint     the bodywork, plain white, so the board can tint it or wear a
 *             driving school's paint (UVs come from build-car-wrap.mjs)
 *   glass     the windows
 *   tail      the rear lamps, so the board can make them glow
 *   wheel_fl, wheel_fr, wheel_rl, wheel_rr   each centred on its axle
 * and `extras` on the root: { wheelRadius, smooth: true }. `smooth` tells the
 * board to keep the model's materials and shade it smoothly.
 *
 * The downloads are not in the repository. Put each in its own folder:
 *   ~/Downloads/board-cars/<car>/<file>.glb
 *
 * Run:      node scripts/build-real-cars.mjs [--from <dir>] [car ...]
 * Look:     node scripts/build-real-cars.mjs --inspect [car ...]
 *           lists each model's parts and draws its side and top, by part
 *           and by what this script makes of it, in marketing/cars-inspect/
 *           (never committed).
 * Then:     node scripts/build-car-wrap.mjs   (the wrap templates and UVs)
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import {
  ALL_EXTENSIONS,
  EXTMeshoptCompression,
  EXTTextureWebP,
  KHRMeshQuantization,
} from "@gltf-transform/extensions";
import {
  meshopt,
  prune,
  quantize,
  simplifyPrimitive,
  textureCompress,
  weldPrimitive,
} from "@gltf-transform/functions";
import {
  MeshoptDecoder,
  MeshoptEncoder,
  MeshoptSimplifier,
} from "meshoptimizer";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public", "assets", "board", "cars");

/** The footprint every car is scaled to fit, so the driving rules stay put. */
const FIT = { length: 4.3, width: 1.85 };
/** The most a car may weigh once built, before its wrap UVs are added. */
const BUDGET_KB = 250;
/** Textures are shrunk to at most this many pixels a side. */
const TEXTURE_SIZE = 512;

/**
 * Each car: its file, which way its nose points once Sketchfab's own turn is
 * applied, and what each of its parts is. A part is named
 * "<node name>|<material name>"; the first rule whose pattern matches it
 * decides. Anything unmatched keeps its own look as `body`.
 *
 *   drop    left out (the cabin's insides, number plates, the model's ground)
 *   paint   bodywork that takes the board's paint
 *   glass   windows
 *   tail    rear lamps
 *   wheel   tyres, rims and brakes; split into four by which corner they sit at
 */
/** The Probox's tyres and rims share materials with its bodywork and lamps. */
const proboxWheel = ([x, y, z]) =>
  Math.abs(x + 0.945) > 0.55 &&
  y < 0.66 &&
  (Math.hypot(y - 0.31, z - 0.72) < 0.34 ||
    Math.hypot(y - 0.31, z - 3.29) < 0.34);

/** The Hilux's tyres and rims share materials with its flares and bumpers (cm). */
const hiluxWheel = ([x, y, z]) =>
  Math.abs(x + 77) > 45 &&
  y < 82 &&
  (Math.hypot(y - 44, z + 2) < 34.5 || Math.hypot(y - 44, z - 287) < 34.5);

/** The lorry's axles: front and rear, by how far along the model they sit. */
const lorryAxle = ([, , z]) =>
  Math.abs(z + 2.005) < 0.34 || Math.abs(z - 1.19) < 0.34;

const CARS = {
  // 2014 Toyota Corolla E180 by Armored Wave, CC BY 4.0.
  saloon: {
    dir: "saloon",
    nose: "+z",
    rules: [
      [/^Cube\.00[23]_/, "drop"], // number plates
      [/^corolla_e180_(interior|furniture|dashboard|steering_wheel)/, "drop"],
      [/^corolla_e180_body_(fabric_high|car_plastic_grainy_gray)_/, "drop"],
      [/^corolla_e180_wheels_/, "wheel"],
      [/^corolla_e180_windows_/, "glass"],
      [/^corolla_e180_body_main_paint/, "paint"],
      [/^corolla_e180_body_Material\.005_/, "tail"],
    ],
  },
  // 2016 Nissan Note by snowcappedandescrash, Sketchfab Free Standard. It
  // comes without wheels, so it wears the saloon's.
  hatchback: {
    dir: "hatchback",
    nose: "-z",
    rules: [
      [/\|Paint0011Mtl$/, "paint"],
      // One black for the windows and the wheel-arch liners.
      [/\|Black0011Mtl$/, "glass", ([, y]) => y > 0.3],
      // One picture for the head and tail lamps.
      [/\|Plane0101Mtl$/, "tail", ([, , z]) => z > 0],
    ],
    simplifyError: 0.01,
    triangles: 16000,
    wheelsFrom: "saloon",
    arches: [
      /\|Black0011Mtl$/,
      ([x, y]) => y < 0.3 && y > -1.0 && Math.abs(x) > 1.2,
    ],
  },
  // Toyota Probox by mamont nikita (tnikita), CC BY 4.0. A SketchUp model with
  // its engine and cabin modelled: only the outside is kept.
  wagon: {
    dir: "wagon",
    nose: "+z",
    rules: [
      [/\|(material_4|light1|wheel1)$/, "wheel", proboxWheel],
      // Its light-grey skin is the paint; the dark grey is the panels'
      // inward-facing backs, the tyres and the plastic trim.
      [/\|body1$/, "paint"],
      [/\|Translucent_Glass_Gray$/, "glass"],
      [/\|tail1$/, "tail"],
      [
        /\|(light1|Turn_Signal_Reflector|Color_C01|material_4|window1)$/,
        "body",
      ],
      [/./, "drop"],
    ],
  },
  // Toyota Hilux by David_Holiday, CC BY 4.0.
  pickup: {
    dir: "pickup",
    nose: "+x",
    rules: [
      [/\|material_(0|5|9)_16$/, "wheel", hiluxWheel],
      [/\|material_8_16$/, "paint"],
      [/\|material_6_16$/, "glass"],
      [/\|material_7_16$/, "tail"],
    ],
  },
  // Urban '10 by Daniel Zhabotinsky, CC BY 4.0: a generic compact SUV.
  suv: {
    dir: "suv",
    nose: "+x",
    // Five picture sheets (lamps, underside, tyres, badges): smaller ones.
    textureSize: 256,
    rules: [
      [/^Urban10_(Interior|Steering_Wheel|Numberplate)/, "drop"],
      [/^Urban10_WheelStock/, "wheel"],
      [
        /^Urban10_(Glass_Rear|Body_Glass|Windshield|Glass_Passenger|Glass_Driver)_/,
        "glass",
      ],
      [/^Urban10_Brakelights_/, "tail"],
      [/\|Urban10_bodymat$/, "paint"],
    ],
  },
  // Low Poly 2013 Toyota HiAce by Alvin.Woodly, CC BY 4.0. True to size: a
  // van is longer and narrower than the cars (owner, 2026-11-22).
  van: {
    dir: "van",
    nose: "+z",
    // The model's own size: 4.74 m long, 1.84 m across the body (2.29 m
    // across the mirrors, which is what `width` has to let through).
    fit: { length: 4.74, width: 2.29 },
    rules: [
      [/^(front|rear) (left|right) wheel/, "wheel"],
      [/\|base$/, "paint"],
      [/\|(window|glass|glass_with_squares)$/, "glass"],
      [/\|(brake_lights|tail_light_glass)$/, "tail"],
    ],
  },
  // Isuzu truck by igbalabdrahmane, CC BY 4.0: a light lorry with a box body.
  // True to size.
  lorry: {
    dir: "lorry",
    nose: "+z",
    fit: { length: 6.0, width: 1.95 },
    rules: [
      // A drawing-office model: its parts are told apart by their materials.
      // The tyres share a rubber with the mudguards, the rear rims a chrome
      // with the mirrors and trim: only what sits at an axle is a wheel.
      [/\|Mold-Tech-14153_1$/, "wheel", lorryAxle],
      [/\|Chrome_bright$/, "wheel"],
      [
        /\|Chrome_bright_2$/,
        "wheel",
        ([, y, z]) => y < 0.6 && lorryAxle([0, y, z]),
      ],
      // The cab, the canvas cover and the drop sides under it all take paint:
      // the cover's sides are where a school's name goes.
      [
        /\|(Bombay_Blue_741795|Paint_-_metallic_blue|Paint_-_metallic_jet_black)$/,
        "paint",
      ],
      [/\|Glass_basic_white$/, "glass"],
      [/\|Default_1[12]$/, "tail"],
      [/\|(PL1_0|Pl2_0|Default_9|Default_10|Targa_[01])$/, "drop"], // plates
    ],
  },
};

// ---- arguments --------------------------------------------------------------

const argv = process.argv.slice(2);
const INSPECT = argv.includes("--inspect");
const fromAt = argv.indexOf("--from");
const FROM =
  fromAt >= 0
    ? argv[fromAt + 1]
    : path.join(os.homedir(), "Downloads", "board-cars");
const wanted = argv.filter(
  (a, i) => !a.startsWith("--") && !(fromAt >= 0 && i === fromAt + 1),
);
const IDS = wanted.length ? wanted : Object.keys(CARS);
for (const id of IDS) {
  if (!CARS[id])
    throw new Error(`No car "${id}". Cars: ${Object.keys(CARS).join(", ")}`);
}

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });

// ---- reading a model ----------------------------------------------------------

/** The one .glb in a car's folder (searched one level down too). */
function sourceFile(dir) {
  const base = path.join(FROM, dir);
  if (!existsSync(base))
    throw new Error(`Missing ${base}: download the model first`);
  const found = [];
  for (const name of readdirSync(base)) {
    const full = path.join(base, name);
    if (statSync(full).isDirectory()) {
      for (const inner of readdirSync(full)) {
        if (inner.endsWith(".glb")) found.push(path.join(full, inner));
      }
    } else if (name.endsWith(".glb")) found.push(full);
  }
  if (found.length !== 1) {
    throw new Error(`${base}: expected one .glb, found ${found.length}`);
  }
  return found[0];
}

function multiply(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/** The inverse transpose of a matrix's 3 x 3 part, for turning normals. */
function normalMatrix(m) {
  const [a, b, c, d, e, f, g, h, i] = [
    m[0],
    m[1],
    m[2],
    m[4],
    m[5],
    m[6],
    m[8],
    m[9],
    m[10],
  ];
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    A / det,
    B / det,
    C / det,
    -(b * i - c * h) / det,
    (a * i - c * g) / det,
    -(a * h - b * g) / det,
    (b * f - c * e) / det,
    -(a * f - c * d) / det,
    (a * e - b * d) / det,
  ];
}

const normalize = ([x, y, z]) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

/**
 * Every primitive of the model as a part: its triangles in the scene's frame
 * (Sketchfab's turn applied), with normals, UVs and its material.
 */
async function readParts(file) {
  const doc = await io.read(file);
  const parts = [];
  for (const scene of doc.getRoot().listScenes()) {
    scene.traverse((node) => {
      const mesh = node.getMesh();
      if (!mesh) return;
      const m = node.getWorldMatrix();
      const nm = normalMatrix(m);
      // A mirrored node turns its triangles inside out; turn them back.
      const flip =
        m[0] * (m[5] * m[10] - m[6] * m[9]) -
          m[4] * (m[1] * m[10] - m[2] * m[9]) +
          m[8] * (m[1] * m[6] - m[2] * m[5]) <
        0;
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMode() !== 4) continue;
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        const nor = prim.getAttribute("NORMAL");
        const uv = prim.getAttribute("TEXCOORD_0");
        const idx = prim.getIndices();
        const count = idx ? idx.getCount() : pos.getCount();
        const material = prim.getMaterial();
        const p = [];
        const n = [];
        const t = [];
        const corner = (k) => (idx ? idx.getScalar(k) : k);
        for (let k = 0; k < count; k += 3) {
          const order = flip ? [0, 2, 1] : [0, 1, 2];
          for (const o of order) {
            const v = corner(k + o);
            p.push(multiply(m, pos.getElement(v, [])));
            if (nor) {
              const [x, y, z] = nor.getElement(v, []);
              n.push(
                normalize([
                  nm[0] * x + nm[3] * y + nm[6] * z,
                  nm[1] * x + nm[4] * y + nm[7] * z,
                  nm[2] * x + nm[5] * y + nm[8] * z,
                ]),
              );
            }
            if (uv) t.push(uv.getElement(v, []));
          }
        }
        parts.push({
          node: node.getName(),
          materialName: material?.getName() ?? "",
          material,
          name: `${node.getName()}|${material?.getName() ?? ""}`,
          positions: p,
          normals: nor ? n : null,
          uvs: uv ? t : null,
        });
      }
    });
  }
  return { doc, parts };
}

function boxOf(points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of points) {
    for (let k = 0; k < 3; k++) {
      if (p[k] < min[k]) min[k] = p[k];
      if (p[k] > max[k]) max[k] = p[k];
    }
  }
  return { min, max, size: max.map((v, k) => v - min[k]) };
}

/** Turns a point so the nose that pointed along `nose` points down -z. */
function turn(nose) {
  switch (nose) {
    case "-z":
      return ([x, y, z]) => [x, y, z];
    case "+z":
      return ([x, y, z]) => [-x, y, -z];
    // Quarter turns about the vertical, never mirrors.
    case "+x":
      return ([x, y, z]) => [z, y, -x];
    case "-x":
      return ([x, y, z]) => [-z, y, x];
  }
  throw new Error(`nose must be one of +z -z +x -x, not ${nose}`);
}

function classify(car, part) {
  for (const [pattern, as, test] of car.rules) {
    if (!test && pattern.test(part.name)) return as;
  }
  return "body";
}

/**
 * Splits a part by what each of its triangles is. A rule may carry a test of
 * the triangle's middle ([x, y, z] in the model's own units, nose down -z),
 * for models that use one material for very different things.
 */
function splitParts(car, part) {
  const rules = car.rules.filter(([pattern]) => pattern.test(part.name));
  if (!rules.some(([, , test]) => test)) {
    const as = rules[0]?.[1] ?? "body";
    return [{ ...part, as }];
  }
  const groups = new Map();
  const p = part.positions;
  for (let i = 0; i < p.length; i += 3) {
    const mid = [0, 1, 2].map((k) => (p[i][k] + p[i + 1][k] + p[i + 2][k]) / 3);
    const rule = rules.find(([, , test]) => !test || test(mid));
    const as = rule?.[1] ?? "body";
    const list = groups.get(as) ?? [];
    list.push(i);
    groups.set(as, list);
  }
  return [...groups.entries()].map(([as, starts]) => {
    const pick = (list) =>
      list && starts.flatMap((i) => [list[i], list[i + 1], list[i + 2]]);
    return {
      ...part,
      as,
      positions: pick(part.positions),
      normals: pick(part.normals),
      uvs: pick(part.uvs),
    };
  });
}

/** A material's colour, as a CSS colour. */
function cssColour(material) {
  const rgba = material?.getBaseColorFactor() ?? [1, 1, 1, 1];
  const hex = rgba
    .slice(0, 3)
    .map((c) =>
      Math.round(Math.pow(c, 1 / 2.2) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
  return `#${hex}`;
}

// ---- inspecting ---------------------------------------------------------------

const PALETTE = [
  "#e6194b",
  "#3cb44b",
  "#ffe119",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#46f0f0",
  "#f032e6",
  "#bcf60c",
  "#fabebe",
  "#008080",
  "#e6beff",
  "#9a6324",
  "#800000",
  "#aaffc3",
  "#808000",
  "#000075",
  "#808080",
  "#ffd8b1",
  "#000000",
];
const CLASS_COLOURS = {
  paint: "#f0f0f0",
  body: "#555555",
  glass: "#4aa3df",
  tail: "#e02020",
  wheel: "#222222",
  drop: "#ff00ff",
};

/** A side and a top view of the parts, as a PNG: by part, or by class. */
async function drawViews(parts, colourOf, file, title) {
  const all = parts.flatMap((p) => p.positions);
  const box = boxOf(all);
  const W = 900;
  const s = W / Math.max(box.size[2], box.size[0]);
  const sideH = box.size[1] * s;
  const topH = box.size[0] * s;
  const H = sideH + topH + 60;
  const polys = { side: [], top: [] };
  for (const part of parts) {
    const fill = colourOf(part);
    const pts = part.positions;
    for (let i = 0; i < pts.length; i += 3) {
      const tri = [pts[i], pts[i + 1], pts[i + 2]];
      // Side: looking at the car's left (+x after turning, nose down -z on the left).
      const side = tri.map(([, y, z]) => [
        (z - box.min[2]) * s,
        30 + (box.max[1] - y) * s,
      ]);
      const top = tri.map(([x, , z]) => [
        (z - box.min[2]) * s,
        50 + sideH + (x - box.min[0]) * s,
      ]);
      const depthSide = -Math.min(...tri.map((p) => p[0]));
      const depthTop = Math.max(...tri.map((p) => p[1]));
      polys.side.push({ d: depthSide, pts: side, fill });
      polys.top.push({ d: depthTop, pts: top, fill });
    }
  }
  // Painter's order: far first.
  polys.side.sort((a, b) => b.d - a.d);
  polys.top.sort((a, b) => a.d - b.d);
  const poly = ({ pts, fill }) =>
    `<polygon points="${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}" fill="${fill}" stroke="${fill}" stroke-width="0.3"/>`;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Math.ceil(H)}">`,
    `<rect width="100%" height="100%" fill="#fff8e7"/>`,
    `<text x="8" y="20" font-size="16" font-family="Helvetica">${title}</text>`,
    ...polys.side.map(poly),
    ...polys.top.map(poly),
    `</svg>`,
  ].join("\n");
  await sharp(Buffer.from(svg)).png().toFile(file);
}

async function inspect(id, car) {
  const file = sourceFile(car.dir);
  const { parts } = await readParts(file);
  const t = turn(car.nose);
  for (const part of parts) part.positions = part.positions.map(t);
  const box = boxOf(parts.flatMap((p) => p.positions));
  console.log(`\n== ${id}  ${path.basename(file)}`);
  console.log(
    `size ${box.size.map((v) => v.toFixed(2)).join(" x ")} (x y z, nose -z), y from ${box.min[1].toFixed(2)}`,
  );
  const dir = path.join(ROOT, "marketing", "cars-inspect");
  mkdirSync(dir, { recursive: true });
  parts.forEach((part, i) => {
    const b = boxOf(part.positions);
    const tex = part.material?.getBaseColorTexture() ? " tex" : "";
    const rgba = part.material?.getBaseColorFactor() ?? [1, 1, 1, 1];
    const colour = `#${rgba
      .slice(0, 3)
      .map((c) =>
        Math.round(Math.pow(c, 1 / 2.2) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}${rgba[3] < 1 ? `/${rgba[3].toFixed(2)}` : ""}`;
    const as = classify(car, part);
    console.log(
      `  ${String(i).padStart(3)} ${PALETTE[i % PALETTE.length]} ${as.padEnd(5)} ${(part.positions.length / 3).toFixed(0).padStart(6)} tris${tex.padEnd(4)} ${colour.padEnd(12)}` +
        `  x ${b.min[0].toFixed(2)}..${b.max[0].toFixed(2)}  y ${b.min[1].toFixed(2)}..${b.max[1].toFixed(2)}  z ${b.min[2].toFixed(2)}..${b.max[2].toFixed(2)}  ${part.name}`,
    );
  });
  const index = new Map(parts.map((p, i) => [p, i]));
  await drawViews(
    parts,
    (p) => PALETTE[index.get(p) % PALETTE.length],
    path.join(dir, `${id}-parts.png`),
    `${id}: parts (colours as listed)`,
  );
  await drawViews(
    parts,
    (p) =>
      p.material?.getBaseColorTexture() ? "#c8a0ff" : cssColour(p.material),
    path.join(dir, `${id}-look.png`),
    `${id}: each part in its material's colour (lilac: has a picture)`,
  );
  await drawViews(
    parts.flatMap((p) => splitParts(car, p)).filter((p) => p.as !== "drop"),
    (p) => CLASS_COLOURS[p.as],
    path.join(dir, `${id}-classes.png`),
    `${id}: paint white, body grey, glass blue, tail red, wheels black`,
  );
}

// ---- building -------------------------------------------------------------------

/** Joins parts into one list of triangles each for position, normal and UV. */
function join(list) {
  return {
    positions: list.flatMap((p) => p.positions),
    normals: list.every((p) => p.normals)
      ? list.flatMap((p) => p.normals)
      : null,
    uvs: list.every((p) => p.uvs) ? list.flatMap((p) => p.uvs) : null,
  };
}

/**
 * Normals for a primitive with none: smooth across gentle bends, sharp where
 * two faces meet at more than `angle` degrees (a panel edge, a bumper lip).
 */
function creaseNormals(doc, buffer, prim, angle = 40) {
  const pos = prim.getAttribute("POSITION").getArray();
  const uvAttr = prim.getAttribute("TEXCOORD_0");
  const uv = uvAttr?.getArray();
  const idx = prim.getIndices().getArray();
  const faces = idx.length / 3;
  const faceNormal = new Float32Array(faces * 3);
  const p = (v, k) => pos[v * 3 + k];
  for (let f = 0; f < faces; f++) {
    const [a, b, c] = [idx[f * 3], idx[f * 3 + 1], idx[f * 3 + 2]];
    const u = [0, 1, 2].map((k) => p(b, k) - p(a, k));
    const w = [0, 1, 2].map((k) => p(c, k) - p(a, k));
    // Not normalised: bigger faces count for more.
    faceNormal[f * 3] = u[1] * w[2] - u[2] * w[1];
    faceNormal[f * 3 + 1] = u[2] * w[0] - u[0] * w[2];
    faceNormal[f * 3 + 2] = u[0] * w[1] - u[1] * w[0];
  }
  const key = (v) =>
    `${p(v, 0).toFixed(5)},${p(v, 1).toFixed(5)},${p(v, 2).toFixed(5)}`;
  const facesAt = new Map();
  for (let f = 0; f < faces; f++) {
    for (let k = 0; k < 3; k++) {
      const id = key(idx[f * 3 + k]);
      const list = facesAt.get(id) ?? [];
      list.push(f);
      facesAt.set(id, list);
    }
  }
  const unit = (f) => {
    const n = [faceNormal[f * 3], faceNormal[f * 3 + 1], faceNormal[f * 3 + 2]];
    const l = Math.hypot(...n) || 1;
    return n.map((c) => c / l);
  };
  const cos = Math.cos((angle * Math.PI) / 180);
  const corners = faces * 3;
  const outPos = new Float32Array(corners * 3);
  const outNor = new Float32Array(corners * 3);
  const outUv = uv ? new Float32Array(corners * 2) : null;
  for (let f = 0; f < faces; f++) {
    const mine = unit(f);
    for (let k = 0; k < 3; k++) {
      const v = idx[f * 3 + k];
      const c = f * 3 + k;
      const sum = [0, 0, 0];
      for (const g of facesAt.get(key(v))) {
        const n = unit(g);
        if (n[0] * mine[0] + n[1] * mine[1] + n[2] * mine[2] < cos) continue;
        for (let j = 0; j < 3; j++) sum[j] += faceNormal[g * 3 + j];
      }
      const l = Math.hypot(...sum) || 1;
      for (let j = 0; j < 3; j++) {
        outPos[c * 3 + j] = p(v, j);
        outNor[c * 3 + j] = sum[j] / l;
      }
      if (outUv) {
        outUv[c * 2] = uv[v * 2];
        outUv[c * 2 + 1] = uv[v * 2 + 1];
      }
    }
  }
  prim.getAttribute("POSITION").setArray(outPos);
  prim.setAttribute(
    "NORMAL",
    doc.createAccessor().setType("VEC3").setArray(outNor).setBuffer(buffer),
  );
  if (outUv) uvAttr.setArray(outUv);
  const index = new Uint32Array(corners);
  for (let i = 0; i < corners; i++) index[i] = i;
  prim.getIndices().setArray(index);
  weldPrimitive(prim);
}

async function build(id, car) {
  const file = sourceFile(car.dir);
  const { parts: all } = await readParts(file);
  const t = turn(car.nose);
  for (const part of all) {
    part.positions = part.positions.map(t);
    if (part.normals) part.normals = part.normals.map(t);
  }
  const parts = all
    .flatMap((p) => splitParts(car, p))
    .filter((p) => p.as !== "drop");
  if (car.wheelsFrom)
    parts.push(...(await borrowedWheels(id, car, all, parts)));
  const of = (as) => parts.filter((p) => p.as === as);
  for (const as of ["paint", "glass", "wheel"]) {
    if (!of(as).length && !(as === "wheel" && car.wheelsFrom)) {
      throw new Error(`${id}: no ${as} parts; check its rules`);
    }
  }
  for (const part of of("paint")) {
    if (part.material?.getBaseColorTexture()) {
      throw new Error(
        `${id}: the paint part "${part.name}" has a picture on it (a badge or decal?). Make it body, not paint.`,
      );
    }
  }

  // Centre, stand on the ground, scale to the footprint.
  const box = boxOf(parts.flatMap((p) => p.positions));
  const wheelParts = of("wheel");
  const ground = wheelParts.length
    ? boxOf(wheelParts.flatMap((p) => p.positions)).min[1]
    : box.min[1];
  const centre = [
    (box.min[0] + box.max[0]) / 2,
    ground,
    (box.min[2] + box.max[2]) / 2,
  ];
  // A car is scaled to the cars' shared footprint; a bigger vehicle to its
  // own real size (`fit`).
  const fit = car.fit ?? FIT;
  const scale = Math.min(fit.length / box.size[2], fit.width / box.size[0]);
  const place = ([x, y, z]) => [
    (x - centre[0]) * scale,
    (y - centre[1]) * scale,
    (z - centre[2]) * scale,
  ];
  for (const part of parts) part.positions = part.positions.map(place);

  // Wheels: every wheel triangle goes to the corner it sits at.
  const wheels = { fl: [], fr: [], rl: [], rr: [] };
  {
    for (const part of wheelParts) {
      const split = { fl: [], fr: [], rl: [], rr: [] };
      for (let i = 0; i < part.positions.length; i += 3) {
        const cx =
          (part.positions[i][0] +
            part.positions[i + 1][0] +
            part.positions[i + 2][0]) /
          3;
        const cz =
          (part.positions[i][2] +
            part.positions[i + 1][2] +
            part.positions[i + 2][2]) /
          3;
        const key = `${cz < 0 ? "f" : "r"}${cx < 0 ? "l" : "r"}`;
        split[key].push(i);
      }
      for (const [key, starts] of Object.entries(split)) {
        if (!starts.length) continue;
        const pick = (list) =>
          list && starts.flatMap((i) => [list[i], list[i + 1], list[i + 2]]);
        wheels[key].push({
          ...part,
          positions: pick(part.positions),
          normals: pick(part.normals),
          uvs: pick(part.uvs),
        });
      }
    }
  }

  // ---- the document ----
  const doc = new Document();
  doc.createExtension(EXTTextureWebP);
  const buffer = doc.createBuffer();
  const scene = doc.createScene(id);
  const root = doc.createNode(id);
  scene.addChild(root);

  const copied = new Map();
  const textureCopy = (texture) => {
    if (!texture) return null;
    if (!copied.has(texture)) {
      copied.set(
        texture,
        doc
          .createTexture(texture.getName())
          .setImage(texture.getImage())
          .setMimeType(texture.getMimeType()),
      );
    }
    return copied.get(texture);
  };
  const materials = new Map();
  /** The model's own material, with its colour picture only (no bump or shine maps). */
  const ownMaterial = (source) => {
    const key = source ?? "none";
    if (!materials.has(key)) {
      const m = doc.createMaterial(source?.getName() ?? "plain");
      if (source) {
        m.setBaseColorFactor(source.getBaseColorFactor())
          .setMetallicFactor(source.getMetallicFactor())
          .setRoughnessFactor(source.getRoughnessFactor())
          .setEmissiveFactor(source.getEmissiveFactor())
          .setAlphaMode(source.getAlphaMode())
          .setAlphaCutoff(source.getAlphaCutoff())
          .setDoubleSided(source.getDoubleSided());
        const tex = textureCopy(source.getBaseColorTexture());
        if (tex) m.setBaseColorTexture(tex);
        const glow = textureCopy(source.getEmissiveTexture());
        if (glow) m.setEmissiveTexture(glow);
      }
      materials.set(key, m);
    }
    return materials.get(key);
  };
  const plain = (name, rgba, roughness = 0.5, metallic = 0) =>
    doc
      .createMaterial(name)
      .setBaseColorFactor(rgba)
      .setRoughnessFactor(roughness)
      .setMetallicFactor(metallic);

  function primitive({ positions, uvs }, material, origin = [0, 0, 0]) {
    const prim = doc.createPrimitive().setMaterial(material);
    const flat = (list, size, shift) => {
      const out = new Float32Array(list.length * size);
      list.forEach((v, i) => {
        for (let k = 0; k < size; k++)
          out[i * size + k] = v[k] - (shift?.[k] ?? 0);
      });
      return out;
    };
    const accessor = (type, array) =>
      doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
    prim.setAttribute("POSITION", accessor("VEC3", flat(positions, 3, origin)));
    // No normals yet: the shape alone, so the simplifier can merge corners.
    // creaseNormals() gives them back once it is done.
    const textured =
      material.getBaseColorTexture() || material.getEmissiveTexture();
    if (uvs && textured)
      prim.setAttribute("TEXCOORD_0", accessor("VEC2", flat(uvs, 2)));
    const index = new Uint32Array(positions.length);
    index.forEach((_, i) => (index[i] = i));
    prim.setIndices(
      doc.createAccessor().setType("SCALAR").setArray(index).setBuffer(buffer),
    );
    weldPrimitive(prim);
    return prim;
  }

  const nodeOf = (name, prims, origin = [0, 0, 0]) => {
    const mesh = doc.createMesh(name);
    for (const p of prims) mesh.addPrimitive(p);
    const node = doc.createNode(name).setMesh(mesh).setTranslation(origin);
    root.addChild(node);
    return node;
  };

  // Body: one part per material.
  const byMaterial = new Map();
  for (const part of of("body")) {
    const list = byMaterial.get(part.material) ?? [];
    list.push(part);
    byMaterial.set(part.material, list);
  }
  const bodyPrims = [...byMaterial.entries()].map(([source, list]) =>
    primitive(join(list), ownMaterial(source)),
  );

  // The cabin is left empty: the board tints the windows dark and draws both
  // their faces, so nothing shows through (car-glb.ts).
  nodeOf("body", bodyPrims);
  nodeOf("paint", [
    primitive(join(of("paint")), plain("paint", [1, 1, 1, 1], 0.4)),
  ]);
  nodeOf("glass", [
    primitive(join(of("glass")), plain("glass", [0.1, 0.12, 0.14, 0.6], 0.1)),
  ]);
  if (of("tail").length) {
    const tails = of("tail");
    nodeOf("tail", [primitive(join(tails), ownMaterial(tails[0].material))]);
  }

  let radius = 0;
  for (const [key, list] of Object.entries(wheels)) {
    if (!list.length) throw new Error(`${id}: no wheel at ${key}`);
    const b = boxOf(list.flatMap((p) => p.positions));
    const origin = b.min.map((v, k) => (v + b.max[k]) / 2);
    radius = Math.max(radius, b.size[1] / 2);
    const byMat = new Map();
    for (const part of list) {
      const l = byMat.get(part.material) ?? [];
      l.push(part);
      byMat.set(part.material, l);
    }
    nodeOf(
      `wheel_${key}`,
      [...byMat.entries()].map(([source, l]) =>
        primitive(join(l), ownMaterial(source), origin),
      ),
      origin,
    );
  }
  root.setExtras({ wheelRadius: Number(radius.toFixed(3)), smooth: true });

  // ---- lighter: fewer triangles, smaller pictures ----
  const tris = (prims) =>
    prims.reduce((s, p) => s + p.getIndices().getCount() / 3, 0);
  const allPrims = doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives());
  const before = tris(allPrims);
  const target = car.triangles ?? 20000;
  const ratio = Math.min(1, target / before);
  for (const mesh of doc.getRoot().listMeshes()) {
    // The paint carries the school's lettering: it keeps more of its shape.
    const own = mesh.getName() === "paint" ? Math.min(1, ratio * 1.6) : ratio;
    if (own >= 1) continue;
    for (const prim of mesh.listPrimitives()) {
      simplifyPrimitive(prim, {
        simplifier: MeshoptSimplifier,
        ratio: own,
        error:
          (car.simplifyError ?? 0.004) * (mesh.getName() === "paint" ? 0.5 : 1),
      });
    }
  }
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) creaseNormals(doc, buffer, prim);
  }
  const after = tris(
    doc
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives()),
  );

  await doc.transform(
    prune(),
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      resize: [
        car.textureSize ?? TEXTURE_SIZE,
        car.textureSize ?? TEXTURE_SIZE,
      ],
      quality: 80,
    }),
    quantize({
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
    }),
    meshopt({ encoder: MeshoptEncoder, level: "high" }),
  );
  mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, `${id}.glb`);
  await io.write(out, doc);
  const kb = statSync(out).size / 1024;
  console.log(id, {
    from: path.basename(file),
    kb: Math.round(kb),
    triangles: `${Math.round(before)} -> ${Math.round(after)}`,
    size: boxOf(parts.flatMap((p) => p.positions))
      .size.map((v) => v.toFixed(2))
      .join(" x "),
    wheelRadius: radius.toFixed(3),
    textures: doc.getRoot().listTextures().length,
  });
  if (kb > BUDGET_KB) {
    throw new Error(
      `${id}: ${Math.round(kb)} kB is over the ${BUDGET_KB} kB budget`,
    );
  }
}

/**
 * A car whose model has no wheels wears another car's (`car.wheelsFrom`),
 * sized and placed from its own wheel arches: `car.arches` picks the arch
 * liners, [pattern, test] like a rule. Works in the model's own units, before
 * it is centred and scaled, and hands back four wheels as `wheel` parts.
 */
async function borrowedWheels(id, car, all, parts) {
  const donor = CARS[car.wheelsFrom];
  if (!donor || !car.arches) {
    throw new Error(`${id}: no wheels; give it wheelsFrom and arches`);
  }
  const mid3 = (p, i) =>
    [0, 1, 2].map((k) => (p[i][k] + p[i + 1][k] + p[i + 2][k]) / 3);

  // This car's arches, front and rear.
  const [pattern, test] = car.arches;
  const liner = [];
  for (const part of all) {
    if (!pattern.test(part.name)) continue;
    for (let i = 0; i < part.positions.length; i += 3) {
      if (test(mid3(part.positions, i))) {
        liner.push(
          part.positions[i],
          part.positions[i + 1],
          part.positions[i + 2],
        );
      }
    }
  }
  const body = boxOf(parts.flatMap((p) => p.positions));
  const midZ = (body.min[2] + body.max[2]) / 2;
  const arch = (front) => {
    const pts = liner.filter((p) => p[2] < midZ === front);
    if (!pts.length)
      throw new Error(`${id}: no ${front ? "front" : "rear"} arch`);
    const b = boxOf(pts);
    const half = b.size[2] / 2;
    return {
      z: b.min[2] + half,
      top: b.max[1],
      half,
      x0: b.min[0],
      x1: b.max[0],
    };
  };
  const arches = { f: arch(true), r: arch(false) };

  // The donor's front-left wheel, as a model for all four.
  const { parts: donorAll } = await readParts(sourceFile(donor.dir));
  const dt = turn(donor.nose);
  const donorWheels = [];
  for (const part of donorAll) {
    part.positions = part.positions.map(dt);
    if (part.normals) part.normals = part.normals.map(dt);
    donorWheels.push(
      ...splitParts(donor, part).filter((p) => p.as === "wheel"),
    );
  }
  const dBox = boxOf(donorWheels.flatMap((p) => p.positions));
  const dMid = dBox.min.map((v, k) => (v + dBox.max[k]) / 2);
  const fl = [];
  for (const part of donorWheels) {
    const keep = [];
    for (let i = 0; i < part.positions.length; i += 3) {
      const [x, , z] = mid3(part.positions, i);
      if (x < dMid[0] && z < dMid[2]) keep.push(i);
    }
    const pick = (list) =>
      list && keep.flatMap((i) => [list[i], list[i + 1], list[i + 2]]);
    if (keep.length) {
      fl.push({
        ...part,
        positions: pick(part.positions),
        normals: pick(part.normals),
        uvs: pick(part.uvs),
      });
    }
  }
  const wBox = boxOf(fl.flatMap((p) => p.positions));
  const wMid = wBox.min.map((v, k) => (v + wBox.max[k]) / 2);
  const wRadius = wBox.size[1] / 2;

  const out = [];
  for (const end of ["f", "r"]) {
    const a = arches[end];
    // The tyre fills most of the arch; the arch's curve is centred on the axle.
    const radius = a.half * (car.tyreFill ?? 0.86);
    const s = radius / wRadius;
    const centreY = a.top - a.half;
    const halfWidth = (wBox.size[0] * s) / 2;
    for (const side of ["l", "r"]) {
      const mirror = side === "r" ? -1 : 1;
      // The tyre's outer face sits just inside the arch's outer edge.
      const x =
        side === "l"
          ? a.x0 + halfWidth + a.half * 0.04
          : a.x1 - halfWidth - a.half * 0.04;
      for (const part of fl) {
        const positions = part.positions.map(([px, py, pz]) => [
          x + (px - wMid[0]) * s * mirror,
          centreY + (py - wMid[1]) * s,
          a.z + (pz - wMid[2]) * s,
        ]);
        const normals = part.normals?.map(([nx, ny, nz]) => [
          nx * mirror,
          ny,
          nz,
        ]);
        const uvs = part.uvs && [...part.uvs];
        if (mirror < 0) {
          // A mirror turns triangles inside out: swap two corners of each.
          for (let i = 0; i < positions.length; i += 3) {
            for (const list of [positions, normals, uvs]) {
              if (list) [list[i + 1], list[i + 2]] = [list[i + 2], list[i + 1]];
            }
          }
        }
        out.push({ ...part, as: "wheel", positions, normals, uvs });
      }
    }
  }
  return out;
}

// ---- main -------------------------------------------------------------------------

for (const id of IDS) {
  if (INSPECT) await inspect(id, CARS[id]);
  else await build(id, CARS[id]);
}
if (INSPECT) console.log(`\nPictures in marketing/cars-inspect/`);
