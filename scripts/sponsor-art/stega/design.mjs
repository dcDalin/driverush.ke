/**
 * Stega Driving School's own cars, as on the photos of their real fleet
 * (reference-*.jpg): not a style of ours. Stega runs several paint jobs, and
 * the owner chose to show that (2026-11-26): each board vehicle wears the
 * Stega car closest to it, redrawn clean from the photos and fitted by the
 * wheels and the window line.
 *
 *   hatchback, pickup  their red Demio (reference-demio*.jpg): red body, a
 *                      blue skirt with white stars, a white star with a
 *                      checkered flag and navy flames over the rear door,
 *                      STEGA in yellow stencil on the front door over a dark
 *                      splatter, yellow triangles; CAUTION and DRIVER UNDER
 *                      INSTRUCTIONS at the back
 *   wagon              their blue Fielder (reference-fielder.jpg): blue body,
 *                      a red front with white stars and white-edged
 *                      triangles, STEGA in white on the rear door, a red
 *                      flame star with a checkered flag on the rear quarter
 *   saloon             their white and turquoise Axio (reference-axio*.jpg):
 *                      turquoise bumpers and sills, a turquoise frame of
 *                      striped pointed cells and streaks over the rear
 *                      door, STEGA in red edged violet, DRIVING SCHOOL and
 *                      the number in red, small stars, red Ls; KEEP
 *                      DISTANCE and CAUTION INSTANT BRAKES behind
 *   suv                their white Axio with the blue front and the red
 *                      splash (reference-splash.jpg)
 *   crossover          their white "Team STEGA" Mazda (reference-team*.jpg):
 *                      a red star with black and red streaks, a red shard
 *                      splash, red arrows on the bonnet, blue STEGA,
 *                      red triangles, the Team STEGA plate
 *   van, lorry         their white truck (reference-truck.jpg): big blue
 *                      STEGA, the red L, blue tiles, their office and branch
 *                      numbers, and STEGA CAUTION DRIVER UNDER INSTRUCTION
 *                      over the cab
 *
 * Their logo is traced from the one on their site (trace.mjs). Lettering on
 * the cars is set in the closest free typefaces (Black Ops One for the
 * Demio's stencil, Alfa Slab One for the slab names, Anton and Poppins for
 * the rest). When Stega sends their artwork files, they replace these.
 *
 * Their roof boards are blue ovals with STEGA in yellow bulb letters: the
 * board car's `topBoard` copies it.
 *
 * Not copied: lettering on glass, number plates, the L on mirrors, the
 * truck's side window.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { aspectOf, line } from "../lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Their colours: the logo's from their own file, the cars' off the photos. */
export const COLORS = {
  logoRed: "#e8212b",
  logoBlue: "#1e69a7",
  red: "#e0232b",
  blue: "#1f4fb4",
  fielder: "#1d3fa8",
  navy: "#16245e",
  sky: "#3d7fe0",
  turquoise: "#2cb8d4",
  violet: "#2e2a86",
  orange: "#ef5a28",
  yellow: "#f7d21c",
  maroon: "#4a0a0e",
  white: "#f7f7f4",
  black: "#141414",
  board: "#2c63d8",
  boardRim: "#7fb2ff",
};

/** Their numbers, as painted on their cars and truck. */
const PHONE = "0722 213 810";
const BRANCH = "0718 838 355";

// ---- small helpers ---------------------------------------------------------------------

const n3 = (v) => (Math.round(v * 1000) / 1000).toString();
const pts = (list) => list.map(([a, b]) => `${n3(a)},${n3(b)}`).join(" ");
const poly = (list, fill, extra = "") =>
  `<polygon points="${pts(list)}" fill="${fill}"${extra}/>`;

/** A seeded random number stream, so every build draws the same splashes. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A five-pointed star's points; `yUp` for metres, false for pixels. */
function starPts(cx, cy, r, { inner = 0.42, turn = 0, yUp = true } = {}) {
  const s = yUp ? 1 : -1;
  const out = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * inner : r;
    const a = Math.PI / 2 + turn + (i * Math.PI) / 5;
    out.push([cx + rr * Math.cos(a), cy + s * rr * Math.sin(a)]);
  }
  return out;
}

/** A star, filled, with an optional edge (its width a share of r). */
function star(cx, cy, r, fill, { edge, edgeK = 0.16, ...opts } = {}) {
  const p = starPts(cx, cy, r, opts);
  return edge
    ? poly(
        p,
        fill,
        ` stroke="${edge}" stroke-width="${n3(r * edgeK)}" stroke-linejoin="round" paint-order="stroke"`,
      )
    : poly(p, fill);
}

/** A cubic curve through four points, as a function of t. */
const bez = (p0, p1, p2, p3) => (t) => {
  const u = 1 - t;
  return [0, 1].map(
    (i) =>
      u * u * u * p0[i] +
      3 * u * u * t * p1[i] +
      3 * u * t * t * p2[i] +
      t * t * t * p3[i],
  );
};

/** A point on a curve and its unit normal there. */
function frame(curve, t) {
  const [x, y] = curve(t);
  const [xa, ya] = curve(Math.max(0, t - 1e-3));
  const [xb, yb] = curve(Math.min(1, t + 1e-3));
  const len = Math.hypot(xb - xa, yb - ya) || 1;
  return { x, y, nx: -(yb - ya) / len, ny: (xb - xa) / len };
}

/** A band along a curve, `width(t)` across, as a polygon. */
function ribbon(curve, width, n = 32) {
  const a = [];
  const b = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const f = frame(curve, t);
    const w = width(t) / 2;
    a.push([f.x + f.nx * w, f.y + f.ny * w]);
    b.push([f.x - f.nx * w, f.y - f.ny * w]);
  }
  return [...a, ...b.reverse()];
}

/** A flame or streak: wide at its start, tapering to a point. */
const taper = (w0) => (t) => w0 * (1 - t) ** 1.15;

/** A waving checkered flag along a curve: white, black squares, an edge. */
function checkered(curve, width, { cols = 9, rows = 3, edge } = {}) {
  const at = (t, v) => {
    const f = frame(curve, t);
    const w = width(t);
    return [f.x + f.nx * (v - 0.5) * w, f.y + f.ny * (v - 0.5) * w];
  };
  const cells = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if ((i + j) % 2) continue;
      const t0 = i / cols;
      const t1 = (i + 1) / cols;
      const v0 = j / rows;
      const v1 = (j + 1) / rows;
      cells.push(
        poly([at(t0, v0), at(t1, v0), at(t1, v1), at(t0, v1)], COLORS.black),
      );
    }
  }
  const outline = ribbon(curve, width, 40);
  const w0 = width(0.5);
  return [
    edge
      ? poly(
          outline,
          edge,
          ` stroke="${edge}" stroke-width="${n3(w0 * 0.14)}" stroke-linejoin="round"`,
        )
      : "",
    poly(outline, COLORS.white),
    ...cells,
  ].join("");
}

// ---- lettering ---------------------------------------------------------------------------

/**
 * A line of text fitted in a box (pixels), centred (or set against `align`),
 * never stretched; an optional keyline round it, `edge` of its height.
 */
function fitted(
  font,
  text,
  box,
  { tracking = 0.02, fill, keyline, edge = 0.1, align = "center", skew = 0 },
) {
  const a = aspectOf(font, text, tracking);
  const pad = keyline ? edge : 0;
  const height = Math.min(box.h / (1 + pad), box.w / (a + pad));
  const width = height * a;
  const x =
    align === "left"
      ? box.x + (height * pad) / 2
      : align === "right"
        ? box.x + box.w - width - (height * pad) / 2
        : box.x + (box.w - width) / 2;
  const y = box.y + (box.h - height) / 2;
  const d = line(font, text, { x, y, height, tracking });
  const cx = x + width / 2;
  const cy = y + height / 2;
  const sk = skew
    ? ` transform="translate(${n3(cx)} ${n3(cy)}) skewX(${skew}) translate(${n3(-cx)} ${n3(-cy)})"`
    : "";
  const parts = [];
  if (keyline) {
    parts.push(
      `<path d="${d}" fill="${keyline}" stroke="${keyline}" stroke-width="${n3(height * edge)}" stroke-linejoin="round"/>`,
    );
  }
  parts.push(`<path d="${d}" fill="${fill}"/>`);
  return {
    height,
    width,
    x,
    y,
    svg: `<g${sk}>${parts.join("")}</g>`,
  };
}

/** Lettering drawn into a box of side space on both sides, upright. */
function onBothSides(k, area, draw) {
  return ["left", "right"]
    .map((view) =>
      k.pixels(
        view,
        draw(k.boxPx(view, area.z0, area.y1, area.z1, area.y0), view),
      ),
    )
    .join("");
}

/** A warning triangle with a letter in it ("L" or "!"), in pixels. */
function triangle(fonts, cx, cy, size, { stroke, fill = "none", ink, glyph }) {
  const h = (size * Math.sqrt(3)) / 2;
  const p = [
    [cx, cy - h * 0.62],
    [cx + size / 2, cy + h * 0.38],
    [cx - size / 2, cy + h * 0.38],
  ];
  const sw = size * 0.12;
  const g = glyph
    ? fitted(
        fonts["Poppins-ExtraBold.ttf"],
        glyph,
        { x: cx - size * 0.2, y: cy - h * 0.12, w: size * 0.4, h: h * 0.42 },
        { fill: ink ?? stroke, tracking: 0 },
      ).svg
    : "";
  return (
    poly(
      p,
      fill,
      ` stroke="${stroke}" stroke-width="${n3(sw)}" stroke-linejoin="round"`,
    ) + g
  );
}

/** A learner's plate, a red L on a square, in pixels. */
function lPlate(
  cx,
  cy,
  size,
  { ground = COLORS.white, ink = COLORS.red, frame } = {},
) {
  const s = size;
  const x = cx - s / 2;
  const y = cy - s / 2;
  const t = s * 0.19;
  const l = [
    [x + s * 0.28, y + s * 0.15],
    [x + s * 0.28 + t, y + s * 0.15],
    [x + s * 0.28 + t, y + s * 0.85 - t],
    [x + s * 0.78, y + s * 0.85 - t],
    [x + s * 0.78, y + s * 0.85],
    [x + s * 0.28, y + s * 0.85],
  ];
  return [
    `<rect x="${n3(x)}" y="${n3(y)}" width="${n3(s)}" height="${n3(s)}" fill="${ground}"${frame ? ` stroke="${frame}" stroke-width="${n3(s * 0.07)}"` : ""}/>`,
    poly(l, ink),
  ].join("");
}

