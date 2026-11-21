/**
 * Gives every board car's bodywork a wrap template, so a driving school's
 * paint job can be put on it, measures where the car's landmarks are (wheel
 * arches, windows, roof, bonnet, the clear band of the doors), and draws the
 * template for a school's designer.
 *
 * Car-wrap shops work from a flat "vehicle template": the car's left side,
 * right side, top, front and back, all at one scale. This does the same. Each
 * triangle of a car's `paint` node is laid onto the view it faces most, at one
 * scale within a view, so nothing is stretched. The sides and the top fill
 * the picture's width (about 410 to 470 pixels per metre), so a school's
 * lettering stays crisp when the camera closes in. Both sides are drawn the
 * way you see them standing beside the car, so lettering reads normally.
 *
 * Writes, for each car:
 *   public/assets/board/cars/<car>.glb                 the same car, with UVs
 *   public/assets/board/sponsors/<car>-wrap.json       views and landmarks
 *   public/assets/board/sponsors/<car>-template.svg    the template to draw on
 *
 * Run after scripts/build-board-cars.mjs (which writes the cars without UVs):
 *   node scripts/build-car-wrap.mjs [car ...]
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
const OUT = path.join(ROOT, "public/assets/board/sponsors");
const CARS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["saloon", "suv", "pickup"];

/** The template picture, in pixels. Schools draw at this size. */
const ATLAS = { width: 2048, height: 2048 };
/** Room between views; art is drawn half of it past each edge (bleed). */
const PAD = 24;

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });
mkdirSync(OUT, { recursive: true });

// ---- geometry ---------------------------------------------------------------------

function normalOf([a, b, c]) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
}
const areaOf = (tri) => Math.hypot(...normalOf(tri)) / 2;
const centroid = (tri) =>
  [0, 1, 2].map((k) => (tri[0][k] + tri[1][k] + tri[2][k]) / 3);

/** Which view a triangle faces most. */
function viewOf(tri) {
  const n = normalOf(tri);
  const [ax, ay, az] = n.map(Math.abs);
  if (ay >= ax && ay >= az) return n[1] > 0 ? "top" : "bottom";
  if (ax >= az) return n[0] > 0 ? "right" : "left";
  return n[2] > 0 ? "back" : "front";
}
const facesSide = (tri) => ["left", "right"].includes(viewOf(tri));
const facesUp = (tri) => viewOf(tri) === "top";

/** A node's triangles in the car's frame (metres, nose down -z), with colours. */
function trianglesOf(n) {
  const prim = n.getMesh().listPrimitives()[0];
  const pos = prim.getAttribute("POSITION");
  const col = prim.getAttribute("COLOR_0");
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
    const tri = [at(corner(i)), at(corner(i + 1)), at(corner(i + 2))];
    if (col) {
      tri.colour = col
        .getElement(corner(i), [])
        .slice(0, 3)
        .map((c) => Math.round(Math.pow(c, 1 / 2.2) * 255))
        .join(",");
    }
    tris.push(tri);
  }
  return tris;
}

function boxOf(tris) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const tri of tris) {
    for (const p of tri) {
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], p[k]);
        max[k] = Math.max(max[k], p[k]);
      }
    }
  }
  return { min, max };
}

const r3 = (n) => Math.round(n * 1000) / 1000;

// ---- landmarks ------------------------------------------------------------------

/**
 * Where a design can rely on things being, measured from this car's own
 * shape: so one design fits a long low saloon and a tall short SUV alike.
 */
