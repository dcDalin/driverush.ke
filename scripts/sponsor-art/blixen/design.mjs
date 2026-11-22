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

// ---- shared parts ----------------------------------------------------------------------

const poly = (pts, fill) =>
  `<polygon points="${pts.map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join(" ")}" fill="${fill}"/>`;

/** Three chevrons pointing at the nose, `h` metres tall, the first at z. */
function chevrons3(z0, y, h) {
  return [0, 1, 2]
    .map((i) => {
      const z = z0 + i * h * 1.1;
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
        COLORS.orange,
      );
    })
    .join("");
}

/**
 * B.A.D.S in black, `h` pixels tall, centred on (px, py) of a side view and
 * turned to lie along the line from (a) to (b), in that view's pixels.
 */
function badsAlong(fonts, px, py, h, [ax, ay], [bx, by]) {
  let turn = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
  if (turn > 90) turn -= 180;
  if (turn < -90) turn += 180;
  const font = fonts["Poppins-ExtraBold.ttf"];
  const w = h * aspectOf(font, "B.A.D.S", 0.06);
  return `<g transform="rotate(${turn.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})"><path d="${line(font, "B.A.D.S", { x: px - w / 2, y: py - h / 2, height: h, tracking: 0.06 })}" fill="${COLORS.black}"/></g>`;
}

/**
 * "Instant Brakes" on the back, as across their boot lid: on the largest
 * clear silver there (between the lamps, the plate and the window), or in
 * white on the orange below it when the silver has no room. Never on a
 * lamp or the plate.
 */
function instantBrakes(k, fonts, ySplit, maxH) {
  const { L, box } = k;
  const font = fonts["Poppins-Medium.ttf"];
  const text = "Instant   Brakes";
  const a = aspectOf(font, text, 0.01);
  const s = k.scale("back");
  const tryIn = (y0, y1, fill) => {
    const r = k.clearRect("back", box.xmin, box.xmax, y0, y1);
    if (!r || r.z1 - r.z0 < 0.45 || r.y1 - r.y0 < 0.07) return null;
    const b = k.boxPx("back", r.z0, r.y1, r.z1, r.y0);
    const h = Math.min(maxH * s, b.h * 0.8, (b.w * 0.92) / a);
    if (h < 0.045 * s) return null;
    return fitted(
      font,
      text,
      { x: b.x, y: b.y + (b.h - h) / 2, w: b.w, h },
      0.01,
      `fill="${fill}"`,
    ).svg;
  };
  const svg =
    tryIn(ySplit + 0.02, L.belt + 0.06, COLORS.orange) ??
    tryIn(L.sill, ySplit - 0.02, COLORS.white);
  return svg ? k.pixels("back", svg) : "";
}

// ---- the car and the van ------------------------------------------------------------

/**
 * Blixen's paint, fitted to the vehicle: their car's layout on the cars;
 * on the van the orange rear rises over the blank rear quarter, with the
 * mark and DRIVING SCHOOL larger on the sliding door; on the lorry a fleet
 * truck's layout in their look.
 */
