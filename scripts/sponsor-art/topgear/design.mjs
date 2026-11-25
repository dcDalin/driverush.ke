/**
 * Top Gear Driving School's own car, as on the photos of their real one
 * (reference-side.png, reference-front.jpg): not a style of ours. Fitted to
 * every board car by placing each part where it sits on their car, measured
 * against the wheels and the window line.
 *
 * From the photos (their red car's left side, nose to the left; wheel centres
 * at x 77 and 475, window line at y 198, door bottoms at y 312):
 *   - a red body
 *   - "TOP GEAR" across both doors in heavy block letters of mirror gold with
 *     a black edge, and "DRIVING SCHOOL" in yellow under it
 *   - a yellow band along the bottom of the body, all the way round
 *   - a thin yellow sweep on the front wing, rising from the headlamp
 *   - their "TG" mark (a T and a G with gear wheels) scattered in white and
 *     gold over the wings, the rear quarters and the bonnet
 *   - a yellow disc with the gear-stick pattern on the rear quarter, and a
 *     yellow oval with TOP, the pattern and GEAR on the bonnet
 *   - a white square with a red L, front and back
 *
 * Their door lettering is a block face with no free match, so its seven
 * letters are drawn here to the photo's shapes. "DRIVING SCHOOL" and the
 * roof board are set in the closest free typefaces (Anton, Alfa Slab One),
 * and the logo's words in Arvo Bold. The TG mark is traced from their logo
 * (trace.mjs). When Top Gear sends their artwork files, they replace these.
 *
 * Not copied: the lettering across the top of their windscreen (the board
 * cars' glass is not painted) and their number plate.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { aspectOf, line } from "../lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Their colours, measured off the photos and lifted out of the daylight. */
export const COLORS = {
  red: "#c2201c",
  yellow: "#f7c41c",
  white: "#fbfaf6",
  black: "#15120d",
  // The mirror gold of the door lettering, top to bottom.
  gold: ["#dcb827", "#c9a31f", "#84700f", "#93791a", "#ecc92a", "#d6ae1d"],
  // The roof board.
  board: "#f8b91c",
  boardRed: "#d81f1c",
  // The logo.
  logoYellow: "#f6ee1f",
  logoBlue: "#1b34c8",
  logoRed: "#e02a1c",
};

/** Places along the car, as on the photo: 0 = rear wheel, 1 = front wheel. */
const PHOTO = { rearWheel: 475, frontWheel: 77, belt: 198, sill: 312 };
const along = (x) =>
  (x - PHOTO.rearWheel) / (PHOTO.frontWheel - PHOTO.rearWheel);
const down = (y) => (y - PHOTO.belt) / (PHOTO.sill - PHOTO.belt);

/** The yellow band along the bottom, as a share of the doors' height. */
const LIP = 10 / (PHOTO.sill - PHOTO.belt);
/** The disc on the rear quarter: where, and how wide against the wheelbase. */
const DISC = { at: along(505), y: down(203), d: 48 / 398 };
/** A TG mark's height on their car, in metres (about a hand's width). */
const MARK = 0.135;
/**
 * Their TG marks, as on the photo: [along, down, look]. `look` is solid
 * white ("w"), solid gold ("g"), or an outline of either ("wo", "go").
 */
const MARKS = [
  [along(85), down(213), "w"],
  [along(118), down(211), "go"],
  [along(42), down(238), "wo"],
  [along(23), down(256), "g"],
  [along(117), down(248), "g"],
  [along(474), down(169), "go"],
  [along(549), down(202), "g"],
  [along(473), down(228), "wo"],
  [along(537), down(234), "w"],
  [along(574), down(239), "go"],
  [along(503), down(248), "go"],
  [along(547), down(272), "g"],
  [along(586), down(276), "wo"],
];

// ---- the TG mark ---------------------------------------------------------------------

const tgSvg = readFileSync(path.join(HERE, "tg.svg"), "utf8");
const [, TG_W, TG_H] = /width="(\d+)" height="(\d+)"/.exec(tgSvg).map(Number);
const TG_INNER = /<g id="tg"[\s\S]*?<\/g>/.exec(tgSvg)[0];

/**
 * Their TG mark with its middle at (cx, cy), `h` tall, in pixels. `look` as
 * in MARKS, or any colour for a plain solid mark.
 */
function tg(cx, cy, h, look) {
  const c = COLORS;
  const k = h / TG_H;
  const at = `translate(${(cx - (TG_W * k) / 2).toFixed(1)} ${(cy - h / 2).toFixed(1)}) scale(${k.toFixed(5)})`;
  const paint =
    look === "w"
      ? `fill="${c.white}"`
      : look === "g"
        ? `fill="${c.yellow}"`
        : look === "wo" || look === "go"
          ? // An outline: the body's red inside a line of white or gold.
            `fill="${c.red}" stroke="${look === "wo" ? c.white : c.yellow}" stroke-width="${(TG_H * 0.05).toFixed(0)}" stroke-linejoin="round"`
          : `fill="${look}"`;
  return `<g transform="${at}" ${paint}>${TG_INNER}</g>`;
}

// ---- the door lettering ----------------------------------------------------------------

