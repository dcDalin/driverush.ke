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

// ---- fitted to each vehicle ------------------------------------------------------------

/** Their logo's height over its width. */
const LOGO_TALL = GREEN.h / GREEN.w;

const poly = (pts, fill) =>
  `<polygon points="${pts.map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join(" ")}" fill="${fill}"/>`;

/**
 * "AA DRIVING" over "SCHOOL", in their yellow on the dark green, as large as
 * fits `box` (pixels) and set against its `align` edge.
 */
function nameBlock(fonts, box, { fill = COLORS.yellow, align = "left" } = {}) {
  const heavy = fonts["Poppins-ExtraBold.ttf"];
  const rows = ["AA DRIVING", "SCHOOL"];
  const a = rows.map((t) => aspectOf(heavy, t, 0.02));
  const gap = 0.3;
  const h = Math.min(box.h / (2 + gap), box.w / Math.max(...a));
  const top = box.y + (box.h - h * (2 + gap)) / 2;
  return rows
    .map((text, i) => {
      const w = h * a[i];
      const x =
        align === "right"
          ? box.x + box.w - w
          : align === "center"
            ? box.x + (box.w - w) / 2
            : box.x;
      const d = line(heavy, text, {
        x,
        y: top + i * h * (1 + gap),
        height: h,
        tracking: 0.02,
      });
      return `<path d="${d}" fill="${fill}"/>`;
    })
    .join("");
}

/**
 * Their logo with the name beside it, filling a pixel box: the logo at the
 * box's `nose` end (where the vehicle's front is, so it leads), the name
 * after it. As a sign writer sets a fleet panel.
 */
function lockupBox(fonts, box, nose) {
  const logoH = box.h;
  const logoW = Math.min(logoH / LOGO_TALL, box.w * 0.38);
  const lh = logoW * LOGO_TALL;
  const gap = logoW * 0.16;
  const nameW = box.w - logoW - gap;
  const lx = nose === "left" ? box.x : box.x + box.w - logoW;
  const nx = nose === "left" ? box.x + logoW + gap : box.x;
  const name = nameBlock(
    fonts,
    { x: nx, y: box.y + (box.h - lh) / 2, w: nameW, h: lh },
    { align: nose === "left" ? "left" : "right" },
  );
  return aaLogo(lx + logoW / 2, box.y + box.h / 2, logoW) + name;
}

/**
 * For a roof, read from above with its top towards the nose: the logo
 * leading, the name under it, centred across the roof.
 */
function roofStack(fonts, b) {
  const logoW = Math.min(b.w * 0.62, (b.h * 0.42) / LOGO_TALL);
  const logoH = logoW * LOGO_TALL;
  const gap = logoH * 0.18;
  const used = Math.min(b.h, logoH + gap + logoH * 0.9);
  const y0 = b.y + (b.h - used) / 2;
  return (
    aaLogo(b.x + b.w / 2, y0 + logoH / 2, logoW) +
    nameBlock(
      fonts,
      { x: b.x, y: y0 + logoH + gap, w: b.w, h: used - logoH - gap },
      { fill: COLORS.green, align: "center" },
    )
  );
}

/** A "CAUTION / DRIVER UNDER INSTRUCTION" plate with a red L, as on their buses. */
function cautionPlate(fonts, box) {
  const c = COLORS;
  const heavy = fonts["Poppins-ExtraBold.ttf"];
  const bold = fonts["Poppins-Bold.ttf"];
  const pad = box.h * 0.08;
  const l = box.h - 2 * pad;
  const tx = box.x + pad * 2 + l;
  const tw = box.w - (tx - box.x) - pad * 1.5;
  return [
    `<rect x="${box.x.toFixed(1)}" y="${box.y.toFixed(1)}" width="${box.w.toFixed(1)}" height="${box.h.toFixed(1)}" fill="${c.black}"/>`,
    `<rect x="${(box.x + pad * 0.4).toFixed(1)}" y="${(box.y + pad * 0.4).toFixed(1)}" width="${(box.w - pad * 0.8).toFixed(1)}" height="${(box.h - pad * 0.8).toFixed(1)}" fill="${c.yellow}"/>`,
    lPlate(box.x + pad + l / 2, box.y + box.h / 2, l, { ground: c.yellow }),
    fitted(
      heavy,
      "CAUTION",
      { x: tx, y: box.y + pad, w: tw, h: (box.h - 2 * pad) * 0.5 },
      0.03,
      `fill="${c.black}"`,
    ).svg,
    fitted(
      bold,
      "DRIVER UNDER INSTRUCTION",
      {
        x: tx,
        y: box.y + pad + (box.h - 2 * pad) * 0.6,
        w: tw,
        h: (box.h - 2 * pad) * 0.34,
      },
      0.02,
      `fill="${c.black}"`,
    ).svg,
  ].join("");
}