// ---- their logo, traced -----------------------------------------------------------------

const traced = readFileSync(path.join(HERE, "stega.svg"), "utf8");
const part = (name) => {
  const g = new RegExp(`<g id="${name}"[\\s\\S]*?</g>`).exec(traced)[0];
  const [x, y, w, h] = /data-box="([^"]+)"/.exec(g)[1].split(" ").map(Number);
  return { g, x, y, w, h };
};
const EMBLEM_RED = part("emblem-red");
const EMBLEM_BLUE = part("emblem-blue");
const NAME = part("stega");
const SCHOOL = part("school");
const EST = part("est");

/** The emblem's box (both wings and the bolt), in the tracing's pixels. */
const EMBLEM = {
  x: EMBLEM_RED.x,
  y: Math.min(EMBLEM_RED.y, EMBLEM_BLUE.y),
  w: EMBLEM_BLUE.x + EMBLEM_BLUE.w - EMBLEM_RED.x,
  h:
    Math.max(EMBLEM_RED.y + EMBLEM_RED.h, EMBLEM_BLUE.y + EMBLEM_BLUE.h) -
    Math.min(EMBLEM_RED.y, EMBLEM_BLUE.y),
};
/** The words' box: STEGA over DRIVING SCHOOL. */
const WORDS = {
  x: Math.min(NAME.x, SCHOOL.x),
  y: NAME.y,
  w:
    Math.max(NAME.x + NAME.w, SCHOOL.x + SCHOOL.w) - Math.min(NAME.x, SCHOOL.x),
  h: SCHOOL.y + SCHOOL.h - NAME.y,
};

/** Traced parts drawn so that `box` (tracing pixels) lands at (x, y), scale s. */
const placed = (box, x, y, s, inner) =>
  `<g transform="translate(${n3(x - box.x * s)} ${n3(y - box.y * s)}) scale(${s.toFixed(6)})">${inner}</g>`;

function emblemParts(mono) {
  return mono
    ? `<g fill="#fff">${EMBLEM_RED.g}${EMBLEM_BLUE.g}</g>`
    : `<g fill="${COLORS.logoRed}">${EMBLEM_RED.g}</g><g fill="${COLORS.logoBlue}">${EMBLEM_BLUE.g}</g>`;
}
function wordParts(mono, est = false) {
  const red = mono ? "#fff" : COLORS.logoRed;
  const blue = mono ? "#fff" : COLORS.logoBlue;
  return `<g fill="${red}">${NAME.g}${est ? EST.g : ""}</g><g fill="${blue}">${SCHOOL.g}</g>`;
}

/**
 * Their logo as they set it: the emblem over STEGA over DRIVING SCHOOL
 * (and "Est 1995" with `est`), `w` wide, its top middle at (cx, y).
 */
function logoStack(cx, y, w, { mono = false, est = false } = {}) {
  const box = {
    x: Math.min(EMBLEM.x, WORDS.x),
    y: EMBLEM.y,
    w:
      Math.max(EMBLEM.x + EMBLEM.w, WORDS.x + WORDS.w) -
      Math.min(EMBLEM.x, WORDS.x),
    h: (est ? EST.y + EST.h : WORDS.y + WORDS.h) - EMBLEM.y,
  };
  const s = w / box.w;
  return {
    h: box.h * s,
    svg: placed(
      box,
      cx - w / 2,
      y,
      s,
      emblemParts(mono) + wordParts(mono, est),
    ),
  };
}

/** The stack's height over its width. */
const STACK_TALL = (WORDS.y + WORDS.h - EMBLEM.y) / Math.max(EMBLEM.w, WORDS.w);

/** The logo set in a row: the emblem, then STEGA over DRIVING SCHOOL. */
function logoRow(box, { mono = false } = {}) {
  const gap = 0.12;
  // Emblem and words drawn at the same height.
  const ew = EMBLEM.w / EMBLEM.h;
  const ww = WORDS.w / WORDS.h;
  const h = Math.min(box.h, box.w / (ew + gap + ww));
  const total = h * (ew + gap + ww);
  const x = box.x + (box.w - total) / 2;
  const y = box.y + (box.h - h) / 2;
  return (
    placed(EMBLEM, x, y, h / EMBLEM.h, emblemParts(mono)) +
    placed(WORDS, x + h * (ew + gap), y, h / WORDS.h, wordParts(mono))
  );
}

// ---- their motifs ------------------------------------------------------------------------

/**
 * The Demio's and Fielder's rear-door picture, in side metres: a star with a
 * checkered flag waving behind it and flames trailing back over it. (cz, cy)
 * is the star's middle, r its size; the nose is towards -z.
 */
function starAndFlag(cz, cy, r, { flames, star: starFill, starEdge, ring }) {
  const flag = bez(
    [cz + 2.1 * r, cy + 1.05 * r],
    [cz + 1.1 * r, cy + 1.45 * r],
    [cz + 0.35 * r, cy - 0.7 * r],
    [cz - 0.75 * r, cy - 1.35 * r],
  );
  const parts = [];
  // Flames from behind the star, back and up over the rear door.
  flames.forEach((col, i) => {
    const spread = (i - (flames.length - 1) / 2) * 0.32 * r;
    const curve = bez(
      [cz + 0.15 * r, cy + 0.05 * r + spread * 0.4],
      [cz + 1.0 * r, cy + 0.3 * r + spread],
      [cz + 1.7 * r, cy + 0.5 * r + spread * 1.3],
      [cz + 2.6 * r, cy + 1.1 * r + spread * 1.6],
    );
    parts.push(poly(ribbon(curve, taper(0.42 * r * (1 - i * 0.12))), col));
  });
  parts.push(
    checkered(flag, (t) => r * (0.62 + 0.12 * Math.sin(t * Math.PI * 2)), {
      cols: 10,
      rows: 3,
      edge: COLORS.navy,
    }),
  );
  if (ring) {
    parts.push(
      star(cz, cy, r * 1.28, "none", { edge: ring, edgeK: 0.13, turn: 0.35 }),
    );
  }
  parts.push(
    star(cz, cy, r, starFill, { edge: starEdge, edgeK: 0.12, turn: 0.35 }),
  );
  return parts.join("");
}

/** A paint splatter over an area of side metres, its drops seeded. */
function splatter(seed, z0, z1, y0, y1, fill) {
  const rand = rng(seed);
  const out = [];
  const w = z1 - z0;
  const h = y1 - y0;
  for (let i = 0; i < 70; i++) {
    const u = rand();
    const z = z0 + u * w;
    // Thicker in the middle of the run, thinning at both ends.
    const fat = Math.sin(u * Math.PI);
    const y = y0 + (0.5 + (rand() - 0.5) * fat) * h;
    const rx = (0.01 + rand() * 0.05) * (0.4 + fat);
    const ry = rx * (0.35 + rand() * 0.5);
    out.push(
      `<ellipse cx="${n3(z)}" cy="${n3(y)}" rx="${n3(rx)}" ry="${n3(ry)}" transform="rotate(${n3((rand() - 0.5) * 30)} ${n3(z)} ${n3(y)})" fill="${fill}"/>`,
    );
  }
  return out.join("");
}

/** Small stars scattered in a box of metres, seeded. */
function scatter(seed, z0, z1, y0, y1, count, colours, size = [0.018, 0.04]) {
  const rand = rng(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const col = colours[i % colours.length];
    const r = size[0] + rand() * (size[1] - size[0]);
    out.push(
      star(z0 + rand() * (z1 - z0), y0 + rand() * (y1 - y0), r, col.fill, {
        edge: col.edge,
        edgeK: 0.22,
        turn: rand() * 0.6,
      }),
    );
  }
  return out.join("");
}

// ---- the painters, one per real Stega car ------------------------------------------------

/** Which of their cars each board vehicle wears (owner, 2026-11-26). */
const WHICH = {
  hatchback: demio,
  pickup: demio,
  wagon: fielder,
  saloon: axio,
  suv: splash,
  crossover: team,
  van: truck,
  lorry: truck,
};

export default function stega({ k, fonts }) {
  const paint = WHICH[k.car] ?? (k.kind === "car" ? demio : truck);
  return paint(k, fonts);
}

/** Shared measures: along (0 rear wheel, 1 front wheel), down (0 belt, 1 sill). */
function measures(k) {
  const { L } = k;
  const rear = L.wheels.rear.z;
  const front = L.wheels.front.z;
  const wb = rear - front;
  const band = L.belt - L.sill;
  return {
    far: 9,
    rear,
    front,
    wb,
    band,
    zAt: (u) => rear - u * wb,
    yAt: (v) => L.belt - v * band,
  };
}

/** The five views drawn from side, top, front and back pictures, and extras. */
function assemble(k, { defs = "", side, top, front, back, extra = [] }) {
  return {
    defs,
    body: [
      k.inView("left", side),
      k.inView("right", side),
      k.inView("top", top),
      k.inView("front", front),
      k.inView("back", back),
      ...extra,
    ].join("\n"),
  };
}

/** The phone number along a box (pixels). */
const phoneIn = (fonts, b, fill) =>
  fitted(fonts["Poppins-Bold.ttf"], PHONE, b, { fill, tracking: 0.04 }).svg;

/**
 * Their name on the doors: on the largest clear paint of the given stretch
 * (the same on both sides), no taller than `cap` metres, drawn by `draw`.
 */
function nameSpot(k, zA, zB, yA, yB) {
  return k.clearRect("both", Math.min(zA, zB), Math.max(zA, zB), yA, yB, {
    inset: 0.02,
  });
}

// -- the red Demio (hatchback, pickup) --