/**
 * Their block letters, each on a grid 5 wide and 7 tall: a heavy slab with
 * its corners cut, and small square holes and notches. Each is a list of
 * outlines; the first is the letter's edge, the rest are cut out of it.
 */
const C = 0.5; // the corner cut
const GLYPHS = {
  T: [
    [
      [C, 0],
      [5 - C, 0],
      [5, C],
      [5, 2],
      [3.5, 2],
      [3.5, 7],
      [1.5, 7],
      [1.5, 2],
      [0, 2],
      [0, C],
    ],
  ],
  O: [
    [
      [C, 0],
      [5 - C, 0],
      [5, C],
      [5, 7 - C],
      [5 - C, 7],
      [C, 7],
      [0, 7 - C],
      [0, C],
    ],
    [
      [1.95, 1.9],
      [3.05, 1.9],
      [3.05, 5.1],
      [1.95, 5.1],
    ],
  ],
  P: [
    [
      [C, 0],
      [5 - C, 0],
      [5, C],
      [5, 4.4 - C],
      [5 - C, 4.4],
      [2, 4.4],
      [2, 7],
      [0, 7],
      [0, C],
    ],
    [
      [1.95, 1.6],
      [3.05, 1.6],
      [3.05, 2.8],
      [1.95, 2.8],
    ],
  ],
  G: [
    [
      [C, 0],
      [5 - C, 0],
      [5, C],
      [5, 7 - C],
      [5 - C, 7],
      [C, 7],
      [0, 7 - C],
      [0, C],
    ],
    [
      [1.95, 1.8],
      [5, 1.8],
      [5, 3],
      [3.05, 3],
      [3.05, 5.2],
      [1.95, 5.2],
    ],
  ],
  E: [
    [
      [C, 0],
      [5 - C, 0],
      [5, C],
      [5, 7 - C],
      [5 - C, 7],
      [C, 7],
      [0, 7 - C],
      [0, C],
    ],
    [
      [2, 1.7],
      [5, 1.7],
      [5, 5.3],
      [2, 5.3],
      [2, 4.2],
      [4.1, 4.2],
      [4.1, 2.8],
      [2, 2.8],
    ],
  ],
  A: [
    [
      [C, 0],
      [5 - C, 0],
      [5, C],
      [5, 7],
      [3.05, 7],
      [3.05, 4.5],
      [1.95, 4.5],
      [1.95, 7],
      [0, 7],
      [0, C],
    ],
    [
      [1.95, 1.6],
      [3.05, 1.6],
      [3.05, 2.9],
      [1.95, 2.9],
    ],
  ],
  R: [
    [
      [C, 0],
      [5 - C, 0],
      [5, C],
      [5, 3.3],
      [4.4, 3.8],
      [5, 4.3],
      [5, 7],
      [3.05, 7],
      [3.05, 4.5],
      [1.95, 4.5],
      [1.95, 7],
      [0, 7],
      [0, C],
    ],
    [
      [1.95, 1.6],
      [3.05, 1.6],
      [3.05, 2.9],
      [1.95, 2.9],
    ],
  ],
};
const GAP = 0.45; // between letters, in grid units
const SPACE = 3.2; // between words

/** How wide a word in their block letters is, for a height of 1. */
function blockAspect(text) {
  let w = 0;
  [...text].forEach((ch, i) => {
    if (ch === " ") w += SPACE - GAP;
    else w += 5 + (i < text.length - 1 ? GAP : 0);
  });
  return w / 7;
}

/** Words in their block letters as one path: top-left at (x, y), `h` tall. */
function block(text, x, y, h) {
  const k = h / 7;
  let at = 0;
  const out = [];
  for (const ch of text) {
    if (ch === " ") {
      at += SPACE - GAP;
      continue;
    }
    for (const ring of GLYPHS[ch]) {
      out.push(
        `${ring
          .map(
            ([px, py], i) =>
              `${i ? "L" : "M"}${(x + (at + px) * k).toFixed(1)} ${(y + py * k).toFixed(1)}`,
          )
          .join("")}Z`,
      );
    }
    at += 5 + GAP;
  }
  return out.join("");
}

/**
 * "TOP GEAR" over "DRIVING SCHOOL", as on their doors, filling `box` (pixels)
 * as far as it can without changing shape. `mono` draws it all in white.
 */