export default function blixen({ k, fonts }) {
  if (k.kind === "lorry") return lorry(k, fonts);
  return car(k, fonts);
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

  const silver = k.rect(-far, -far, far, far, c.silver);
  // The orange strip along the bottom of the body.
  const yLip = L.sill + Math.max(0.05, LIP * band);
  const lip = k.rect(-far, -far, far, yLip, c.orange);

  // The orange rear's front edge. On a car, as on theirs: from over the rear
  // wheel at the window line, running forward as it falls. On the van it is
  // one straight diagonal from high on the blank rear quarter (the panel
  // behind the side windows) down across the sliding door, so the orange
  // fills that panel's back part as a fleet van's wrap does.
  const panel = van
    ? k.clearRect("both", L.wheels.front.z, box.zmax, L.belt, box.ymax)
    : null;
  const vanEdge = van && panel && panel.y1 - panel.y0 > 0.4;
  const VAN_LEAN = 0.8; // metres back per metre up
  const edgeAt = vanEdge
    ? (y) => panel.z0 + 0.05 + (y - L.belt) * VAN_LEAN
    : (y) =>
        zAt(EDGE.top) +
        ((zAt(EDGE.bottom) - zAt(EDGE.top)) * (L.belt - y)) / band;
  const yTop = vanEdge ? box.ymax + 0.2 : L.belt + 0.03;
  const rearOrange = poly(
    [
      [edgeAt(yTop), yTop],
      [box.zmax + far, yTop],
      [box.zmax + far, -far],
      [edgeAt(-far), -far],
    ],
    c.orange,
  );
  // Two thin orange lines beside that edge, on the silver: on a car from the
  // window line a little under halfway down; on the van down the panel.
  const [yLineTop, yLineLow] = vanEdge
    ? [panel.y1 - 0.02, L.belt + 0.12]
    : [yTop, yAt(0.45)];
  const lineW = vanEdge ? 0.022 : 0.014;
  const lines = (vanEdge ? [0.06, 0.12] : [0.035, 0.07])
    .map((gap) =>
      poly(
        [
          [edgeAt(yLineTop) - gap, yLineTop],
          [edgeAt(yLineTop) - gap - lineW, yLineTop],
          [edgeAt(yLineLow) - gap - lineW, yLineLow],
          [edgeAt(yLineLow) - gap, yLineLow],
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
  const chevH = van ? 0.07 : 0.05;
  const chev = chevrons3(
    zAt(CHEVRONS.at) - 0.04,
    Math.max(yAt(CHEVRONS.down), L.wheels.front.y + L.wheels.front.r + 0.07),
    chevH,
  );

  const side = [silver, rearOrange, lines, frontOrange, lip, chev].join("");
  const front = [silver, k.rect(-far, -far, far, yAt(FRONT), c.orange)].join(
    "",
  );
  const ySplit = yAt(0.5);
  const back = [silver, k.rect(-far, -far, far, ySplit, c.orange)].join("");

  // Where a moulding splits the doors' clear band, each piece of lettering
  // keeps to the band it overlaps most, as a wrapper works round a body line.
  const bands = L.bands?.length ? L.bands : [L.door];
  const inBand = (y0, y1) => {
    let best = null;
    let most = -Infinity;
    for (const b of bands) {
      const o = Math.min(y1, b.y1) - Math.max(y0, b.y0);
      if (o > most) {
        most = o;
        best = b;
      }
    }
    return { y0: Math.max(y0, best.y0), y1: Math.min(y1, best.y1) };
  };

  const zNoseStop = L.wheels.front.z + L.wheels.front.r * 0.95;
  const zTailStop = L.wheels.rear.z - L.wheels.rear.r * 0.95;
  const sides = ["left", "right"]
    .map((view) => {
      const s = k.scale(view);
      const out = [];
      if (vanEdge) {
        // The van: their mark large on the sliding door under its window,
        // DRIVING SCHOOL under it, ahead of the orange.
        const z0 = zNoseStop + 0.08;
        const markLow = L.belt - 0.38;
        const markBox = k.boxPx(
          view,
          z0,
          Math.min(L.door.y1, L.belt - 0.03),
          Math.min(edgeAt(markLow) - 0.55, L.door.z1),
          markLow,
        );
        out.push(mark(fonts, k.cap(markBox, 0.32 * s)));
        const dsTop = markLow - 0.04;
        const dsLow = Math.max(yLip + 0.03, L.door.y0);
        const dsBox = k.boxPx(view, z0, dsTop, edgeAt(dsLow) - 0.12, dsLow);
        out.push(drivingSchool(fonts, k.cap(dsBox, 0.13 * s)));
        // B.A.D.S along the diagonal, on the silver, at the window line.
        const y = L.belt - 0.14;
        const [px, py] = k.pt[view](edgeAt(y) - 0.26, y);
        out.push(
          badsAlong(
            fonts,
            px,
            py,
            0.1 * s,
            k.pt[view](edgeAt(L.belt + 0.5), L.belt + 0.5),
            k.pt[view](edgeAt(L.sill), L.sill),
          ),
        );
        // Their number on the orange, high on the rear panel.
        const yP = (panel.y0 + panel.y1) / 2 + 0.05;
        const tail = Math.min(panel.z1, box.zmax - 0.12);
        const from = edgeAt(yP + 0.08) + 0.08;
        let h = 0.12 * s;
        h *= Math.min(1, ((tail - from) * s) / pillWidth(fonts, h));
        const [px2, py2] = k.pt[view]((from + tail) / 2, yP);
        out.push(phonePill(fonts, px2, py2, h));
        return k.pixels(view, out.join(""));
      }
      // A car, as theirs: the mark on the front door.
      const mk = inBand(yAt(MARK.low), Math.min(yAt(MARK.top), L.door.y1));
      out.push(
        mark(
          fonts,
          k.boxPx(
            view,
            Math.max(zAt(MARK.to), zNoseStop),
            mk.y1,
            zAt(MARK.from),
            mk.y0,
          ),
        ),
      );
      // DRIVING SCHOOL, low across both doors, above the orange strip.
      const ds = inBand(Math.max(yAt(NAME.low), yLip + 0.02), yAt(NAME.top));
      out.push(
        drivingSchool(
          fonts,
          k.boxPx(
            view,
            Math.max(zAt(NAME.to), zNoseStop),
            ds.y1,
            Math.min(zAt(NAME.from), zTailStop),
            ds.y0,
          ),
        ),
      );
      // B.A.D.S, leaning along the diagonal, just ahead of it.
      {
        const y = yAt(BADS.down);
        const [px, py] = k.pt[view](edgeAt(y) - BADS.ahead, y);
        out.push(
          badsAlong(
            fonts,
            px,
            py,
            BADS.height * s,
            k.pt[view](edgeAt(L.belt), L.belt),
            k.pt[view](edgeAt(L.sill), L.sill),
          ),
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

  // The van's long roof, behind the name board: their mark for the camera
  // above.
  const roofMark =
    van && L.roof.clear
      ? k.onTopWith(
          {
            z0: L.roof.board.z + 0.6,
            z1: L.roof.z1 - 0.2,
            x0: L.roof.x0 + 0.2,
            x1: L.roof.x1 - 0.2,
          },
          (b) => mark(fonts, b),
        )
      : "";

  const body = [
    k.inView("left", side),
    k.inView("right", side),
    k.inView("top", silver),
    k.inView("front", front),
    k.inView("back", back),
    sides,
    roofMark,
    instantBrakes(k, fonts, ySplit, van ? 0.13 : 0.1),
  ].join("\n");
  return { defs: "", body };
}

// ---- the lorry ------------------------------------------------------------------------

/**
 * The lorry, as a fleet truck in Blixen's look. The cab is their car's
 * front: silver, with the orange bumper and lower corners, the chevrons, and
 * their mark on the door where it fits. The box is silver with their orange
 * rear over its back third behind the same leaning edge and two thin lines,
 * their mark large on its front part (about 60 cm tall), DRIVING SCHOOL
 * under it, B.A.D.S along the edge and their number on the orange. The
 * drop-side rail at its foot is their orange strip. The box's roof carries
 * the mark for the camera above. Its rear doors take no paint.
 */
function lorry(k, fonts) {
  const { L, box } = k;
  const c = COLORS;
  const far = 9;
  const load = L.load;
  const cab = L.cab;
  const len = load.z1 - load.z0;
  const LEAN = 0.62; // the edge runs forward as it falls, as on their car
  const zTopEdge = load.z0 + len * 0.66;
  const edgeAt = (y) => zTopEdge - (load.y1 - y) * LEAN;
  const yHigh = box.ymax + 0.2;

  const silver = k.rect(-far, -far, far, far, c.silver);
  const rearOrange = poly(
    [
      [edgeAt(yHigh), yHigh],
      [far, yHigh],
      [far, -far],
      [edgeAt(-far), -far],
    ],
    c.orange,
  );
  const yLineLow = load.rail + (load.y1 - load.rail) * 0.5;
  const lines = [0.08, 0.16]
    .map((gap) =>
      poly(
        [
          [edgeAt(yHigh) - gap, yHigh],
          [edgeAt(yHigh) - gap - 0.028, yHigh],
          [edgeAt(yLineLow) - gap - 0.028, yLineLow],
          [edgeAt(yLineLow) - gap, yLineLow],
        ],
        c.orange,
      ),
    )
    .join("");
  // The rail at the box's foot and the cab's lower part: their orange strip
  // and orange front corner.
  const rail = k.rect(load.z0 - 0.05, -far, far, load.rail - 0.015, c.orange);
  const yCabLow = cab.sill + 0.3;
  const cabLow = k.rect(-far, -far, cab.z1, yCabLow, c.orange);
  const chev = chevrons3(
    cab.door.z0 + 0.02,
    (cab.door.y0 + cab.door.y1) / 2,
    0.08,
  );
  const side = [silver, rearOrange, lines, rail, cabLow, chev].join("");

  const sides = ["left", "right"]
    .map((view) => {
      const s = k.scale(view);
      const out = [];
      // The mark, large on the box's front part, high.
      const z0 = load.z0 + 0.22;
      const markTop = load.y1 - 0.1;
      const markLow = markTop - 0.66;
      const markZ1 = edgeAt(markLow) - 0.4;
      out.push(
        mark(
          fonts,
          k.cap(k.boxPx(view, z0, markTop, markZ1, markLow), 0.62 * s),
        ),
      );
      // DRIVING SCHOOL under it, across the box above the rail.
      const dsTop = markLow - 0.06;
      const dsLow = load.rail + 0.1;
      out.push(
        drivingSchool(
          fonts,
          k.cap(
            k.boxPx(view, z0, dsTop, edgeAt(dsLow) - 0.25, dsLow),
            0.26 * s,
          ),
        ),
      );
      // B.A.D.S along the edge, on the silver.
      const y = load.rail + (load.y1 - load.rail) * 0.72;
      const [px, py] = k.pt[view](edgeAt(y) - 0.42, y);
      out.push(
        badsAlong(
          fonts,
          px,
          py,
          0.17 * s,
          k.pt[view](edgeAt(load.y1), load.y1),
          k.pt[view](edgeAt(load.rail), load.rail),
        ),
      );
      // Their number on the orange, high, ahead of the box's back edge.
      const yP = load.y1 - 0.32;
      const from = edgeAt(yP + 0.1) + 0.15;
      const to = load.z1 - 0.15;
      let h = 0.18 * s;
      h *= Math.min(1, ((to - from) * s) / pillWidth(fonts, h));
      const [qx, qy] = k.pt[view]((from + to) / 2, yP);
      out.push(phonePill(fonts, qx, qy, h));
      // The mark on the cab door, if there is room for it to read.
      const r = k.clearRect(
        "both",
        cab.z0 + 0.05,
        cab.z1 - 0.05,
        yCabLow + 0.02,
        cab.top,
      );
      if (r && r.y1 - r.y0 >= 0.11 && r.z1 - r.z0 >= 0.25) {
        out.push(mark(fonts, k.boxPx(view, r.z0, r.y1, r.z1, r.y0)));
      }
      return k.pixels(view, out.join(""));
    })
    .join("");

  // The top: the box silver with the orange back third, the cab silver.
  const top = [
    silver,
    k.rect(zTopEdge, -far, far, far, c.orange),
    k.rect(zTopEdge - 0.16 - 0.028, -far, zTopEdge - 0.16, far, c.orange),
    k.rect(zTopEdge - 0.08 - 0.028, -far, zTopEdge - 0.08, far, c.orange),
  ].join("");
  const roofMark = k.onTopWith(
    {
      z0: load.z0 + 0.3,
      z1: zTopEdge - 0.4,
      x0: box.xmin + 0.15,
      x1: box.xmax - 0.15,
    },
    (b) => mark(fonts, b),
  );
  const front = [silver, k.rect(-far, -far, far, yCabLow, c.orange)].join("");

  const body = [
    k.inView("left", side),
    k.inView("right", side),
    k.inView("top", top),
    k.inView("front", front),
    k.inView("back", silver),
    sides,
    roofMark,
  ].join("\n");
  return { defs: "", body };
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
