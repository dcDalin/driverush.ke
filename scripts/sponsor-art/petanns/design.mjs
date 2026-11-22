/**
 * Petanns Driving School's own car ("Petanns Kenya, Shule Ya Wakenya"), as on
 * the photos of their real ones (reference-side.jpg, reference-front.jpg,
 * reference-van.jpg): not a style of ours. Fitted to every board car by
 * placing each part where it sits on their car, measured against the wheels
 * and the window line.
 *
 * From the photos:
 *   - a white body under an orange roof
 *   - blue over the lower rear and the rear bumper, and a blue front bumper
 *     whose colour runs back in a wedge along the bottom of the front door
 *   - a red-orange wedge low on the rear door, its point forward, with a
 *     thin line of the other colour beside each wedge
 *   - "PETANNS" across the doors in leaning blue slab letters edged in
 *     orange, "KENYA" in white on a blue block after it, and "Shule Ya
 *     Wakenya" in script under it
 *   - their number over the rear door, and a red warning triangle on the
 *     rear quarter
 *   - on the bonnet, an orange sweep back from each headlamp and their
 *     emblem in the middle; a red L on the front bumper
 *   - at the back (as on their van): red Ls, CAUTION, and DRIVER UNDER
 *     INSTRUCTION on an orange band
 *
 * The lettering is set in the closest free typefaces (Alfa Slab One for the
 * name, Kaushan Script for the motto, Poppins for the rest). Their emblem is
 * their own picture (logo.jpg); for one-colour places its outline is traced
 * (trace.mjs). When Petanns sends their artwork files, they replace these.
 *
 * Their real cars carry no roof board: every school's board car has one
 * (owner, 2026-11-21), so `topBoard` is ours, in their look.
 *
 * Not copied: the lettering on their windscreens and rear windows (the board
 * cars' glass is not painted), the L on their mirrors, and their plates.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { aspectOf, line } from "../lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Their colours, measured off the photos and lifted out of the daylight. */
export const COLORS = {
  white: "#f8f8f5",
  blue: "#1568f0",
  orange: "#f4421a",
  navy: "#1b3f95",
  black: "#17181b",
  red: "#e0201c",
};

/** Their number, as painted on their cars. */
const PHONE = "0705 05 05 04";

// ---- their emblem ----------------------------------------------------------------------

const jpeg = (buffer) => `data:image/jpeg;base64,${buffer.toString("base64")}`;
const EMBLEM_FILE = readFileSync(path.join(HERE, "logo.jpg"));
const EMBLEM_JPG = jpeg(EMBLEM_FILE);
// For the bonnet, where it is read from in front of the car: the picture
// itself turned a quarter (a turned <image> is drawn half cut off).
const EMBLEM_TURNED = jpeg(
  await sharp(EMBLEM_FILE).rotate(-90).jpeg({ quality: 95 }).toBuffer(),
);
const traced = readFileSync(path.join(HERE, "emblem.svg"), "utf8");
const INK = (() => {
  const g = /<g id="ink"[\s\S]*?<\/g>/.exec(traced)[0];
  const [, size] = /width="(\d+)"/.exec(traced).map(Number);
  return { g, size };
})();

/**
 * Their emblem, `size` across with its middle at (cx, cy): their own picture
 * on a white disc, or (`mono`) its outline in white.
 */
function emblem(
  cx,
  cy,
  size,
  { mono = false, disc = true, turned = false } = {},
) {
  const x = cx - size / 2;
  const y = cy - size / 2;
  if (mono) {
    const k = size / INK.size;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(5)})" fill="#fff">${INK.g}</g>`;
  }
  return [
    disc
      ? `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(size * 0.54).toFixed(1)}" fill="#ffffff"/>`
      : "",
    `<image href="${turned ? EMBLEM_TURNED : EMBLEM_JPG}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}"/>`,
  ].join("");
}

// ---- lettering and small parts -------------------------------------------------------

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

/** How far their name leans, in degrees. */
const LEAN = 11;

/**
 * "PETANNS" with "KENYA" on its blue block, over "Shule Ya Wakenya", as on
 * their doors, filling `box` (pixels) as far as it can without changing
 * shape. `motto: false` leaves the motto off; `mono` draws it all in white.
 */