export function lettering(
  fonts,
  box,
  { mono = false, id = "l", tag: withTag = true } = {},
) {
  const c = COLORS;
  const tagFont = fonts["Anton-Regular.ttf"];
  const a1 = blockAspect("TOP GEAR");
  const a2 = aspectOf(tagFont, "DRIVING SCHOOL", 0.02);
  // As on the car: the tagline is two thirds of the name's width, centred
  // under it, close below.
  const tagShare = 0.67;
  const gap = 0.1;
  const w = withTag
    ? Math.min(box.w, box.h / ((1 + gap) / a1 + tagShare / a2))
    : Math.min(box.w, box.h * a1);
  const h1 = w / a1;
  const w2 = w * tagShare;
  const h2 = w2 / a2;
  const total = withTag ? h1 * (1 + gap) + h2 : h1;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + (box.h - total) / 2;
  const name = block("TOP GEAR", x, y, h1);
  const tag = !withTag
    ? ""
    : line(tagFont, "DRIVING SCHOOL", {
        x: x + (w - w2) / 2,
        y: y + h1 * (1 + gap),
        height: h2,
        tracking: 0.02,
      });
  if (mono) {
    return `<path d="${name}" fill="#fff" fill-rule="evenodd"/><path d="${tag}" fill="#fff"/>`;
  }
  const edge = h1 * 0.075;
  const stops = c.gold
    .map(
      (col, i) =>
        `<stop offset="${[0, 0.16, 0.3, 0.44, 0.54, 1][i]}" stop-color="${col}"/>`,
    )
    .join("");
  return [
    `<defs><linearGradient id="${id}-gold" gradientUnits="userSpaceOnUse" x1="0" y1="${y.toFixed(1)}" x2="0" y2="${(y + h1).toFixed(1)}">${stops}</linearGradient></defs>`,
    // The black edge, heavier below and to the right, as a shadow.
    `<path d="${name}" transform="translate(${(edge * 0.5).toFixed(1)} ${(edge * 0.6).toFixed(1)})" fill="${c.black}" stroke="${c.black}" stroke-width="${(edge * 2).toFixed(1)}" stroke-linejoin="miter" fill-rule="evenodd"/>`,
    `<path d="${name}" fill="${c.black}" stroke="${c.black}" stroke-width="${(edge * 1.6).toFixed(1)}" stroke-linejoin="miter" fill-rule="evenodd"/>`,
    `<path d="${name}" fill="url(#${id}-gold)" fill-rule="evenodd"/>`,
    `<path d="${tag}" fill="${c.yellow}"/>`,
  ].join("");
}

/**
 * TOP over GEAR in their gold block letters, both lines the same height,
 * filling `box` (pixels): for a long roof seen from behind.
 */
function stacked(box, id) {
  const c = COLORS;
  const aTop = blockAspect("TOP");
  const aGear = blockAspect("GEAR");
  const gap = 0.22;
  const h = Math.min(box.w / aGear, box.h / (2 + gap));
  const rows = [
    ["TOP", box.y + (box.h - h * (2 + gap)) / 2],
    ["GEAR", box.y + (box.h - h * (2 + gap)) / 2 + h * (1 + gap)],
  ];
  const edge = h * 0.075;
  const stops = c.gold
    .map(
      (col, i) =>
        `<stop offset="${[0, 0.16, 0.3, 0.44, 0.54, 1][i]}" stop-color="${col}"/>`,
    )
    .join("");
  return rows
    .map(([text, y], i) => {
      const w = h * (text === "TOP" ? aTop : aGear);
      const d = block(text, box.x + (box.w - w) / 2, y, h);
      const gid = `${id}-${i}-gold`;
      return [
        `<defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${y.toFixed(1)}" x2="0" y2="${(y + h).toFixed(1)}">${stops}</linearGradient></defs>`,
        `<path d="${d}" transform="translate(${(edge * 0.5).toFixed(1)} ${(edge * 0.6).toFixed(1)})" fill="${c.black}" stroke="${c.black}" stroke-width="${(edge * 2).toFixed(1)}" stroke-linejoin="miter" fill-rule="evenodd"/>`,
        `<path d="${d}" fill="${c.black}" stroke="${c.black}" stroke-width="${(edge * 1.6).toFixed(1)}" stroke-linejoin="miter" fill-rule="evenodd"/>`,
        `<path d="${d}" fill="url(#${gid})" fill-rule="evenodd"/>`,
      ].join("");
    })
    .join("");
}

// ---- the gear-stick pattern ----------------------------------------------------------

/** The gear-stick pattern: three gates joined across, in a box w by h. */
function gates(cx, cy, w, h, fill) {
  const bar = w * 0.13;
  const post = (x) =>
    `<rect x="${(x - bar / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${bar.toFixed(1)}" height="${h.toFixed(1)}" rx="${(bar * 0.3).toFixed(1)}" fill="${fill}"/>`;
  return [
    post(cx - w / 2 + bar / 2),
    post(cx),
    post(cx + w / 2 - bar / 2),
    `<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - bar / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${bar.toFixed(1)}" fill="${fill}"/>`,
  ].join("");
}

/** The yellow disc on their rear quarter: 1 3 5 over the gates over 2 4 R. */
function disc(fonts, cx, cy, r) {
  const c = COLORS;
  const font = fonts["Anton-Regular.ttf"];
  const row = (text, y) => {
    const height = r * 0.3;
    const width = height * aspectOf(font, text, 0.5);
    return `<path d="${line(font, text, { x: cx - width / 2, y, height, tracking: 0.5 })}" fill="${c.red}"/>`;
  };
  return [
    `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${c.yellow}"/>`,
    row("1 3 5", cy - r * 0.74),
    gates(cx, cy, r * 0.95, r * 0.62, c.red),
    row("2 4 R", cy + r * 0.44),
  ].join("");
}

