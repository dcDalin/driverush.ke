/**
 * Blixen Auto Driving School's own car (B.A.D.S), as on the photos of their
 * real ones (reference-side.jpg, reference-rear.jpg, reference-fleet.jpg):
 * not a style of ours. Fitted to every board car by placing each part where
 * it sits on their car, measured against the wheels and the window line.
 *
 * From the photos (their silver car's right side, nose to the right; wheel
 * centres at x 69 and 784, window line at y 155, door bottoms at y 346):
 *   - a silver body
 *   - orange over the rear below the windows, its front edge a diagonal
 *     across the rear door, with two thin orange lines beside its top
 *   - an orange front bumper and lower front corner, and an orange strip
 *     along the bottom of the body
 *   - on the front door their mark: a warning triangle, BLIXEN in dark blue,
 *     and AUTO on an orange arrow band, under a small steering wheel
 *   - "DRIVING SCHOOL" in large orange letters with a white edge, low across
 *     both doors
 *   - "B.A.D.S" in black, leaning along the diagonal on the rear door
 *   - a white pill with a phone symbol and their number on the rear quarter
 *   - three orange chevrons on the front wing
 *   - "Instant Brakes" in orange across the boot lid
 *
 * The lettering is set in the closest free typefaces (Poppins, and Michroma
 * for the logo's line of words). The steering wheel, its arcs and the big
 * BADS are traced from their logo (trace.mjs). When Blixen sends their
 * artwork files, they replace these.
 *
 * Not copied: the lettering on their rear window (the board cars' glass is
 * not painted), the small motto under their door mark (too fine to read at
 * this size), their number plates and each car's fleet number.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { aspectOf, line } from "../lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Their colours, measured off the photos and lifted out of the daylight. */
export const COLORS = {
  silver: "#c9ccd1",
  orange: "#f05a23",
  navy: "#1f2646",
  black: "#17181b",
  white: "#fbfbf9",
  red: "#d21f26",
  // Their logo's orange is browner than their cars'.
  logoOrange: "#d86a22",
};

/** Their number, as painted on their cars. */
const PHONE = "+254 798 338 023";

/** Places along the car, as on the photo: 0 = rear wheel, 1 = front wheel. */
const PHOTO = { rearWheel: 69, frontWheel: 784, belt: 155, sill: 346 };
const along = (x) =>
  (x - PHOTO.rearWheel) / (PHOTO.frontWheel - PHOTO.rearWheel);
const down = (y) => (y - PHOTO.belt) / (PHOTO.sill - PHOTO.belt);

/** The orange strip along the bottom, as a share of the doors' height. */
const LIP = 20 / (PHOTO.sill - PHOTO.belt);
/** The orange rear's front edge: where it meets the window line, and the sill. */
const EDGE = { top: along(78), bottom: along(261) };
/** The orange front: from the front wheel forward, below this line. */
const FRONT = down(252);
/** Their door mark's box, DRIVING SCHOOL's, and where B.A.D.S and the pill sit. */
const MARK = {
  from: along(449),
  to: along(594),
  top: down(179),
  low: down(251),
};
const NAME = {
  from: along(238),
  to: along(653),
  top: down(269),
  low: down(317),
};
const BADS = { down: down(225), ahead: 0.15, height: 0.06 };
const PILL = { at: -0.124, down: 0.18, height: 0.036 };
const CHEVRONS = { at: along(807), down: down(203) };

// ---- their logo, traced --------------------------------------------------------------

const traced = readFileSync(path.join(HERE, "bads.svg"), "utf8");
const part = (name) => {
  const g = new RegExp(`<g id="${name}"[\\s\\S]*?</g>`).exec(traced)[0];
  const [x, y, w, h] = /data-box="([^"]+)"/.exec(g)[1].split(" ").map(Number);
  return { g, x, y, w, h };
};
const WHEEL = part("wheel");
const ARCS = part("arcs");
const LETTERS = part("letters");
/** The wheel and its arcs together. */
const EMBLEM = {
  x: Math.min(WHEEL.x, ARCS.x),
  y: Math.min(WHEEL.y, ARCS.y),
  w: Math.max(WHEEL.x + WHEEL.w, ARCS.x + ARCS.w) - Math.min(WHEEL.x, ARCS.x),
  h: Math.max(WHEEL.y + WHEEL.h, ARCS.y + ARCS.h) - Math.min(WHEEL.y, ARCS.y),
};

