/**
 * AA Driving School's own car (AA Kenya), as on the photos of their real
 * ones (reference-rear.jpg, reference-front.jpg, reference-bonnet.jpg,
 * reference-pickup.jpg): not a style of ours. Fitted to every board car by
 * placing each part where it sits on their car, measured against the wheels
 * and the window line.
 *
 * From the photos:
 *   - a dark green body
 *   - yellow and dark green squares, a hand's span each, over the bonnet,
 *     the boot and the sides: down to the sill along the doors, and rising
 *     over the front wing to the headlamp, so the bumpers and the lower
 *     front stay dark green
 *   - a white roof
 *   - their AA KENYA logo on the front door (as on their pickup)
 *   - a learner's plate, a red L on white, at the back
 *
 * Their logo is traced from the one they publish (trace.mjs). The roof
 * board's words are set in the closest free typeface (Poppins). When AA
 * sends their artwork files, they replace these.
 *
 * Not copied: their number plates and the stickers on their windscreens.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { aspectOf, line } from "../lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Their colours: the logo's from their own file, the body's off the photos. */
export const COLORS = {
  yellow: "#fbd91f",
  green: "#046240",
  body: "#0d3b2a",
  white: "#f6f6f2",
  black: "#141414",
  red: "#d8201f",
};

/** One square of their pattern, in metres. */
const SQUARE = 0.2;
/**
 * The squares' lower edge on the sides, as [along, down]: along is 0 at the
 * rear wheel and 1 at the front wheel; down is 0 at the window line and 1 at
 * the sill. Low along the doors, rising over the front wing, and stopping at
 * the bumper's top behind the rear wheel.
 */
const EDGE = [
  [-0.25, 0.6],
  [0, 0.97],
  [0.45, 0.97],
  [1, 0.35],
];
/** Their logo on the front door: where its middle is, and its size. */
const DOOR_LOGO = { at: 0.63, down: 0.36, size: 0.34 };

// ---- their logo, traced --------------------------------------------------------------

const traced = readFileSync(path.join(HERE, "aa.svg"), "utf8");
const part = (name) => {
  const g = new RegExp(`<g id="${name}"[\\s\\S]*?</g>`).exec(traced)[0];
  const [x, y, w, h] = /data-box="([^"]+)"/.exec(g)[1].split(" ").map(Number);
  return { g, x, y, w, h };
};
const GREEN = part("green");
const WHITE = part("white");
/** The tracing is of their logo five times enlarged. */
const K = 5;
/** Behind the lion and behind KENYA, in the logo's own pixels: solid green. */
const BACKING = [
  [300, 72, 92, 246],
  [52, 290, 248, 82],
];

/**
 * Their logo's box of green, white and yellow, `size` across with its middle
 * at (cx, cy). `mono` is the green alone, in white, for engraving.
 */