export function lettering(fonts, box, { mono = false, motto = true } = {}) {
  const c = COLORS;
  const slab = fonts["AlfaSlabOne-Regular.ttf"];
  const heavy = fonts["Poppins-ExtraBold.ttf"];
  const script = fonts["KaushanScript-Regular.ttf"];
  const aName = aspectOf(slab, "PETANNS", 0.04);
  const aKenya = aspectOf(heavy, "KENYA", 0.04);
  // KENYA's block is half the name's height, and sits after it.
  const blockH = 0.52;
  const blockW = blockH * 0.62 * aKenya + blockH * 0.5;
  const gap = 0.14;
  const mottoH = motto ? 0.3 : 0;
  const mottoGap = motto ? 0.16 : 0;
  // For a name of height 1: how wide and how tall the whole lockup is.
  const wide = aName + gap + blockW + 0.2;
  const tall = 1 + mottoGap + mottoH;
  const h = Math.min(box.h / tall, box.w / wide);
  const x = box.x + (box.w - wide * h) / 2 + 0.1 * h;
  const y = box.y + (box.h - tall * h) / 2;
  const lean = (body) =>
    `<g transform="translate(${x.toFixed(1)} ${(y + h).toFixed(1)}) skewX(${-LEAN}) translate(${(-x).toFixed(1)} ${(-(y + h)).toFixed(1)})">${body}</g>`;

  const name = line(slab, "PETANNS", { x, y, height: h, tracking: 0.04 });
  const bx = x + (aName + gap) * h;
  const by = y + h * 0.06;
  const kenya = fitted(
    heavy,
    "KENYA",
    {
      x: bx + blockH * h * 0.2,
      y: by + blockH * h * 0.19,
      w: blockW * h - blockH * h * 0.4,
      h: blockH * h * 0.62,
    },
    0.04,
    "",
  );
  const block = `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${(blockW * h).toFixed(1)}" height="${(blockH * h).toFixed(1)}"`;
  const saying = motto
    ? fitted(
        script,
        "“Shule Ya Wakenya”",
        { x, y: y + h * (1 + mottoGap), w: aName * h, h: mottoH * h },
        0.01,
        `fill="${mono ? "#fff" : c.navy}"`,
      ).svg
    : "";
  if (mono) {
    return [
      lean(
        `<path d="${name}" fill="#fff"/>${block} fill="none" stroke="#fff" stroke-width="${(h * 0.03).toFixed(1)}"/><path d="${kenya.d}" fill="#fff"/>`,
      ),
      saying,
    ].join("");
  }
  return [
    lean(
      [
        `<path d="${name}" fill="none" stroke="${c.orange}" stroke-width="${(h * 0.17).toFixed(1)}" stroke-linejoin="round"/>`,
        `<path d="${name}" fill="none" stroke="${c.white}" stroke-width="${(h * 0.07).toFixed(1)}" stroke-linejoin="round"/>`,
        `<path d="${name}" fill="${c.blue}"/>`,
        `${block} fill="${c.blue}"/>`,
        `<path d="${kenya.d}" fill="${c.white}"/>`,
      ].join(""),
    ),
    saying,
  ].join("");
}

/**
 * Where `lettering` puts its parts in `box`: the name's left and top, its
 * height, and KENYA's block (as drawn before the lean).
 */
function lockupGeometry(fonts, box, motto = true) {
  const aName = aspectOf(fonts["AlfaSlabOne-Regular.ttf"], "PETANNS", 0.04);
  const aKenya = aspectOf(fonts["Poppins-ExtraBold.ttf"], "KENYA", 0.04);
  const blockH = 0.52;
  const blockW = blockH * 0.62 * aKenya + blockH * 0.5;
  const gap = 0.14;
  const wide = aName + gap + blockW + 0.2;
  const tall = 1 + (motto ? 0.46 : 0);
  const h = Math.min(box.h / tall, box.w / wide);
  const x = box.x + (box.w - wide * h) / 2 + 0.1 * h;
  const y = box.y + (box.h - tall * h) / 2;
  return { x, y, h, kenyaX: x + (aName + gap) * h, kenyaW: blockW * h };
}

