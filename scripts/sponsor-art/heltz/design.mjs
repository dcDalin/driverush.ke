/**
 * Heltz Driving Academy's own car, as on the photo of their real one
 * (reference.jpg): not a style of ours. Fitted to every board car by placing
 * each part where it sits on their car, measured against the wheels and the
 * window line, so it lands in the same place on a saloon, an SUV and a pickup.
 *
 * From the photo (their car's right side, nose to the right; wheel centres at
 * x 175 and 533, window line at y 115, door bottoms at y 232):
 *   - a white body with a scatter of small marks in red, navy and blue
 *   - "HELTZ" in wide block letters, orange shading to yellow at the top,
 *     red brush strokes low down, a thin red edge, the L in red; across both
 *     doors from just over the rear wheel to the front door
 *   - "DRIVING ACADEMY" in blue under it, ending under the Z
 *   - the front in taxi gold from the front door forward, bonnet included,
 *     with two red stripes leaning back at its edge
 *   - a red splash on the front wing, and a white front bumper
 *
 * The lettering is set in the closest free typefaces (Rubik Mono One for the
 * name, Righteous for the tagline); the splash is traced from the photo
 * (trace.mjs). When Heltz sends their artwork files, they replace both.
 *
 * Their real car's scatter includes Louis Vuitton's "LV" monogram. That is
 * not Heltz's to give, so those marks are left out of the scatter here.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { aspectOf, line } from "../lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Their colours, measured off the photo and lifted out of the daylight. */
export const COLORS = {
  white: "#f6f6f3",
  gold: "#f4a20c",
  orange: "#f5821a",
  yellow: "#f9b938",
  red: "#e3271b",
  blue: "#1d2fc2",
  navy: "#1c2463",
};

/** Places along the car, as on the photo: 0 = rear wheel, 1 = front wheel. */
const PHOTO = {
  rearWheel: 175,
  frontWheel: 533,
  belt: 115,
  sill: 232,
};
const along = (x) =>
  (x - PHOTO.rearWheel) / (PHOTO.frontWheel - PHOTO.rearWheel);
const down = (y) => (y - PHOTO.belt) / (PHOTO.sill - PHOTO.belt);

const NAME = { from: along(121), to: along(412) };
const GOLD = along(414); // the gold's edge, where the first stripe sits
const STRIPES = [along(414), along(446)];
const STRIPE_W = 6 / (PHOTO.frontWheel - PHOTO.rearWheel); // of the wheelbase
const LEAN = 0.1; // the stripes lean back: metres forward per metre up
const SPLASH = { at: along(573), y: down(142), w: 57 / 358 };
const BUMPER = down(150); // the white bumper's top, on the front

// ---- the lettering ------------------------------------------------------------------

/**
 * "HELTZ" over "DRIVING ACADEMY", as on their doors, filling `box` (pixels)
 * as far as it can without changing shape. `mono` draws it all in white.
 */
