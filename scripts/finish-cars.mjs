#!/usr/bin/env node
/**
 * The last step of `npm run build:cars`: how each board vehicle's own parts
 * look. `build-real-cars.mjs` sorts a downloaded model's triangles into paint,
 * glass, lamps, wheels and the rest, and keeps the makers' materials; those
 * were made for other renderers and many arrive wrong for ours: lamp lenses
 * opaque black, tyres mid grey, rims flat white, chrome with no colour.
 *
 * This pass sets them right, by rule: per vehicle, per part (`body`, `tail`,
 * `wheel`), per material, and where one material covers unlike things, per
 * triangle by where it sits (`where`, in the car's own metres: x across,
 * y up from the road, z along with the nose at -z; a wheel's are about its
 * axle, so `r` is the distance out from it; `u`, `v` are where it is on the
 * material's picture).
 *
 * It works on the built files in `public/assets/board/cars/`, so it can be
 * run alone, and again: every rule sets its values outright. Two things it
 * cannot give back on a later run, so start from the file in git when a
 * rule that used them changes: a picture taken off (`plain`) and triangles
 * taken off (`DROP`).
 *
 *   node scripts/finish-cars.mjs [car ...]
 *
 * After it changes a model: bump its `?v=` in `app/lib/board/cars.ts` and
 * `public/sw.js`, and take the car pictures again (`build:car-thumbs`).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import {
  ALL_EXTENSIONS,
  EXTMeshoptCompression,
} from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "public", "assets", "board", "cars");

// ---- looks (colours are linear, as glTF keeps them) ---------------------------

/** Tyre rubber: nearly black, dull. */
const RUBBER = { color: [0.012, 0.012, 0.013], metal: 0, rough: 0.92 };
/** An alloy rim: bright, a little soft so the room's lights do not sparkle. */
const ALLOY = { color: [0.78, 0.79, 0.8], metal: 1, rough: 0.28 };
/** A painted steel rim or a plastic wheel cover. */
const STEEL = { color: [0.55, 0.56, 0.57], metal: 0.85, rough: 0.42 };
/** The dark well behind the spokes: brakes, the barrel's shadow. */
const WELL = { color: [0.02, 0.02, 0.022], metal: 0.3, rough: 0.8 };
const CHROME = { color: [0.85, 0.85, 0.86], metal: 1, rough: 0.12 };
/** Unpainted bumper and trim plastic. */
const PLASTIC = { color: [0.018, 0.018, 0.02], metal: 0, rough: 0.6 };
/** A headlamp seen as one piece: bright, glassy, never dark in shade. */
const HEADLAMP = {
  color: [0.92, 0.94, 0.96],
  metal: 0.35,
  rough: 0.12,
  emissive: [0.32, 0.33, 0.34],
};
/**
 * A headlamp that is only its flat cover, nothing modelled behind: glass
 * that mirrors the room, so it reads as a lamp and not a white panel.
 */
const COVER = {
  color: [0.62, 0.66, 0.7],
  metal: 0.85,
  rough: 0.07,
  emissive: [0.1, 0.105, 0.11],
};
/** A clear lens over a modelled reflector. */
const LENS = {
  color: [0.9, 0.95, 1, 0.22],
  metal: 0,
  rough: 0.04,
  emissive: [0.1, 0.1, 0.11],
};
/** The bright bowl behind a clear lens. */
const REFLECTOR = {
  color: [0.9, 0.9, 0.92],
  metal: 1,
  rough: 0.14,
  emissive: [0.16, 0.16, 0.17],
};
const TAIL_RED = { color: [0.5, 0.01, 0.01], metal: 0, rough: 0.18 };
const AMBER = {
  color: [0.9, 0.3, 0.01],
  metal: 0,
  rough: 0.2,
  emissive: [0.12, 0.03, 0],
};
const REVERSE = {
  color: [0.9, 0.9, 0.9],
  metal: 0,
  rough: 0.15,
  emissive: [0.12, 0.12, 0.12],
};