/** A bare red L, `size` tall, its middle at (cx, cy): painted straight on. */
function redL(cx, cy, size, fill = COLORS.red) {
  const s = size;
  const x = cx - s * 0.3;
  const y = cy - s / 2;
  const t = s * 0.24;
  const l = [
    [x, y],
    [x + t, y],
    [x + t, y + s - t],
    [x + s * 0.62, y + s - t],
    [x + s * 0.62, y + s],
    [x, y + s],
  ];
  return `<polygon points="${l.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ")}" fill="${fill}"/>`;
}

/** Their warning triangle: red-edged, white, with a hump in the road. */
function warning(cx, cy, size) {
  const c = COLORS;
  const w = size;
  const h = size * 0.87;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const road = y + h * 0.78;
  return [
    `<polygon points="${cx.toFixed(1)},${y.toFixed(1)} ${(x + w).toFixed(1)},${(y + h).toFixed(1)} ${x.toFixed(1)},${(y + h).toFixed(1)}" fill="${c.white}" stroke="${c.red}" stroke-width="${(w * 0.09).toFixed(1)}" stroke-linejoin="round"/>`,
    `<path d="M${(cx - w * 0.24).toFixed(1)} ${road.toFixed(1)}Q${(cx - w * 0.12).toFixed(1)} ${(road - h * 0.26).toFixed(1)} ${cx.toFixed(1)} ${road.toFixed(1)}Q${(cx + w * 0.12).toFixed(1)} ${(road - h * 0.26).toFixed(1)} ${(cx + w * 0.24).toFixed(1)} ${road.toFixed(1)}Z" fill="${c.black}"/>`,
  ].join("");
}

/** Their number with a phone symbol before it, `h` tall, middle at (cx, cy). */
function phone(fonts, cx, cy, h) {
  const c = COLORS;
  const font = fonts["Poppins-Bold.ttf"];
  const textW = h * aspectOf(font, PHONE, 0.03);
  const icon = h * 1.15;
  const x = cx - (icon + h * 0.3 + textW) / 2;
  const ix = x + icon / 2;
  const a = icon * 0.24;
  return [
    `<rect x="${x.toFixed(1)}" y="${(cy - icon / 2).toFixed(1)}" width="${icon.toFixed(1)}" height="${icon.toFixed(1)}" rx="${(icon * 0.2).toFixed(1)}" fill="${c.black}"/>`,
    `<g transform="rotate(-35 ${ix.toFixed(1)} ${cy.toFixed(1)})"><path d="M${(ix - a).toFixed(1)} ${(cy - a * 0.3).toFixed(1)}Q${ix.toFixed(1)} ${(cy + a * 1.2).toFixed(1)} ${(ix + a).toFixed(1)} ${(cy - a * 0.3).toFixed(1)}" fill="none" stroke="${c.white}" stroke-width="${(icon * 0.14).toFixed(1)}" stroke-linecap="round"/></g>`,
    `<path d="${line(font, PHONE, { x: x + icon + h * 0.3, y: cy - h / 2, height: h, tracking: 0.03 })}" fill="${c.black}"/>`,
  ].join("");
}

/** "Shule Ya Wakenya" alone, filling `box` (pixels), in their navy. */
function motto(fonts, box, fill = COLORS.navy) {
  return fitted(
    fonts["KaushanScript-Regular.ttf"],
    "“Shule Ya Wakenya”",
    box,
    0.01,
    `fill="${fill}"`,
  ).svg;
}

const poly = (pts, fill) =>
  `<polygon points="${pts.map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join(" ")}" fill="${fill}"/>`;

/** A line `t` metres thick lying above the edge from p to q. */
const stripe = ([z0, y0], [z1, y1], lift, t, fill) =>
  poly(
    [
      [z0, y0 + lift],
      [z1, y1 + lift],
      [z1, y1 + lift + t],
      [z0, y0 + lift + t],
    ],
    fill,
  );

/**
 * The back, as on their van: a red L at each end, CAUTION, and DRIVER UNDER
 * INSTRUCTION on an orange band, all on the largest clear paint between the
 * lamps, the plate and the window (the back's paint map), no taller than
 * `maxH` metres. Where there is room for only one line, the band alone.
 */