/** Their steering wheel and road, `h` tall with its middle at (cx, cy). */
function emblem(cx, cy, h, { mono = false, arcs = true } = {}) {
  const c = COLORS;
  const k = h / EMBLEM.h;
  const at = `translate(${(cx - (EMBLEM.w * k) / 2 - EMBLEM.x * k).toFixed(1)} ${(cy - h / 2 - EMBLEM.y * k).toFixed(1)}) scale(${k.toFixed(5)})`;
  return `<g transform="${at}"><g fill="${mono ? "#fff" : c.black}">${WHEEL.g}</g>${arcs ? `<g fill="${mono ? "#fff" : c.logoOrange}">${ARCS.g}</g>` : ""}</g>`;
}

/** Their big BADS, `h` tall with its top-left corner at (x, y). */
function badsWord(x, y, h, fill) {
  const k = h / LETTERS.h;
  return {
    w: LETTERS.w * k,
    svg: `<g transform="translate(${(x - LETTERS.x * k).toFixed(1)} ${(y - LETTERS.y * k).toFixed(1)}) scale(${k.toFixed(5)})" fill="${fill}">${LETTERS.g}</g>`,
  };
}

// ---- lettering -------------------------------------------------------------------------

/** A line of text fitted in a box (pixels), centred, never stretched. */
function fitted(font, text, box, tracking, attrs) {
  const a = aspectOf(font, text, tracking);
  const height = Math.min(box.h, box.w / a);
  const width = height * a;
  const d = line(font, text, {
    x: box.x + (box.w - width) / 2,
    y: box.y + (box.h - height) / 2,
    height,
    tracking,
  });
  return { d, height, width, svg: `<path d="${d}" ${attrs}/>` };
}

/** A chevron pointing right, in pixels: its tip at (x, y), `h` tall. */
function chevron(x, y, h, fill) {
  const a = h * 0.5;
  const t = h * 0.42;
  const p = [
    [x - a, y - h / 2],
    [x, y],
    [x - a, y + h / 2],
    [x - a - t, y + h / 2],
    [x - t, y],
    [x - a - t, y - h / 2],
  ];
  return `<polygon points="${p.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ")}" fill="${fill}"/>`;
}

/**
 * Their door mark, filling `box` (pixels) as far as it can without changing
 * shape: the small steering wheel, the warning triangle, BLIXEN, and AUTO on
 * its orange arrow band. `mono` draws it all in white.
 */