export function lettering(
  fonts,
  box,
  {
    mono = false,
    id = "l",
    align = "center",
    valign = align === "center" ? "middle" : "top",
    tag: withTag = true,
  } = {},
) {
  const nameFont = fonts["RubikMonoOne-Regular.ttf"];
  const tagFont = fonts["Righteous-Regular.ttf"];
  const nameTrack = -0.035;
  const tagTrack = 0.02;
  const a1 = aspectOf(nameFont, "HELTZ", nameTrack);
  const a2 = aspectOf(tagFont, "DRIVING ACADEMY", tagTrack);
  // As on the car: the tagline is 0.65 of the name's width, under its right
  // end, a quarter of the name's height below it.
  const tagShare = 0.65;
  const gap = 0.26;
  const w = withTag
    ? Math.min(box.w, box.h / (1 / a1 + gap / a1 + tagShare / a2))
    : Math.min(box.w, box.h * a1);
  const h1 = w / a1;
  const w2 = w * tagShare;
  const h2 = w2 / a2;
  const total = withTag ? h1 * (1 + gap) + h2 : h1;
  // `align` keeps the front end of the lettering against the gold: right on
  // the car's right side (nose to the right), left on its left side.
  const x =
    align === "right"
      ? box.x + box.w - w
      : align === "left"
        ? box.x
        : box.x + (box.w - w) / 2;
  const y =
    valign === "middle"
      ? box.y + (box.h - total) / 2
      : valign === "bottom"
        ? box.y + box.h - total
        : box.y;

  // Each letter on its own, so the L can be red as on their car.
  const letters = [];
  const font = nameFont;
  const size = 100;
  const scale = h1 / inkHeight(font, "HELTZ");
  // Start the first letter's ink, not its side bearing, at x.
  let lx =
    x - font.charToGlyph("H").getPath(0, 0, size).getBoundingBox().x1 * scale;
  for (const ch of "HELTZ") {
    const g = font.charToGlyph(ch);
    letters.push({ ch, d: glyphPath(font, ch, lx, y, h1) });
    lx +=
      ((g.advanceWidth / font.unitsPerEm) * size + nameTrack * size) * scale;
  }
  const all = letters.map((l) => l.d).join("");
  const tag = !withTag
    ? ""
    : line(tagFont, "DRIVING ACADEMY", {
        x: x + w - w2,
        y: y + h1 * (1 + gap),
        height: h2,
        tracking: tagTrack,
      });
  const edge = Math.round(h1 * 0.075 * 10) / 10;
  const bold = Math.round(h2 * 0.06 * 10) / 10;

  if (mono) {
    return [
      `<path d="${all}" fill="#fff" stroke="#fff" stroke-width="${edge * 2}" stroke-linejoin="round"/>`,
      `<path d="${tag}" fill="#fff" stroke="#fff" stroke-width="${bold}" stroke-linejoin="round"/>`,
    ].join("");
  }

  const c = COLORS;
  const top = y.toFixed(1);
  const bottom = (y + h1).toFixed(1);
  const defs = [
    `<linearGradient id="${id}-warm" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${bottom}"><stop offset="0" stop-color="${c.yellow}"/><stop offset="0.55" stop-color="${c.orange}"/><stop offset="1" stop-color="${c.orange}"/></linearGradient>`,
    `<linearGradient id="${id}-hot" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${bottom}"><stop offset="0" stop-color="#f0544a"/><stop offset="1" stop-color="${c.red}"/></linearGradient>`,
    `<clipPath id="${id}-clip"><path d="${all}"/></clipPath>`,
  ].join("");

  // Red brush strokes low in the letters, as on their car: ragged bands
  // rising from the bottom edge, the same every build.
  const strokes = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) {
    const sx = x + rnd() * w;
    const sw = w * (0.04 + rnd() * 0.09);
    const sy = y + h1 * (0.55 + rnd() * 0.3);
    const sh = h1 * (0.04 + rnd() * 0.07);
    const lift = h1 * (rnd() - 0.5) * 0.12;
    strokes.push(
      `M${sx.toFixed(1)} ${(sy + sh).toFixed(1)}` +
        `Q${(sx + sw * 0.5).toFixed(1)} ${(sy + lift).toFixed(1)} ${(sx + sw).toFixed(1)} ${(sy + sh * 0.4).toFixed(1)}` +
        `L${(sx + sw).toFixed(1)} ${(sy + sh * 1.6).toFixed(1)}` +
        `Q${(sx + sw * 0.5).toFixed(1)} ${(sy + sh * 1.3 + lift).toFixed(1)} ${sx.toFixed(1)} ${(sy + sh * 2).toFixed(1)}Z`,
    );
  }
  // A band of red along the bottom of each letter.
  const foot = `M${x.toFixed(1)} ${(y + h1 * 0.86).toFixed(1)}H${(x + w).toFixed(1)}V${(y + h1 + 2).toFixed(1)}H${x.toFixed(1)}Z`;

  return [
    `<defs>${defs}</defs>`,
    `<path d="${all}" fill="${c.red}" stroke="${c.red}" stroke-width="${edge * 2}" stroke-linejoin="round"/>`,
    ...letters.map(
      (l) =>
        `<path d="${l.d}" fill="url(#${id}-${l.ch === "L" ? "hot" : "warm"})"/>`,
    ),
    `<g clip-path="url(#${id}-clip)">`,
    `<path d="${strokes.join("")}" fill="${c.red}" opacity="0.9"/>`,
    `<path d="${foot}" fill="${c.red}" opacity="0.85"/>`,
    `</g>`,
    `<path d="${tag}" fill="${c.blue}" stroke="${c.blue}" stroke-width="${bold}" stroke-linejoin="round"/>`,
  ].join("");
}

