/**
 * Helz Driving Academy's car, drawn from a photo of their real one until they
 * send their own files: white, with a big orange "HELZ" outlined in dark brown
 * across both doors, blue "DRIVING ACADEMY" under it, an orange front end with
 * three red stripes behind it and a red splash on the wing, and a scatter of
 * small marks over the white.
 *
 * Their real car's scatter copies Louis Vuitton's "LV" monogram. That is not
 * theirs to give, so ours is stars and an "H".
 *
 * The roof carries the name too: it is the part a learner at the table can
 * actually read.
 */
import {
  boxOf,
  letters,
  loadFont,
  polygon,
  pts,
  star,
  viewsOf,
} from "./lib.mjs";

const ORANGE = "#f39200";
const ORANGE_DARK = "#c25f00";
const OUTLINE = "#4a1503";
const RED = "#d7261e";
const BLUE = "#1d3fbf";
const WHITE = "#f6f6f2";

/** The front of the orange: forward of this along the sides, below the windows. */
const ORANGE_EDGE = -0.26;
/** The bonnet's back edge, at the bottom of the windscreen. */
const BONNET = -0.98;
const BELT = 0.86;

/**
 * A paint splat centred on (cx, cy), r pixels across its body: a ragged blob
 * with a few drops thrown off it. The same every build.
 */
function splat([cx, cy], r) {
  const body = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const k = i % 4 === 0 ? 1.55 : 0.82 + 0.22 * Math.sin(i * 2.7);
    body.push([
      cx + Math.cos(a) * r * k * 1.25,
      cy + Math.sin(a) * r * k * 0.8,
    ]);
  }
  const drops = [
    [1.9, -0.35, 0.16],
    [-2.1, 0.25, 0.13],
    [1.2, 1.25, 0.1],
    [-1.3, -1.15, 0.11],
    [2.4, 0.6, 0.07],
  ]
    .map(
      ([dx, dy, dr]) =>
        `<circle cx="${(cx + dx * r).toFixed(1)}" cy="${(cy + dy * r * 0.8).toFixed(1)}" r="${(dr * r * 1.6).toFixed(1)}" fill="${RED}"/>`,
    )
    .join("");
  return `<polygon points="${pts(body)}" fill="${RED}"/>${drops}`;
}