/** The yellow oval on their bonnet: TOP, the gates, GEAR. */
function oval(cx, cy, rx, ry) {
  const c = COLORS;
  const word = (text, y, h) => {
    const w = h * blockAspect(text);
    return `<path d="${block(text, cx - w / 2, y, h)}" fill="${c.red}" fill-rule="evenodd"/>`;
  };
  const h = ry * 0.36;
  return [
    `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${c.yellow}"/>`,
    word("TOP", cy - ry * 0.74, h),
    gates(cx, cy, rx * 0.5, ry * 0.3, c.black),
    word("GEAR", cy + ry * 0.38, h),
  ].join("");
}

/** A learner's plate: a white square with a red L. */
function lPlate(cx, cy, size) {
  const c = COLORS;
  const s = size;
  const x = cx - s / 2;
  const y = cy - s / 2;
  const t = s * 0.2; // the L's stroke
  const l = [
    [x + s * 0.24, y + s * 0.16],
    [x + s * 0.24 + t, y + s * 0.16],
    [x + s * 0.24 + t, y + s * 0.84 - t],
    [x + s * 0.78, y + s * 0.84 - t],
    [x + s * 0.78, y + s * 0.84],
    [x + s * 0.24, y + s * 0.84],
  ];
  return [
    `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" fill="${c.white}"/>`,
    `<polygon points="${l.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ")}" fill="${c.boardRed}"/>`,
  ].join("");
}

/** "DRIVING SCHOOL" alone, in their yellow, filling `box` (pixels). */
function tagline(fonts, box) {
  const font = fonts["Anton-Regular.ttf"];
  const a = aspectOf(font, "DRIVING SCHOOL", 0.02);
  const w = Math.min(box.w, box.h * a);
  const h = w / a;
  const d = line(font, "DRIVING SCHOOL", {
    x: box.x + (box.w - w) / 2,
    y: box.y + (box.h - h) / 2,
    height: h,
    tracking: 0.02,
  });
  return `<path d="${d}" fill="${COLORS.yellow}"/>`;
}

/**
 * Whether a round thing of radius `r` (metres) centred at (z, y) sits wholly
 * on clear paint on both sides: never over glass, a lamp, a handle or an arch.
 */
const onClear = (k, z, y, r) =>
  ["left", "right"].every((side) =>
    [
      [0, 0],
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
      [r * 0.7, r * 0.7],
      [-r * 0.7, -r * 0.7],
      [r * 0.7, -r * 0.7],
      [-r * 0.7, r * 0.7],
    ].every(([dz, dy]) => k.clear(side, z + dz, y + dy)),
  );

/** A TG mark at (z, y) of both sides, upright, `h` metres tall. */
function marksOnSides(k, list, h) {
  return ["left", "right"]
    .map((view) =>
      k.pixels(
        view,
        list
          .map(([z, y, look]) => {
            const [px, py] = k.pt[view](z, y);
            return tg(px, py, h * k.scale(view), look);
          })
          .join(""),
      ),
    )
    .join("");
}

/**
 * The back: a learner's plate at the driver's right and a TG mark at the
 * other end, on the largest clear paint between the lamps, the plate and
 * the window (the back's paint map).
 */
function backItems(k, yA, yB, size = 0.24) {
  const r = k.clearRect("back", k.box.xmin, k.box.xmax, yA, yB);
  if (!r || r.y1 - r.y0 < 0.12 || r.z1 - r.z0 < 0.3) return "";
  const s = k.scale("back");
  const sz = Math.min(size, r.y1 - r.y0, (r.z1 - r.z0) * 0.45);
  const y = (r.y0 + r.y1) / 2;
  // The driver's right is +x; from behind, that is the left of the picture.
  const [px, py] = k.pt.back(r.z1 - sz / 2, y);
  const [mx, my] = k.pt.back(r.z0 + sz * 0.45, y);
  const room = r.z1 - r.z0 - sz;
  return k.pixels(
    "back",
    lPlate(px, py, sz * s) + (room > sz ? tg(mx, my, sz * 0.8 * s, "g") : ""),
  );
}

/**
 * Top Gear's paint, fitted to the vehicle: their car's layout on the cars;
 * the same on the van with the name large on the blank panel behind the
 * side windows; a fleet truck's layout on the lorry.
 */
export default function topgear({ k, fonts }) {
  return k.kind === "lorry" ? lorry(k, fonts) : car(k, fonts);
}