const PLATE_FRONT = { color: [0.85, 0.85, 0.85], metal: 0, rough: 0.45 };
const PLATE_REAR = { color: [0.9, 0.62, 0.03], metal: 0, rough: 0.45 };

/** Not a look: these triangles are taken off the car. */
const DROP = Symbol("drop");

/**
 * [part, material, look, where?, key?]. The first rule that fits a triangle
 * wins. `key` names the copy of a material that a `where` rule splits off.
 */
const CARS = {
  saloon: [
    // "Klosz" is the lamp's shade: the clear cover over the reflectors.
    ["body", "klosz", LENS],
    // One metal for the lamp bowls, the grille bars and the rims.
    ["body", "main_paint", REFLECTOR],
    ["wheel", "main_paint", ALLOY],
    ["wheel", "Material.013", WELL],
    ["body", "Material.003", CHROME],
    ["body", "miror", CHROME],
    [
      "tail",
      "Material.005",
      { color: [0.45, 0.01, 0.01], metal: 0, rough: 0.15 },
    ],
  ],
  hatchback: [
    ["body", "Chrome1Mtl", CHROME],
    // The number plates lost their picture and came out black: blank
    // plates in Kenya's colours, white in front and yellow behind.
    [
      "body",
      "469SinTtulo202509291655170011Mtl",
      PLATE_FRONT,
      ({ z }) => z < 0,
      "front",
    ],
    [
      "body",
      "469SinTtulo202509291655170011Mtl",
      PLATE_REAR,
      ({ z }) => z > 0,
      "rear",
    ],
    ["wheel", "main_paint", STEEL],
    ["wheel", "Material.013", WELL],
  ],
  wagon: [
    ["wheel", "material_4", RUBBER],
    ["wheel", "light1", STEEL],
    ["wheel", "wheel1", STEEL],
    ["body", "material_4", PLASTIC],
    // One pale grey for the lamps, the badges, the plates and a panel
    // around the front plate.
    [
      "body",
      "light1",
      COVER,
      ({ x, z }) => z < -1.7 && Math.abs(x) > 0.4,
      "head",
    ],
    [
      "body",
      "light1",
      REVERSE,
      ({ x, z }) => z > 1.8 && Math.abs(x) > 0.6,
      "reverse",
    ],
    [
      "body",
      "light1",
      CHROME,
      ({ x, y, z }) => Math.abs(x) < 0.07 && y > (z < 0 ? 0.6 : 0.85),
      "badge",
    ],
    [
      "body",
      "light1",
      PLASTIC,
      ({ x, y, z, wide }) =>
        z < -1.9 && y < 0.6 && (wide > 0.31 || Math.abs(x) > 0.16),
      "panel",
    ],
    ["tail", "tail1", TAIL_RED],
    ["body", "Color_C01", AMBER],
  ],
  pickup: [
    ["wheel", "material_9_16", RUBBER],
    ["wheel", "material_0_16", ALLOY],
    ["body", "material_0_16", CHROME],
    ["body", "material_4_16", HEADLAMP],
    ["body", "material_3_16", AMBER],
    ["body", "material_5_16", PLASTIC],
    ["tail", "material_7_16", TAIL_RED],
  ],
  suv: [
    // One picture for the whole wheel: tyre, brake disc, and a white strip
    // down its right side that the rim is coloured from. All of it came as
    // rough metal, so the rim was a flat white. The strip's dark end
    // is the shade between the spokes, so the rim keeps the picture.
    [
      "wheel",
      "RB1c_Tire_1k",
      { color: [1, 1, 1], metal: 0.6, rough: 0.3 },
      ({ u }) => u > 0.83,
      "rim",
    ],
    ["wheel", "RB1c_Tire_1k", { color: [1, 1, 1], metal: 0, rough: 0.9 }],
    // Its lamps are small pictures under tinted covers, dark at this size.
    [
      "body",
      "UCB_Lights_and_Glass_Transperent",
      { ...LENS, plain: true },
      ({ z }) => z < 0,
      "head",
    ],
    [
      "body",
      "UCB_Lights_and_Glass_Transperent",
      { color: [0.7, 0.03, 0.03, 0.5], metal: 0, rough: 0.08, plain: true },
      ({ z }) => z > 0,
      "tail",
    ],
    [
      "body",
      "UCB_Lights_and_Glass",
      {
        color: [1, 1, 1],
        metal: 0.2,
        rough: 0.15,
        emissive: [0.9, 0.9, 0.9],
        glow: true,
      },
      ({ z }) => z < 0,
      "head",
    ],
  ],
  van: [
    ["wheel", "rubber", RUBBER],
    ["wheel", "wheel", WELL],
    ["wheel", "hubcaps", STEEL],
    ["body", "headlight", HEADLAMP],
    ["body", "indicator_light", AMBER],
    ["body", "reverse_lights", REVERSE],
    ["tail", "brake_lights", TAIL_RED],
    ["body", "secondary", PLASTIC],
    // The headlamp covers came as window glass, which the board tints dark.
    [
      "glass",
      "glass",
      { ...COVER, to: "lamps" },
      ({ y, z }) => y < 1.1 && z < -1.9,
    ],
  ],
  lorry: [
    ["wheel", "Mold-Tech-14153_1", RUBBER],
    ["wheel", "Chrome_bright", STEEL],
    ["wheel", "Chrome_bright_2", STEEL],
    ["tail", "Default_11", TAIL_RED],
    ["body", "Default_3", AMBER],
    ["body", "Default_4", TAIL_RED],
    ["body", "Default_5", HEADLAMP],
    // Gold wheel nuts that are not part of the wheels: they stood still
    // while the wheels turned.
    ["body", "Material__9_0", DROP],
  ],
  crossover: [
    ["wheel", "tire", RUBBER],
    ["wheel", "metal", ALLOY],
    ["wheel", "brake", WELL],
    ["body", "metal", CHROME],
    ["body", "plt1", LENS],
    // The bowls behind the headlamp lenses.
    ["body", "metal3", REFLECTOR, ({ z }) => z < -1.6, "head"],
    ["body", "plt2", AMBER],
    ["body", "plt3", TAIL_RED],
    ["tail", "plt3-2", TAIL_RED],
  ],
};