/** The ink height of a word in a font, at size 100. */
function inkHeight(font, text) {
  let top = Infinity;
  let bottom = -Infinity;
  for (const ch of text) {
    const b = font.charToGlyph(ch).getPath(0, 0, 100).getBoundingBox();
    top = Math.min(top, b.y1);
    bottom = Math.max(bottom, b.y2);
  }
  return bottom - top;
}

/** One letter as a path, placed so the word's ink top is at y and ink is h1 tall. */
function glyphPath(font, ch, x, y, h1) {
  const word = "HELTZ";
  let top = Infinity;
  for (const c of word) {
    top = Math.min(
      top,
      font.charToGlyph(c).getPath(0, 0, 100).getBoundingBox().y1,
    );
  }
  const k = h1 / inkHeight(font, word);
  const p = font.charToGlyph(ch).getPath(0, 0, 100);
  return p.commands
    .map((c) => {
      const X = (v) => (x + v * k).toFixed(1);
      const Y = (v) => (y + (v - top) * k).toFixed(1);
      switch (c.type) {
        case "M":
        case "L":
          return `${c.type}${X(c.x)} ${Y(c.y)}`;
        case "Q":
          return `Q${X(c.x1)} ${Y(c.y1)} ${X(c.x)} ${Y(c.y)}`;
        case "C":
          return `C${X(c.x1)} ${Y(c.y1)} ${X(c.x2)} ${Y(c.y2)} ${X(c.x)} ${Y(c.y)}`;
        case "Z":
          return "Z";
      }
      return "";
    })
    .join("");
}

// ---- the scatter ---------------------------------------------------------------------

/** Four-pointed star centred on (x, y), r across its points. */
function star4(x, y, r) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rr = i % 2 ? r * 0.32 : r;
    pts.push(
      `${(x + Math.cos(a) * rr).toFixed(4)},${(y + Math.sin(a) * rr).toFixed(4)}`,
    );
  }
  return pts.join(" ");
}

/**
 * The scatter over the white, in metres: a solid navy star, a red flower in
 * a ring, a blue star in a diamond and a small black star, repeating in
 * staggered rows as on their car.
 */
function scatter(c) {
  const t = 0.22; // tile
  const r = 0.027;
  const ring = (x, y, col) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${col}" stroke-width="0.0075"/>` +
    [0, 1, 2, 3]
      .map((i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        return `<ellipse cx="${(x + Math.cos(a) * r * 0.42).toFixed(4)}" cy="${(y + Math.sin(a) * r * 0.42).toFixed(4)}" rx="${(r * 0.34).toFixed(4)}" ry="${(r * 0.18).toFixed(4)}" transform="rotate(${45 + i * 90} ${(x + Math.cos(a) * r * 0.42).toFixed(4)} ${(y + Math.sin(a) * r * 0.42).toFixed(4)})" fill="${col}"/>`;
      })
      .join("");
  const diamond = (x, y, col) =>
    `<polygon points="${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}" fill="none" stroke="${col}" stroke-width="0.0075"/>` +
    `<polygon points="${star4(x, y, r * 0.62)}" fill="${col}"/>`;
  return `<pattern id="heltz-scatter" width="${t}" height="${t}" patternUnits="userSpaceOnUse">
    <polygon points="${star4(t * 0.25, t * 0.25, r)}" fill="${c.navy}"/>
    ${ring(t * 0.75, t * 0.25, c.red)}
    ${diamond(t * 0.25 - t * 0.25 + 0.0001, t * 0.75, c.blue)}
    ${diamond(t, t * 0.75, c.blue)}
    ${ring(t * 0.5, t * 0.75, c.red)}
    <polygon points="${star4(t * 0.5, t * 0.5, r * 0.6)}" fill="#26262a"/>
  </pattern>`;
}

