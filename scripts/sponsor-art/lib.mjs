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
  const { views, pad } = layout;
  const [xmin, ymin, zmin] = layout.box.min;
  const [xmax, ymax, zmax] = layout.box.max;
  // Each view has its own scale (pixels per metre): the sides and top are
  // drawn larger than the ends.
  const sc = (v) => views[v].scale;

  // SVG matrices from the car's spaces to template pixels, per view.
  const m = (a, d, e, f) => `matrix(${a} 0 0 ${d} ${f1(e)} ${f1(f)})`;
  const matrix = {
    left: m(
      sc("left"),
      -sc("left"),
      views.left.x - zmin * sc("left"),
      views.left.y + ymax * sc("left"),
    ),
    right: m(
      -sc("right"),
      -sc("right"),
      views.right.x + zmax * sc("right"),
      views.right.y + ymax * sc("right"),
    ),
    top: m(
      -sc("top"),
      sc("top"),
      views.top.x + zmax * sc("top"),
      views.top.y - xmin * sc("top"),
    ),
    front: m(
      -sc("front"),
      -sc("front"),
      views.front.x + xmax * sc("front"),
      views.front.y + ymax * sc("front"),
    ),
    back: m(
      sc("back"),
      -sc("back"),
      views.back.x - xmin * sc("back"),
      views.back.y + ymax * sc("back"),
    ),
  };
  /** A point of a space, in a view's pixels. */
  const pt = {
    left: (z, y) => [
      views.left.x + (z - zmin) * sc("left"),
      views.left.y + (ymax - y) * sc("left"),
    ],
    right: (z, y) => [
      views.right.x + (zmax - z) * sc("right"),
      views.right.y + (ymax - y) * sc("right"),
    ],
    top: (z, x) => [
      views.top.x + (zmax - z) * sc("top"),
      views.top.y + (x - xmin) * sc("top"),
    ],
    front: (x, y) => [
      views.front.x + (xmax - x) * sc("front"),
      views.front.y + (ymax - y) * sc("front"),
    ],
    back: (x, y) => [
      views.back.x + (x - xmin) * sc("back"),
      views.back.y + (ymax - y) * sc("back"),
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

  /**
   * The whole picture at the template's size. `shade` bakes soft light into
   * it (for our own styles); a copy of a school's real car leaves it off, so
   * its colours stay exactly its own and the scene's light does the shading.
   */
  function svg(defs, body, { shade = true } = {}) {
    const light = shade ? shading() : { defs: "", body: "" };
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.atlas.width}" height="${layout.atlas.height}" viewBox="0 0 ${layout.atlas.width} ${layout.atlas.height}">`,
      `<defs>${clips}${light.defs}${defs}</defs>`,
      body,
      light.body,
      `</svg>`,
    ].join("\n");
  }

  // ---- where paint shows (the side maps of build-car-wrap) ----

  const maps = layout.landmarks.map;
  /**
   * Is the 5 cm cell at (a, y) clear paint a learner sees? `a` is z along a
   * side ("left", "right"), x across the back ("back").
   */
  function clear(side, a, y) {
    const m = maps[side];
    const row = m.rows[Math.floor((y - m.y0) / m.cell)];
    return row?.[Math.floor((a - m.a0) / m.cell)] === "1";
  }

  /**
   * The largest rectangle of clear paint on a side inside [zA, zB] x [yA, yB]
   * (metres), as {z0, z1, y0, y1}, trimmed by `inset` all round. Both sides
   * are asked when `side` is "both", and only cells clear on both count, so
   * lettering lands the same on the left and the right. On the "back", z
   * reads x.
   */
  function clearRect(side, zA, zB, yA, yB, { inset = 0.03 } = {}) {
    const m = side === "back" ? maps.back : maps.left;
    const sides = side === "both" ? ["left", "right"] : [side];
    const i0 = Math.ceil((zA - m.a0) / m.cell);
    const i1 = Math.floor((zB - m.a0) / m.cell);
    const j0 = Math.ceil((yA - m.y0) / m.cell);
    const j1 = Math.floor((yB - m.y0) / m.cell);
    const cols = i1 - i0;
    if (cols <= 0 || j1 <= j0) return null;
    // Largest rectangle under a histogram, row by row, bottom up.
    const heights = new Array(cols).fill(0);
    let best = null;
    for (let j = j0; j < j1; j++) {
      for (let c = 0; c < cols; c++) {
        const z = m.a0 + (i0 + c + 0.5) * m.cell;
        const y = m.y0 + (j + 0.5) * m.cell;
        heights[c] = sides.every((s) => clear(s, z, y)) ? heights[c] + 1 : 0;
      }
      const stack = [];
      for (let c = 0; c <= cols; c++) {
        const h = c < cols ? heights[c] : 0;
        while (stack.length && heights[stack[stack.length - 1]] >= h) {
          const top = stack.pop();
          const left = stack.length ? stack[stack.length - 1] + 1 : 0;
          const area = heights[top] * (c - left);
          if (!best || area > best.area) {
            best = { area, c0: left, c1: c, top: j + 1, h: heights[top] };
          }
        }
        stack.push(c);
      }
    }
    if (!best || best.area === 0) return null;
    return {
      z0: m.a0 + (i0 + best.c0) * m.cell + inset,
      z1: m.a0 + (i0 + best.c1) * m.cell - inset,
      y0: m.y0 + (best.top - best.h) * m.cell + inset,
      y1: m.y0 + best.top * m.cell - inset,
    };
  }

  /**
   * The clear runs along a side at height y, nose to tail, as {z0, z1}:
   * between them are windows, pillars' glass, lamps and arches.
   */
  function runsAt(side, y, zA = zmin, zB = zmax) {
    const m = maps[side];
    const runs = [];
    let start = null;
    for (let z = zA + m.cell / 2; z <= zB + m.cell; z += m.cell) {
      const ok = z <= zB && clear(side, z, y);
      if (ok && start === null) start = z - m.cell / 2;
      if (!ok && start !== null) {
        runs.push({ z0: start, z1: z - m.cell / 2 });
        start = null;
      }
    }
    return runs;
  }

  /**
   * Something drawn upright on the roof or bonnet, reading when the car
   * drives away from you: `draw(box)` fills a pixel box whose top points at
   * the nose. `area` is {z0, z1, x0, x1} in metres.
   */
  function onTopWith(area, draw) {
    const b = boxPx("top", area.z1, area.x0, area.z0, area.x1);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const box = { x: cx - b.h / 2, y: cy - b.w / 2, w: b.h, h: b.w };
    return pixels(
      "top",
      `<g transform="rotate(90 ${f1(cx)} ${f1(cy)})">${draw(box)}</g>`,
    );
  }

  /** Pixels per metre in a view. */
  const scale = (view) => views[view].scale;

  /**
   * A pixel box no taller than `h` pixels, its middle where the box's was
   * (or its top or bottom, with `align`): lettering fitted into it is then
   * no larger than a sign writer would paint it on this vehicle.
   */
  function cap(b, h, align = "middle") {
    if (b.h <= h) return b;
    const y =
      align === "top"
        ? b.y
        : align === "bottom"
          ? b.y + b.h - h
          : b.y + (b.h - h) / 2;
    return { ...b, y, h };
  }

  return {
    L: layout.landmarks,
    scale,
    cap,
    kind: layout.landmarks.kind ?? "car",
    car: layout.car,
    clear,
    clearRect,
    runsAt,
    onTopWith,
    boxPx,
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