function landmarks(doc, paintTris, bodyTris) {
  const nodes = doc.getRoot().listNodes();
  const root = nodes.find((n) => n.getExtras()?.wheelRadius);
  const wheelR = root?.getExtras().wheelRadius ?? 0.32;
  const wheelZ = (prefix) =>
    nodes.find((n) => n.getName().startsWith(prefix))?.getTranslation()[2];
  const archR = wheelR * 1.25;
  const front = { z: r3(wheelZ("wheel_f")), y: r3(wheelR), r: r3(archR) };
  const rear = { z: r3(wheelZ("wheel_r")), y: r3(wheelR), r: r3(archR) };

  const box = boxOf(paintTris);
  const length = box.max[2] - box.min[2];
  const sideTris = paintTris.filter(facesSide);
  const sill = Math.min(...sideTris.flatMap((t) => t.map((p) => p[1])));

  // Glass: the colour covering most of the body's sides high up.
  const high = wheelR * 2 + 0.25;
  const byColour = new Map();
  for (const tri of bodyTris) {
    if (!facesSide(tri) || centroid(tri)[1] < high) continue;
    byColour.set(tri.colour, (byColour.get(tri.colour) ?? 0) + areaOf(tri));
  }
  const glassColour = [...byColour.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const glass = bodyTris.filter((t) => t.colour === glassColour);
  const glassSides = glass.filter(
    (t) => facesSide(t) && centroid(t)[1] >= high,
  );
  const belt = Math.min(...glassSides.flatMap((t) => t.map((p) => p[1])));
  const glassBox = boxOf(glass.filter((t) => centroid(t)[1] >= belt - 0.05));
  const screen = { front: r3(glassBox.min[2]), rear: r3(glassBox.max[2]) };

  // Roof: upward bodywork above the windows. Clear unless rails or racks
  // cover a good part of it.
  const roofTris = paintTris.filter(
    (t) => facesUp(t) && centroid(t)[1] > belt + 0.15,
  );
  const roofBox = boxOf(roofTris);
  const roofArea = roofTris.reduce((s, t) => s + areaOf(t), 0);
  const inRoof = (t) => {
    const [x, y, z] = centroid(t);
    return (
      y > belt + 0.15 &&
      x >= roofBox.min[0] &&
      x <= roofBox.max[0] &&
      z >= roofBox.min[2] &&
      z <= roofBox.max[2]
    );
  };
  const clutter = bodyTris
    .filter((t) => facesUp(t) && t.colour !== glassColour && inRoof(t))
    .reduce((s, t) => s + areaOf(t), 0);
  const roof = {
    z0: r3(roofBox.min[2]),
    z1: r3(roofBox.max[2]),
    x0: r3(roofBox.min[0]),
    x1: r3(roofBox.max[0]),
    y: r3(roofBox.max[1]),
    clear: clutter < roofArea * 0.1,
  };

  // Bonnet: upward bodywork ahead of the windscreen.
  const bonnetBox = boxOf(
    paintTris.filter(
      (t) =>
        facesUp(t) &&
        centroid(t)[2] < screen.front &&
        centroid(t)[1] > sill + 0.25,
    ),
  );
  const bonnet = {
    z0: r3(bonnetBox.min[2]),
    z1: r3(Math.min(bonnetBox.max[2], screen.front)),
    x0: r3(bonnetBox.min[0]),
    x1: r3(bonnetBox.max[0]),
    y: r3(bonnetBox.max[1]),
  };

  // Mouldings: thin body strips running most of the car's length along its
  // sides. Lettering keeps clear of them.
  const strips = new Map();
  for (const tri of bodyTris) {
    if (!facesSide(tri) || tri.colour === glassColour) continue;
    const y = centroid(tri)[1];
    if (y <= sill || y >= belt) continue;
    const list = strips.get(tri.colour) ?? [];
    list.push(tri);
    strips.set(tri.colour, list);
  }
  const trims = [];
  for (const list of strips.values()) {
    const b = boxOf(list);
    if (b.max[2] - b.min[2] > length * 0.5 && b.max[1] - b.min[1] < 0.15) {
      trims.push({ y0: r3(b.min[1]), y1: r3(b.max[1]) });
    }
  }

  // What a learner actually sees of the paint on a side: the car's left
  // side drawn on a 1 cm grid, nearest surface wins (paint or body: glass,
  // trim, mouldings, handles, arches). Bands where paint shows right across
  // are where lettering can go.
  const CELL = 0.01;
  const facing = (t) => viewOf(t) === "left";
  const surfaces = [
    ...paintTris.filter(facing).map((t) => ({ t, paint: true })),
    ...bodyTris.filter(facing).map((t) => ({ t, paint: false })),
  ];
  /** The longest run of rows in [yA, yB] where paint shows over [zA, zB]. */
  function clearBand(zA, zB, yA, yB, need = 0.9) {
    const nz = Math.max(1, Math.round((zB - zA) / CELL));
    const ny = Math.max(1, Math.round((yB - yA) / CELL));
    const depth = new Float32Array(nz * ny).fill(Infinity);
    const paint = new Uint8Array(nz * ny);
    for (const { t, paint: isPaint } of surfaces) {
      const [a, b, c] = t;
      const zs = [a[2], b[2], c[2]];
      const ys = [a[1], b[1], c[1]];
      const i0 = Math.max(0, Math.floor((Math.min(...zs) - zA) / CELL));
      const i1 = Math.min(nz - 1, Math.ceil((Math.max(...zs) - zA) / CELL));
      const j0 = Math.max(0, Math.floor((Math.min(...ys) - yA) / CELL));
      const j1 = Math.min(ny - 1, Math.ceil((Math.max(...ys) - yA) / CELL));
      const det = (b[2] - a[2]) * (c[1] - a[1]) - (c[2] - a[2]) * (b[1] - a[1]);
      if (Math.abs(det) < 1e-9) continue;
      for (let j = j0; j <= j1; j++) {
        const y = yA + (j + 0.5) * CELL;
        for (let i = i0; i <= i1; i++) {
          const z = zA + (i + 0.5) * CELL;
          const u =
            ((z - a[2]) * (c[1] - a[1]) - (c[2] - a[2]) * (y - a[1])) / det;
          const v =
            ((b[2] - a[2]) * (y - a[1]) - (z - a[2]) * (b[1] - a[1])) / det;
          if (u < 0 || v < 0 || u + v > 1) continue;
          const x = a[0] + u * (b[0] - a[0]) + v * (c[0] - a[0]);
          const k = j * nz + i;
          if (x < depth[k]) {
            depth[k] = x;
            paint[k] = isPaint ? 1 : 0;
          }
        }
      }
    }
    let best = [0, 0];
    let start = -1;
    for (let j = 0; j <= ny; j++) {
      let ok = false;
      if (j < ny) {
        let n = 0;
        for (let i = 0; i < nz; i++) n += paint[j * nz + i];
        ok = n / nz >= need;
      }
      if (ok && start < 0) start = j;
      if (!ok && start >= 0) {
        if (j - start > best[1] - best[0]) best = [start, j];
        start = -1;
      }
    }
    return {
      y0: r3(yA + best[0] * CELL + 0.01),
      y1: r3(yA + best[1] * CELL - 0.01),
    };
  }

  const doorZ = {
    z0: r3(front.z + archR + 0.05),
    z1: r3(rear.z - archR - 0.05),
  };
  const door = { ...doorZ, ...clearBand(doorZ.z0, doorZ.z1, sill, belt) };
  // The front wing over the arch, for a mark there.
  const wingZ = {
    z0: r3(front.z - archR * 0.7),
    z1: r3(front.z + archR * 0.7),
  };
  const wing = {
    ...wingZ,
    ...clearBand(
      wingZ.z0,
      wingZ.z1,
      front.y + archR * 0.8,
      bonnet.y + 0.05,
      0.85,
    ),
  };

  return {
    wheels: { front, rear },
    sill: r3(sill),
    belt: r3(belt),
    screen,
    roof,
    bonnet,
    trims,
    door,
    wing,
  };
}

// ---- one car --------------------------------------------------------------------

async function wrapCar(id) {
  const file = path.join(ROOT, `public/assets/board/cars/${id}.glb`);
  const doc = await io.read(file);
  await doc.transform(dequantize());
  const nodes = doc.getRoot().listNodes();
  const node = (name) => {
    const found = nodes.find((n) => n.getName() === name);
    if (!found) throw new Error(`${id}.glb has no "${name}" node`);
    return found;
  };
  const paintNode = node("paint");
  // One vertex per triangle corner, so each triangle can take its own view.
  await doc.transform(unweld());
  const paintTris = trianglesOf(paintNode);
  const bodyTris = trianglesOf(node("body"));

  const box = boxOf(paintTris);
  const [xmin, , zmin] = box.min;
  const [xmax, ymax, zmax] = box.max;
  const L = zmax - zmin;
  const W = xmax - xmin;
  const H = ymax - box.min[1];

  // The sides and the top are what a learner reads, so they get every pixel
  // the picture can give them: stacked full width, at the largest scale that
  // fits this car. The ends go below at half that, and the underside (never
  // seen) in what is left.
  const SCALE =
    Math.floor(
      Math.min(
        (ATLAS.width - 2 * PAD) / L,
        (ATLAS.height - 5 * PAD) / (2.5 * H + W),
      ) / 10,
    ) * 10;
  const ENDS = SCALE / 2;
  const row1 = PAD;
  const row2 = row1 + Math.round(H * SCALE) + PAD;
  const row3 = row2 + Math.round(H * SCALE) + PAD;
  const row4 = row3 + Math.round(W * SCALE) + PAD;
  const endW = Math.round(W * ENDS);
  const endH = Math.round(H * ENDS);
  const underX = 3 * PAD + 2 * endW;
  const UNDER = Math.min(ENDS, (ATLAS.width - underX - PAD) / L, endH / W);
  const view = (x, y, w, h, scale) => ({
    x,
    y,
    w: Math.round(w * scale),
    h: Math.round(h * scale),
    scale,
  });
  const views = {
    left: view(PAD, row1, L, H, SCALE),
    right: view(PAD, row2, L, H, SCALE),
    top: view(PAD, row3, L, W, SCALE),
    front: view(PAD, row4, W, H, ENDS),
    back: view(2 * PAD + endW, row4, W, H, ENDS),
    bottom: view(underX, row4, L, W, UNDER),
  };
  for (const [name, v] of Object.entries(views)) {
    if (
      v.x + v.w > ATLAS.width - PAD / 2 ||
      v.y + v.h > ATLAS.height - PAD / 2
    ) {
      throw new Error(`${id}: the ${name} view does not fit the template`);
    }
  }

  /** Where a point of the car lands in a view. The driver's right is +x. */
  function place(view, [x, y, z]) {
    const v = views[view];
    const s = v.scale;
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

  // UVs on the paint.
  const prim = paintNode.getMesh().listPrimitives()[0];
  const uv = new Float32Array(prim.getAttribute("POSITION").getCount() * 2);
  const paintIdx = prim.getIndices();
  const laid = {
    left: [],
    right: [],
    top: [],
    bottom: [],
    front: [],
    back: [],
  };
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

  const marks = landmarks(doc, paintTris, bodyTris);

  await doc.transform(
    weld(),
    quantize({ quantizePosition: 14, quantizeColor: 8, quantizeTexcoord: 14 }),
    meshopt({ encoder: MeshoptEncoder, level: "high" }),
  );
  await io.write(file, doc);

  const layout = {
    note: `Written by scripts/build-car-wrap.mjs. Pixels in the ${id}'s wrap template; landmarks in metres, in the car's frame (nose -z, driver's right +x).`,
    car: id,
    atlas: ATLAS,
    scale: SCALE,
    pad: PAD,
    box: {
      length: r3(L),
      width: r3(W),
      height: r3(H),
      min: box.min.map(r3),
      max: box.max.map(r3),
    },
    views,
    landmarks: marks,
  };
  writeFileSync(
    path.join(OUT, `${id}-wrap.json`),
    `${JSON.stringify(layout, null, 2)}\n`,
  );

  // The template for designers.
  const poly = (pts, attrs) =>
    `<polygon points="${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}" ${attrs}/>`;
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
  const rect = (view, a, b, label) => {
    const [x1, y1] = place(view, a);
    const [x2, y2] = place(view, b);
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    return (
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.abs(x2 - x1).toFixed(1)}" height="${Math.abs(y2 - y1).toFixed(1)}" fill="none" stroke="#0a8f3c" stroke-width="3" stroke-dasharray="14 8"/>` +
      `<text x="${(x + 8).toFixed(1)}" y="${(y + 22).toFixed(1)}" font-size="17" fill="#0a8f3c">${label}</text>`
    );
  };
  const d = marks.door;
  const named = marks.roof.clear ? marks.roof : marks.bonnet;
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
    `<!-- DriveRush.ke ${id} wrap template. Draw the school's paint in each view at this size, then save a PNG or SVG of the same size. White = paintwork; blue-grey = glass, lamps and trim (not painted). Keep lettering inside the green boxes. The sides and top are drawn at ${SCALE} px per metre, the ends at half that. -->`,
    `<rect width="100%" height="100%" fill="#eeeeee"/>`,
    ...Object.entries(views).map(([view, v]) =>
      [
        `<g id="${view}">`,
        `<rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" fill="#f9f9f9" stroke="#999" stroke-width="2" stroke-dasharray="6 6"/>`,
        `<g id="${view}-paint">${laid[view].map((t) => poly(t, 'fill="#ffffff" stroke="#b0b0b0" stroke-width="0.6"')).join("")}</g>`,
        `<g id="${view}-body">${bodyIn(view)}</g>`,
        `<text x="${v.x + 6}" y="${v.y + v.h + 18}" font-size="16" fill="#555">${names[view]}</text>`,
        `</g>`,
      ].join(""),
    ),
    rect("left", [0, d.y1, d.z0], [0, d.y0, d.z1], "name and lettering"),
    rect("right", [0, d.y1, d.z0], [0, d.y0, d.z1], "name and lettering"),
    rect(
      "top",
      [named.x0 + 0.05, 0, named.z1 - 0.05],
      [named.x1 - 0.05, 0, named.z0 + 0.05],
      marks.roof.clear
        ? "roof: the part learners read"
        : "bonnet: the part learners read",
    ),
    `</svg>`,
  ].join("\n");
  writeFileSync(path.join(OUT, `${id}-template.svg`), `${svg}\n`);

  console.log(id, {
    size: `${L.toFixed(2)} x ${W.toFixed(2)} x ${H.toFixed(2)} m`,
    belt: marks.belt,
    sill: marks.sill,
    door: marks.door,
    wing: marks.wing,
    roof: marks.roof,
    bonnet: marks.bonnet,
    screen: marks.screen,
    trims: marks.trims,
  });
}

for (const id of CARS) await wrapCar(id);