export function mark(fonts, box, { mono = false } = {}) {
  const c = COLORS;
  const bold = fonts["Poppins-Bold.ttf"];
  // The mark is twice as wide as it is tall.
  const w = Math.min(box.w, box.h * 2);
  const x = box.x + (box.w - w) / 2;
  const y = box.y + (box.h - w / 2) / 2;
  const ink = mono ? "#fff" : c.navy;
  const hot = mono ? "#fff" : c.orange;

  const word = fitted(
    bold,
    "BLIXEN",
    { x: x + w * 0.2, y: y + w * 0.185, w: w * 0.8, h: w * 0.16 },
    0.03,
    `fill="${ink}"`,
  );
  // The warning triangle, left of the word.
  const tx = x + w * 0.005;
  const ty = y + w * 0.255;
  const tw = w * 0.18;
  const th = w * 0.165;
  const triangle = [
    `<polygon points="${(tx + tw / 2).toFixed(1)},${ty.toFixed(1)} ${(tx + tw).toFixed(1)},${(ty + th).toFixed(1)} ${tx.toFixed(1)},${(ty + th).toFixed(1)}" fill="${mono ? "none" : c.white}" stroke="${mono ? "#fff" : c.red}" stroke-width="${(w * 0.018).toFixed(1)}" stroke-linejoin="round"/>`,
    `<rect x="${(tx + tw / 2 - w * 0.01).toFixed(1)}" y="${(ty + th * 0.36).toFixed(1)}" width="${(w * 0.02).toFixed(1)}" height="${(th * 0.34).toFixed(1)}" fill="${ink}"/>`,
    `<circle cx="${(tx + tw / 2).toFixed(1)}" cy="${(ty + th * 0.84).toFixed(1)}" r="${(w * 0.012).toFixed(1)}" fill="${ink}"/>`,
  ].join("");
  // AUTO, then the orange band running on from it to two chevrons.
  const by = y + w * 0.375;
  const bh = w * 0.07;
  const auto = fitted(
    bold,
    "AUTO",
    { x: x + w * 0.215, y: by, w: w * 0.3, h: bh },
    0.12,
    `fill="${ink}"`,
  );
  const barFrom = x + w * 0.215 + (w * 0.3 + auto.width) / 2 + w * 0.02;
  const barTo = x + w * 0.9;
  const band = [
    `<rect x="${(x + w * 0.2).toFixed(1)}" y="${(by + bh + w * 0.012).toFixed(1)}" width="${(barTo - x - w * 0.2).toFixed(1)}" height="${(w * 0.012).toFixed(1)}" fill="${hot}"/>`,
    `<rect x="${barFrom.toFixed(1)}" y="${(by + bh * 0.2).toFixed(1)}" width="${(barTo - barFrom).toFixed(1)}" height="${(bh * 0.6).toFixed(1)}" fill="${hot}"/>`,
    chevron(x + w * 0.955, by + bh / 2, bh * 1.05, hot),
    chevron(x + w * 1.0, by + bh / 2, bh * 1.05, hot),
  ].join("");
  return [
    emblem(x + w * 0.6, y + w * 0.085, w * 0.16, { mono, arcs: false }),
    triangle,
    word.svg,
    auto.svg,
    band,
  ].join("");
}

/** "DRIVING SCHOOL" as on their doors: orange with a white edge. */
function drivingSchool(fonts, box, { mono = false } = {}) {
  const c = COLORS;
  const t = fitted(
    fonts["Poppins-ExtraBold.ttf"],
    "DRIVING SCHOOL",
    box,
    0.03,
    "",
  );
  if (mono) return `<path d="${t.d}" fill="#fff"/>`;
  const h = t.height;
  return [
    `<path d="${t.d}" fill="none" stroke="${c.orange}" stroke-width="${(h * 0.2).toFixed(1)}" stroke-linejoin="round"/>`,
    `<path d="${t.d}" fill="none" stroke="${c.white}" stroke-width="${(h * 0.12).toFixed(1)}" stroke-linejoin="round"/>`,
    `<path d="${t.d}" fill="${c.orange}"/>`,
  ].join("");
}

/** How wide their pill is, for a height `h`. */
function pillWidth(fonts, h) {
  const textW = h * 0.42 * aspectOf(fonts["Poppins-Medium.ttf"], PHONE, 0.02);
  return h * 0.78 * 2 + textW + h * 0.75;
}