/**
 * A learner's plate on the back, on clear paint on the left half (as on
 * their saloons, on the bumper's left), up to 20 cm across.
 */
function backPlate(k) {
  const { L, box } = k;
  const r = k.clearRect("back", box.xmin, 0, L.sill, L.belt, { inset: 0.02 });
  if (!r) return "";
  const size = Math.min(0.2, r.z1 - r.z0, r.y1 - r.y0);
  if (size < 0.1) return "";
  const s = k.scale("back");
  // Towards the outer edge of that clear area, low, as theirs is.
  const [px, py] = k.pt.back(r.z0 + size / 2 + 0.02, r.y0 + size / 2);
  return k.pixels("back", lPlate(px, py, size * s));
}

/**
 * AA's paint, fitted to the vehicle: their car's own layout on the cars, the
 * same squares along the doors of the van with its tall side kept calm for
 * their logo and name, and a fleet truck's layout on the lorry.
 */
export default function aa({ k, fonts }) {
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

  // The squares line up with the window line on the sides, and with the
  // car's middle on top, so they meet the same way on every car.
  const defs = [
    squares("aa-side", SQUARE, rear.toFixed(3), L.belt.toFixed(3)),
    squares("aa-top", SQUARE, rear.toFixed(3), 0),
    squares("aa-end", SQUARE, 0, L.belt.toFixed(3)),
  ].join("");

  const body = k.rect(-far, -far, far, far, c.body);
  // The sides: squares above their lower edge, the dark green below it,
  // up the pillars to the white roof. A van's band is three whole rows down
  // from the window line, nose to tail, one clean band along its long flat
  // side; its tall side above stays dark green for the logo.
  const edge = EDGE.map(([u, v]) => [zAt(u), yAt(v)]);
  const vanRows = L.belt - 3 * SQUARE;
  const side = [
    body,
    van
      ? k.rect(-far, vanRows, far, L.belt + 0.005, "url(#aa-side)")
      : poly(
          [
            [box.zmax + far, edge[0][1]],
            ...edge,
            [box.zmin - far, yAt(0.2)],
            [box.zmin - far, far],
            [box.zmax + far, far],
          ],
          "url(#aa-side)",
        ),
    // The white roof's edge, where the side curls over into it.
    k.rect(L.screen.front, L.roof.y - 0.04, L.screen.rear, far, c.white),
  ].join("");
  // The top: squares on the bonnet and the boot, a white roof between. A
  // van's is white but for its short nose, in the body's green.
  const top = van
    ? [
        k.rect(-far, -far, far, far, c.white),
        k.rect(-far, -far, L.screen.front, far, c.body),
      ].join("")
    : [
        k.rect(-far, -far, far, far, "url(#aa-top)"),
        k.rect(L.screen.front, -far, L.screen.rear, far, c.white),
      ].join("");
  // The ends: a dark green front; squares over the bumper at the back. A
  // van's band runs round both ends at the sides' height.
  const back = van
    ? [body, k.rect(-far, vanRows, far, L.belt + 0.005, "url(#aa-end)")].join(
        "",
      )
    : [body, k.rect(-far, yAt(0.6), far, far, "url(#aa-end)")].join("");
  const front = van ? back : body;

  // Their logo on the front door, the same way round on both sides: on the
  // largest clear paint of that door (a moulding or a handle can split it),
  // as near their spot on it as that allows, up to its size on their car.
  const doorFrom = L.wheels.front.z + L.wheels.front.r + 0.04;
  const doorTo = zAt(0.42);
  const spot = k.clearRect("both", doorFrom, doorTo, L.sill, L.belt, {
    inset: 0.015,
  });
  const logos = !spot
    ? ""
    : ["left", "right"]
        .map((view) => {
          const s = k.scale(view);
          const size = Math.min(
            DOOR_LOGO.size,
            (spot.y1 - spot.y0) / LOGO_TALL,
            spot.z1 - spot.z0,
          );
          const half = (size * LOGO_TALL) / 2;
          const clampTo = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
          const z = clampTo(
            zAt(DOOR_LOGO.at),
            spot.z0 + size / 2,
            spot.z1 - size / 2,
          );
          const y = clampTo(
            yAt(DOOR_LOGO.down),
            spot.y0 + half,
            spot.y1 - half,
          );
          const [px, py] = k.pt[view](z, y);
          return k.pixels(view, aaLogo(px, py, size * s));
        })
        .join("");

  // A van: the logo and name large on the blank panel behind the side
  // windows, high where it reads over traffic, lettering about 30 cm.
  const panelArt = [];
  if (van) {
    const panel = k.clearRect(
      "both",
      L.wheels.front.z,
      box.zmax,
      L.belt + 0.06,
      box.ymax,
    );
    if (panel && panel.y1 - panel.y0 > 0.35) {
      for (const view of ["left", "right"]) {
        const b = k.boxPx(view, panel.z0, panel.y1, panel.z1, panel.y0);
        const capped = k.cap(b, 0.62 * k.scale(view));
        panelArt.push(
          k.pixels(
            view,
            lockupBox(fonts, capped, view === "left" ? "left" : "right"),
          ),
        );
      }
    }
  }
  // The long white roof of a van carries the logo and name for the camera
  // above, behind the name board.
  const roofArt =
    van && L.roof.clear
      ? k.onTopWith(
          {
            z0: L.roof.board.z + 0.55,
            z1: L.roof.z1 - 0.2,
            x0: L.roof.x0 + 0.18,
            x1: L.roof.x1 - 0.18,
          },
          (b) => roofStack(fonts, b),
        )
      : "";

  return {
    defs,
    body: [
      k.inView("left", side),
      k.inView("right", side),
      k.inView("top", top),
      k.inView("front", front),
      k.inView("back", back),
      van ? "" : logos,
      ...panelArt,
      roofArt,
      backPlate(k),
    ].join("\n"),
  };
}