// ---- the car ------------------------------------------------------------------------

/** "DRIVING ACADEMY" alone, filling `box` (pixels), in their blue. */
function tagline(fonts, box, { align = "center" } = {}) {
  const font = fonts["Righteous-Regular.ttf"];
  const a = aspectOf(font, "DRIVING ACADEMY", 0.02);
  const w = Math.min(box.w, box.h * a);
  const h = w / a;
  const x =
    align === "right"
      ? box.x + box.w - w
      : align === "left"
        ? box.x
        : box.x + (box.w - w) / 2;
  const d = line(font, "DRIVING ACADEMY", {
    x,
    y: box.y + (box.h - h) / 2,
    height: h,
    tracking: 0.02,
  });
  const bold = Math.round(h * 0.06 * 10) / 10;
  return `<path d="${d}" fill="${COLORS.blue}" stroke="${COLORS.blue}" stroke-width="${bold}" stroke-linejoin="round"/>`;
}

const poly = (pts, fill, extra = "") =>
  `<polygon points="${pts.map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join(" ")}" fill="${fill}"${extra}/>`;

/** The splash, traced, centred on (z, y) of a side, `h` metres tall. */
function splashAt3d(z, y, h, maxW = Infinity) {
  const splashSvg = readFileSync(path.join(HERE, "splash.svg"), "utf8");
  const [, sw, sh] = /width="(\d+)" height="(\d+)"/.exec(splashSvg).map(Number);
  const inner = /<g id="splash"[\s\S]*?<\/g>/.exec(splashSvg)[0];
  // Mirrored, so its tails point back along the vehicle.
  const sk = Math.min(h / sh, maxW / sw);
  return `<g transform="translate(${z.toFixed(4)} ${y.toFixed(4)}) scale(${(-sk).toFixed(6)} ${(-sk).toFixed(6)}) translate(${-sw / 2} ${-sh / 2})">${inner}</g>`;
}

/**
 * Heltz's paint, fitted to the vehicle: their car's layout on the cars, the
 * same with the gold running to the front door's back edge and the name on
 * the blank rear panel on the van, and a fleet truck's layout on the lorry.
 */
export default function heltz({ k, fonts }) {
  if (k.kind === "lorry") return lorry(k, fonts);
  return car(k, fonts);
}

/**
 * HELTZ / DRIVING ACADEMY on the back, on the largest clear paint between
 * the lamps, the plate and the window (the back's paint map), no taller
 * than `h` metres.
 */