function backPanel(k, fonts, maxH) {
  const { L, box } = k;
  const c = COLORS;
  const r = k.clearRect("back", box.xmin, box.xmax, L.sill, L.belt + 0.05);
  if (!r || r.y1 - r.y0 < 0.08 || r.z1 - r.z0 < 0.5) return "";
  const s = k.scale("back");
  const b = k.cap(k.boxPx("back", r.z0, r.y1, r.z1, r.y0), maxH * s);
  const bold = fonts["Poppins-ExtraBold.ttf"];
  const out = [];
  const lSize = Math.min(b.h, 0.18 * s);
  const roomForLs = b.w > lSize * 6;
  const inner = roomForLs
    ? { x: b.x + lSize * 1.1, w: b.w - lSize * 2.2 }
    : { x: b.x, w: b.w };
  if (roomForLs) {
    out.push(redL(b.x + lSize * 0.45, b.y + b.h / 2, lSize));
    out.push(redL(b.x + b.w - lSize * 0.4, b.y + b.h / 2, lSize));
  }
  const two = b.h >= 0.15 * s;
  const bandH = Math.min(two ? b.h * 0.5 : b.h, 0.1 * s);
  const bandY = two ? b.y + b.h - bandH : b.y + (b.h - bandH) / 2;
  if (two) {
    out.push(
      fitted(
        bold,
        "CAUTION",
        {
          x: inner.x,
          y: b.y + (b.h - bandH - Math.min(b.h * 0.4, 0.07 * s)) / 2,
          w: inner.w,
          h: Math.min(b.h * 0.4, 0.07 * s),
        },
        0.06,
        `fill="${c.orange}" stroke="${c.white}" stroke-width="${(0.012 * s).toFixed(1)}" paint-order="stroke"`,
      ).svg,
    );
  }
  out.push(
    `<rect x="${inner.x.toFixed(1)}" y="${bandY.toFixed(1)}" width="${inner.w.toFixed(1)}" height="${bandH.toFixed(1)}" fill="${c.orange}"/>`,
    fitted(
      bold,
      "DRIVER UNDER INSTRUCTION",
      {
        x: inner.x + bandH * 0.3,
        y: bandY + bandH * 0.22,
        w: inner.w - bandH * 0.6,
        h: bandH * 0.56,
      },
      0.03,
      `fill="${c.white}"`,
    ).svg,
  );
  return k.pixels("back", out.join(""));
}

/**
 * Petanns' paint, fitted to the vehicle: their car's layout on the cars;
 * on the van their real NV200's (an orange roof down to a blue line over
 * the windows, the wedges low, the name large on the doors); on the lorry a
 * fleet truck's, with the wedges running the length of the box.
 */
export default function petanns({ k, fonts }) {
  return k.kind === "lorry" ? lorry(k, fonts) : car(k, fonts);
}