function demio(k, fonts) {
  const { L, box } = k;
  const c = COLORS;
  const m = measures(k);
  const { far, zAt, yAt } = m;
  const r = L.wheels.front.r;

  // The blue skirt: low along the doors, up over the rear quarter and the
  // bumpers, with a thin white line on its top edge.
  const skirtEdge = [
    [box.zmin - far, yAt(0.5)],
    [zAt(1) - r * 1.1, yAt(0.55)],
    [zAt(1) + r * 1.2, yAt(0.86)],
    [zAt(0) - r * 1.3, yAt(0.86)],
    [zAt(0) + r * 0.2, yAt(0.5)],
    [box.zmax + far, yAt(0.42)],
  ];
  const skirt = poly(
    [...skirtEdge, [box.zmax + far, -far], [box.zmin - far, -far]],
    c.blue,
  );
  const pinstripe = `<polyline points="${pts(skirtEdge)}" fill="none" stroke="${c.white}" stroke-width="0.012" stroke-linejoin="round"/>`;

  const rs = Math.min(0.24, m.band * 0.36);
  const motif = starAndFlag(zAt(0.3), yAt(0.42), rs, {
    flames: [c.navy, c.sky, c.navy],
    star: c.white,
    starEdge: c.navy,
  });
  const splat = splatter(
    11,
    zAt(0.88),
    zAt(0.45),
    yAt(0.7),
    yAt(0.84),
    c.maroon,
  );
  const stars = [
    scatter(
      3,
      zAt(-0.05),
      box.zmax - 0.15,
      yAt(0.62),
      yAt(0.95),
      5,
      [{ fill: c.white, edge: c.navy }],
      [0.03, 0.055],
    ),
    scatter(
      5,
      zAt(0.15),
      zAt(-0.1),
      yAt(0.05),
      yAt(0.3),
      3,
      [{ fill: c.white }],
      [0.02, 0.035],
    ),
    scatter(
      7,
      box.zmin + 0.12,
      zAt(1.05),
      yAt(0.25),
      yAt(0.45),
      3,
      [{ fill: c.white }],
      [0.02, 0.03],
    ),
  ].join("");
  const side = [
    k.rect(-far, -far, far, far, c.red),
    skirt,
    pinstripe,
    motif,
    splat,
    stars,
  ].join("");

  // On top: red, a few white and yellow stars on the bonnet.
  const bon = L.bonnet;
  const top = [
    k.rect(-far, -far, far, far, c.red),
    scatter(
      21,
      bon.z0 + 0.12,
      bon.z1 - 0.1,
      bon.x0 + 0.1,
      bon.x1 - 0.1,
      6,
      [{ fill: c.white }, { fill: c.yellow }],
      [0.025, 0.045],
    ),
  ].join("");
  // The ends: red over a blue bumper with stars.
  const bumper = L.sill + (L.belt - L.sill) * 0.42;
  const front = [
    k.rect(-far, -far, far, far, c.red),
    k.rect(-far, -far, far, L.sill + (L.bonnet.y - L.sill) * 0.42, c.blue),
    scatter(
      31,
      box.xmin + 0.1,
      box.xmax - 0.1,
      L.sill + 0.04,
      L.sill + (L.bonnet.y - L.sill) * 0.36,
      6,
      [{ fill: c.white }, { fill: c.red, edge: c.white }],
      [0.025, 0.045],
    ),
  ].join("");
  const back = [
    k.rect(-far, -far, far, far, c.red),
    k.rect(-far, -far, far, bumper, c.blue),
    `<line x1="-9" y1="${n3(bumper)}" x2="9" y2="${n3(bumper)}" stroke="${c.white}" stroke-width="0.012"/>`,
    scatter(
      33,
      box.xmin + 0.1,
      box.xmax - 0.1,
      L.sill + 0.03,
      bumper - 0.12,
      7,
      [{ fill: c.white }, { fill: c.red, edge: c.white }],
      [0.025, 0.045],
    ),
  ].join("");

  const extra = [];
  // STEGA in yellow stencil on the front door, the number over it.
  const spot = nameSpot(k, zAt(0.9), zAt(0.42), yAt(0.68), yAt(0.08));
  if (spot) {
    extra.push(
      onBothSides(k, spot, (b, view) => {
        const s = k.scale(view);
        const name = fitted(
          fonts["BlackOpsOne-Regular.ttf"],
          "STEGA",
          k.cap({ ...b, y: b.y + b.h * 0.22, h: b.h * 0.78 }, 0.2 * s),
          { fill: c.yellow, keyline: c.maroon, edge: 0.06, tracking: 0.04 },
        );
        const phone = phoneIn(
          fonts,
          {
            x: name.x,
            y: name.y - name.height * 0.55,
            w: name.width,
            h: Math.min(name.height * 0.32, 0.05 * s),
          },
          c.white,
        );
        return name.svg + phone;
      }),
    );
  }
  // Yellow triangles: an L on the rear quarter, a warning on the front wing.
  for (const view of ["left", "right"]) {
    const s = k.scale(view);
    const [lx, ly] = k.pt[view](zAt(-0.12), yAt(0.3));
    const [wx, wy] = k.pt[view](zAt(0.62), yAt(0.75));
    const [fx, fy] = k.pt[view](
      (L.wing.z0 + L.wing.z1) / 2,
      Math.min(L.wing.y0, L.belt - 0.1),
    );
    extra.push(
      k.pixels(
        view,
        [
          triangle(fonts, lx, ly, 0.13 * s, { stroke: c.yellow, glyph: "L" }),
          triangle(fonts, wx, wy, 0.08 * s, { stroke: c.yellow, glyph: "!" }),
          triangle(fonts, fx, fy, 0.08 * s, { stroke: c.yellow, glyph: "!" }),
        ].join(""),
      ),
    );
  }
  // The back: CAUTION in yellow, DRIVER UNDER INSTRUCTIONS on the blue.
  const tail = k.clearRect("back", box.xmin, box.xmax, bumper + 0.02, L.belt, {
    inset: 0.03,
  });
  const sb = k.scale("back");
  if (tail) {
    const b = k.boxPx("back", tail.z0, tail.y1, tail.z1, tail.y0);
    extra.push(
      k.pixels(
        "back",
        fitted(
          fonts["AlfaSlabOne-Regular.ttf"],
          "CAUTION",
          k.cap(b, 0.13 * sb),
          {
            fill: c.yellow,
            keyline: c.maroon,
            edge: 0.06,
            tracking: 0.03,
          },
        ).svg,
      ),
    );
  }
  const under = k.boxPx(
    "back",
    box.xmin * 0.72,
    bumper - 0.015,
    box.xmax * 0.72,
    bumper - 0.09,
  );
  extra.push(
    k.pixels(
      "back",
      fitted(fonts["Anton-Regular.ttf"], "DRIVER UNDER INSTRUCTIONS", under, {
        fill: c.white,
        tracking: 0.04,
      }).svg +
        ["-1", "1"]
          .map((sgn) => {
            const [tx, ty] = k.pt.back(
              Number(sgn) * box.xmax * 0.82,
              bumper - 0.06,
            );
            return triangle(fonts, tx, ty, 0.08 * sb, {
              stroke: c.yellow,
              glyph: "!",
            });
          })
          .join(""),
    ),
  );
  return assemble(k, { side, top, front, back, extra });
}

// -- the blue Fielder (wagon) --

function fielder(k, fonts) {
  const { L, box } = k;
  const c = COLORS;
  const m = measures(k);
  const { far, zAt, yAt } = m;
  const r = L.wheels.front.r;

  // Red over the front bumper, ending in a point back past the front wheel;
  // a red line along the sills and red over the rear bumper.
  const redEdge = [
    [box.zmin - far, yAt(0.45)],
    [zAt(1) - r * 1.05, yAt(0.5)],
    [zAt(1) - r * 0.2, yAt(0.62)],
    [zAt(1) + r * 1.6, yAt(0.92)],
    [zAt(0) - r * 1.2, yAt(0.92)],
    [zAt(0) + r * 0.6, yAt(0.62)],
    [box.zmax + far, yAt(0.55)],
  ];
  const red = poly(
    [...redEdge, [box.zmax + far, -far], [box.zmin - far, -far]],
    c.red,
  );
  const rs = Math.min(0.2, m.band * 0.3);
  const side = [
    k.rect(-far, -far, far, far, c.fielder),
    red,
    // White stars along the red's top edge at the front.
    star(zAt(1) - r * 0.6, yAt(0.52), 0.05, c.white, {
      edge: c.navy,
      edgeK: 0.1,
      turn: 0.2,
    }),
    star(zAt(1) + r * 0.9, yAt(0.4), 0.045, c.white, {
      edge: c.navy,
      edgeK: 0.1,
      turn: -0.3,
    }),
    star(zAt(0.62), yAt(0.22), 0.035, c.white, { turn: 0.5 }),
    starAndFlag(zAt(-0.12), yAt(0.32), rs, {
      flames: [c.red, "#a3121a", c.red],
      star: c.white,
      starEdge: c.navy,
      ring: c.red,
    }),
  ].join("");
  const top = k.rect(-far, -far, far, far, c.fielder);
  const bumperTop = L.sill + (L.bonnet.y - L.sill) * 0.48;
  const front = [
    k.rect(-far, -far, far, far, c.fielder),
    k.rect(-far, -far, far, bumperTop, c.red),
    star(box.xmin * 0.75, bumperTop + 0.01, 0.05, c.white, {
      edge: c.navy,
      edgeK: 0.1,
    }),
    star(box.xmax * 0.75, bumperTop + 0.01, 0.05, c.white, {
      edge: c.navy,
      edgeK: 0.1,
    }),
  ].join("");
  const backTop = L.sill + (L.belt - L.sill) * 0.4;
  const back = [
    k.rect(-far, -far, far, far, c.fielder),
    k.rect(-far, -far, far, backTop, c.red),
    scatter(
      41,
      box.xmin + 0.1,
      box.xmax - 0.1,
      backTop - 0.02,
      backTop + 0.1,
      4,
      [{ fill: c.white }],
      [0.025, 0.04],
    ),
  ].join("");

  const extra = [];
  // STEGA in white across the rear door, their number over it, small.
  const spot = nameSpot(k, zAt(0.62), zAt(0.12), yAt(0.75), yAt(0.1));
  if (spot) {
    extra.push(
      onBothSides(k, spot, (b, view) => {
        const s = k.scale(view);
        const name = fitted(
          fonts["AlfaSlabOne-Regular.ttf"],
          "STEGA",
          k.cap(b, 0.2 * s),
          { fill: c.white, keyline: c.navy, edge: 0.05, tracking: 0.03 },
        );
        return (
          name.svg +
          phoneIn(
            fonts,
            {
              x: name.x,
              y: name.y - name.height * 0.5,
              w: name.width * 0.7,
              h: Math.min(name.height * 0.3, 0.045 * s),
            },
            c.white,
          )
        );
      }),
    );
  }
  // White-edged triangles on the red front, L and warning.
  for (const view of ["left", "right"]) {
    const s = k.scale(view);
    const [tx, ty] = k.pt[view](zAt(1) - r * 1.25, yAt(0.7));
    extra.push(
      k.pixels(
        view,
        triangle(fonts, tx, ty, 0.09 * s, { stroke: c.white, glyph: "!" }),
      ),
    );
  }
  const sf = k.scale("front");
  const [ax, ay] = k.pt.front(
    box.xmax * 0.45,
    L.sill + (bumperTop - L.sill) * 0.45,
  );
  const [bx, by] = k.pt.front(
    box.xmin * 0.45,
    L.sill + (bumperTop - L.sill) * 0.45,
  );
  extra.push(
    k.pixels(
      "front",
      triangle(fonts, ax, ay, 0.12 * sf, { stroke: c.white, glyph: "!" }) +
        triangle(fonts, bx, by, 0.12 * sf, { stroke: c.white, glyph: "L" }),
    ),
  );
  // Their number on the bonnet's nose, read from in front.
  const bon = L.bonnet;
  extra.push(
    k.onTopWith(
      {
        z0: bon.z0 + 0.06,
        z1: bon.z0 + 0.18,
        x0: bon.x0 * 0.45,
        x1: bon.x1 * 0.45,
      },
      (b) =>
        `<g transform="rotate(180 ${n3(b.x + b.w / 2)} ${n3(b.y + b.h / 2)})">${phoneIn(fonts, b, c.white)}</g>`,
    ),
  );
  // The back: STEGA in white over the red.
  const tail = k.clearRect("back", box.xmin, box.xmax, backTop + 0.03, L.belt, {
    inset: 0.04,
  });
  if (tail) {
    const sb = k.scale("back");
    const b = k.boxPx("back", tail.z0, tail.y1, tail.z1, tail.y0);
    extra.push(
      k.pixels(
        "back",
        fitted(fonts["AlfaSlabOne-Regular.ttf"], "STEGA", k.cap(b, 0.12 * sb), {
          fill: c.white,
          keyline: c.navy,
          edge: 0.05,
          tracking: 0.04,
        }).svg,
      ),
    );
  }
  return assemble(k, { side, top, front, back, extra });
}