function onBack(k, fonts, h) {
  const { L, box } = k;
  const r = k.clearRect("back", box.xmin, box.xmax, L.sill, L.belt + 0.05);
  if (!r || r.y1 - r.y0 < 0.12 || r.z1 - r.z0 < 0.5) return "";
  const b = k.boxPx("back", r.z0, r.y1, r.z1, r.y0);
  return k.pixels(
    "back",
    lettering(fonts, k.cap(b, h * k.scale("back")), { id: "heltz-back" }),
  );
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
  const lean = (z, y) => z - (y - L.sill) * LEAN; // forward as it rises

  // The gold front: below the windows from the gold's edge forward, and all
  // of it ahead of the windscreen. The bumper below its top line is white.
  // On a van the driver sits over the wheel, so the front door is all
  // "front": the gold runs to its back edge, the pillar behind its window.
  let zG = zAt(GOLD);
  if (van) {
    const runs = k.runsAt("left", L.belt + 0.25, L.screen.front, rear);
    const pillar = runs.find((r) => r.z1 - r.z0 < 0.4);
    if (pillar) zG = pillar.z1 + (L.belt - L.sill) * LEAN;
  }
  const yTop = L.belt + 0.02;
  const yBumper = yAt(BUMPER);
  const zBumper = L.wheels.front.z - L.wheels.front.r * 0.95;
  const gold = [
    [lean(zG, yTop), yTop],
    [lean(zG, -1), -1],
    [box.zmin - far, -1],
    [box.zmin - far, box.ymax + far],
    [L.screen.front, box.ymax + far],
    [L.screen.front, yTop],
  ];
  const bumper = [
    [zBumper, yBumper],
    [zBumper, -far],
    [box.zmin - far, -far],
    [box.zmin - far, yBumper],
  ];
  const stripeW = Math.max(STRIPE_W * wb, 0.05);
  const stripeGap = (STRIPES[0] - STRIPES[1]) * wb;
  const stripes = [zG, zG + stripeGap]
    .map((z) =>
      poly(
        [
          [lean(z, yTop), yTop],
          [lean(z - stripeW, yTop), yTop],
          [lean(z - stripeW, -1), -1],
          [lean(z, -1), -1],
        ],
        c.red,
      ),
    )
    .join("");

  // The splash on the front wing, as wide as on their car, unless the wing
  // over the arch is too low to hold it: then smaller, to fit what shows.
  const archTop = L.wheels.front.y + L.wheels.front.r;
  const room =
    L.wing.y1 - L.wing.y0 > 0.06
      ? L.wing
      : { y0: archTop + 0.01, y1: L.bonnet.y - 0.02 };
  const splashSvg = readFileSync(path.join(HERE, "splash.svg"), "utf8");
  const [, sw] = /width="(\d+)" height="(\d+)"/.exec(splashSvg).map(Number);
  const splash = splashAt3d(
    zAt(SPLASH.at),
    (room.y0 + room.y1) / 2 + 0.01,
    1.5 * (room.y1 - room.y0),
    SPLASH.w * wb,
  );
  void sw;

  const white = [
    k.rect(-far, -far, far, far, c.white),
    k.rect(-far, -far, far, far, "url(#heltz-scatter)"),
  ].join("");
  const side = [
    white,
    poly(gold, c.gold),
    poly(bumper, c.white),
    stripes,
    splash,
  ].join("");
  const top = [
    white,
    k.rect(box.zmin - far, -far, L.screen.front, far, c.gold),
  ].join("");
  const front = [
    k.rect(-far, -far, far, far, c.gold),
    k.rect(-far, -far, far, yBumper, c.white),
  ].join("");

  // The lettering. On a car: between the rear wheel and the gold, in the
  // doors' clear band, as on their car, never taller than a sign writer
  // would paint it (a name about 22 cm high). Where a moulding splits the
  // doors into two low bands, HELTZ goes in the upper and DRIVING ACADEMY
  // in the lower, as a wrapper works round a body line.
  const name = [];
  const panel = van
    ? k.clearRect("both", zG + 0.25, box.zmax, L.belt, box.ymax)
    : null;
  if (panel && panel.y1 - panel.y0 > 0.4) {
    // A van: the blank panel behind the side windows, high where it reads
    // over traffic, the name about 30 cm tall.
    for (const view of ["left", "right"]) {
      const b = k.boxPx(view, panel.z0, panel.y1, panel.z1, panel.y0);
      name.push(
        k.pixels(
          view,
          lettering(fonts, k.cap(b, 0.56 * k.scale(view)), {
            id: `heltz-${view}`,
            align: "center",
          }),
        ),
      );
    }
  } else {
    const zFront = zAt(NAME.to);
    const tallArch = L.wheels.rear.r > 0.45;
    const zBack = Math.min(
      zAt(NAME.from),
      tallArch ? L.wheels.rear.z - L.wheels.rear.r - 0.04 : L.wheels.rear.z,
    );
    const [first, second] = L.bands ?? [L.door];
    const split =
      first.y1 - first.y0 < 0.3 &&
      second &&
      second.y1 - second.y0 >= 0.1 &&
      second.y1 < first.y0;
    for (const view of ["left", "right"]) {
      const align = view === "right" ? "right" : "left";
      const s = k.scale(view);
      if (split) {
        const top = k.boxPx(view, zFront, first.y1, zBack, first.y0 + 0.01);
        const low = k.boxPx(view, zFront, second.y1, zBack, second.y0);
        name.push(
          k.pixels(
            view,
            lettering(fonts, k.cap(top, 0.2 * s), {
              id: `heltz-${view}`,
              align,
              valign: "middle",
              tag: false,
            }) + tagline(fonts, k.cap(low, 0.075 * s), { align }),
          ),
        );
      } else {
        const b = k.boxPx(view, zFront, L.door.y1, zBack, L.door.y0 + 0.01);
        name.push(
          k.pixels(
            view,
            lettering(fonts, k.cap(b, 0.36 * s, "top"), {
              id: `heltz-${view}`,
              align,
            }),
          ),
        );
      }
    }
  }

  // The roof behind the name board on a long van roof: HELTZ for the camera
  // above.
  const roofName =
    van && L.roof.clear
      ? k.onTopWith(
          {
            z0: L.roof.board.z + 0.55,
            z1: L.roof.z1 - 0.15,
            x0: L.roof.x0 + 0.15,
            x1: L.roof.x1 - 0.15,
          },
          (b) => lettering(fonts, b, { id: "heltz-roof" }),
        )
      : "";

  const body = [
    k.inView("left", side),
    k.inView("right", side),
    k.inView("top", top),
    k.inView("front", front),
    k.inView("back", white),
    ...name,
    roofName,
    onBack(k, fonts, van ? 0.3 : 0.22),
  ].join("\n");
  return { defs: scatter(c), body };
}