// ---- the car and the van ----------------------------------------------------------------

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
  const at = (u, v) => [zAt(u), yAt(v)];

  const white = k.rect(-far, -far, far, far, c.white);

  // The sides. Places are [along, down]: along is 0 at the rear wheel and 1
  // at the front wheel; down is 0 at the window line and 1 at the sill.
  const nose = box.zmin - far;
  const tail = box.zmax + far;
  // Blue front: the bumper, and a wedge running back low along the front door.
  const blueFront = poly(
    [
      [nose, yAt(0.42)],
      at(1.0, 0.5),
      at(0.9, 0.64),
      at(0.5, 1.1),
      [zAt(0.5), -far],
      [nose, -far],
    ],
    c.blue,
  );
  // The red-orange wedge low on the rear door, its point forward.
  const wedge = poly([at(0.5, 1.1), at(0.1, 0.56), [zAt(0.1), -far]], c.orange);
  // Blue rear: the bumper and the lower rear quarter.
  const blueRear = poly(
    [
      at(-0.04, 0.6),
      at(-0.16, 0.42),
      [tail, yAt(0.36)],
      [tail, -far],
      [zAt(-0.04), -far],
    ],
    c.blue,
  );
  // A thin line of the other colour above each wedge.
  const lines = [
    stripe(at(0.9, 0.64), at(0.5, 1.1), 0.03, 0.022, c.orange),
    stripe(at(0.5, 1.1), at(0.1, 0.56), 0.03, 0.022, c.blue),
  ].join("");

  // The roof's colour on the sides. A car: the orange roof comes down over
  // the pillars as far as the rear door. The van, as their NV200: orange
  // over the windows the whole length, a white line, then a blue band
  // along the windows' top edge.
  let roofEdge;
  if (van) {
    // Over the windows the roof curves away at once, so the line is taken
    // from the blank panel behind them: the orange comes 14 cm down it.
    const panel = k.clearRect("both", L.door.z0, box.zmax, L.belt, box.ymax);
    const paintTop = panel ? panel.y1 + 0.03 : box.ymax - 0.1;
    const yT = paintTop - 0.14;
    roofEdge = [
      k.rect(-far, yT, far, far, c.orange),
      k.rect(-far, yT - 0.075, far, yT - 0.018, c.blue),
    ].join("");
  } else {
    roofEdge = poly(
      [
        [nose, L.belt + 0.05],
        [zAt(0.1), L.belt + 0.05],
        [zAt(0.1), far],
        [nose, far],
      ],
      c.orange,
    );
  }
  const side = [white, roofEdge, blueFront, wedge, blueRear, lines].join("");

  // The top: an orange roof; on the white bonnet an orange sweep back from
  // each headlamp with a thin blue line inside it.
  const half = k.width / 2;
  const bz0 = L.bonnet.z0;
  const bz1 = L.bonnet.z1;
  const hasBonnet = bz1 - bz0 > 0.3;
  const sweeps = !hasBonnet
    ? ""
    : [-1, 1]
        .map((sg) =>
          [
            poly(
              [
                [bz0 - 0.05, sg * half * 0.5],
                [bz0 - 0.05, sg * half * 0.86],
                [bz1, sg * half * 1.2],
                [bz1, sg * half * 0.9],
              ],
              c.orange,
            ),
            poly(
              [
                [bz0 - 0.05, sg * half * 0.44],
                [bz0 - 0.05, sg * half * 0.47],
                [bz1, sg * half * 0.87],
                [bz1, sg * half * 0.83],
              ],
              c.blue,
            ),
          ].join(""),
        )
        .join("");
  const top = [
    white,
    sweeps,
    van
      ? k.rect(-far, -far, far, far, c.orange)
      : k.rect(L.screen.front, -far, L.screen.rear, far, c.orange),
  ].join("");

  // The ends: a blue bumper with a white strip low on it.
  const yBumper = yAt(0.45);
  const yStrip = L.sill + 0.05;
  const end = [
    white,
    k.rect(-far, -far, far, yBumper, c.blue),
    k.rect(-far, yStrip, far, yStrip + 0.045, c.white),
  ].join("");

  // Lettering and signs, in pixels and never mirrored, the same on both
  // sides. The name across the doors between the arches, no taller than a
  // sign writer would paint it: about 20 cm on a car, 30 cm on the van.
  // Where a moulding splits the doors into two low bands, PETANNS KENYA goes
  // in the upper and the motto in the lower, as a wrapper works round a
  // body line.
  const zFront = Math.max(zAt(0.92), L.wheels.front.z + L.wheels.front.r);
  const zBack = Math.min(zAt(0.1), L.wheels.rear.z - L.wheels.rear.r);
  const [first, second] = L.bands ?? [L.door];
  const split =
    !van &&
    first.y1 - first.y0 < 0.3 &&
    second &&
    second.y1 - second.y0 >= 0.1 &&
    second.y1 < first.y0;
  const nameH = van ? 0.3 : 0.2;
  const sides = ["left", "right"]
    .map((view) => {
      const s = k.scale(view);
      const out = [];
      if (split) {
        const upper = k.boxPx(view, zFront, first.y1, zBack, first.y0);
        const lower = k.boxPx(view, zFront, second.y1, zBack, second.y0);
        out.push(
          lettering(fonts, k.cap(upper, nameH * s), { motto: false }),
          motto(fonts, k.cap(lower, 0.06 * s)),
        );
      } else {
        const yHigh = Math.min(yAt(0.14), L.door.y1);
        const yLow = Math.max(yAt(0.66), L.door.y0);
        const withMotto = yHigh - yLow > 0.3;
        out.push(
          lettering(
            fonts,
            k.cap(
              k.boxPx(view, zFront, yHigh, zBack, yLow),
              nameH * (withMotto ? 1.46 : 1) * s,
            ),
            { motto: withMotto },
          ),
        );
      }
      // Their number, over the rear door, just under the window.
      {
        const h = (van ? 0.07 : 0.05) * s;
        const [px, py] = k.pt[view](zAt(0.3), L.belt - (van ? 0.075 : 0.055));
        if (yAt(0.14) < L.belt - 0.09) out.push(phone(fonts, px, py, h));
      }
      // The warning triangle on the rear quarter, kept on the body.
      {
        const size = van ? 0.26 : 0.2;
        const z = Math.min(zAt(-0.16), box.zmax - 0.32);
        const [px, py] = k.pt[view](z, yAt(0.16));
        out.push(warning(px, py, size * s));
      }
      return k.pixels(view, out.join(""));
    })
    .join("");

  // Their emblem in the middle of the bonnet, upright from in front.
  const badge = (() => {
    if (!hasBonnet) return "";
    const s = k.scale("top");
    const [cx, cy] = k.pt.top((bz0 + bz1) / 2, 0);
    const size = Math.min(0.42, (bz1 - bz0) * 0.5) * s;
    return k.pixels("top", emblem(cx, cy, size, { turned: true }));
  })();

  // The van's long roof behind the name board: their name in white on the
  // orange, for the camera above.
  const roofName =
    van && L.roof.clear
      ? k.onTopWith(
          {
            z0: L.roof.board.z + 0.55,
            z1: L.roof.z1 - 0.2,
            x0: L.roof.x0 + 0.18,
            x1: L.roof.x1 - 0.18,
          },
          (b) => lettering(fonts, b, { mono: true }),
        )
      : "";

  // The front: a red L on the bumper, at the driver's right.
  const front = (() => {
    const s = k.scale("front");
    const [px, py] = k.pt.front(k.width * 0.27, (yBumper + yStrip) / 2 + 0.04);
    return k.pixels("front", redL(px, py, 0.2 * s));
  })();

  return {
    defs: "",
    body: [
      k.inView("left", side),
      k.inView("right", side),
      k.inView("top", top),
      k.inView("front", end),
      k.inView("back", end),
      sides,
      badge,
      roofName,
      front,
      backPanel(k, fonts, van ? 0.26 : 0.2),
    ].join("\n"),
  };
}