// -- the white and turquoise Axio (saloon) --

function axio(k, fonts) {
  const { L, box } = k;
  const c = COLORS;
  const m = measures(k);
  const { far, zAt, yAt } = m;
  const r = L.wheels.front.r;

  // Turquoise over the bumpers, ending at the wheel arches, and a thin line
  // along the sills between them (reference-axio-side.jpg).
  const lowEdge = [
    [box.zmin - far, yAt(0.5)],
    [zAt(1) - r * 1.02, yAt(0.54)],
    [zAt(1) - r * 0.98, yAt(0.92)],
    [zAt(0) + r * 0.98, yAt(0.92)],
    [zAt(0) + r * 1.02, yAt(0.52)],
    [box.zmax + far, yAt(0.48)],
  ];
  const low = poly(
    [...lowEdge, [box.zmax + far, -far], [box.zmin - far, -far]],
    c.turquoise,
  );

  // Their pattern over the rear door and quarter: a turquoise frame with a
  // jagged top, and in it two staggered rows of white pointed cells, each
  // striped blue and red.
  const zFront = zAt(0.34);
  const zRear = Math.min(zAt(-0.15), box.zmax - 0.12);
  const topY = yAt(0.1);
  const tooth = 0.11;
  const crown = [];
  for (let z = zFront, i = 0; z < zRear; z += tooth / 2, i++) {
    crown.push([z, i % 2 ? topY + 0.05 : topY]);
  }
  crown.push([zRear, topY]);
  const frameShape = [
    [zAt(0.39), yAt(1.02)],
    [zFront, yAt(0.3)],
    ...crown,
    [zRear, yAt(0.55)],
    [zRear, yAt(1.02)],
  ];
  const cellH = m.band * 0.33;
  const cellW = cellH * 0.66;
  const step = cellW + 0.028;
  const cell = (cz, base) => {
    const x0 = cz - cellW / 2;
    const x1 = cz + cellW / 2;
    const stripes = [0.16, 0.3, 0.44, 0.58]
      .map(
        (f, i) =>
          `<line x1="${n3(x0 + cellW * 0.16)}" y1="${n3(base + cellH * f)}" x2="${n3(x1 - cellW * 0.16)}" y2="${n3(base + cellH * f)}" stroke="${i % 2 ? c.red : c.blue}" stroke-width="0.007"/>`,
      )
      .join("");
    return (
      poly(
        [
          [x0, base],
          [x1, base],
          [x1, base + cellH * 0.64],
          [cz, base + cellH],
          [x0, base + cellH * 0.64],
        ],
        c.white,
      ) + stripes
    );
  };
  const cells = [];
  for (let z = zFront + step * 0.7; z < zRear - cellW * 0.3; z += step) {
    cells.push(cell(z, yAt(0.48)));
    cells.push(cell(z + step / 2, yAt(0.9)));
  }
  const defs = `<clipPath id="stega-frame"><polygon points="${pts(frameShape)}"/></clipPath>`;
  const pattern = `<g clip-path="url(#stega-frame)">${poly(frameShape, c.turquoise)}${cells.join("")}</g>`;
  // Streaks from the pattern forward and down under the name: a turquoise
  // wedge between thin red and blue lines.
  const streaks = [
    [c.red, 0.018, -0.07],
    [c.turquoise, 0.075, 0.0],
    [c.red, 0.02, 0.08],
    [c.blue, 0.014, 0.13],
    [c.red, 0.016, 0.18],
  ]
    .map(([col, w, off]) =>
      poly(
        ribbon(
          bez(
            [zAt(0.16), yAt(0.14 + off)],
            [zAt(0.3), yAt(0.3 + off)],
            [zAt(0.48), yAt(0.55 + off * 0.5)],
            [zAt(0.66), yAt(0.84 + off * 0.2)],
          ),
          taper(w),
        ),
        col,
      ),
    )
    .join("");
  const side = [
    k.rect(-far, -far, far, far, c.white),
    pattern,
    streaks,
    low,
    // Small stars: round the name, on the front wing, by the tail lamps.
    scatter(
      51,
      zAt(0.85),
      zAt(0.42),
      yAt(0.05),
      yAt(0.85),
      12,
      [{ fill: c.blue }, { fill: c.white, edge: c.red }, { fill: c.blue }],
      [0.011, 0.02],
    ),
    scatter(
      53,
      zAt(1.2),
      zAt(0.85),
      yAt(0.02),
      yAt(0.4),
      6,
      [{ fill: c.blue }, { fill: c.white, edge: c.red }],
      [0.013, 0.024],
    ),
    scatter(
      59,
      zRear + 0.02,
      box.zmax - 0.1,
      yAt(0.05),
      yAt(0.4),
      4,
      [{ fill: c.blue }, { fill: c.white, edge: c.red }],
      [0.013, 0.022],
    ),
  ].join("");

  const bon = L.bonnet;
  const top = [
    k.rect(-far, -far, far, far, c.white),
    scatter(
      55,
      bon.z0 + 0.1,
      bon.z1 - 0.1,
      bon.x0 + 0.1,
      bon.x1 - 0.1,
      5,
      [{ fill: c.blue }, { fill: c.white, edge: c.orange }],
      [0.02, 0.035],
    ),
  ].join("");
  const bumperTop = L.sill + (L.bonnet.y - L.sill) * 0.55;
  const front = [
    k.rect(-far, -far, far, far, c.white),
    k.rect(-far, -far, far, bumperTop, c.turquoise),
  ].join("");
  const backTop = L.sill + (L.belt - L.sill) * 0.42;
  const back = [
    k.rect(-far, -far, far, far, c.white),
    k.rect(-far, -far, far, backTop, c.turquoise),
    scatter(
      57,
      box.xmin + 0.15,
      box.xmax - 0.15,
      backTop + 0.03,
      L.belt - 0.05,
      6,
      [{ fill: c.blue }, { fill: c.white, edge: c.orange }],
      [0.015, 0.03],
    ),
  ].join("");

  const extra = [];
  // STEGA in red edged blue on the front door, DRIVING SCHOOL and the
  // number under it in red.
  const spot = nameSpot(k, zAt(0.92), zAt(0.42), yAt(0.85), yAt(0.06));
  if (spot) {
    extra.push(
      onBothSides(k, spot, (b, view) => {
        const s = k.scale(view);
        const capped = k.cap(b, 0.4 * s, "top");
        const name = fitted(
          fonts["AlfaSlabOne-Regular.ttf"],
          "STEGA",
          {
            x: capped.x,
            y: capped.y,
            w: capped.w,
            h: Math.min(capped.h * 0.5, 0.19 * s),
          },
          { fill: c.red, keyline: c.violet, edge: 0.16, tracking: 0.02 },
        );
        // DRIVING and SCHOOL set apart under it, as their sign writer does.
        const half = name.width * 0.46;
        const rowY = name.y + name.height * 1.16;
        const rowH = name.height * 0.36;
        const word = (text, x) =>
          fitted(
            fonts["Anton-Regular.ttf"],
            text,
            { x, y: rowY, w: half, h: rowH },
            { fill: c.red, keyline: c.violet, edge: 0.08, tracking: 0.06 },
          ).svg;
        const school = {
          svg:
            word("DRIVING", name.x) +
            word("SCHOOL", name.x + name.width - half),
        };
        const phone = fitted(
          fonts["Poppins-Bold.ttf"],
          "#0722213810",
          {
            x: name.x + name.width * 0.3,
            y: rowY + rowH * 1.25,
            w: name.width * 0.6,
            h: name.height * 0.24,
          },
          { fill: c.red, tracking: 0.02 },
        );
        return name.svg + school.svg + phone.svg;
      }),
    );
  }
  // Red Ls on the turquoise front bumper's corners.
  for (const view of ["left", "right"]) {
    const s = k.scale(view);
    const [lx, ly] = k.pt[view](zAt(1) - r * 1.3, yAt(0.72));
    extra.push(
      k.pixels(
        view,
        lPlate(lx, ly, 0.08 * s, { ground: "none", frame: c.red }),
      ),
    );
  }
  const sf = k.scale("front");
  const [fx, fy] = k.pt.front(
    box.xmax * 0.55,
    L.sill + (bumperTop - L.sill) * 0.55,
  );
  extra.push(
    k.pixels(
      "front",
      lPlate(fx, fy, 0.14 * sf, { ground: "none", frame: c.red }),
    ),
  );
  // On the bonnet: STEGA DRIVING SCHOOL in blue, read as the car drives away.
  extra.push(
    k.onTopWith(
      {
        z0: bon.z0 + (bon.z1 - bon.z0) * 0.35,
        z1: bon.z1 - 0.08,
        x0: bon.x0 * 0.78,
        x1: bon.x1 * 0.78,
      },
      (b) => {
        const name = fitted(
          fonts["AlfaSlabOne-Regular.ttf"],
          "STEGA",
          { x: b.x, y: b.y, w: b.w, h: b.h * 0.66 },
          { fill: c.sky, keyline: c.fielder, edge: 0.08, tracking: 0.05 },
        );
        return (
          name.svg +
          fitted(
            fonts["Poppins-ExtraBold.ttf"],
            "DRIVING SCHOOL",
            {
              x: name.x + name.width * 0.2,
              y: name.y + name.height * 1.1,
              w: name.width * 0.8,
              h: b.h * 0.22,
            },
            { fill: c.sky, tracking: 0.06 },
          ).svg
        );
      },
    ),
  );
  // The back (reference-axio-rear*.jpg): KEEP and DISTANCE either side of
  // the badge with stars round them and the number under; CAUTION over
  // INSTANT BRAKES on the turquoise bumper, a red L and a warning triangle.
  const sb = k.scale("back");
  const boot = k.clearRect("back", box.xmin, box.xmax, backTop + 0.03, L.belt, {
    inset: 0.04,
  });
  if (boot) {
    const bh = Math.min(0.075, (boot.y1 - boot.y0) * 0.5);
    const y1 = boot.y1 - 0.01;
    const keep = k.boxPx("back", boot.z0, y1, -0.11, y1 - bh);
    const dist = k.boxPx("back", 0.11, y1, boot.z1, y1 - bh);
    const ink = { fill: c.red, keyline: c.violet, edge: 0.08, tracking: 0.04 };
    const keepW = fitted(fonts["AlfaSlabOne-Regular.ttf"], "KEEP", keep, {
      ...ink,
      align: "right",
    });
    const distW = fitted(fonts["AlfaSlabOne-Regular.ttf"], "DISTANCE", dist, {
      ...ink,
      align: "left",
    });
    const [px, py] = k.pt.back(boot.z1 - 0.2, y1 - bh - 0.06);
    extra.push(
      k.pixels(
        "back",
        keepW.svg +
          distW.svg +
          fitted(
            fonts["Poppins-Bold.ttf"],
            "#0722213810",
            {
              x: px - 0.18 * sb,
              y: py - 0.015 * sb,
              w: 0.36 * sb,
              h: 0.03 * sb,
            },
            { fill: c.red, tracking: 0.02 },
          ).svg,
      ),
      k.inView(
        "back",
        scatter(
          61,
          boot.z0,
          boot.z1,
          y1 - bh - 0.1,
          y1 - bh - 0.01,
          7,
          [{ fill: c.blue }, { fill: c.white, edge: c.red }],
          [0.012, 0.022],
        ),
      ),
    );
  }
  const bump = k.clearRect("back", box.xmin, box.xmax, L.sill, backTop - 0.02, {
    inset: 0.03,
  });
  if (bump) {
    const bb = k.boxPx("back", bump.z0, bump.y1, bump.z1, bump.y0);
    const capped = k.cap(bb, 0.15 * sb, "top");
    const mid = {
      x: capped.x + capped.w * 0.16,
      y: capped.y,
      w: capped.w * 0.68,
      h: capped.h,
    };
    const caution = fitted(
      fonts["AlfaSlabOne-Regular.ttf"],
      "CAUTION",
      { ...mid, h: mid.h * 0.66 },
      { fill: c.red, keyline: c.violet, edge: 0.06, tracking: 0.05 },
    );
    const brakes = fitted(
      fonts["Anton-Regular.ttf"],
      "INSTANT BRAKES",
      {
        x: caution.x,
        y: caution.y + caution.height * 1.12,
        w: caution.width,
        h: mid.h * 0.26,
      },
      { fill: c.red, tracking: 0.12 },
    );
    const side = Math.min(capped.h * 0.8, capped.w * 0.12);
    extra.push(
      k.pixels(
        "back",
        caution.svg +
          brakes.svg +
          lPlate(
            capped.x + capped.w - side * 0.6,
            capped.y + capped.h / 2,
            side,
            {
              ground: "none",
              frame: c.red,
            },
          ) +
          triangle(
            fonts,
            capped.x + side * 0.6,
            capped.y + capped.h / 2,
            side,
            {
              stroke: c.red,
              fill: c.white,
              glyph: "!",
            },
          ),
      ),
    );
  }
  // A small red triangle low on each rear quarter.
  for (const view of ["left", "right"]) {
    const s = k.scale(view);
    const [tx, ty] = k.pt[view](box.zmax - 0.25, yAt(0.7));
    extra.push(
      k.pixels(
        view,
        triangle(fonts, tx, ty, 0.05 * s, { stroke: c.red, fill: c.red }),
      ),
    );
  }
  return assemble(k, { defs, side, top, front, back, extra });
}

