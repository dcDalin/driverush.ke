/**
 * The drawing kit livery styles are written with.
 *
 * A style draws in the car's own space, in metres, never in template pixels:
 *   side  (z, y)  z along the car (nose at -z), y up; drawn on both sides
 *   top   (z, x)  seen from above; x to the driver's right
 *   end   (x, y)  the front and the back
 * The kit carries each drawing into its views of the wrap template through the
 * same projection `scripts/build-car-wrap.mjs` used for the UVs. So a colour
 * block that wraps from the side onto the bonnet meets itself exactly at the
 * seam, and one style fits every car, placed by the car's measured landmarks.
 *
 * Lettering is the exception: it is placed in pixels, never mirrored, and
 * always keeps its true proportions.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import opentype from "opentype.js";

export function loadFont(dir, file) {
  const buf = readFileSync(path.join(dir, file));
  return opentype.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
}

const f1 = (n) => (Math.round(n * 10) / 10).toString();

// ---- lettering --------------------------------------------------------------------

/** A line of text as outline commands at size 100, with its ink box. */
function outline(font, text, tracking = 0) {
  const size = 100;
  let x = 0;
  const commands = [];
  // Glyph by glyph: some display fonts' shaping tables trip opentype.js.
  for (const glyph of [...text].map((ch) => font.charToGlyph(ch))) {
    commands.push(...glyph.getPath(x, 0, size).commands);
    x += (glyph.advanceWidth / font.unitsPerEm) * size + tracking * size;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of commands) {
    for (const [px, py] of [
      [c.x, c.y],
      [c.x1, c.y1],
      [c.x2, c.y2],
    ]) {
      if (px === undefined) continue;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
  }
  return { commands, minX, minY, w: maxX - minX, h: maxY - minY };
}

/** Width over height of a line of text's ink. */
export function aspectOf(font, text, tracking = 0) {
  const o = outline(font, text, tracking);
  return o.w / o.h;
}

/**
 * A line of text as one SVG path, scaled to `height` pixels of ink and with
 * its ink's top-left corner at (x, y). Never stretched.
 */
export function line(font, text, { x, y, height, tracking = 0 }) {
  const o = outline(font, text, tracking);
  const k = height / o.h;
  const X = (v) => f1(x + (v - o.minX) * k);
  const Y = (v) => f1(y + (v - o.minY) * k);
  return o.commands
    .map((c) => {
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

/**
 * The school's name as a lockup: its wordmark, with its tagline under it set
 * to the same width, centred in `box` (pixels) and as large as fits.
 *
 * `on` is what it sits on: "light" (white paint), "dark" (the brand colour:
 * lettering knocked out in white), or "mono" (all white, for engraving).
 */
export function lockup(
  brand,
  fonts,
  box,
  { on = "light", scale = 1, tagline = true } = {},
) {
  const wm = brand.wordmark;
  const tg = tagline ? brand.tagline : null;
  const wFont = fonts[wm.font];
  const tFont = tg ? fonts[tg.font] : null;
  const a1 = aspectOf(wFont, wm.text, wm.tracking ?? 0);
  const a2 = tg ? aspectOf(tFont, tg.text, tg.tracking ?? 0) : Infinity;
  const gapK = 0.2;
  // Wordmark width w: total height = w/a1 * (1 + gap) + w/a2.
  const fitW = Math.min(
    box.w,
    box.h / (1 / a1 + (tg ? gapK / a1 + 1 / a2 : 0)),
  );
  const w = fitW * scale;
  const h1 = w / a1;
  const h2 = tg ? w / a2 : 0;
  const total = h1 + (tg ? gapK * h1 + h2 : 0);
  const x = box.x + (box.w - w) / 2;
  const y = box.y + (box.h - total) / 2;
  const word = line(wFont, wm.text, {
    x,
    y,
    height: h1,
    tracking: wm.tracking ?? 0,
  });
  const c = brand.colors;
  const white = "#ffffff";
  const parts = [];
  if (on === "light" && wm.keyline) {
    parts.push(
      `<path d="${word}" fill="${c[wm.keyline]}" stroke="${c[wm.keyline]}" stroke-width="${f1(h1 * 0.11)}" stroke-linejoin="round"/>`,
    );
  }
  const wordFill =
    on === "light" ? c[wm.fill ?? "primary"] : on === "mono" ? white : white;
  parts.push(`<path d="${word}" fill="${wordFill}"/>`);
  if (tg) {
    const tag = line(tFont, tg.text, {
      x,
      y: y + h1 + gapK * h1,
      height: h2,
      tracking: tg.tracking ?? 0,
    });
    const tagFill = on === "light" ? c[tg.fill ?? "ink"] : white;
    parts.push(`<path d="${tag}" fill="${tagFill}"/>`);
  }
  return parts.join("");
}

// ---- the car's spaces -------------------------------------------------------------

/**
 * Everything a style needs for one car: its landmarks (`L`), its box, and
 * helpers that carry drawings in metres into the template's views.
 */
export function kit(layout, fonts) {
  const { scale: s, views, pad } = layout;
  const [xmin, ymin, zmin] = layout.box.min;
  const [xmax, ymax, zmax] = layout.box.max;

  // SVG matrices from the car's spaces to template pixels, per view.
  const m = (a, d, e, f) => `matrix(${a} 0 0 ${d} ${f1(e)} ${f1(f)})`;
  const matrix = {
    left: m(s, -s, views.left.x - zmin * s, views.left.y + ymax * s),
    right: m(-s, -s, views.right.x + zmax * s, views.right.y + ymax * s),
    top: m(-s, s, views.top.x + zmax * s, views.top.y - xmin * s),
    front: m(-s, -s, views.front.x + xmax * s, views.front.y + ymax * s),
    back: m(s, -s, views.back.x - xmin * s, views.back.y + ymax * s),
  };
  /** A point of a space, in a view's pixels. */
  const pt = {
    left: (z, y) => [
      views.left.x + (z - zmin) * s,
      views.left.y + (ymax - y) * s,
    ],
    right: (z, y) => [
      views.right.x + (zmax - z) * s,
      views.right.y + (ymax - y) * s,
    ],
    top: (z, x) => [views.top.x + (zmax - z) * s, views.top.y + (x - xmin) * s],
    front: (x, y) => [
      views.front.x + (xmax - x) * s,
      views.front.y + (ymax - y) * s,
    ],
    back: (x, y) => [
      views.back.x + (x - xmin) * s,
      views.back.y + (ymax - y) * s,
    ],
  };

  // Each view clipped half the padding past its edge: drawings carry on a
  // little beyond the bodywork, so small mipmaps never pull in a neighbour.
  const bleed = pad / 2;
  const clips = Object.entries(views)
    .map(
      ([name, v]) =>
        `<clipPath id="bleed-${name}"><rect x="${v.x - bleed}" y="${v.y - bleed}" width="${v.w + 2 * bleed}" height="${v.h + 2 * bleed}"/></clipPath>`,
    )
    .join("");

  const inView = (view, body) =>
    `<g clip-path="url(#bleed-${view})"><g transform="${matrix[view]}">${body}</g></g>`;
  const pixels = (view, body) =>
    `<g clip-path="url(#bleed-${view})">${body}</g>`;

  /** A rectangle of a space, in metres, from corner (a0, b0) to (a1, b1). */
  const rect = (a0, b0, a1, b1, fill, extra = "") =>
    `<rect x="${f1m(Math.min(a0, a1))}" y="${f1m(Math.min(b0, b1))}" width="${f1m(Math.abs(a1 - a0))}" height="${f1m(Math.abs(b1 - b0))}" fill="${fill}"${extra}/>`;

  /** Lettering in a box of a space, upright in its view's pixels. */
  function boxPx(view, a0, b0, a1, b1) {
    const [x1, y1] = pt[view](a0, b0);
    const [x2, y2] = pt[view](a1, b1);
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1),
    };
  }

  /**
   * A lockup on the roof or bonnet, reading upright when the car drives away
   * from you (most tasks start that way from the learner's side), so its top
   * points at the nose. `area` is {z0, z1, x0, x1} in metres.
   */
  function onTop(brand, area, opts) {
    const b = boxPx("top", area.z1, area.x0, area.z0, area.x1);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    // Turned a quarter: across the car is the lockup's width.
    const box = { x: cx - b.h / 2, y: cy - b.w / 2, w: b.h, h: b.w };
    return pixels(
      "top",
      `<g transform="rotate(90 ${f1(cx)} ${f1(cy)})">${lockup(brand, fonts, box, opts)}</g>`,
    );
  }

  /**
   * A lockup on both sides, in a box of side space. A band under 20 cm tall
   * (a tall car's doors under a moulding) gets the wordmark alone, larger:
   * the tagline still shows on the roof or bonnet and the back.
   */
  function onSides(brand, area, opts = {}) {
    const tagline = area.y1 - area.y0 >= 0.2;
    return ["left", "right"]
      .map((view) =>
        pixels(
          view,
          lockup(
            brand,
            fonts,
            boxPx(view, area.z0, area.y1, area.z1, area.y0),
            { tagline, ...opts },
          ),
        ),
      )
      .join("");
  }

  /**
   * A small lockup on the back, across the boot or tailgate: centred between
   * the doors' lettering band and the window, 60% of the car's width.
   */
  function onBack(brand, opts) {
    const L = layout.landmarks;
    const mid = (L.belt + L.door.y0) / 2;
    const half = (xmax - xmin) * 0.3;
    return pixels(
      "back",
      lockup(
        brand,
        fonts,
        boxPx("back", -half, mid + 0.08, half, mid - 0.08),
        opts,
      ),
    );
  }

  /**
   * Light on the paint, baked in: a soft shoulder highlight fading to a
   * darker sill on the sides, a sheen along the top, the ends darker low.
   */
  function shading() {
    const L = layout.landmarks;
    const defs = `
      <linearGradient id="shade-side" gradientUnits="userSpaceOnUse" x1="0" y1="${f1m(ymax)}" x2="0" y2="${f1m(ymin)}">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.10"/>
        <stop offset="${f1m((ymax - L.belt) / (ymax - ymin))}" stop-color="#ffffff" stop-opacity="0.16"/>
        <stop offset="${f1m((ymax - (L.belt + L.sill) / 2) / (ymax - ymin))}" stop-color="#ffffff" stop-opacity="0"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.22"/>
      </linearGradient>
      <linearGradient id="shade-top" gradientUnits="userSpaceOnUse" x1="0" y1="${f1m(xmin)}" x2="0" y2="${f1m(xmax)}">
        <stop offset="0" stop-color="#000000" stop-opacity="0.10"/>
        <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.12"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.10"/>
      </linearGradient>
      <linearGradient id="shade-end" gradientUnits="userSpaceOnUse" x1="0" y1="${f1m(ymax)}" x2="0" y2="${f1m(ymin)}">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.08"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.2"/>
      </linearGradient>`;
    const big = 9;
    const body = [
      inView("left", rect(-big, -big, big, big, "url(#shade-side)")),
      inView("right", rect(-big, -big, big, big, "url(#shade-side)")),
      inView("top", rect(-big, -big, big, big, "url(#shade-top)")),
      inView("front", rect(-big, -big, big, big, "url(#shade-end)")),
      inView("back", rect(-big, -big, big, big, "url(#shade-end)")),
    ].join("");
    return { defs, body };
  }

  /** The whole picture: a style's body, shaded, at the template's size. */
  function svg(defs, body) {
    const shade = shading();
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.atlas.width}" height="${layout.atlas.height}" viewBox="0 0 ${layout.atlas.width} ${layout.atlas.height}">`,
      `<defs>${clips}${shade.defs}${defs}</defs>`,
      body,
      shade.body,
      `</svg>`,
    ].join("\n");
  }

  return {
    L: layout.landmarks,
    box: { xmin, ymin, zmin, xmax, ymax, zmax },
    width: xmax - xmin,
    inView,
    pixels,
    rect,
    pt,
    onTop,
    onSides,
    onBack,
    svg,
  };
}

/** Metres, to the millimetre. */
export const f1m = (n) => (Math.round(n * 1000) / 1000).toString();

/** A list of [a, b] points as an SVG path through them, in metres. */
export const pathOf = (points, close = false) =>
  points.map(([a, b], i) => `${i ? "L" : "M"}${f1m(a)} ${f1m(b)}`).join("") +
  (close ? "Z" : "");