/** Their white pill: a phone symbol in a ring, then their number. */
function phonePill(fonts, cx, cy, h) {
  const c = COLORS;
  const font = fonts["Poppins-Medium.ttf"];
  const textH = h * 0.42;
  const textW = textH * aspectOf(font, PHONE, 0.02);
  const ring = h * 0.78; // the ring's radius: it stands a little proud
  const w = ring * 2 + textW + h * 0.75;
  const x = cx - w / 2;
  const rx = x + ring;
  // A handset: a curved bar with a pad at each end.
  const a = ring * 0.42;
  const handset = `<g transform="rotate(-35 ${rx.toFixed(1)} ${cy.toFixed(1)})"><path d="M${(rx - a).toFixed(1)} ${(cy - a * 0.2).toFixed(1)}Q${rx.toFixed(1)} ${(cy + a * 1.15).toFixed(1)} ${(rx + a).toFixed(1)} ${(cy - a * 0.2).toFixed(1)}" fill="none" stroke="${c.black}" stroke-width="${(ring * 0.2).toFixed(1)}" stroke-linecap="round"/><rect x="${(rx - a - ring * 0.17).toFixed(1)}" y="${(cy - a * 0.62).toFixed(1)}" width="${(ring * 0.34).toFixed(1)}" height="${(ring * 0.36).toFixed(1)}" rx="${(ring * 0.08).toFixed(1)}" fill="${c.black}"/><rect x="${(rx + a - ring * 0.17).toFixed(1)}" y="${(cy - a * 0.62).toFixed(1)}" width="${(ring * 0.34).toFixed(1)}" height="${(ring * 0.36).toFixed(1)}" rx="${(ring * 0.08).toFixed(1)}" fill="${c.black}"/></g>`;
  return [
    `<rect x="${(x + ring * 0.6).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${(w - ring * 0.6).toFixed(1)}" height="${h.toFixed(1)}" rx="${(h / 2).toFixed(1)}" fill="${c.white}"/>`,
    `<circle cx="${rx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${ring.toFixed(1)}" fill="${c.white}" stroke="${c.black}" stroke-width="${(ring * 0.13).toFixed(1)}"/>`,
    handset,
    `<path d="${line(font, PHONE, { x: x + ring * 2 + h * 0.3, y: cy - textH / 2, height: textH, tracking: 0.02 })}" fill="${c.black}"/>`,
  ].join("");
}

// ---- the car ------------------------------------------------------------------------