/**
 * The lorry, painted as a fleet truck in Heltz's look: the cab is their gold
 * front, with the splash on its door; the gold runs a little onto the box
 * and ends in their two red stripes. The box is white, calm in the middle
 * for HELTZ and DRIVING ACADEMY (letters about 55 cm tall), with their
 * scatter over its rear part behind a third stripe and along the drop-side
 * rail at its foot. Its roof carries the name for the camera above.
 */
function lorry(k, fonts) {
  const { L, box } = k;
  const c = COLORS;
  const far = 9;
  const load = L.load;
  const cab = L.cab;
  const yHigh = box.ymax + 0.2;
  const tilt = 0.1; // the stripes lean back, as on their car
  const lean = (z, y) => z - (y - load.rail) * tilt;
  const sw = 0.075; // a stripe, wide enough to read on a truck
  const zGold = load.z0 + 0.3;
  const zStripe2 = zGold + 0.2;
  const zScatter = load.z1 - 1.05;
  const stripe = (z) =>
    poly(
      [
        [lean(z, yHigh), yHigh],
        [lean(z + sw, yHigh), yHigh],
        [lean(z + sw, -1), -1],
        [lean(z, -1), -1],
      ],
      c.red,
    );
  const white = k.rect(-far, -far, far, far, c.white);
  const scatterIn = (pts) =>
    `<clipPath id="heltz-rear-${pts.length}"><path d="M${pts.map(([a, b]) => `${a.toFixed(3)} ${b.toFixed(3)}`).join("L")}Z"/></clipPath>` +
    `<g clip-path="url(#heltz-rear-${pts.length})">${k.rect(-far, -far, far, far, "url(#heltz-scatter)")}</g>`;
  const rearPart = [
    [lean(zScatter, yHigh), yHigh],
    [far, yHigh],
    [far, -1],
    [lean(zScatter, -1), -1],
  ];
  const railPart = [
    [-far, load.rail - 0.02],
    [far, load.rail - 0.02],
    [far, -1],
    [-far, -1],
    [-far, load.rail - 0.02],
  ];
  const gold = [
    [lean(zGold, yHigh), yHigh],
    [lean(zGold, -1), -1],
    [-far, -1],
    [-far, yHigh],
  ];
  const side = [
    white,
    scatterIn(rearPart),
    scatterIn(railPart),
    poly(gold, c.gold),
    stripe(zGold),
    stripe(zStripe2),
    stripe(zScatter - sw),
    // The splash on the cab's door, low and forward, as on their wing.
    splashAt3d(
      (cab.door.z0 + cab.door.z1) / 2,
      (cab.door.y0 + cab.door.y1) / 2,
      0.24,
      0.55,
    ),
  ].join("");

  // The name on the box, between the stripes and the scatter, its nose end
  // against the gold as on their car.
  const name = ["left", "right"]
    .map((view) => {
      const b = k.boxPx(
        view,
        zStripe2 + sw + 0.25,
        load.y1 - 0.12,
        zScatter - sw - 0.25,
        load.rail + 0.08,
      );
      return k.pixels(
        view,
        lettering(fonts, k.cap(b, 1.0 * k.scale(view)), {
          id: `heltz-${view}`,
          align: view === "right" ? "right" : "left",
          valign: "middle",
        }),
      );
    })
    .join("");

  // The top: the cab gold, the box white with the same zones and stripes
  // straight across it, and the name over the box's middle.
  const topStripe = (z) => k.rect(z, -far, z + sw, far, c.red);
  const top = [
    white,
    `<g clip-path="url(#heltz-top-rear)">${k.rect(-far, -far, far, far, "url(#heltz-scatter)")}</g>`,
    k.rect(-far, -far, zGold, far, c.gold),
    topStripe(zGold),
    topStripe(zStripe2),
    topStripe(zScatter - sw),
  ].join("");
  const roofName = k.onTopWith(
    {
      z0: zStripe2 + sw + 0.3,
      z1: zScatter - sw - 0.3,
      x0: box.xmin + 0.18,
      x1: box.xmax - 0.18,
    },
    (b) => lettering(fonts, b, { id: "heltz-roof" }),
  );

  const front = [
    k.rect(-far, -far, far, far, c.gold),
    k.rect(-far, -far, far, cab.sill + 0.3, c.white),
  ].join("");

  const defs =
    scatter(c) +
    `<clipPath id="heltz-top-rear"><rect x="${zScatter.toFixed(3)}" y="-9" width="9" height="18"/></clipPath>`;
  const body = [
    k.inView("left", side),
    k.inView("right", side),
    k.inView("top", top),
    k.inView("front", front),
    k.inView("back", white),
    name,
    roofName,
  ].join("\n");
  return { defs, body };
}