function aaLogo(cx, cy, size, { mono = false, ground = true } = {}) {
  const c = COLORS;
  const k = size / GREEN.w;
  const at = `translate(${(cx - size / 2 - GREEN.x * k).toFixed(1)} ${(cy - (GREEN.h * k) / 2 - GREEN.y * k).toFixed(1)}) scale(${k.toFixed(5)})`;
  if (mono) return `<g transform="${at}" fill="#fff">${GREEN.g}</g>`;
  const backing = BACKING.map(
    ([x, y, w, h]) =>
      `<rect x="${x * K}" y="${y * K}" width="${w * K}" height="${h * K}" fill="${c.green}"/>`,
  ).join("");
  return [
    `<g transform="${at}">`,
    ground
      ? `<rect x="${GREEN.x}" y="${GREEN.y}" width="${GREEN.w}" height="${GREEN.h}" fill="${c.yellow}"/>`
      : "",
    backing,
    `<g fill="${c.green}">${GREEN.g}</g>`,
    `<g fill="${c.white}">${WHITE.g}</g>`,
    `</g>`,
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
  return { height, width, svg: `<path d="${d}" ${attrs}/>` };
}

/** A learner's plate: a red L on white, `size` across. */
function lPlate(cx, cy, size, { ground = COLORS.white } = {}) {
  const c = COLORS;
  const s = size;
  const x = cx - s / 2;
  const y = cy - s / 2;
  const t = s * 0.2;
  const l = [
    [x + s * 0.26, y + s * 0.14],
    [x + s * 0.26 + t, y + s * 0.14],
    [x + s * 0.26 + t, y + s * 0.86 - t],
    [x + s * 0.8, y + s * 0.86 - t],
    [x + s * 0.8, y + s * 0.86],
    [x + s * 0.26, y + s * 0.86],
  ];
  return [
    `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" fill="${ground}"/>`,
    `<polygon points="${l.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ")}" fill="${c.red}"/>`,
  ].join("");
}

/** Their squares as a pattern, in whatever units it is drawn in. */
function squares(id, size, x0 = 0, y0 = 0) {
  const c = COLORS;
  const q = size;
  return `<pattern id="${id}" width="${2 * q}" height="${2 * q}" patternUnits="userSpaceOnUse" patternTransform="translate(${x0} ${y0})"><rect width="${2 * q}" height="${2 * q}" fill="${c.body}"/><rect width="${q}" height="${q}" fill="${c.yellow}"/><rect x="${q}" y="${q}" width="${q}" height="${q}" fill="${c.yellow}"/></pattern>`;
}

// ---- the car ------------------------------------------------------------------------

export default function aa({ k }) {
  const { L, box } = k;
  const c = COLORS;
  const far = 9;
  const rear = L.wheels.rear.z;
  const wb = rear - L.wheels.front.z;
  const zAt = (u) => rear - u * wb;
  const band = L.belt - L.sill;
  const yAt = (v) => L.belt - v * band;
  const scaleOf = (view) => Math.abs(k.pt[view](1, 0)[0] - k.pt[view](0, 0)[0]);
  const poly = (pts, fill) =>
    `<polygon points="${pts.map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join(" ")}" fill="${fill}"/>`;

  // The squares line up with the window line on the sides, and with the
  // car's middle on top, so they meet the same way on every car.
  const defs = [
    squares("aa-side", SQUARE, rear.toFixed(3), L.belt.toFixed(3)),
    squares("aa-top", SQUARE, rear.toFixed(3), 0),
    squares("aa-end", SQUARE, 0, L.belt.toFixed(3)),
  ].join("");

  const body = k.rect(-far, -far, far, far, c.body);
  // The sides: squares above their lower edge, the dark green below it.
  const edge = EDGE.map(([u, v]) => [zAt(u), yAt(v)]);
  const side = [
    body,
    poly(
      [
        [box.zmax + far, edge[0][1]],
        ...edge,
        [box.zmin - far, yAt(0.2)],
        [box.zmin - far, far],
        [box.zmax + far, far],
      ],
      "url(#aa-side)",
    ),
  ].join("");
  // The top: squares on the bonnet and the boot, a white roof between.
  const top = [
    k.rect(-far, -far, far, far, "url(#aa-top)"),
    k.rect(L.screen.front, -far, L.screen.rear, far, c.white),
  ].join("");
  // The ends: a dark green front; squares over the bumper at the back.
  const back = [body, k.rect(-far, yAt(0.6), far, far, "url(#aa-end)")].join(
    "",
  );

  // Their logo on the front door, the same way round on both sides.
  const logos = ["left", "right"]
    .map((view) => {
      const s = scaleOf(view);
      const size = Math.min(DOOR_LOGO.size, (L.door.y1 - L.door.y0) * 0.62);
      const z = Math.max(
        zAt(DOOR_LOGO.at),
        L.wheels.front.z + L.wheels.front.r + size / 2 + 0.06,
      );
      const [px, py] = k.pt[view](z, yAt(DOOR_LOGO.down));
      return k.pixels(view, aaLogo(px, py, size * s));
    })
    .join("");
  // A learner's plate at the back, on the bumper's left as on theirs.
  const plate = (() => {
    const s = scaleOf("back");
    const [px, py] = k.pt.back(-k.width * 0.3, yAt(0.78));
    return k.pixels("back", lPlate(px, py, 0.2 * s));
  })();

  return {
    defs,
    body: [
      k.inView("left", side),
      k.inView("right", side),
      k.inView("top", top),
      k.inView("front", body),
      k.inView("back", back),
      logos,
      plate,
    ].join("\n"),
  };
}

// ---- the logo ------------------------------------------------------------------------

/**
 * Their logo with the school's name beside it, on their yellow. `mono` is
 * white on nothing, for brass and board paint.
 */
export function logo({ fonts, mono }) {
  const c = COLORS;
  const w = 1200;
  const h = 470;
  const heavy = fonts["Poppins-ExtraBold.ttf"];
  const size = h - 80;
  const colX = 40 + size + 44;
  const colW = w - colX - 50;
  const ink = mono ? "#fff" : c.green;
  const row = (text, y, wanted) =>
    fitted(
      heavy,
      text,
      { x: colX, y, w: colW, h: wanted },
      0.02,
      `fill="${ink}"`,
    ).svg;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${mono ? "" : `<rect width="${w}" height="${h}" rx="36" fill="${c.yellow}"/>`}
    ${aaLogo(40 + size / 2, h / 2, size, { mono, ground: false })}
    ${row("AA DRIVING", 96, 112)}
    ${row("SCHOOL", 252, 112)}
  </svg>`;
}

// ---- the roof board (app/components/board/top-board.ts) --------------------------------

/** The roof board's size on the board cars, in metres, and its corner cut. */
export const TOP_BOARD = { width: 1.35, height: 0.45, cut: 0.02 };

/**
 * Their roof board, as on their saloons: yellow in a black frame, a red L,
 * AA DRIVING SCHOOL with their logo, and a black band reading CAUTION -
 * DRIVER UNDER INSTRUCTION.
 */
export function topBoard({ fonts }) {
  const c = COLORS;
  const w = 1200;
  const h = (w * TOP_BOARD.height) / TOP_BOARD.width;
  const heavy = fonts["Poppins-ExtraBold.ttf"];
  const bold = fonts["Poppins-Bold.ttf"];
  const bandH = 96;
  const topH = h - bandH - 24;
  const lSize = 190;
  const logoSize = 150;
  const nameX = 40 + lSize + 34;
  const nameW = w - nameX - logoSize - 70;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${c.black}"/>
    <rect x="12" y="12" width="${w - 24}" height="${h - 24}" fill="${c.yellow}"/>
    ${lPlate(40 + lSize / 2, 12 + topH / 2, lSize, { ground: c.yellow })}
    ${fitted(heavy, "AA DRIVING", { x: nameX, y: 34, w: nameW, h: 104 }, 0.02, `fill="${c.black}"`).svg}
    ${fitted(heavy, "SCHOOL", { x: nameX, y: 158, w: nameW, h: 104 }, 0.02, `fill="${c.black}"`).svg}
    ${aaLogo(w - 40 - logoSize / 2, 12 + topH / 2, logoSize)}
    <rect x="12" y="${h - 12 - bandH}" width="${w - 24}" height="${bandH}" fill="${c.black}"/>
    ${fitted(bold, "CAUTION - DRIVER UNDER INSTRUCTION", { x: 60, y: h - 12 - bandH + 20, w: w - 120, h: bandH - 40 }, 0.03, `fill="${c.yellow}"`).svg}
  </svg>`;
}

// ---- the classroom's walls (app/lib/board/room.ts) ---------------------------------

/**
 * The wall banner (3.2 x 0.6 m): their squares over dark green, with their
 * logo and the school's name on a yellow panel.
 */
export function banner({ fonts }) {
  const w = 2048;
  const h = 384;
  const c = COLORS;
  const heavy = fonts["Poppins-ExtraBold.ttf"];
  const q = 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>${squares("aa-banner", q)}</defs>
    <rect width="${w}" height="${h}" fill="${c.body}"/>
    <rect width="${w}" height="${q * 4}" fill="url(#aa-banner)"/>
    <rect x="${q * 9}" y="${q * 0.5}" width="${q * 14}" height="${h - q}" rx="20" fill="${c.yellow}"/>
    ${aaLogo(q * 9 + 40 + 130, h / 2, 260)}
    ${fitted(heavy, "AA DRIVING SCHOOL", { x: q * 9 + 340, y: 96, w: q * 14 - 390, h: 120 }, 0.02, `fill="${c.green}"`).svg}
    ${fitted(fonts["Poppins-Medium.ttf"], "Inspiring Mobility", { x: q * 9 + 340, y: 232, w: q * 14 - 390, h: 50 }, 0.04, `fill="${c.green}"`).svg}
  </svg>`;
}

/**
 * Two framed posters (0.52 x 0.72 m): their logo on its yellow, and an
 * invitation to learn with them, with their own line ("Inspiring Mobility")
 * and their site. No prices and no promises about passing.
 */
export function posters({ fonts }) {
  const w = 1024;
  const h = 1418;
  const c = COLORS;
  const heavy = fonts["Poppins-ExtraBold.ttf"];
  const medium = fonts["Poppins-Medium.ttf"];
  const q = 128;
  const centred = (font, text, y, wanted, fill) =>
    fitted(
      font,
      text,
      { x: 80, y, w: w - 160, h: wanted },
      0.02,
      `fill="${fill}"`,
    ).svg;
  const defs = `<defs>${squares("aa-poster", q)}</defs>`;
  const logoPoster = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${defs}
    <rect width="${w}" height="${h}" fill="${c.yellow}"/>
    ${aaLogo(w / 2, 520, 640, { ground: false })}
    ${centred(heavy, "DRIVING SCHOOL", 900, 92, c.green)}
    <rect y="${h - q * 2}" width="${w}" height="${q * 2}" fill="url(#aa-poster)"/>
  </svg>`;
  const lessons = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${defs}
    <rect width="${w}" height="${h}" fill="${c.yellow}"/>
    <rect width="${w}" height="${q * 2}" fill="url(#aa-poster)"/>
    ${centred(heavy, "LEARN TO DRIVE", 340, 100, c.green)}
    ${centred(heavy, "WITH", 470, 70, c.green)}
    ${aaLogo(w / 2, 760, 380, { ground: false })}
    ${centred(heavy, "AA DRIVING SCHOOL", 1010, 84, c.green)}
    ${centred(medium, "Inspiring Mobility", 1130, 56, c.green)}
    <rect y="${h - 150}" width="${w}" height="150" fill="${c.body}"/>
    ${centred(medium, "www.aakenya.co.ke", h - 105, 56, c.yellow)}
  </svg>`;
  return [
    { id: "logo", svg: logoPoster },
    { id: "lessons", svg: lessons },
  ];
}