// ---- the lorry ------------------------------------------------------------------------

/**
 * The lorry, painted as a fleet truck in Petanns' look: a white cab, blue
 * under its windows and orange over them; a white box with an orange roof
 * coming down to a blue line at its top edge; their wedges running the
 * length of the box low (blue from the front, the orange wedge pointing
 * forward, blue rising at the rear), each with a thin line of the other
 * colour; PETANNS KENYA and the motto large in the middle, their number and
 * the warning triangle at the rear end, and the name in white on the box's
 * roof for the camera above. The box's rear doors take no paint.
 */
function lorry(k, fonts) {
  const { box } = k;
  const L = k.L;
  const c = COLORS;
  const far = 9;
  const load = L.load;
  const cab = L.cab;
  const len = load.z1 - load.z0;
  const zL = (u) => load.z0 + u * len; // 0 at the box's front, 1 its rear
  const rail = load.rail;
  const foot = load.y0 - 0.05;
  const yCap = load.y1 - 0.17; // the orange roof's lower edge on the sides

  const white = k.rect(-far, -far, far, far, c.white);
  const inCab = (body) => `<g clip-path="url(#petanns-cab)">${body}</g>`;
  const inBox = (body) => `<g clip-path="url(#petanns-box)">${body}</g>`;

  const cabSide = [
    // Orange over the windows, blue under them with an orange line on top.
    k.rect(-far, cab.top - 0.16, far, far, c.orange),
    k.rect(-far, -far, far, cab.belt - 0.05, c.blue),
    k.rect(-far, cab.belt - 0.05, far, cab.belt - 0.025, c.orange),
  ].join("");

  const blueFront = poly(
    [
      [zL(-0.05), rail + 0.22],
      [zL(0.46), foot],
      [zL(-0.05), foot],
    ],
    c.blue,
  );
  const wedge = poly(
    [
      [zL(0.3), foot],
      [zL(0.74), rail + 0.2],
      [zL(0.74), foot],
    ],
    c.orange,
  );
  const blueRear = poly(
    [
      [zL(0.7), foot],
      [zL(0.76), rail + 0.22],
      [zL(1.05), rail + 0.36],
      [zL(1.05), foot],
    ],
    c.blue,
  );
  const lines = [
    stripe([zL(-0.05), rail + 0.22], [zL(0.46), foot], 0.04, 0.03, c.orange),
    stripe([zL(0.3), foot], [zL(0.74), rail + 0.2], 0.04, 0.03, c.blue),
    stripe(
      [zL(0.76), rail + 0.22],
      [zL(1.05), rail + 0.36],
      0.04,
      0.03,
      c.orange,
    ),
  ].join("");
  const boxSide = [
    k.rect(-far, yCap, far, far, c.orange),
    k.rect(-far, yCap - 0.055, far, yCap - 0.02, c.blue),
    blueFront,
    wedge,
    blueRear,
    lines,
  ].join("");
  const side = [white, inCab(cabSide), inBox(boxSide)].join("");

  // Lettering and signs on the box, the same on both sides: the name as
  // large as the box's middle allows, their number under KENYA (the motto
  // runs under PETANNS), the warning triangle at the rear end.
  const sides = ["left", "right"]
    .map((view) => {
      const s = k.scale(view);
      const b = k.boxPx(
        view,
        load.z0 + 0.25,
        yCap - 0.1,
        load.z1 - 0.62,
        rail + 0.3,
      );
      const box1 = k.cap(b, 0.62 * 1.46 * s);
      const g = lockupGeometry(fonts, box1, true);
      const out = [lettering(fonts, box1)];
      out.push(
        phone(
          fonts,
          g.kenyaX + g.kenyaW / 2,
          g.y + g.h * 1.32,
          Math.min(0.085 * s, g.h * 0.17),
        ),
      );
      const [px, py] = k.pt[view](
        load.z1 - 0.33,
        (yCap - 0.1 + rail + 0.3) / 2,
      );
      out.push(warning(px, py, 0.36 * s));
      return k.pixels(view, out.join(""));
    })
    .join("");

  // The top: orange all over, the name in white on the box.
  const top = k.rect(-far, -far, far, far, c.orange);
  const roofName = k.onTopWith(
    {
      z0: load.z0 + 0.35,
      z1: load.z1 - 0.35,
      x0: box.xmin + 0.2,
      x1: box.xmax - 0.2,
    },
    (b) => lettering(fonts, b, { mono: true }),
  );

  // The ends: the cab's front white over a blue bumper, the orange roof
  // edge across the box's front and back.
  const yBumper = cab.sill + 0.33;
  const ends = [
    white,
    k.rect(-far, -far, far, yBumper, c.blue),
    k.rect(-far, yBumper, far, yBumper + 0.03, c.orange),
    k.rect(-far, yCap, far, far, c.orange),
  ].join("");
  const front = (() => {
    const s = k.scale("front");
    const [px, py] = k.pt.front(k.width * 0.3, yBumper + 0.14);
    return k.pixels("front", redL(px, py, 0.2 * s));
  })();

  const defs = [
    `<clipPath id="petanns-cab"><rect x="-9" y="-9" width="${(9 + load.z0 - 0.03).toFixed(3)}" height="18"/></clipPath>`,
    `<clipPath id="petanns-box"><rect x="${(load.z0 - 0.03).toFixed(3)}" y="-9" width="18" height="18"/></clipPath>`,
  ].join("");
  return {
    defs,
    body: [
      k.inView("left", side),
      k.inView("right", side),
      k.inView("top", top),
      k.inView("front", ends),
      k.inView("back", ends),
      sides,
      roofName,
      front,
    ].join("\n"),
  };
}