function car(k, fonts) {
  const { L, box } = k;
  const c = COLORS;
  const far = 9;
  const van = k.kind === "van";
  const rear = L.wheels.rear.z;
  const wb = rear - L.wheels.front.z;
  const zAt = (u) => rear - u * wb;
  const band = L.belt - L.sill;
  const yAt = (v) => L.belt - v * band;

  // Red all over, with the yellow band along the bottom, all the way round.
  const yLip = L.sill + Math.max(0.05, LIP * band);
  const red = k.rect(-far, -far, far, far, c.red);
  const lip = k.rect(-far, -far, far, yLip, c.yellow);

  // The yellow sweep on the front wing: a thin blade rising from the headlamp
  // toward the windscreen's foot. A van's front wheel is under the driver,
  // so its sweep rises from just ahead of the arch.
  const sweep = (() => {
    const z0 = van ? L.wheels.front.z - L.wheels.front.r * 1.3 : zAt(1.07);
    const y0 = yAt(0.33);
    const z1 = van ? L.wheels.front.z + L.wheels.front.r * 0.4 : zAt(0.92);
    const y1 = Math.min(yAt(-0.02), L.bonnet.y);
    const t = 0.05;
    const p = (z, y) => `${z.toFixed(4)} ${y.toFixed(4)}`;
    return `<path d="M${p(z0, y0)}Q${p(z0 + 0.02, y1 - 0.06)} ${p(z1, y1)}Q${p(z0 + 0.1, y1 - 0.02)} ${p(z0 - t, y0 + 0.01)}Z" fill="${c.yellow}"/>`;
  })();

  const side = [red, lip, sweep].join("");
  const end = [red, lip].join("");

  // The lettering. On a car: between the wheel arches in the doors' clear
  // band, above the yellow, as on their car, the name about 22 cm tall at
  // most. Where a moulding splits the doors into two low bands, TOP GEAR
  // goes in the upper one and DRIVING SCHOOL in the lower. On a van: the
  // blank panel behind the side windows, the name about 33 cm tall.
  const zFront = Math.max(zAt(along(138)), L.wheels.front.z + L.wheels.front.r);
  const zBack = Math.min(zAt(along(423)), L.wheels.rear.z - L.wheels.rear.r);
  const yLow = Math.max(L.door.y0, yLip + 0.02);
  const name = [];
  /** Where the lettering is, in metres, so marks keep off it. */
  const held = [];
  const panel = van
    ? k.clearRect("both", L.wheels.front.z + 0.6, box.zmax, L.belt, box.ymax)
    : null;
  if (panel && panel.y1 - panel.y0 > 0.4) {
    for (const view of ["left", "right"]) {
      const b = k.boxPx(view, panel.z0, panel.y1, panel.z1, panel.y0);
      name.push(
        k.pixels(
          view,
          lettering(fonts, k.cap(b, 0.62 * k.scale(view)), {
            id: `topgear-${view}`,
          }),
        ),
      );
    }
    held.push(panel);
  } else {
    const [first, second] = L.bands ?? [L.door];
    const split =
      first.y1 - first.y0 < 0.3 &&
      second &&
      second.y1 - second.y0 >= 0.1 &&
      second.y1 < first.y0;
    for (const view of ["left", "right"]) {
      const s = k.scale(view);
      if (split) {
        const top = k.boxPx(view, zFront, first.y1, zBack, first.y0);
        const low = k.boxPx(
          view,
          zFront,
          second.y1,
          zBack,
          Math.max(second.y0, yLip + 0.02),
        );
        name.push(
          k.pixels(
            view,
            lettering(fonts, k.cap(top, 0.2 * s), {
              id: `topgear-${view}`,
              tag: false,
            }) + tagline(fonts, k.cap(low, 0.08 * s)),
          ),
        );
      } else {
        const b = k.boxPx(view, zFront, L.door.y1, zBack, yLow);
        name.push(
          k.pixels(
            view,
            lettering(fonts, k.cap(b, 0.4 * s), { id: `topgear-${view}` }),
          ),
        );
      }
    }
    held.push({ z0: zFront, z1: zBack, y0: yLow, y1: L.door.y1 });
  }
  const inHeld = (z, y, r) =>
    held.some(
      (h) => z > h.z0 - r && z < h.z1 + r && y > h.y0 - r && y < h.y1 + r,
    );

  // Their marks and the disc, on the front wings and the rear quarters as
  // on their car, the same on both sides; one that would sit on glass, a
  // lamp, an arch or the lettering is left off. A van's front wing is short
  // and its rear quarter tall, so its marks are placed from its own wheels.
  const r = MARK * 0.5;
  const marks = MARKS.map(([u, v, look]) => [zAt(u), yAt(v), look]).filter(
    ([z, y]) => y > yLip + r && !inHeld(z, y, r) && onClear(k, z, y, r),
  );
  const discR = van ? 0.2 : (DISC.d * wb) / 2;
  let disc3d = null;
  // Where theirs is; else the nearest clear spot on the same quarter.
  search: for (const dz of [0, -0.1, 0.1, -0.2, 0.2, -0.3, 0.3]) {
    for (const dy of [0, -0.06, 0.06]) {
      const z = zAt(DISC.at) + dz;
      const y = Math.max(yAt(DISC.y), yLip + discR + 0.03) + dy;
      if (onClear(k, z, y, discR * 1.05) && !inHeld(z, y, discR)) {
        disc3d = [z, y];
        break search;
      }
    }
  }
  if (van && !disc3d) {
    // The van's sliding-door band, low between the arches, toward the back:
    // their disc where the car's rear quarter would be.
    const y = (Math.max(L.door.y0, yLip) + L.door.y1) / 2;
    for (const dz of [0, -0.15, -0.3, -0.45]) {
      const z = L.door.z1 - discR - 0.12 + dz;
      if (onClear(k, z, y, discR * 1.05) && !inHeld(z, y, discR)) {
        disc3d = [z, y];
        break;
      }
    }
  }
  const sides = [
    marksOnSides(k, marks, MARK),
    disc3d
      ? ["left", "right"]
          .map((view) => {
            const [dx, dy] = k.pt[view](...disc3d);
            return k.pixels(view, disc(fonts, dx, dy, discR * k.scale(view)));
          })
          .join("")
      : "",
  ].join("");

  // The bonnet: the yellow oval, reading upright from in front of the car
  // as on theirs, with their marks round it. A van has next to no bonnet:
  // its oval goes on the roof's back end, its name ahead of that, behind the
  // name board.
  const s = k.scale("top");
  const deep = (L.bonnet.z1 - L.bonnet.z0) * s;
  const bonnetOk = deep > 0.45 * s;
  // `fromBehind`: on a roof the oval reads when the vehicle drives away
  // from you, as the name does; on a bonnet, from in front as on theirs.
  const ovalAt = (zMid, rx, ry, withMarks, fromBehind = false) => {
    const [cx, cy] = k.pt.top(zMid, 0);
    const turned = (body) =>
      `<g transform="rotate(${fromBehind ? 90 : -90} ${cx.toFixed(1)} ${cy.toFixed(1)})">${body}</g>`;
    const across = (L.bonnet.x1 - L.bonnet.x0) * 0.36;
    const d = ry / s;
    const marksTop = withMarks
      ? [
          [zMid - d * 0.85, -across, "w"],
          [zMid + d * 0.65, -across * 0.95, "g"],
          [zMid - d * 0.85, across, "g"],
          [zMid + d * 0.65, across * 0.95, "w"],
        ]
          .map(([z, x, look]) => {
            const [px, py] = k.pt.top(z, x);
            return `<g transform="rotate(-90 ${px.toFixed(1)} ${py.toFixed(1)})">${tg(px, py, MARK * s, look)}</g>`;
          })
          .join("")
      : "";
    return k.pixels("top", turned(oval(cx, cy, rx, ry)) + marksTop);
  };
  let top = "";
  if (bonnetOk) {
    const ry = deep * 0.3;
    const rx = Math.min(ry * 1.75, (L.bonnet.x1 - L.bonnet.x0) * s * 0.3);
    top = ovalAt((L.bonnet.z0 + L.bonnet.z1) / 2, rx, ry, true);
  }
  if (van && L.roof.clear) {
    const zEnd = L.roof.z1 - 0.12;
    const ry = 0.3 * s;
    const rx = ry * 1.75;
    top += ovalAt(zEnd - 0.3, rx, ry, false, true);
    top += k.onTopWith(
      {
        z0: L.roof.board.z + 0.5,
        z1: zEnd - 0.7,
        x0: L.roof.x0 + 0.14,
        x1: L.roof.x1 - 0.14,
      },
      (b) => lettering(fonts, b, { id: "topgear-roof" }),
    );
  }

  // The front: a learner's plate at the driver's right, and their marks at
  // the corners, as on their car. The back: the same on clear paint.
  const front = (() => {
    // A van's front below the windscreen is grille and lamps.
    if (van) return "";
    const sc = k.scale("front");
    const y = (yLip + L.belt) / 2;
    const [px, py] = k.pt.front(k.width * 0.27, y - 0.02);
    const fm = [
      [-k.width * 0.3, y + 0.02, "g"],
      [-k.width * 0.12, y - 0.08, "wo"],
    ]
      .map(([x, my, look]) => {
        const [mx, mpy] = k.pt.front(x, my);
        return tg(mx, mpy, MARK * sc, look);
      })
      .join("");
    return k.pixels("front", lPlate(px, py, 0.24 * sc) + fm);
  })();

  const body = [
    k.inView("left", side),
    k.inView("right", side),
    k.inView("top", red),
    k.inView("front", end),
    k.inView("back", end),
    sides,
    ...name,
    top,
    front,
    backItems(k, yLip + 0.02, L.belt + 0.05, van ? 0.3 : 0.24),
  ].join("\n");
  return { defs: "", body };
}