// -- the white Axio with the blue front and the red splash (suv) --

function splash(k, fonts) {
  const { L, box } = k;
  const c = COLORS;
  const m = measures(k);
  const { far, zAt, yAt } = m;
  const r = L.wheels.front.r;

  const lowEdge = [
    [box.zmin - far, yAt(0.4)],
    [zAt(1) - r * 1.1, yAt(0.45)],
    [zAt(1) - r * 0.1, yAt(0.6)],
    [zAt(1) + r * 1.4, yAt(0.9)],
    [zAt(0) - r * 1.3, yAt(0.92)],
    [zAt(0) + r * 0.5, yAt(0.7)],
    [box.zmax + far, yAt(0.62)],
  ];
  const low = poly(
    [...lowEdge, [box.zmax + far, -far], [box.zmin - far, -far]],
    c.blue,
  );
  // The splash: a red burst with ragged edges over the rear door and
  // quarter, blue brush strokes through it, stars on it, drops around it.
  const rand = rng(61);
  const cz = zAt(0.22);
  const cy = yAt(0.42);
  const rx = Math.min(0.62, m.wb * 0.24);
  const ry = m.band * 0.36;
  const burst = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const spike = i % 6 === 0 ? 1.35 + rand() * 0.3 : 0.85 + rand() * 0.25;
    burst.push([cz + Math.cos(a) * rx * spike, cy + Math.sin(a) * ry * spike]);
  }
  const drops = [];
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const d = 1.25 + rand() * 0.45;
    drops.push(
      `<circle cx="${n3(cz + Math.cos(a) * rx * d)}" cy="${n3(cy + Math.sin(a) * ry * d)}" r="${n3(0.008 + rand() * 0.02)}" fill="${c.red}"/>`,
    );
  }
  const strokes = [0, 1, 2]
    .map((i) =>
      poly(
        ribbon(
          bez(
            [cz + rx * 1.1, cy + ry * (0.5 - i * 0.4)],
            [cz + rx * 0.4, cy + ry * (0.8 - i * 0.4)],
            [cz - rx * 0.3, cy + ry * (-0.1 - i * 0.35)],
            [cz - rx * 1.05, cy + ry * (0.2 - i * 0.45)],
          ),
          taper(0.05 - i * 0.01),
        ),
        i === 1 ? c.navy : c.blue,
      ),
    )
    .join("");
  const side = [
    k.rect(-far, -far, far, far, c.white),
    poly(burst, c.red),
    ...drops,
    strokes,
    star(cz - rx * 0.45, cy + ry * 0.2, 0.06, c.white, {
      edge: c.blue,
      edgeK: 0.14,
      turn: 0.2,
    }),
    star(cz + rx * 0.35, cy - ry * 0.3, 0.045, c.orange, {
      edge: c.white,
      edgeK: 0.14,
      turn: -0.3,
    }),
    star(cz + rx * 0.7, cy + ry * 0.5, 0.035, c.white, { turn: 0.4 }),
    low,
    star(zAt(1) - r * 0.7, yAt(0.45), 0.04, c.white, {
      edge: c.red,
      edgeK: 0.12,
    }),
    star(zAt(0) + r * 0.9, yAt(0.66), 0.035, c.orange, {
      edge: c.white,
      edgeK: 0.12,
    }),
  ].join("");
  const top = k.rect(-far, -far, far, far, c.white);
  const bumperTop = L.sill + (L.bonnet.y - L.sill) * 0.55;
  const front = [
    k.rect(-far, -far, far, far, c.white),
    k.rect(-far, -far, far, bumperTop, c.blue),
    star(box.xmin * 0.7, bumperTop - 0.06, 0.04, c.orange, {
      edge: c.white,
      edgeK: 0.12,
    }),
  ].join("");
  const backTop = L.sill + (L.belt - L.sill) * 0.35;
  const back = [
    k.rect(-far, -far, far, far, c.white),
    k.rect(-far, -far, far, backTop, c.blue),
  ].join("");

  const extra = [];
  const spot = nameSpot(k, zAt(0.95), zAt(0.48), yAt(0.75), yAt(0.06));
  if (spot) {
    extra.push(
      onBothSides(k, spot, (b, view) => {
        const s = k.scale(view);
        const name = fitted(
          fonts["AlfaSlabOne-Regular.ttf"],
          "STEGA",
          k.cap({ ...b, h: b.h * 0.7 }, 0.2 * s, "top"),
          { fill: c.blue, keyline: c.white, edge: 0.05, tracking: 0.03 },
        );
        const school = fitted(
          fonts["Poppins-ExtraBold.ttf"],
          "DRIVING SCHOOL",
          {
            x: name.x,
            y: name.y + name.height * 1.12,
            w: name.width,
            h: name.height * 0.3,
          },
          { fill: c.red, tracking: 0.06 },
        );
        return name.svg + school.svg;
      }),
    );
  }
  const sf = k.scale("front");
  const [fx, fy] = k.pt.front(
    box.xmax * 0.5,
    L.sill + (bumperTop - L.sill) * 0.5,
  );
  extra.push(
    k.pixels(
      "front",
      triangle(fonts, fx, fy, 0.12 * sf, {
        stroke: c.red,
        fill: c.white,
        glyph: "!",
      }),
    ),
  );
  const tail = k.clearRect("back", box.xmin, box.xmax, backTop + 0.03, L.belt, {
    inset: 0.04,
  });
  if (tail) {
    const sb = k.scale("back");
    extra.push(
      k.pixels(
        "back",
        fitted(
          fonts["AlfaSlabOne-Regular.ttf"],
          "CAUTION",
          k.cap(k.boxPx("back", tail.z0, tail.y1, tail.z1, tail.y0), 0.11 * sb),
          { fill: c.red, keyline: c.blue, edge: 0.05, tracking: 0.04 },
        ).svg,
      ),
    );
  }
  return assemble(k, { side, top, front, back, extra });
}