// ---- the pass -----------------------------------------------------------------

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });

const partOf = (name) =>
  /^wheel_/.test(name) ? "wheel" : name === "tail" ? "tail" : name;
/** A material's name as the maker gave it, without this pass's own marks. */
const baseOf = (name) => name.split("@")[0];

function wear(material, look) {
  const [r, g, b, a = 1] = look.color;
  material
    .setBaseColorFactor([r, g, b, a])
    .setMetallicFactor(look.metal)
    .setRoughnessFactor(look.rough)
    .setEmissiveFactor(look.emissive ?? [0, 0, 0])
    .setAlphaMode(a < 1 ? "BLEND" : "OPAQUE");
  // A maker's picture that only darkens the part: off.
  if (look.plain) material.setBaseColorTexture(null);
  // Its own picture glows, so a lamp's detail shows in shade too.
  if (look.glow) material.setEmissiveTexture(material.getBaseColorTexture());
}

async function finish(id) {
  const file = path.join(DIR, `${id}.glb`);
  const doc = await io.read(file);
  const rules = CARS[id];
  const made = new Map();
  /** The copy of a material for one part (and one split of it). */
  const materialFor = (source, part, key, look) => {
    const name = `${baseOf(source.getName())}@${part}${key ? `.${key}` : ""}`;
    let material = made.get(name);
    if (!material) {
      material = source.clone().setName(name);
      wear(material, look);
      made.set(name, material);
    }
    return material;
  };

  /**
   * The mesh of a part made by this pass (`to` in a look), standing exactly
   * where the part its triangles come from stands.
   */
  const partNamed = (beside, name) => {
    const parent = beside.getParentNode();
    let node = parent.listChildren().find((n) => n.getName() === name);
    if (!node) {
      node = doc
        .createNode(name)
        .setTranslation(beside.getTranslation())
        .setRotation(beside.getRotation())
        .setScale(beside.getScale())
        .setMesh(doc.createMesh(name));
      parent.addChild(node);
    }
    return node.getMesh();
  };

  let changed = 0;
  for (const node of [...doc.getRoot().listNodes()]) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const part = partOf(node.getName());
    const m = node.getWorldMatrix();
    const [ay, az] = part === "wheel" ? [m[13], m[14]] : [0, 0];
    for (const prim of mesh.listPrimitives()) {
      const source = prim.getMaterial();
      const fits = rules.filter(
        ([p, name]) => p === part && name === baseOf(source.getName()),
      );
      if (!fits.length) continue;
      const at = prim.getAttribute("POSITION");
      const uv = prim.getAttribute("TEXCOORD_0");
      const indices = prim.getIndices();
      const count = indices.getCount();
      const point = (i) => {
        const v = at.getElement(indices.getScalar(i), []);
        const x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12];
        const y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
        const z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
        return [x, y, z];
      };
      // Each triangle goes to the first rule that fits where it sits.
      const groups = new Map();
      for (let i = 0; i < count; i += 3) {
        const [a, b, c] = [point(i), point(i + 1), point(i + 2)];
        const x = (a[0] + b[0] + c[0]) / 3;
        const y = (a[1] + b[1] + c[1]) / 3;
        const z = (a[2] + b[2] + c[2]) / 3;
        const r = Math.hypot(y - ay, z - az);
        // How wide the triangle itself is, for telling a small part from
        // the big face it lies on.
        const wide = Math.max(a[0], b[0], c[0]) - Math.min(a[0], b[0], c[0]);
        // Where it is on the material's picture, if it has one.
        const [u, v] = uv
          ? [0, 1].map(
              (k) =>
                (uv.getElement(indices.getScalar(i), [])[k] +
                  uv.getElement(indices.getScalar(i + 1), [])[k] +
                  uv.getElement(indices.getScalar(i + 2), [])[k]) /
                3,
            )
          : [0, 0];
        const rule = fits.find(
          ([, , , where]) => !where || where({ x, y, z, r, wide, u, v }),
        );
        const key = rule ? fits.indexOf(rule) : -1;
        if (!groups.has(key)) groups.set(key, []);
        groups
          .get(key)
          .push(
            indices.getScalar(i),
            indices.getScalar(i + 1),
            indices.getScalar(i + 2),
          );
      }
      const Index = indices.getArray().constructor;
      const whole = groups.size === 1;
      let kept = false;
      for (const [key, list] of groups) {
        const rule = fits[key];
        if (rule) changed += list.length / 3;
        // Taken off the car altogether.
        if (rule && rule[2] === DROP) continue;
        const material = rule
          ? materialFor(
              source,
              part,
              rule[4] ?? (rule[3] ? String(key) : ""),
              rule[2],
            )
          : source;
        const to = rule?.[2].to;
        const target = to || kept ? prim.clone() : prim;
        if (to) partNamed(node, to).addPrimitive(target);
        else if (kept) mesh.addPrimitive(target);
        else kept = true;
        target.setMaterial(material);
        if (!whole) {
          target.setIndices(
            doc
              .createAccessor()
              .setType("SCALAR")
              .setBuffer(indices.getBuffer())
              .setArray(new Index(list)),
          );
        }
      }
      if (!kept) mesh.removePrimitive(prim);
    }
  }
  // Materials nothing wears any more.
  for (const material of doc.getRoot().listMaterials()) {
    if (!material.listParents().some((p) => p.propertyType === "Primitive")) {
      material.dispose();
    }
  }
  // Packed as the builder packs them (its `meshopt` at "high").
  doc
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  await io.write(file, doc);
  console.log(`${id}: ${changed} triangles set`);
}

const wanted = process.argv.slice(2);
for (const id of wanted.length ? wanted : Object.keys(CARS)) {
  if (!CARS[id]) throw new Error(`No car "${id}".`);
  await finish(id);
}