/**
 * The lorry, painted as a fleet truck in Top Gear's look: red cab and box,
 * their yellow band along the foot of both (on the box, the drop-side rail),
 * TOP GEAR in their gold block letters large across the box (about 55 cm),
 * their TG marks only at the box's two ends with the gear disc among the
 * rear ones, and on the box's roof the yellow oval and the name for the
 * camera above. The box's rear doors take no paint.
 */
function lorry(k, fonts) {
  const { L, box } = k;
  const c = COLORS;
  const far = 9;
  const load = L.load;
  const cab = L.cab;
  const red = k.rect(-far, -far, far, far, c.red);
  // The band: the rail strip along the box, and a band of the same height's
  // feel along the cab's foot.
  const cabLip = cab.sill + 0.12;
  const yellow = [
    k.rect(load.z0 - 0.02, -far, far, load.rail - 0.015, c.yellow),
    k.rect(-far, -far, load.z0 - 0.02, cabLip, c.yellow),
  ].join("");
  // A thin red line along the rail's middle, so the band reads as a band
  // and not as a yellow box bottom.
  const pin = k.rect(
    load.z0 - 0.02,
    load.rail - 0.22,
    far,
    load.rail - 0.25,
    c.red,
  );
  // The yellow sweep on the cab's front corner, rising from the lamp.
  const sweep = (() => {
    const z0 = cab.z0 + 0.06;
    const y0 = cabLip + 0.06;
    const z1 = cab.door.z0 + 0.15;
    const y1 = cab.belt - 0.02;
    const t = 0.06;
    const p = (z, y) => `${z.toFixed(4)} ${y.toFixed(4)}`;
    return `<path d="M${p(z0, y0)}Q${p(z0 + 0.02, y1 - 0.06)} ${p(z1, y1)}Q${p(z0 + 0.12, y1 - 0.02)} ${p(z0 - t, y0 + 0.01)}Z" fill="${c.yellow}"/>`;
  })();
  const side = [red, yellow, pin, sweep].join("");

  // The ends of the box, where their marks go; the name between them.
  const endLen = 0.75;
  const zA = load.z0 + 0.1;
  const zB = load.z1 - 0.1;
  const yA = load.rail + 0.08;
  const yB = load.y1 - 0.1;
  const name = ["left", "right"]
    .map((view) => {
      const b = k.boxPx(view, zA + endLen + 0.1, yB, zB - endLen - 0.1, yA);
      return k.pixels(
        view,
        lettering(fonts, k.cap(b, 1.0 * k.scale(view)), {
          id: `topgear-${view}`,
        }),
      );
    })
    .join("");

  // Marks at each end: a loose cluster as on their car's wings and
  // quarters, half a metre tall rows, with the disc among the rear ones.
  const M = 0.2;
  const h = yB - yA;
  const frontMarks = [
    [zA + 0.18, yA + h * 0.82, "w"],
    [zA + 0.5, yA + h * 0.62, "go"],
    [zA + 0.2, yA + h * 0.42, "g"],
    [zA + 0.55, yA + h * 0.18, "wo"],
  ];
  const discR = 0.27;
  const discZ = zB - endLen / 2 - 0.02;
  const discY = yA + h * 0.5;
  const rearMarks = [
    [zB - 0.2, yA + h * 0.88, "g"],
    [zB - 0.58, yA + h * 0.86, "wo"],
    [zB - 0.16, yA + h * 0.12, "w"],
    [zB - 0.58, yA + h * 0.12, "go"],
  ];
  const sides = [
    marksOnSides(k, [...frontMarks, ...rearMarks], M),
    ["left", "right"]
      .map((view) => {
        const [dx, dy] = k.pt[view](discZ, discY);
        return k.pixels(view, disc(fonts, dx, dy, discR * k.scale(view)));
      })
      .join(""),
  ].join("");

  // The top: red, the yellow oval at the box roof's front, the name along
  // the rest of it, reading when the lorry drives away from you.
  const s = k.scale("top");
  const ovalZ = load.z0 + 0.55;
  const [ox, oy] = k.pt.top(ovalZ, 0);
  const ry = 0.4 * s;
  const rx = Math.min(ry * 1.75, (box.xmax - box.xmin) * s * 0.42);
  const topOval = k.pixels(
    "top",
    `<g transform="rotate(90 ${ox.toFixed(1)} ${oy.toFixed(1)})">${oval(ox, oy, rx, ry)}</g>`,
  );
  // TOP over GEAR, each word across the roof's width: twice the size the
  // two words side by side could be.
  const roofName = k.onTopWith(
    {
      z0: ovalZ + 0.7,
      z1: load.z1 - 0.3,
      x0: box.xmin + 0.15,
      x1: box.xmax - 0.15,
    },
    (b) => stacked(b, "topgear-roof"),
  );

  const front = [red, k.rect(-far, -far, far, cabLip, c.yellow)].join("");

  const body = [
    k.inView("left", side),
    k.inView("right", side),
    k.inView("top", red),
    k.inView("front", front),
    k.inView("back", red),
    sides,
    name,
    topOval,
    roofName,
  ].join("\n");
  return { defs: "", body };
}