// -- the white "Team STEGA" Mazda (crossover) --

/**
 * Their white Mazda (reference-team-*.jpg): a big red star edged black on
 * the rear door with black, red and grey streaks sweeping back from it, a
 * red shard splash edged black over the rear quarter, STEGA in blue italics
 * on the front door, red warning triangles, red arrows on the bonnet, the
 * Team STEGA plate; DRIVER UNDER INSTRUCTIONS, CAUTION and KEEP | Team
 * STEGA | DISTANCE at the back.
 */
function team(k, fonts) {
  const { L, box } = k;
  const c = COLORS;
  const m = measures(k);
  const { far, zAt, yAt } = m;
  const at = (u, v) => [zAt(u), yAt(v)];
  const edge = (w) =>
    ` stroke="${c.black}" stroke-width="${w}" stroke-linejoin="round" paint-order="stroke"`;

  // The streaks, from the star back and up over the rear door.
  const [sz, sy] = at(0.3, 0.45);
  const R = Math.min(0.22, m.band * 0.36);
  const streak = (dv, w, col, reach = 0.55) =>
    poly(
      ribbon(
        bez(
          [sz, sy + dv * m.band],
          [sz + R * 1.2, sy + (dv + 0.12) * m.band],
          [zAt(0.3 - reach * 0.6), yAt(0.2 - dv)],
          [zAt(0.3 - reach), yAt(0.06 - dv * 1.3)],
        ),
        taper(w),
      ),
      col,
    );
  const streaks = [
    streak(0.18, 0.11, c.black),
    streak(0.06, 0.08, c.red, 0.62),
    streak(-0.05, 0.05, c.black, 0.5),
    streak(-0.14, 0.035, "#9aa0a6", 0.42),
    streak(0.27, 0.04, c.red, 0.4),
  ].join("");
  // The shard splash over the rear quarter: red, edged black.
  const shard = poly(
    [
      at(0.18, 0.74),
      at(0.02, 0.56),
      at(-0.08, 0.64),
      at(-0.18, 0.4),
      at(-0.3, 0.5),
      at(-0.5, 0.3),
      at(-0.42, 0.58),
      at(-0.3, 0.8),
      at(-0.16, 0.7),
      at(-0.06, 0.9),
      at(0.06, 0.78),
    ],
    c.red,
    edge(0.014),
  );
  const side = [
    k.rect(-far, -far, far, far, c.white),
    shard,
    streaks,
    star(sz + 0.02, sy - 0.02, R * 1.06, c.black, { turn: 0.25 }),
    star(sz, sy, R, c.red, { edge: c.black, edgeK: 0.08, turn: 0.25 }),
  ].join("");

  // The bonnet: two red arrows, heads out towards the windscreen's corners.
  const bon = L.bonnet;
  const arrow = (sgn) => {
    const zA = bon.z0 + (bon.z1 - bon.z0) * 0.3;
    const zB = bon.z0 + (bon.z1 - bon.z0) * 0.72;
    const xIn = sgn * 0.05;
    const xOut = sgn * Math.min(bon.x1 * 0.88, 0.66);
    const t = 0.05;
    const kink = (xIn + xOut) / 2;
    return poly(
      [
        [zA, xIn],
        [zA + t * 1.6, xIn],
        [zA + (zB - zA) * 0.45, kink - sgn * 0.02],
        [zA + (zB - zA) * 0.45 + t, kink + sgn * 0.04],
        [zB - t * 0.6, xOut - sgn * 0.16],
        [zB + t * 0.9, xOut - sgn * 0.2],
        [zB, xOut],
        [zB - t * 2.6, xOut - sgn * 0.12],
        [zB - t * 1.6, xOut - sgn * 0.16],
        [zA + (zB - zA) * 0.45 - t * 0.4, kink + sgn * 0.06],
        [zA + (zB - zA) * 0.4 - t, kink],
      ],
      c.red,
    );
  };
  const top = [k.rect(-far, -far, far, far, c.white), arrow(1), arrow(-1)].join(
    "",
  );
  const front = k.rect(-far, -far, far, far, c.white);
  // The back's corners carry the side's red and black round.
  const corner = (sgn) =>
    [
      poly(
        [
          [sgn * box.xmax, L.belt - 0.06],
          [sgn * (box.xmax - 0.22), L.sill + (L.belt - L.sill) * 0.45],
          [sgn * (box.xmax - 0.16), L.sill + (L.belt - L.sill) * 0.42],
          [sgn * box.xmax, L.belt - 0.16],
        ],
        c.red,
        edge(0.01),
      ),
      poly(
        [
          [sgn * box.xmax, L.belt - 0.2],
          [sgn * (box.xmax - 0.12), L.sill + (L.belt - L.sill) * 0.4],
          [sgn * (box.xmax - 0.09), L.sill + (L.belt - L.sill) * 0.38],
          [sgn * box.xmax, L.belt - 0.26],
        ],
        c.black,
      ),
    ].join("");
  const back = [
    k.rect(-far, -far, far, far, c.white),
    corner(1),
    corner(-1),
  ].join("");

  const extra = [];
  // STEGA in blue italics on the front door, DRIVING SCHOOL under it.
  const spot = nameSpot(k, zAt(0.95), zAt(0.5), L.sill, L.belt);
  if (spot) {
    extra.push(
      onBothSides(k, spot, (b, view) => {
        const s = k.scale(view);
        const capped = k.cap(b, 0.3 * s);
        const name = fitted(
          fonts["Poppins-ExtraBold.ttf"],
          "STEGA",
          { ...capped, h: capped.h * 0.7 },
          {
            fill: c.blue,
            keyline: c.navy,
            edge: 0.1,
            tracking: 0.01,
            skew: -12,
          },
        );
        return (
          name.svg +
          fitted(
            fonts["Anton-Regular.ttf"],
            "DRIVING SCHOOL",
            {
              x: name.x,
              y: name.y + name.height * 1.1,
              w: name.width,
              h: capped.h * 0.24,
            },
            { fill: "#5b6068", tracking: 0.1, skew: -12 },
          ).svg
        );
      }),
    );
  }
  // Warning triangles: one over the front wheel, one in the shard.
  for (const view of ["left", "right"]) {
    const s = k.scale(view);
    const [tx, ty] = k.pt[view](...at(0.92, 0.3));
    const [qx, qy] = k.pt[view](...at(-0.26, 0.6));
    extra.push(
      k.pixels(
        view,
        triangle(fonts, tx, ty, 0.09 * s, {
          stroke: c.red,
          fill: c.white,
          glyph: "!",
        }) +
          triangle(fonts, qx, qy, 0.07 * s, {
            stroke: c.white,
            fill: c.red,
            glyph: "!",
            ink: c.white,
          }),
      ),
    );
  }
  // The bonnet's nose: their number, read from in front.
  extra.push(
    k.onTopWith(
      {
        z0: bon.z0 + 0.05,
        z1: bon.z0 + 0.15,
        x0: bon.x0 * 0.5,
        x1: bon.x1 * 0.5,
      },
      (b) =>
        `<g transform="rotate(180 ${n3(b.x + b.w / 2)} ${n3(b.y + b.h / 2)})">${phoneIn(fonts, b, c.black)}</g>`,
    ),
  );
  // The front: the Team STEGA plate, a red triangle low on the bumper.
  const sf = k.scale("front");
  const plateY = L.sill + (L.bonnet.y - L.sill) * 0.35;
  const plate = k.boxPx("front", 0.26, plateY + 0.075, -0.26, plateY - 0.075);
  const [t1x, t1y] = k.pt.front(box.xmin * 0.72, plateY - 0.02);
  extra.push(
    k.pixels(
      "front",
      teamPlate(fonts, plate) +
        triangle(fonts, t1x, t1y, 0.1 * sf, {
          stroke: c.red,
          fill: c.white,
          glyph: "!",
        }),
    ),
  );
  // The back: DRIVER UNDER INSTRUCTIONS over the boot, two triangles,
  // CAUTION; KEEP | Team STEGA | DISTANCE on the bumper.
  const sb = k.scale("back");
  const split = L.sill + (L.belt - L.sill) * 0.42;
  const boot = k.clearRect(
    "back",
    box.xmin + 0.2,
    box.xmax - 0.2,
    split,
    L.belt,
    {
      inset: 0.03,
    },
  );
  if (boot) {
    const bb = k.boxPx("back", boot.z0, boot.y1, boot.z1, boot.y0);
    const lineH = Math.min(0.055 * sb, bb.h * 0.3);
    const top1 = fitted(
      fonts["AlfaSlabOne-Regular.ttf"],
      "DRIVER UNDER INSTRUCTIONS",
      { x: bb.x, y: bb.y, w: bb.w, h: lineH },
      { fill: c.red, tracking: 0.02 },
    );
    const cH = Math.min(0.1 * sb, bb.h * 0.42);
    const caution = fitted(
      fonts["AlfaSlabOne-Regular.ttf"],
      "CAUTION",
      { x: bb.x + bb.w * 0.15, y: bb.y + bb.h - cH, w: bb.w * 0.7, h: cH },
      { fill: c.red, tracking: 0.04 },
    );
    const triY = (top1.y + top1.height + caution.y) / 2 + cH * 0.1;
    const tri = Math.min(0.08 * sb, caution.y - top1.y - top1.height);
    extra.push(
      k.pixels(
        "back",
        top1.svg +
          caution.svg +
          triangle(fonts, caution.x + caution.width * 0.18, triY, tri, {
            stroke: c.red,
            fill: c.white,
            glyph: "!",
          }) +
          triangle(fonts, caution.x + caution.width * 0.82, triY, tri, {
            stroke: c.red,
            fill: c.white,
            glyph: "!",
          }),
      ),
    );
  }
  const bump = k.clearRect(
    "back",
    box.xmin + 0.1,
    box.xmax - 0.1,
    L.sill,
    split,
    {
      inset: 0.02,
    },
  );
  if (bump) {
    const bb = k.cap(
      k.boxPx("back", bump.z0, bump.y1, bump.z1, bump.y0),
      0.12 * sb,
    );
    const pw = Math.min(bb.w * 0.26, bb.h * 2.2);
    const px = bb.x + (bb.w - pw) / 2;
    const ink = { fill: c.black, tracking: 0.03 };
    extra.push(
      k.pixels(
        "back",
        teamPlate(fonts, { x: px, y: bb.y, w: pw, h: bb.h }) +
          fitted(
            fonts["Poppins-ExtraBold.ttf"],
            "KEEP",
            {
              x: bb.x,
              y: bb.y + bb.h * 0.25,
              w: px - bb.x - bb.w * 0.02,
              h: bb.h * 0.5,
            },
            { ...ink, align: "right" },
          ).svg +
          fitted(
            fonts["Poppins-ExtraBold.ttf"],
            "DISTANCE",
            {
              x: px + pw + bb.w * 0.02,
              y: bb.y + bb.h * 0.25,
              w: bb.x + bb.w - px - pw - bb.w * 0.02,
              h: bb.h * 0.5,
            },
            { ...ink, align: "left" },
          ).svg,
      ),
    );
  }
  return assemble(k, { side, top, front, back, extra });
}