/** Heltz's logo: their lettering, on a transparent ground. */
export function logo({ fonts, mono }) {
  const w = 1200;
  const h = 470;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${lettering(fonts, { x: 40, y: 30, w: w - 80, h: h - 60 }, { mono, id: "logo" })}</svg>`;
}

// ---- the roof board (app/components/board/top-board.ts) --------------------------------

/** The roof board's size on the board cars, in metres, and its corner cut. */
export const TOP_BOARD = { width: 1.35, height: 0.45, cut: 0.04 };

/**
 * A roof board for Heltz. Their real car has none: every school's board car
 * carries one (owner, 2026-11-21), so this is ours, in their look: white
 * with a red edge and their door lettering.
 */
export function topBoard({ fonts }) {
  const c = COLORS;
  const w = 1200;
  const h = (w * TOP_BOARD.height) / TOP_BOARD.width;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${c.red}"/>
    <rect x="16" y="16" width="${w - 32}" height="${h - 32}" rx="18" fill="${c.white}"/>
    ${lettering(fonts, { x: 70, y: 44, w: w - 140, h: h - 88 }, { id: "board" })}
  </svg>`;
}

// ---- the classroom's walls (app/lib/board/room.ts) ---------------------------------

/** The splash, as traced, placed with its middle at (cx, cy), `w` wide. */
function splashAt(cx, cy, w) {
  const svg = readFileSync(path.join(HERE, "splash.svg"), "utf8");
  const [, sw, sh] = /width="(\d+)" height="(\d+)"/.exec(svg).map(Number);
  const inner = /<g id="splash"[\s\S]*?<\/g>/.exec(svg)[0];
  const k = w / sw;
  return `<g transform="translate(${cx - (sw * k) / 2} ${cy - (sh * k) / 2}) scale(${k})">${inner}</g>`;
}