export default function blixen({ k, fonts }) {
  const { L, box } = k;
  const c = COLORS;
  const far = 9;
  const rear = L.wheels.rear.z;
  const wb = rear - L.wheels.front.z;
  const zAt = (u) => rear - u * wb;
  const band = L.belt - L.sill;
  const yAt = (v) => L.belt - v * band;
  /** Pixels per metre in a view. */
  const scaleOf = (view) => Math.abs(k.pt[view](1, 0)[0] - k.pt[view](0, 0)[0]);
  const poly = (pts, fill) =>
    `<polygon points="${pts.map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join(" ")}" fill="${fill}"/>`;

  const silver = k.rect(-far, -far, far, far, c.silver);
  // The orange strip along the bottom of the body.
  const yLip = L.sill + Math.max(0.05, LIP * band);
  const lip = k.rect(-far, -far, far, yLip, c.orange);

  // The orange rear: below the windows, behind a diagonal that runs forward
  // as it falls, from over the rear wheel to a quarter of the way along.
  const edgeAt = (y) =>
    zAt(EDGE.top) + ((zAt(EDGE.bottom) - zAt(EDGE.top)) * (L.belt - y)) / band;
  const yTop = L.belt + 0.03;
  const rearOrange = poly(
    [
      [edgeAt(yTop), yTop],
      [box.zmax + far, yTop],
      [box.zmax + far, -far],
      [edgeAt(-far), -far],
    ],
    c.orange,
  );
  // Two thin orange lines beside that edge, on the silver, from the window
  // line a little under halfway down (as on the photo of their car's rear).
  const yLines = yAt(0.45);
  const lines = [0.035, 0.07]
    .map((gap) =>
      poly(
        [
          [edgeAt(yTop) - gap, yTop],
          [edgeAt(yTop) - gap - 0.014, yTop],
          [edgeAt(yLines) - gap - 0.014, yLines],
          [edgeAt(yLines) - gap, yLines],
        ],
        c.orange,
      ),
    )
    .join("");
  // The orange front: the bumper and the corner under the lamp.
  const zF = L.wheels.front.z;
  const frontOrange = poly(
    [
      [zF + 0.02, yAt(FRONT + 0.03)],
      [box.zmin - far, yAt(FRONT - 0.03)],
      [box.zmin - far, -far],
      [zF + 0.02, -far],
    ],
    c.orange,
  );
  // Three chevrons on the front wing, pointing forward, clear of the arch.
  const chevrons = (() => {
    const y = Math.max(
      yAt(CHEVRONS.down),
      L.wheels.front.y + L.wheels.front.r + 0.07,
    );
    const h = 0.05;
    return [0, 1, 2]
      .map((i) => {
        const z = zAt(CHEVRONS.at) - 0.04 + i * 0.055;
        const a = h * 0.5;
        const t = h * 0.42;
        return poly(
          [
            [z + a, y + h / 2],
            [z, y],
            [z + a, y - h / 2],
            [z + a + t, y - h / 2],
            [z + t, y],
            [z + a + t, y + h / 2],
          ],
          c.orange,
        );
      })
      .join("");
  })();

  const side = [silver, rearOrange, lines, frontOrange, lip, chevrons].join("");
  const front = [silver, k.rect(-far, -far, far, yAt(FRONT), c.orange)].join(
    "",
  );
  const back = [silver, k.rect(-far, -far, far, yAt(0.5), c.orange)].join("");

  // The lettering, in pixels and never mirrored, the same on both sides.
  const zNoseStop = L.wheels.front.z + L.wheels.front.r * 0.95;
  const zTailStop = L.wheels.rear.z - L.wheels.rear.r * 0.95;
  const sides = ["left", "right"]
    .map((view) => {
      const s = scaleOf(view);
      const out = [];
      // Their mark, on the front door.
      out.push(
        mark(
          fonts,
          boxPx(
            k,
            view,
            Math.max(zAt(MARK.to), zNoseStop),
            Math.min(yAt(MARK.top), L.door.y1),
            zAt(MARK.from),
            yAt(MARK.low),
          ),
        ),
      );
      // DRIVING SCHOOL, low across both doors, above the orange strip.
      out.push(
        drivingSchool(
          fonts,
          boxPx(
            k,
            view,
            Math.max(zAt(NAME.to), zNoseStop),
            yAt(NAME.top),
            Math.min(zAt(NAME.from), zTailStop),
            Math.max(yAt(NAME.low), yLip + 0.02),
          ),
        ),
      );
      // B.A.D.S, leaning along the diagonal, just ahead of it.
      {
        const y = yAt(BADS.down);
        const [px, py] = k.pt[view](edgeAt(y) - BADS.ahead, y);
        const [ax, ay] = k.pt[view](edgeAt(L.belt), L.belt);
        const [bx, by] = k.pt[view](edgeAt(L.sill), L.sill);
        let turn = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
        if (turn > 90) turn -= 180;
        if (turn < -90) turn += 180;
        const font = fonts["Poppins-ExtraBold.ttf"];
        const h = BADS.height * s;
        const w = h * aspectOf(font, "B.A.D.S", 0.06);
        out.push(
          `<g transform="rotate(${turn.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})"><path d="${line(font, "B.A.D.S", { x: px - w / 2, y: py - h / 2, height: h, tracking: 0.06 })}" fill="${c.black}"/></g>`,
        );
      }
      // Their number, on the orange over the rear wheel. On a car with a
      // short tail it moves forward, and shrinks if it must, to stay whole.
      {
        const tail = box.zmax - 0.2;
        const room = (tail - (L.wheels.rear.z - L.wheels.rear.r)) * s;
        let h = PILL.height * wb * s;
        h *= Math.min(1, room / pillWidth(fonts, h));
        const half = pillWidth(fonts, h) / s / 2;
        const z = Math.min(zAt(PILL.at), tail - half);
        const [px, py] = k.pt[view](z, yAt(PILL.down));
        out.push(phonePill(fonts, px, py, h));
      }
      return k.pixels(view, out.join(""));
    })
    .join("");

  // "Instant Brakes" across the boot lid, under the window.
  const boot = (() => {
    const s = scaleOf("back");
    const font = fonts["Poppins-Medium.ttf"];
    const y = yAt(0.16);
    const [cx, cy] = k.pt.back(0, y);
    const w = k.width * 0.62 * s;
    const t = fitted(
      font,
      "Instant   Brakes",
      { x: cx - w / 2, y: cy - 0.065 * s, w, h: 0.13 * s },
      0.01,
      `fill="${c.orange}"`,
    );
    return k.pixels("back", t.svg);
  })();

  const body = [
    k.inView("left", side),
    k.inView("right", side),
    k.inView("top", silver),
    k.inView("front", front),
    k.inView("back", back),
    sides,
    boot,
  ].join("\n");
  return { defs: "", body };
}