/** Their Team STEGA plate: white, a black edge, red lettering. */
function teamPlate(fonts, plate) {
  const c = COLORS;
  return [
    `<rect x="${n3(plate.x)}" y="${n3(plate.y)}" width="${n3(plate.w)}" height="${n3(plate.h)}" rx="${n3(plate.h * 0.08)}" fill="${c.white}" stroke="${c.black}" stroke-width="${n3(plate.h * 0.05)}"/>`,
    fitted(
      fonts["Poppins-Bold.ttf"],
      "Team",
      { x: plate.x, y: plate.y + plate.h * 0.1, w: plate.w, h: plate.h * 0.3 },
      { fill: c.red },
    ).svg,
    fitted(
      fonts["Poppins-ExtraBold.ttf"],
      "STEGA",
      {
        x: plate.x + plate.w * 0.08,
        y: plate.y + plate.h * 0.46,
        w: plate.w * 0.84,
        h: plate.h * 0.42,
      },
      { fill: c.red, tracking: 0.04 },
    ).svg,
  ].join("");
}

// -- the white truck (van, lorry) --

/** Their big blue truck lettering: blue with light speed lines, edged navy. */
const TRUCK_DEFS = (h) => `
  <pattern id="stega-lines" width="10" height="${n3(h / 6)}" patternUnits="userSpaceOnUse">
    <rect width="10" height="${n3(h / 6)}" fill="${COLORS.board}"/>
    <rect y="${n3(h / 12)}" width="10" height="${n3(h / 30)}" fill="${COLORS.boardRim}"/>
  </pattern>`;

/** STEGA over DRIVING SCHOOL, truck style, filling a pixel box. */
function truckName(fonts, b) {
  const name = fitted(
    fonts["AlfaSlabOne-Regular.ttf"],
    "STEGA",
    { x: b.x, y: b.y, w: b.w, h: b.h * 0.72 },
    {
      fill: "url(#stega-lines)",
      keyline: COLORS.navy,
      edge: 0.07,
      tracking: 0.03,
    },
  );
  const school = fitted(
    fonts["Poppins-ExtraBold.ttf"],
    "DRIVING SCHOOL",
    {
      x: name.x + name.width * 0.35,
      y: name.y + name.height * 1.08,
      w: name.width * 0.65,
      h: b.h * 0.2,
    },
    { fill: COLORS.fielder, tracking: 0.05, align: "right" },
  );
  return name.svg + school.svg;
}

/** Their small blue tiles, a square with a cross, scattered in metres. */
function tiles(seed, z0, z1, y0, y1, count) {
  const rand = rng(seed);
  const s = 0.07;
  const out = [];
  for (let i = 0; i < count; i++) {
    const z = z0 + rand() * (z1 - z0);
    const y = y0 + rand() * (y1 - y0);
    out.push(
      `<rect x="${n3(z - s / 2)}" y="${n3(y - s / 2)}" width="${s}" height="${s}" fill="none" stroke="${COLORS.sky}" stroke-width="0.012"/>`,
      `<path d="M${n3(z - s * 0.3)} ${n3(y - s * 0.3)}L${n3(z + s * 0.3)} ${n3(y + s * 0.3)}M${n3(z + s * 0.3)} ${n3(y - s * 0.3)}L${n3(z - s * 0.3)} ${n3(y + s * 0.3)}" stroke="${COLORS.sky}" stroke-width="0.01"/>`,
    );
  }
  return out.join("");
}

/** The caution header: STEGA, then CAUTION over DRIVER UNDER INSTRUCTION. */
function cautionHeader(fonts, b) {
  const c = COLORS;
  const nameW = b.w * 0.42;
  const name = fitted(
    fonts["AlfaSlabOne-Regular.ttf"],
    "STEGA",
    { x: b.x, y: b.y, w: nameW, h: b.h },
    { fill: "url(#stega-lines)", keyline: c.navy, edge: 0.07, tracking: 0.03 },
  );
  const tx = b.x + nameW + b.w * 0.04;
  const tw = b.w - nameW - b.w * 0.04;
  return (
    name.svg +
    fitted(
      fonts["AlfaSlabOne-Regular.ttf"],
      "CAUTION",
      { x: tx, y: b.y, w: tw, h: b.h * 0.52 },
      { fill: c.red, tracking: 0.04 },
    ).svg +
    fitted(
      fonts["Anton-Regular.ttf"],
      "DRIVER UNDER INSTRUCTION",
      { x: tx, y: b.y + b.h * 0.62, w: tw, h: b.h * 0.34 },
      { fill: c.red, tracking: 0.04 },
    ).svg
  );
}

function truck(k, fonts) {
  const { L, box } = k;
  const c = COLORS;
  const far = 9;
  const lorry = k.kind === "lorry";
  const extra = [];
  const white = k.rect(-far, -far, far, far, c.white);

  // The big panel: the lorry's box, or the van's tall side behind its
  // windows; the lettering about 55 cm on the lorry, 30 cm on the van.
  const panel = lorry
    ? {
        z0: L.load.z0 + 0.2,
        z1: L.load.z1 - 0.2,
        y0: L.load.rail + 0.06,
        y1: L.load.y1 - 0.08,
      }
    : k.clearRect("both", L.wheels.front.z, box.zmax, L.sill + 0.05, box.ymax, {
        inset: 0.04,
      });
  const nameH = 0.78;
  const defs = TRUCK_DEFS(64);
  const sideArt = [white];
  if (panel) {
    const pz0 = panel.z0;
    const pz1 = panel.z1;
    sideArt.push(
      tiles(71, pz0, pz1, panel.y0 + 0.05, panel.y1 - 0.05, lorry ? 22 : 8),
    );
    extra.push(
      onBothSides(k, panel, (b, view) => {
        const s = k.scale(view);
        const nose = view === "left";
        // Name low on the panel, towards the tail; the L plate and the
        // numbers high, towards the nose.
        const nb = k.cap(
          { x: nose ? b.x + b.w * 0.32 : b.x, y: b.y, w: b.w * 0.68, h: b.h },
          nameH * s,
          "bottom",
        );
        // The van's name goes along its doors instead (below).
        const name = lorry ? truckName(fonts, nb) : "";
        const lSize = Math.min((lorry ? 0.42 : 0.24) * s, b.h * 0.4);
        const lx = nose ? b.x + lSize * 0.7 : b.x + b.w - lSize * 0.7;
        const ly = b.y + lSize * 0.65;
        const numW = Math.min(b.w * 0.3, (lorry ? 0.9 : 0.55) * s);
        const numX = nose ? lx + lSize * 0.7 : lx - lSize * 0.7 - numW;
        const numH = Math.min((lorry ? 0.07 : 0.045) * s, b.h * 0.08);
        const bold = fonts["Poppins-Bold.ttf"];
        return [
          `<rect x="${n3(lx - lSize / 2)}" y="${n3(ly - lSize / 2)}" width="${n3(lSize)}" height="${n3(lSize)}" fill="${c.white}" stroke="${c.red}" stroke-width="${n3(lSize * 0.05)}"/>`,
          lPlate(lx, ly, lSize * 0.86, { ground: c.red, ink: c.white }),
          fitted(
            bold,
            `OFFICE ${PHONE}`,
            { x: numX, y: ly - numH * 1.2, w: numW, h: numH },
            { fill: c.fielder, align: nose ? "left" : "right" },
          ).svg,
          fitted(
            bold,
            `EMBAKASI ${BRANCH}`,
            { x: numX, y: ly + numH * 0.4, w: numW, h: numH },
            { fill: c.red, align: nose ? "left" : "right" },
          ).svg,
          name,
        ].join("");
      }),
    );
  }
  // The van: STEGA large along the long band of its doors, under the
  // windows, as a sign writer letters a van's flank.
  const doors = lorry
    ? null
    : k.clearRect(
        "both",
        L.wheels.front.z + 0.3,
        box.zmax - 0.1,
        L.sill + 0.05,
        L.belt,
        {
          inset: 0.04,
        },
      );
  if (doors) {
    sideArt.push(tiles(75, doors.z0, doors.z1, doors.y0, doors.y1, 6));
    extra.push(
      onBothSides(k, doors, (b, view) =>
        truckName(fonts, k.cap(b, 0.44 * k.scale(view))),
      ),
    );
  }
  // The lorry's cab: STEGA in red on the door, a few tiles.
  if (lorry) {
    const cab = L.cab;
    sideArt.push(
      tiles(
        73,
        cab.z0 + 0.15,
        cab.z1 - 0.1,
        cab.sill + 0.12,
        cab.belt - 0.05,
        4,
      ),
    );
    const door = k.clearRect(
      "both",
      cab.z0,
      cab.z1,
      cab.sill,
      cab.belt + 0.02,
      { inset: 0.03 },
    );
    if (door) {
      extra.push(
        onBothSides(k, door, (b, view) => {
          const s = k.scale(view);
          const nb = k.cap(b, 0.2 * s);
          const name = fitted(
            fonts["AlfaSlabOne-Regular.ttf"],
            "STEGA",
            { ...nb, h: nb.h * 0.7 },
            { fill: c.red, keyline: c.fielder, edge: 0.06, skew: -8 },
          );
          return (
            name.svg +
            fitted(
              fonts["Poppins-ExtraBold.ttf"],
              "DRIVING SCHOOL",
              {
                x: name.x,
                y: name.y + name.height * 1.1,
                w: name.width,
                h: nb.h * 0.22,
              },
              { fill: c.fielder, tracking: 0.05 },
            ).svg
          );
        }),
      );
    }
  }
  const side = sideArt.join("");

  // Over the cab (lorry) or across the van's nose: the caution header.
  const sf = k.scale("front");
  if (lorry) {
    const hb = k.boxPx(
      "front",
      box.xmin + 0.12,
      L.load.y1 - 0.06,
      box.xmax - 0.12,
      L.cab.top + 0.1,
    );
    extra.push(k.pixels("front", cautionHeader(fonts, k.cap(hb, 0.5 * sf))));
  } else {
    const nose = k.clearRect(
      "back",
      box.xmin,
      box.xmax,
      L.sill + 0.05,
      L.belt,
      { inset: 0.04 },
    );
    if (nose) {
      const sb = k.scale("back");
      const hb = k.boxPx("back", nose.z0, nose.y1, nose.z1, nose.y0);
      extra.push(k.pixels("back", cautionHeader(fonts, k.cap(hb, 0.2 * sb))));
    }
    const [lx, ly] = k.pt.front(box.xmax * 0.5, L.sill + 0.25);
    extra.push(k.pixels("front", lPlate(lx, ly, 0.14 * sf, { frame: c.red })));
  }
  // The roof, for the camera above: their logo, read as it drives away.
  const roof = lorry
    ? {
        z0: L.load.z0 + 0.5,
        z1: L.load.z1 - 0.4,
        x0: box.xmin + 0.22,
        x1: box.xmax - 0.22,
      }
    : L.roof.clear
      ? {
          z0: L.roof.board.z + 0.6,
          z1: L.roof.z1 - 0.2,
          x0: L.roof.x0 + 0.2,
          x1: L.roof.x1 - 0.2,
        }
      : null;
  if (roof) {
    extra.push(
      k.onTopWith(roof, (b) => {
        const w = Math.min(b.w * 0.9, (b.h * 0.9) / STACK_TALL);
        const lg = logoStack(b.x + b.w / 2, 0, w);
        return logoStack(b.x + b.w / 2, b.y + (b.h - lg.h) / 2, w).svg;
      }),
    );
  }
  return assemble(k, {
    defs,
    side,
    top: white,
    front: white,
    back: white,
    extra,
  });
}