/**
 * The lorry, as a fleet truck in AA's look: a dark green cab with a band of
 * their squares low on it; a dark green box with two rows of squares along
 * the drop-side rail at its foot and one along its top edge, their logo and
 * the school's name large on the calm green between (letters about 40 cm a
 * line), and a caution plate as on their buses at its rear end. The roofs
 * are white, as theirs, the box's with the logo and name for the camera.
 */
function lorry(k, fonts) {
  const { L, box } = k;
  const c = COLORS;
  const far = 9;
  const cab = L.cab;
  const load = L.load;
  const rowTop = load.y1 - SQUARE;
  const defs = [
    // Rows ending flush on the rail's top, on the cab's window line and on
    // the box's top edge, the columns on the box's front.
    squares("aa-rail", SQUARE, load.z0.toFixed(3), load.rail.toFixed(3)),
    squares("aa-crown", SQUARE, load.z0.toFixed(3), rowTop.toFixed(3)),
    squares("aa-cab", SQUARE, cab.z0.toFixed(3), cab.belt.toFixed(3)),
    squares("aa-cabend", SQUARE, 0, cab.belt.toFixed(3)),
  ].join("");
  const body = k.rect(-far, -far, far, far, c.body);
  const side = [
    body,
    // The box: two rows on the rail, one on the top edge.
    k.rect(
      load.z0 - 0.02,
      load.rail - 2 * SQUARE,
      far,
      load.rail,
      "url(#aa-rail)",
    ),
    k.rect(load.z0 - 0.02, rowTop, far, far, "url(#aa-crown)"),
    // The cab: two rows up to its window line.
    k.rect(-far, cab.belt - 2 * SQUARE, cab.z1, cab.belt, "url(#aa-cab)"),
    k.rect(-far, cab.top - 0.05, cab.z1, far, c.white),
  ].join("");
  const front = [
    body,
    k.rect(-far, cab.belt - 2 * SQUARE, far, cab.belt, "url(#aa-cabend)"),
    k.rect(-far, cab.top - 0.05, far, far, c.white),
  ].join("");

  // The name panel on the box's calm middle: logo at the nose end.
  const yLow = load.rail + 0.12;
  const yHigh = rowTop - 0.12;
  const zNose = load.z0 + 0.25;
  const plateW = 1.15;
  const zTail = load.z1 - plateW - 0.45;
  const art = ["left", "right"].map((view) => {
    const s = k.scale(view);
    const b = k.boxPx(view, zNose, yHigh, zTail, yLow);
    const lock = lockupBox(
      fonts,
      k.cap(b, 0.95 * s),
      view === "left" ? "left" : "right",
    );
    const p = k.boxPx(
      view,
      load.z1 - 0.3 - plateW,
      (yLow + yHigh) / 2 + 0.23,
      load.z1 - 0.3,
      (yLow + yHigh) / 2 - 0.23,
    );
    return k.pixels(view, lock + cautionPlate(fonts, p));
  });

  const top = [k.rect(-far, -far, far, far, c.white)].join("");
  const roofArt = k.onTopWith(
    {
      z0: load.z0 + 0.5,
      z1: load.z1 - 0.4,
      x0: box.xmin + 0.2,
      x1: box.xmax - 0.2,
    },
    (b) => roofStack(fonts, b),
  );

  return {
    defs,
    body: [
      k.inView("left", side),
      k.inView("right", side),
      k.inView("top", top),
      k.inView("front", front),
      k.inView("back", body),
      ...art,
      roofArt,
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