// ---- the logo ------------------------------------------------------------------------

/**
 * Their emblem with their name beside it. In colour it sits on white, as
 * theirs does; `mono` is white on nothing, for brass and board paint.
 */
export function logo({ fonts, mono }) {
  const c = COLORS;
  const w = 1200;
  const h = 470;
  const size = h - 50;
  const colX = 30 + size + 30;
  const colW = w - colX - 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${mono ? "" : `<rect width="${w}" height="${h}" rx="36" fill="#ffffff"/>`}
    ${emblem(30 + size / 2, h / 2, size, { mono, disc: false })}
    ${lettering(fonts, { x: colX, y: 70, w: colW, h: 200 }, { mono, motto: false })}
    ${fitted(fonts["Poppins-ExtraBold.ttf"], "DRIVING SCHOOL", { x: colX + 20, y: 300, w: colW - 40, h: 76 }, 0.04, `fill="${mono ? "#fff" : c.blue}"`).svg}
  </svg>`;
}

// ---- the roof board (app/components/board/top-board.ts) --------------------------------

/** The roof board's size on the board cars, in metres, and its corner cut. */
export const TOP_BOARD = { width: 1.35, height: 0.45, cut: 0.04 };

/**
 * A roof board for Petanns. Their real cars carry none: every school's board
 * car has one (owner, 2026-11-21), so this is ours, in their look: white
 * with an orange edge, their name, and a red L.
 */
export function topBoard({ fonts }) {
  const c = COLORS;
  const w = 1200;
  const h = (w * TOP_BOARD.height) / TOP_BOARD.width;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${c.orange}"/>
    <rect x="16" y="16" width="${w - 32}" height="${h - 32}" rx="14" fill="${c.white}"/>
    <rect x="16" y="${h - 16 - 34}" width="${w - 32}" height="34" fill="${c.blue}"/>
    ${redL(120, h / 2 - 16, 190)}
    ${lettering(fonts, { x: 215, y: 40, w: w - 215 - 50, h: h - 110 })}
  </svg>`;
}

