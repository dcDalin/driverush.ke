/**
 * Helpers for drawing a school's car into the saloon's wrap template in code.
 *
 * Shapes are given in the car's own frame (metres: z along the car, nose at
 * -z; y up; x to the driver's right) and land in each view of the template
 * the way `scripts/build-car-wrap.mjs` lays the car out. Lettering is turned
 * into outlines, so the picture comes out the same on any machine.
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

/** Where car points land in each view, in template pixels. */
export function viewsOf(layout) {
  const { scale: s, views } = layout;
  const [xmin, , zmin] = layout.car.min;
  const [xmax, ymax, zmax] = layout.car.max;
  return {
    // (z, y) on a side
    left: (z, y) => [
      views.left.x + (z - zmin) * s,
      views.left.y + (ymax - y) * s,
    ],
    right: (z, y) => [
      views.right.x + (zmax - z) * s,
      views.right.y + (ymax - y) * s,
    ],
    // (z, x) from above
    top: (z, x) => [views.top.x + (zmax - z) * s, views.top.y + (x - xmin) * s],
    // (x, y) at the ends
    front: (x, y) => [
      views.front.x + (xmax - x) * s,
      views.front.y + (ymax - y) * s,
    ],
    back: (x, y) => [
      views.back.x + (x - xmin) * s,
      views.back.y + (ymax - y) * s,
    ],
  };
}

export const pts = (list) =>
  list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/** A polygon given in car coordinates, placed by `at`. */
export const polygon = (at, list, attrs) =>
  `<polygon points="${pts(list.map(([a, b]) => at(a, b)))}" ${attrs}/>`;

/** A pixel box from two car corners. */
export function boxOf(at, [a1, b1], [a2, b2]) {
  const [x1, y1] = at(a1, b1);
  const [x2, y2] = at(a2, b2);
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}

/**
 * Lettering as an outline path filling `box` (pixels). `fit: "stretch"` fills
 * the box exactly; "contain" keeps the letters' shape and centres them.
 */
export function letters(
  font,
  text,
  box,
  { fit = "stretch", spacing = 0 } = {},
) {
  const size = 100;
  let x = 0;
  const commands = [];
  for (const glyph of font.stringToGlyphs(text)) {
    commands.push(...glyph.getPath(x, 0, size).commands);
    x += (glyph.advanceWidth / font.unitsPerEm) * size + spacing * size;
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
  let sx = box.w / (maxX - minX);
  let sy = box.h / (maxY - minY);
  let ox = box.x;
  let oy = box.y;
  if (fit === "contain") {
    const k = Math.min(sx, sy);
    ox += (box.w - (maxX - minX) * k) / 2;
    oy += (box.h - (maxY - minY) * k) / 2;
    sx = sy = k;
  }
  const X = (v) => (ox + (v - minX) * sx).toFixed(1);
  const Y = (v) => (oy + (v - minY) * sy).toFixed(1);
  return commands
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

/** A five-pointed star centred on (cx, cy). */
export function star(cx, cy, r) {
  const list = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    list.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return list;
}