export default function helz({ layout, fonts }) {
  const bowlby = loadFont(fonts, "BowlbyOne-Regular.ttf");
  const at = viewsOf(layout);
  const { views, atlas } = layout;
  const [, , zmin] = layout.car.min;
  const [, ymax] = layout.car.max;

  /** Big "HELZ": a dark outline under orange, with a brick texture. */
  const helz = (box) => {
    const d = letters(bowlby, "HELZ", box, { spacing: 0.02 });
    const line = Math.max(3, box.h * 0.1);
    return [
      `<path d="${d}" fill="${OUTLINE}" stroke="${OUTLINE}" stroke-width="${line * 2}" stroke-linejoin="round"/>`,
      `<path d="${d}" fill="${ORANGE}"/>`,
      `<path d="${d}" fill="url(#brick)" opacity="0.55"/>`,
    ].join("");
  };
  /** "DRIVING ACADEMY" in blue, edged in white so it reads over the scatter. */
  const academy = (box) => {
    const d = letters(bowlby, "DRIVING ACADEMY", box, { spacing: 0.03 });
    return [
      `<path d="${d}" fill="${WHITE}" stroke="${WHITE}" stroke-width="${Math.max(3, box.h * 0.22)}" stroke-linejoin="round"/>`,
      `<path d="${d}" fill="${BLUE}"/>`,
    ].join("");
  };

  const H = letters(bowlby, "H", { x: 0, y: 0, w: 9, h: 10 });

  function side(view) {
    const p = at[view];
    const v = views[view];
    // The orange front: whole height ahead of the windscreen, below the
    // windows back to the edge (leaning back a touch, like the real car).
    const orange = polygon(
      p,
      [
        [zmin - 0.2, ymax + 0.2],
        [BONNET, ymax + 0.2],
        [BONNET, BELT],
        [ORANGE_EDGE, BELT],
        [ORANGE_EDGE - 0.08, 0.2],
        [zmin - 0.2, 0.2],
      ],
      `fill="${ORANGE}"`,
    );
    // Three red stripes just inside the orange edge.
    const stripes = [0.05, 0.14, 0.23]
      .map((back) => {
        const z = ORANGE_EDGE - back;
        return polygon(
          p,
          [
            [z, BELT - 0.02],
            [z - 0.05, BELT - 0.02],
            [z - 0.05 - 0.07, 0.36],
            [z - 0.07, 0.36],
          ],
          `fill="${RED}"`,
        );
      })
      .join("");
    // A red splash on the front wing, at the bottom of the windscreen.
    const splash = splat(p(BONNET - 0.3, 0.9), 0.13 * layout.scale);
    const name = boxOf(p, [-0.66, 0.775], [0.94, 0.56]);
    const sub = boxOf(p, [-0.6, 0.525], [0.88, 0.45]);
    // Text boxes are the same on both sides; only the car is mirrored.
    return [
      `<g clip-path="url(#clip-${view})">`,
      `<rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" fill="${WHITE}"/>`,
      `<rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" fill="url(#scatter)"/>`,
      orange,
      stripes,
      splash,
      helz(name),
      academy(sub),
      `</g>`,
    ].join("");
  }

  function top() {
    const p = at.top;
    const v = views.top;
    const bonnet = polygon(
      p,
      [
        [zmin - 0.2, -1.2],
        [BONNET, -1.2],
        [BONNET, 1.2],
        [zmin - 0.2, 1.2],
      ],
      `fill="${ORANGE}"`,
    );
    // Roof lettering runs across the roof and reads upright when the car
    // drives away from you, like a school car's roof sign: that is how most
    // tasks start, from the learner's side of the table.
    const s = layout.scale;
    const [cx, cy] = p(0.08, 0);
    const across = 1.06 * s;
    const along = 1.28 * s;
    const top = cy - along / 2;
    const nameH = across / 2.3;
    const lineH = across / 7.5;
    const roofName = {
      x: cx - across / 2,
      y: top + 0.08 * along,
      w: across,
      h: nameH,
    };
    const line1 = {
      x: cx - across * 0.45,
      y: roofName.y + nameH + 0.09 * along,
      w: across * 0.9,
      h: lineH,
    };
    const line2 = { ...line1, y: line1.y + lineH + 0.06 * along };
    const roof = [
      helz(roofName),
      `<path d="${letters(bowlby, "DRIVING", line1, { fit: "contain" })}" fill="${BLUE}"/>`,
      `<path d="${letters(bowlby, "ACADEMY", line2, { fit: "contain" })}" fill="${BLUE}"/>`,
    ].join("");
    return [
      `<g clip-path="url(#clip-top)">`,
      `<rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" fill="${WHITE}"/>`,
      `<rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" fill="url(#scatter)"/>`,
      bonnet,
      // Three red stripes across the bonnet's back edge, as on the sides.
      [0.05, 0.14, 0.23]
        .map((fwd) =>
          polygon(
            p,
            [
              [BONNET - fwd, -1.2],
              [BONNET - fwd - 0.05, -1.2],
              [BONNET - fwd - 0.05, 1.2],
              [BONNET - fwd, 1.2],
            ],
            `fill="${RED}"`,
          ),
        )
        .join(""),
      `<g transform="rotate(90 ${cx.toFixed(1)} ${cy.toFixed(1)})">${roof}</g>`,
      `</g>`,
    ].join("");
  }

  function ends() {
    const f = views.front;
    const b = views.back;
    const tag = boxOf(at.back, [0.5, 0.86], [-0.5, 0.74]);
    return [
      `<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="${ORANGE}"/>`,
      `<g clip-path="url(#clip-back)">`,
      `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${WHITE}"/>`,
      `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="url(#scatter)"/>`,
      `<path d="${letters(bowlby, "HELZ DRIVING ACADEMY", tag, { fit: "contain" })}" fill="${BLUE}"/>`,
      `</g>`,
    ].join("");
  }

  const clips = Object.entries(views)
    .map(
      ([name, v]) =>
        `<clipPath id="clip-${name}"><rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}"/></clipPath>`,
    )
    .join("");

  const defs = `<defs>
    ${clips}
    <pattern id="brick" width="26" height="14" patternUnits="userSpaceOnUse">
      <path d="M0 0.75H26M0 7.75H26M6 0V7M19 7V14" stroke="${ORANGE_DARK}" stroke-width="1.6" fill="none"/>
    </pattern>
    <pattern id="scatter" width="44" height="44" patternUnits="userSpaceOnUse">
      <polygon points="${pts(star(8, 9, 5.5))}" fill="${RED}"/>
      <polygon points="${pts(star(31, 31, 4.5))}" fill="${BLUE}"/>
      <g transform="translate(26 3)"><path d="${H}" fill="${ORANGE}"/></g>
      <g transform="translate(4 25)"><path d="${H}" fill="${BLUE}"/></g>
    </pattern>
  </defs>`;

  const wrap = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${atlas.width}" height="${atlas.height}" viewBox="0 0 ${atlas.width} ${atlas.height}">`,
    defs,
    `<rect width="100%" height="100%" fill="${WHITE}"/>`,
    side("left"),
    side("right"),
    top(),
    ends(),
    `</svg>`,
  ].join("\n");

  const logoSvg = (mono) => {
    const box1 = { x: 40, y: 30, w: 1120, h: 330 };
    const box2 = { x: 70, y: 410, w: 1060, h: 120 };
    const n = letters(bowlby, "HELZ", box1, { spacing: 0.02 });
    const s = letters(bowlby, "DRIVING ACADEMY", box2, { spacing: 0.03 });
    const body = mono
      ? `<path d="${n}" fill="#fff" stroke="#fff" stroke-width="36" stroke-linejoin="round"/><path d="${s}" fill="#fff"/>`
      : [
          `<path d="${n}" fill="${OUTLINE}" stroke="${OUTLINE}" stroke-width="40" stroke-linejoin="round"/>`,
          `<path d="${n}" fill="${ORANGE}"/>`,
          `<path d="${n}" fill="url(#brick)" opacity="0.55"/>`,
          `<path d="${s}" fill="${WHITE}" stroke="${WHITE}" stroke-width="24" stroke-linejoin="round"/>`,
          `<path d="${s}" fill="${BLUE}"/>`,
        ].join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="560" viewBox="0 0 1200 560">${defs}${body}</svg>`;
  };

  return { wrap, logo: logoSvg(false), logoMono: logoSvg(true) };
}