// ---- the logo ------------------------------------------------------------------------------

/**
 * Their logo in a row: the emblem, then STEGA over DRIVING SCHOOL, on
 * nothing (their logo sits on white). `mono` is all white, for brass and
 * board paint.
 */
export function logo({ mono }) {
  const w = 1200;
  const h = 470;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${logoRow({ x: 30, y: 60, w: w - 60, h: h - 120 }, { mono })}
  </svg>`;
}

// ---- the roof board (app/components/board/top-board.ts) --------------------------------------

/** The roof board's size on the board cars, in metres, and its corner cut. */
export const TOP_BOARD = { width: 1.35, height: 0.45, cut: 0.05 };

/** Marquee bulbs, for STEGA on the roof board. */
const BULBS = (r) => `
  <pattern id="stega-bulbs" width="${r * 3.5}" height="${r * 3.5}" patternUnits="userSpaceOnUse">
    <rect width="${r * 3.5}" height="${r * 3.5}" fill="${COLORS.yellow}"/>
    <circle cx="${r * 1.75}" cy="${r * 1.75}" r="${r}" fill="#fff6b8" stroke="#c99a12" stroke-width="${r * 0.3}"/>
  </pattern>`;

/**
 * Their roof board: a blue oval, STEGA in yellow bulb letters, CAUTION
 * between an L and a warning triangle, DRIVER UNDER INSTRUCTIONS under it.
 */
export function topBoard({ fonts }) {
  const c = COLORS;
  const w = 1200;
  const h = (w * TOP_BOARD.height) / TOP_BOARD.width;
  const rim = 16;
  const name = fitted(
    fonts["AlfaSlabOne-Regular.ttf"],
    "STEGA",
    { x: 250, y: 34, w: w - 500, h: 150 },
    { fill: "url(#stega-bulbs)", keyline: c.navy, edge: 0.07, tracking: 0.08 },
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>${BULBS(5.5)}</defs>
    <rect width="${w}" height="${h}" fill="${c.board}"/>
    <rect x="${rim}" y="${rim}" width="${w - 2 * rim}" height="${h - 2 * rim}" rx="${(h - 2 * rim) / 2}" fill="none" stroke="${c.boardRim}" stroke-width="7"/>
    ${name.svg}
    ${triangle(fonts, 150, 238, 110, { stroke: c.red, fill: c.yellow, ink: c.black, glyph: "L" })}
    ${triangle(fonts, w - 150, 238, 110, { stroke: c.red, fill: c.yellow, ink: c.black, glyph: "!" })}
    ${fitted(fonts["AlfaSlabOne-Regular.ttf"], "CAUTION", { x: 250, y: 196, w: w - 500, h: 86 }, { fill: c.orange, keyline: c.navy, edge: 0.06, tracking: 0.05 }).svg}
    ${fitted(fonts["Anton-Regular.ttf"], "DRIVER UNDER INSTRUCTIONS", { x: 230, y: 296, w: w - 460, h: 52 }, { fill: c.white, tracking: 0.05 }).svg}
  </svg>`;
}

// ---- the classroom's walls (app/lib/board/room.ts) -------------------------------------------

/** A checkered strip along a box (pixels), squares `q` across. */
function checkerStrip(x, y, w, rows, q) {
  const out = [
    `<rect x="${x}" y="${y}" width="${w}" height="${rows * q}" fill="${COLORS.white}"/>`,
  ];
  for (let i = 0; i * q < w; i++) {
    for (let j = 0; j < rows; j++) {
      if ((i + j) % 2) continue;
      out.push(
        `<rect x="${x + i * q}" y="${y + j * q}" width="${Math.min(q, w - i * q)}" height="${q}" fill="${COLORS.black}"/>`,
      );
    }
  }
  return out.join("");
}

/**
 * The wall banner (3.2 x 0.6 m): their logo in a row on white, a blue band
 * with their number, red and blue at the ends, a checkered strip.
 */
export function banner({ fonts }) {
  const w = 2048;
  const h = 384;
  const c = COLORS;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${c.white}"/>
    ${poly(
      [
        [0, 0],
        [250, 0],
        [150, h],
        [0, h],
      ],
      c.logoRed,
    )}
    ${poly(
      [
        [270, 0],
        [320, 0],
        [220, h],
        [170, h],
      ],
      c.logoBlue,
    )}
    ${poly(
      [
        [w, 0],
        [w - 250, 0],
        [w - 150, h],
        [w, h],
      ],
      c.logoBlue,
    )}
    ${poly(
      [
        [w - 270, 0],
        [w - 320, 0],
        [w - 220, h],
        [w - 170, h],
      ],
      c.logoRed,
    )}
    ${logoRow({ x: 360, y: 36, w: 900, h: 240 })}
    <rect x="1300" y="70" width="420" height="170" rx="20" fill="${c.logoBlue}"/>
    ${fitted(fonts["Poppins-Medium.ttf"], "Call us", { x: 1330, y: 88, w: 360, h: 40 }, { fill: c.white }).svg}
    ${fitted(fonts["Poppins-ExtraBold.ttf"], PHONE, { x: 1330, y: 142, w: 360, h: 72 }, { fill: c.white, tracking: 0.03 }).svg}
    ${checkerStrip(330, 300, w - 660, 2, 28)}
    ${star(1265, 290, 22, c.logoRed, { yUp: false })}
    ${star(1760, 290, 22, c.logoBlue, { yUp: false })}
  </svg>`;
}

/**
 * Two framed posters (0.52 x 0.72 m): their logo with "Est 1995", and an
 * invitation to learn with them, with where to find them. No prices and no
 * promises about passing.
 */
export function posters({ fonts }) {
  const w = 1024;
  const h = 1418;
  const c = COLORS;
  const heavy = fonts["Poppins-ExtraBold.ttf"];
  const medium = fonts["Poppins-Medium.ttf"];
  const bold = fonts["Poppins-Bold.ttf"];
  const centred = (font, text, y, wanted, fill, tracking = 0.02) =>
    fitted(font, text, { x: 80, y, w: w - 160, h: wanted }, { fill, tracking })
      .svg;
  const stack = logoStack(w / 2, 300, 700, { est: true });
  const logoPoster = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${c.white}"/>
    <rect width="${w}" height="70" fill="${c.logoRed}"/>
    <rect y="70" width="${w}" height="22" fill="${c.logoBlue}"/>
    ${stack.svg}
    ${checkerStrip(0, h - 300, w, 2, 64)}
    <rect y="${h - 172}" width="${w}" height="172" fill="${c.logoBlue}"/>
    ${centred(heavy, PHONE, h - 128, 86, c.white, 0.04)}
  </svg>`;
  const small = logoStack(w / 2, 420, 520);
  const lessons = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${c.white}"/>
    <rect width="${w}" height="230" fill="${c.logoBlue}"/>
    ${centred(heavy, "LEARN TO DRIVE", 60, 96, c.white)}
    ${centred(medium, "with", 176, 40, c.white)}
    ${small.svg}
    ${centred(bold, "Reli Co-op House, 3rd floor", 420 + small.h + 70, 50, c.logoBlue)}
    ${centred(medium, "Mfangano Street, Nairobi", 420 + small.h + 140, 40, c.logoBlue)}
    ${checkerStrip(0, h - 260, w, 1, 64)}
    <rect y="${h - 196}" width="${w}" height="196" fill="${c.logoRed}"/>
    ${centred(heavy, PHONE, h - 170, 70, c.white, 0.04)}
    ${centred(medium, "stegadrivingschool.com", h - 76, 44, c.white)}
  </svg>`;
  return [
    { id: "logo", svg: logoPoster },
    { id: "lessons", svg: lessons },
  ];
}