/** Their gold block with the two red stripes leaning back at its edge. */
function goldBlock(x, w, h, stripeW) {
  const c = COLORS;
  const lean = h * 0.08;
  const stripe = (at) =>
    `<polygon points="${at + lean},0 ${at + lean + stripeW},0 ${at + stripeW},${h} ${at},${h}" fill="${c.red}"/>`;
  return [
    `<polygon points="${x + lean},0 ${w},0 ${w},${h} ${x},${h}" fill="${c.gold}"/>`,
    stripe(x),
    stripe(x + stripeW * 3.2),
  ].join("");
}

/** The scatter over white, in pixels: their car's pattern at `pxPerMetre`. */
function scatterFill(w, h, pxPerMetre) {
  const k = pxPerMetre;
  return `<g transform="scale(${k})"><rect width="${w / k}" height="${h / k}" fill="url(#heltz-scatter)"/></g>`;
}

/**
 * The wall banner (3.2 x 0.6 m): their car's side laid flat. White with the
 * scatter, HELTZ and DRIVING ACADEMY, and the gold front with its two red
 * stripes and the splash, at the right-hand end as on the photo.
 */
export function banner({ fonts }) {
  const w = 2048;
  const h = 384;
  const c = COLORS;
  const goldAt = 1490;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>${scatter(c)}</defs>
    <rect width="${w}" height="${h}" fill="${c.white}"/>
    ${scatterFill(w, h, 640)}
    ${goldBlock(goldAt, w, h, 26)}
    ${splashAt(1820, 150, 300)}
    ${lettering(fonts, { x: 70, y: 46, w: goldAt - 120, h: h - 92 }, { id: "banner", align: "right" })}
  </svg>`;
}

/**
 * Two framed posters (0.52 x 0.72 m): their logo on white, and an invitation
 * to learn with them. No promises about passing.
 */
export function posters({ fonts }) {
  const w = 1024;
  const h = 1418;
  const c = COLORS;
  const tag = fonts["Righteous-Regular.ttf"];
  // A line of text centred across the poster, smaller if it would not fit
  // inside the margins.
  const centred = (text, y, wanted, fill) => {
    const a = aspectOf(tag, text, 0.02);
    const height = Math.min(wanted, (w - 160) / a);
    const width = height * a;
    return `<path d="${line(tag, text, { x: (w - width) / 2, y, height, tracking: 0.02 })}" fill="${fill}"/>`;
  };
  const frameDefs = `<defs>${scatter(c)}</defs>`;
  const logoPoster = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${frameDefs}
    <rect width="${w}" height="${h}" fill="${c.white}"/>
    ${scatterFill(w, h, 1400)}
    <rect x="60" y="430" width="${w - 120}" height="430" rx="24" fill="${c.white}" opacity="0.94"/>
    ${lettering(fonts, { x: 100, y: 470, w: w - 200, h: 350 }, { id: "poster-logo" })}
    <g transform="translate(0 ${h - 260})">${goldBlock(0, w, 260, 30)}</g>
  </svg>`;
  const lessons = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${frameDefs}
    <rect width="${w}" height="${h}" fill="${c.gold}"/>
    <polygon points="0,0 ${w},0 ${w},${h * 0.56} 0,${h * 0.64}" fill="${c.white}"/>
    ${scatterFill(w, h * 0.5, 1400)}
    <rect x="50" y="90" width="${w - 100}" height="250" rx="24" fill="${c.white}" opacity="0.94"/>
    ${centred("LEARN TO DRIVE", 120, 92, c.blue)}
    ${centred("WITH", 250, 70, c.blue)}
    <rect x="50" y="370" width="${w - 100}" height="380" rx="24" fill="${c.white}" opacity="0.94"/>
    ${lettering(fonts, { x: 90, y: 400, w: w - 180, h: 320 }, { id: "poster-lessons" })}
    ${splashAt(w * 0.78, h * 0.72, 300)}
    ${centred("BOOK YOUR LESSONS", 1080, 80, c.navy)}
    ${centred("TODAY", 1190, 80, c.navy)}
    <rect x="0" y="${h - 60}" width="${w}" height="22" fill="${c.red}"/>
  </svg>`;
  return [
    { id: "logo", svg: logoPoster },
    { id: "lessons", svg: lessons },
  ];
}