// ---- the classroom's walls (app/lib/board/room.ts) ---------------------------------

/**
 * The wall banner (3.2 x 0.6 m): their car's side laid flat. White, the blue
 * and orange wedges along the bottom, their name and motto, and their
 * emblem.
 */
export function banner({ fonts }) {
  const w = 2048;
  const h = 384;
  const c = COLORS;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${c.white}"/>
    <rect width="${w}" height="26" fill="${c.orange}"/>
    <polygon points="0,220 430,${h} 0,${h}" fill="${c.blue}"/>
    <polygon points="0,196 470,${h} 440,${h} 0,208" fill="${c.orange}"/>
    <polygon points="430,${h} 1100,${h} 1100,300" fill="${c.orange}"/>
    <polygon points="1100,286 1100,${h} ${w},${h} ${w},250 1500,330" fill="${c.blue}"/>
    ${emblem(1830, 150, 250)}
    ${lettering(fonts, { x: 330, y: 44, w: 1280, h: 230 })}
  </svg>`;
}

/**
 * Two framed posters (0.52 x 0.72 m): their emblem, and an invitation to
 * learn with them, with their own words ("Drive safely, arrive alive") and
 * the number on their cars. No prices and no promises about passing.
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
  const foot = `<polygon points="0,${h - 210} ${w},${h - 120} ${w},${h} 0,${h}" fill="${c.blue}"/><polygon points="0,${h - 246} ${w},${h - 156} ${w},${h - 136} 0,${h - 226}" fill="${c.orange}"/>`;
  const logoPoster = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="#ffffff"/>
    <rect width="${w}" height="40" fill="${c.orange}"/>
    ${emblem(w / 2, 520, 800, { disc: false })}
    ${centred(heavy, "DRIVING SCHOOL", 990, 80, c.blue)}
    ${foot}
  </svg>`;
  const lessons = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${c.white}"/>
    <rect width="${w}" height="40" fill="${c.orange}"/>
    ${centred(heavy, "LEARN TO DRIVE", 130, 104, c.blue)}
    ${centred(heavy, "WITH", 270, 70, c.orange)}
    ${lettering(fonts, { x: 60, y: 390, w: w - 120, h: 330 })}
    ${centred(heavy, "DRIVE SAFELY", 800, 78, c.navy)}
    ${centred(heavy, "ARRIVE ALIVE", 900, 78, c.navy)}
    ${centred(medium, PHONE, 1040, 62, c.black)}
    ${foot}
  </svg>`;
  return [
    { id: "logo", svg: logoPoster },
    { id: "lessons", svg: lessons },
  ];
}