function boxPx(k, view, a0, b0, a1, b1) {
  const [x1, y1] = k.pt[view](a0, b0);
  const [x2, y2] = k.pt[view](a1, b1);
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}

// ---- the logo ------------------------------------------------------------------------

/**
 * Their logo laid out wide: the steering wheel, then BLIXEN AUTO DRIVING
 * SCHOOL over the big BADS. In colour it sits on white, as theirs does;
 * `mono` is white on nothing.
 */
export function logo({ fonts, mono }) {
  const c = COLORS;
  const w = 1200;
  const h = 470;
  const words = fonts["Michroma-Regular.ttf"];
  const ink = mono ? "#fff" : c.black;
  const emblemH = h - 70;
  const emblemW = (emblemH * EMBLEM.w) / EMBLEM.h;
  const colX = 40 + emblemW + 36;
  const colW = w - colX - 44;
  const row = (text, y) =>
    fitted(words, text, { x: colX, y, w: colW, h: 50 }, 0.02, `fill="${ink}"`)
      .svg;
  const bigH = Math.min(150, (colW * LETTERS.h) / LETTERS.w);
  const big = badsWord(0, 0, bigH, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${mono ? "" : `<rect width="${w}" height="${h}" rx="36" fill="${c.white}"/>`}
    ${emblem(40 + emblemW / 2, h / 2, emblemH, { mono })}
    ${row("BLIXEN AUTO", 78)}
    ${row("DRIVING SCHOOL", 150)}
    ${badsWord(colX + (colW - big.w) / 2, 250, bigH, mono ? "#fff" : c.logoOrange).svg}
  </svg>`;
}

/** Their logo as they draw it: the wheel, the line of words, BADS. Square. */
function squareLogo(fonts, x, y, size) {
  const c = COLORS;
  const words = fonts["Michroma-Regular.ttf"];
  const bigH = Math.min(size * 0.19, (size * 0.86 * LETTERS.h) / LETTERS.w);
  const fit = badsWord(0, 0, bigH, "");
  return [
    emblem(x + size / 2, y + size * 0.36, size * 0.66),
    fitted(
      words,
      "BLIXEN AUTO DRIVING SCHOOL",
      {
        x: x + size * 0.07,
        y: y + size * 0.715,
        w: size * 0.86,
        h: size * 0.04,
      },
      0.02,
      `fill="${c.black}"`,
    ).svg,
    badsWord(x + (size - fit.w) / 2, y + size * 0.78, bigH, c.logoOrange).svg,
  ].join("");
}

// ---- the roof board (app/components/board/top-board.ts) --------------------------------

/** The roof board's size on the board cars, in metres, and its corner cut. */
export const TOP_BOARD = { width: 1.35, height: 0.45, cut: 0.02 };

/**
 * Their roof board, as on their car: white, B.A.D.S in red beside a red L
 * square, and DRIVER UNDER INSTRUCTIONS in black under it.
 */
export function topBoard({ fonts }) {
  const c = COLORS;
  const w = 1200;
  const h = (w * TOP_BOARD.height) / TOP_BOARD.width;
  const heavy = fonts["Poppins-ExtraBold.ttf"];
  const bold = fonts["Poppins-Bold.ttf"];
  const lSize = 150;
  const lX = w - 110 - lSize;
  const lY = 46;
  const name = fitted(
    heavy,
    "B.A.D.S",
    { x: 90, y: lY, w: lX - 90 - 50, h: lSize },
    0.04,
    `fill="${c.red}"`,
  );
  const t = lSize * 0.2;
  const ell = [
    [lX + lSize * 0.3, lY + lSize * 0.16],
    [lX + lSize * 0.3 + t, lY + lSize * 0.16],
    [lX + lSize * 0.3 + t, lY + lSize * 0.84 - t],
    [lX + lSize * 0.78, lY + lSize * 0.84 - t],
    [lX + lSize * 0.78, lY + lSize * 0.84],
    [lX + lSize * 0.3, lY + lSize * 0.84],
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="#3a3b3f"/>
    <rect x="12" y="12" width="${w - 24}" height="${h - 24}" fill="${c.white}"/>
    ${name.svg}
    <rect x="${lX}" y="${lY}" width="${lSize}" height="${lSize}" fill="${c.red}"/>
    <polygon points="${ell.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ")}" fill="${c.white}"/>
    ${fitted(bold, "DRIVER UNDER INSTRUCTIONS", { x: 90, y: 250, w: w - 180, h: 84 }, 0.03, `fill="${c.black}"`).svg}
  </svg>`;
}

// ---- the classroom's walls (app/lib/board/room.ts) ---------------------------------

/**
 * The wall banner (3.2 x 0.6 m): their car's side laid flat, nose to the
 * right as on the photo. The orange rear with its diagonal and their number,
 * their mark over DRIVING SCHOOL, the chevrons and the orange front.
 */
export function banner({ fonts }) {
  const w = 2048;
  const h = 384;
  const c = COLORS;
  const lipH = 30;
  const stripe = (gap) =>
    `<polygon points="${330 + gap},0 ${330 + gap + 12},0 ${560 + gap + 12},${h} ${560 + gap},${h}" fill="${c.orange}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${c.silver}"/>
    <polygon points="0,0 330,0 560,${h} 0,${h}" fill="${c.orange}"/>
    ${stripe(28)}${stripe(56)}
    <polygon points="1740,210 ${w},186 ${w},${h} 1740,${h}" fill="${c.orange}"/>
    <rect y="${h - lipH}" width="${w}" height="${lipH}" fill="${c.orange}"/>
    ${phonePill(fonts, 215, 120, 50)}
    ${mark(fonts, { x: 760, y: 22, w: 600, h: 190 })}
    ${drivingSchool(fonts, { x: 640, y: 232, w: 1010, h: 100 })}
    ${[0, 1, 2].map((i) => chevron(1790 + i * 46, 120, 44, c.orange)).join("")}
  </svg>`;
}

/**
 * Two framed posters (0.52 x 0.72 m): their logo on white, and an invitation
 * in their own words ("Learn to drive with confidence"), with their site and
 * number. No prices and no promises about passing.
 */
export function posters({ fonts }) {
  const w = 1024;
  const h = 1418;
  const c = COLORS;
  const heavy = fonts["Poppins-ExtraBold.ttf"];
  const medium = fonts["Poppins-Medium.ttf"];
  const centred = (font, text, y, wanted, fill) =>
    fitted(
      font,
      text,
      { x: 80, y, w: w - 160, h: wanted },
      0.02,
      `fill="${fill}"`,
    ).svg;
  const logoPoster = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${c.white}"/>
    ${squareLogo(fonts, 112, 200, 800)}
    <polygon points="0,${h - 230} ${w},${h - 150} ${w},${h} 0,${h}" fill="${c.orange}"/>
    <polygon points="0,${h - 268} ${w},${h - 188} ${w},${h - 176} 0,${h - 256}" fill="${c.black}"/>
  </svg>`;
  const lessons = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${c.white}"/>
    <polygon points="0,0 ${w},0 ${w},430 0,520" fill="${c.orange}"/>
    <polygon points="0,540 ${w},450 ${w},462 0,552" fill="${c.black}"/>
    ${centred(heavy, "LEARN TO DRIVE", 110, 104, c.white)}
    ${centred(heavy, "WITH CONFIDENCE", 250, 104, c.white)}
    ${mark(fonts, { x: 152, y: 620, w: 720, h: 330 })}
    ${drivingSchool(fonts, { x: 90, y: 990, w: w - 180, h: 110 })}
    ${centred(medium, "www.bads.co.ke", 1170, 60, c.navy)}
    ${centred(medium, PHONE, 1260, 54, c.navy)}
    <rect x="0" y="${h - 46}" width="${w}" height="46" fill="${c.orange}"/>
  </svg>`;
  return [
    { id: "logo", svg: logoPoster },
    { id: "lessons", svg: lessons },
  ];
}