// ---- the logo ------------------------------------------------------------------------

/**
 * Their logo: the TG mark, then TOPGEAR DRIVING SCHOOL. In colour it keeps
 * its yellow ground, as theirs always has; `mono` is white on nothing.
 */
export function logo({ fonts, mono }) {
  const c = COLORS;
  const w = 1200;
  const h = 470;
  const font = fonts["Arvo-Bold.ttf"];
  const ink = mono ? "#fff" : c.logoBlue;
  const markH = h - 70;
  const markW = (markH * TG_W) / TG_H;
  const textX = 50 + markW + 40;
  const textW = w - textX - 50;
  const row = (text, y, wanted) => {
    const a = aspectOf(font, text, 0.02);
    const height = Math.min(wanted, textW / a);
    const width = height * a;
    const d = line(font, text, {
      x: textX + (textW - width) / 2,
      y,
      height,
      tracking: 0.02,
    });
    return mono
      ? `<path d="${d}" fill="#fff"/>`
      : `<path d="${d}" fill="${ink}" stroke="${c.logoRed}" stroke-width="3" paint-order="stroke"/>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${mono ? "" : `<rect width="${w}" height="${h}" rx="36" fill="${c.logoYellow}"/>`}
    ${tg(50 + markW / 2, h / 2, markH, ink)}
    ${row("TOPGEAR DRIVING", 110, 96)}
    ${row("SCHOOL", 250, 110)}
  </svg>`;
}

// ---- the roof board (app/components/board/top-board.ts) --------------------------------

/** The roof board's size on the board cars, in metres, and its corner cut. */
export const TOP_BOARD = { width: 1.35, height: 0.45, cut: 0.13 };

/**
 * Their roof board, as on their car: yellow with cut corners and a red edge,
 * TOP GEAR in red slab letters, DRIVING SCHOOL in black.
 */
export function topBoard({ fonts }) {
  const c = COLORS;
  const w = 1200;
  const h = (w * TOP_BOARD.height) / TOP_BOARD.width;
  const cut = (w * TOP_BOARD.cut) / TOP_BOARD.width;
  const slab = fonts["AlfaSlabOne-Regular.ttf"];
  const sans = fonts["Anton-Regular.ttf"];
  const ring = (inset) => {
    const i = inset;
    const q = cut + i * 0.41; // keeps the edge the same width round the cuts
    return [
      [q, i],
      [w - q, i],
      [w - i, q],
      [w - i, h - q],
      [w - q, h - i],
      [q, h - i],
      [i, h - q],
      [i, q],
    ]
      .map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`)
      .join(" ");
  };
  const centred = (font, text, y, wanted, tracking, attrs, room) => {
    const a = aspectOf(font, text, tracking);
    const height = Math.min(wanted, room / a);
    const width = height * a;
    return `<path d="${line(font, text, { x: (w - width) / 2, y, height, tracking })}" ${attrs}/>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${c.boardRed}"/>
    <polygon points="${ring(16)}" fill="${c.board}"/>
    ${centred(slab, "TOP GEAR", 62, 138, 0.03, `fill="${c.boardRed}" stroke="#7d1512" stroke-width="3" paint-order="stroke"`, w - 250)}
    ${centred(sans, "DRIVING SCHOOL", 240, 92, 0.04, `fill="${c.black}"`, w - 420)}
  </svg>`;
}

// ---- the classroom's walls (app/lib/board/room.ts) ---------------------------------

/**
 * The wall banner (3.2 x 0.6 m): their car's side laid flat. Red, the door
 * lettering, the yellow band along the bottom, their marks and the disc.
 */
export function banner({ fonts }) {
  const w = 2048;
  const h = 384;
  const c = COLORS;
  const lipH = 34;
  const mark = 74;
  const marksAt = [
    [90, 80, "w"],
    [250, 150, "go"],
    [120, 250, "g"],
    [330, 290, "wo"],
    [1560, 70, "go"],
    [1720, 290, "g"],
    [1960, 250, "wo"],
    [1990, 70, "w"],
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${c.red}"/>
    <rect y="${h - lipH}" width="${w}" height="${lipH}" fill="${c.yellow}"/>
    ${marksAt.map(([x, y, look]) => tg(x, y, mark, look)).join("")}
    ${disc(fonts, 1850, 160, 105)}
    ${lettering(fonts, { x: 420, y: 28, w: 1080, h: h - lipH - 50 }, { id: "banner" })}
  </svg>`;
}

/**
 * Two framed posters (0.52 x 0.72 m): their logo on its yellow, and an
 * invitation to learn with them. No promises about passing.
 */
export function posters({ fonts }) {
  const w = 1024;
  const h = 1418;
  const c = COLORS;
  const sans = fonts["Anton-Regular.ttf"];
  const serif = fonts["Arvo-Bold.ttf"];
  const centred = (font, text, y, wanted, fill, extra = "") => {
    const a = aspectOf(font, text, 0.03);
    const height = Math.min(wanted, (w - 160) / a);
    const width = height * a;
    return `<path d="${line(font, text, { x: (w - width) / 2, y, height, tracking: 0.03 })}" fill="${fill}" ${extra}/>`;
  };
  const edge = `stroke="${c.logoRed}" stroke-width="3" paint-order="stroke"`;
  const logoPoster = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${c.logoYellow}"/>
    ${tg(w / 2, 470, 720, c.logoBlue)}
    ${centred(serif, "TOPGEAR DRIVING", 930, 86, c.logoBlue, edge)}
    ${centred(serif, "SCHOOL", 1060, 110, c.logoBlue, edge)}
    <rect x="0" y="${h - 90}" width="${w}" height="34" fill="${c.red}"/>
  </svg>`;
  const lessons = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${c.red}"/>
    <rect x="0" y="${h - 120}" width="${w}" height="120" fill="${c.yellow}"/>
    ${tg(130, 150, 130, "w")}
    ${tg(w - 130, 150, 130, "g")}
    ${centred(sans, "LEARN TO DRIVE", 250, 120, c.white)}
    ${centred(sans, "WITH", 410, 80, c.yellow)}
    ${lettering(fonts, { x: 70, y: 520, w: w - 140, h: 330 }, { id: "poster-lessons" })}
    ${disc(fonts, w / 2, 1010, 110)}
    ${centred(sans, "BOOK YOUR LESSONS TODAY", 1160, 84, c.white)}
  </svg>`;
  return [
    { id: "logo", svg: logoPoster },
    { id: "lessons", svg: lessons },
  ];
}
