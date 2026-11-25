/**
 * The classroom round the board's table, built from the layout in
 * `~/lib/board/room`: painted walls with a school's stripe rail, the school's
 * banner on every wall and its posters, a whiteboard, the road-signs chart,
 * windows, a door, a clock, and a few desks.
 *
 * Cheap on purpose, for every phone: flat planes and canvas pictures, two
 * merged meshes for the furniture, nothing casting shadows. The walls are
 * drawn on their inner side only, so from outside the room (where the camera
 * often is, backed off over the table) the near wall is simply not there and
 * never hides the board.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  CHAIR_BACK,
  DESK_TOP,
  FLOOR_Y,
  FURNITURE,
  METRE,
  onWall,
  ROOM,
  SEAT,
  WALL_ITEMS,
  type WallItemKind,
  WALLS,
} from "~/lib/board/room";
import type { Sponsor } from "~/lib/board/sponsors";

const CHART = "/assets/board/room/signs-chart.webp";
const WALL_H = ROOM.top - FLOOR_Y;

/** The school's stripe rail along the walls, and their gold and red. */
const RAIL = { y: 10, h: 8, gold: "#f4a20c", red: "#e3271b" };

function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** A height on the wall, as a row of the wall picture (top row 0). */
const row = (y: number, px: number) => ((ROOM.top - y) / WALL_H) * px;

/**
 * The wall's paint, one strip 2 m wide repeated along it: cream above, a
 * grey-green dado to 1 m, a dark skirting, and the stripe rail.
 */
function wallPaint() {
  const W = 256;
  const H = 512;
  return canvasTexture(W, H, (ctx) => {
    ctx.fillStyle = "#efe7d6";
    ctx.fillRect(0, 0, W, H);
    const dado = row(FLOOR_Y + 1.0 * METRE, H);
    ctx.fillStyle = "#9fb2a2";
    ctx.fillRect(0, dado, W, H - dado);
    // a faint wash, so a big wall is not one flat colour
    const wash = ctx.createLinearGradient(0, 0, 0, H);
    wash.addColorStop(0, "rgba(255,255,255,0.10)");
    wash.addColorStop(1, "rgba(0,0,0,0.08)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
    // the school's stripe rail
    const r0 = row(RAIL.y + RAIL.h / 2, H);
    const r1 = row(RAIL.y - RAIL.h / 2, H);
    ctx.fillStyle = RAIL.gold;
    ctx.fillRect(0, r0, W, r1 - r0);
    ctx.fillStyle = RAIL.red;
    const t = (r1 - r0) / 6;
    ctx.fillRect(0, r0 + t, W, t);
    ctx.fillRect(0, r1 - 2 * t, W, t);
    // skirting
    const skirt = row(FLOOR_Y + 0.1 * METRE, H);
    ctx.fillStyle = "#4a4038";
    ctx.fillRect(0, skirt, W, H - skirt);
  });
}

function whiteboard() {
  return canvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = "#fbfbf8";
    ctx.fillRect(0, 0, 512, 256);
    ctx.lineCap = "round";
    // a teacher's sketch of the roundabout and the lane arrows
    ctx.strokeStyle = "#2a4bc4";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(150, 128, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(150, 128, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(150, 10);
    ctx.lineTo(150, 58);
    ctx.moveTo(150, 198);
    ctx.lineTo(150, 246);
    ctx.moveTo(30, 128);
    ctx.lineTo(80, 128);
    ctx.moveTo(220, 128);
    ctx.lineTo(270, 128);
    ctx.stroke();
    ctx.strokeStyle = "#d3352a";
    ctx.lineWidth = 7;
    for (const [x, y] of [
      [330, 70],
      [330, 128],
      [330, 186],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 120, y);
      ctx.lineTo(x + 100, y - 16);
      ctx.moveTo(x + 120, y);
      ctx.lineTo(x + 100, y + 16);
      ctx.stroke();
    }
  });
}

function windowPane() {
  return canvasTexture(256, 224, (ctx) => {
    const sky = ctx.createLinearGradient(0, 0, 0, 224);
    sky.addColorStop(0, "#cfe6f7");
    sky.addColorStop(1, "#f4f8f2");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 256, 224);
    ctx.fillStyle = "#f4f1ea";
    ctx.fillRect(124, 0, 8, 224);
    ctx.fillRect(0, 108, 256, 8);
  });
}

function door() {
  return canvasTexture(128, 288, (ctx) => {
    ctx.fillStyle = "#7a5534";
    ctx.fillRect(0, 0, 128, 288);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 20, 96, 110);
    ctx.strokeRect(16, 150, 96, 120);
    ctx.fillStyle = "#cfd3d8";
    ctx.fillRect(98, 140, 14, 6);
  });
}

function clockFace() {
  return canvasTexture(128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = "#26262a";
    ctx.beginPath();
    ctx.arc(64, 64, 63, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fbfbf8";
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#26262a";
    ctx.lineCap = "round";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.lineWidth = i % 3 ? 2 : 4;
      ctx.beginPath();
      ctx.moveTo(64 + Math.sin(a) * 46, 64 - Math.cos(a) * 46);
      ctx.lineTo(64 + Math.sin(a) * 53, 64 - Math.cos(a) * 53);
      ctx.stroke();
    }
    // ten past ten
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(64, 64);
    ctx.lineTo(64 - 26, 64 - 15);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(64, 64);
    ctx.lineTo(64 + 30, 64 - 30);
    ctx.stroke();
  });
}

/** A lit material that also lights itself a little, so every wall reads. */
function print(map: THREE.Texture | null, colour = "#ffffff", glow = 0.4) {
  return new THREE.MeshStandardMaterial({
    map,
    color: colour,
    emissive: "#ffffff",
    emissiveMap: map,
    emissiveIntensity: map ? glow : 0,
    roughness: 0.9,
    metalness: 0,
    envMapIntensity: 0.3,
  });
}

export type Room = {
  group: THREE.Group;
  /** The materials a school's pictures go on, by what hangs there. */
  slots: Partial<Record<WallItemKind, THREE.MeshStandardMaterial[]>>;
};

/**
 * The room, centred on the table's middle (`cx`, `cz`). The chart's picture
 * loads by itself; a school's pictures go on with {@link hangSchool}.
 */
export function buildRoom(cx: number, cz: number): Room {
  const group = new THREE.Group();
  group.position.set(cx, 0, cz);
  const slots: Room["slots"] = {};
  const add = (mesh: THREE.Mesh) => {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  };

  // Walls: inner side only.
  const paint = wallPaint();
  paint.wrapS = THREE.RepeatWrapping;
  for (const wall of WALLS) {
    const map = paint.clone();
    map.needsUpdate = true;
    map.repeat.set(wall.length / (2 * METRE), 1);
    const mesh = add(
      new THREE.Mesh(
        new THREE.PlaneGeometry(wall.length, WALL_H),
        print(map, "#ffffff", 0.35),
      ),
    );
    mesh.position.set(wall.x, FLOOR_Y + WALL_H / 2, wall.z);
    mesh.rotation.y = wall.turn;
  }

  // What hangs on them.
  const fixed: Partial<Record<WallItemKind, () => THREE.Texture>> = {
    whiteboard,
    window: windowPane,
    door,
    clock: clockFace,
  };
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: "#2b2a29",
    roughness: 0.6,
  });
  for (const item of WALL_ITEMS) {
    const wall = WALLS.find((w) => w.id === item.wall)!;
    const at = (out: number) => onWall(wall, item.along, out);
    const place = (mesh: THREE.Mesh, out: number) => {
      const p = at(out);
      mesh.position.set(p.x, item.y, p.z);
      mesh.rotation.y = wall.turn;
    };
    const framed = item.kind !== "clock" && item.kind !== "door";
    if (framed) {
      const border = item.kind === "banner" ? 2 : 4;
      place(
        add(
          new THREE.Mesh(
            new THREE.PlaneGeometry(item.w + 2 * border, item.h + 2 * border),
            frameMaterial,
          ),
        ),
        0.6,
      );
    }
    const make = fixed[item.kind];
    const material =
      item.kind === "window"
        ? (new THREE.MeshBasicMaterial({
            map: make!(),
          }) as unknown as THREE.MeshStandardMaterial)
        : print(make ? make() : null, "#ffffff", 0.4);
    if (item.kind === "clock") {
      material.transparent = true;
    }
    if (!make) {
      // A school's picture or the chart, still to come: plain until then.
      material.color.set("#f6f6f3");
      (slots[item.kind] ??= []).push(material);
    }
    place(
      add(
        new THREE.Mesh(
          item.kind === "clock"
            ? new THREE.CircleGeometry(item.w / 2, 40)
            : new THREE.PlaneGeometry(item.w, item.h),
          material,
        ),
      ),
      1.2,
    );
  }

  // The chart: the same picture as the road-signs trainer's.
  new THREE.TextureLoader().load(CHART, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    for (const m of slots.chart ?? []) wear(m, texture);
  });

  // A few desks and chairs, merged into a wooden mesh and a metal one.
  const wood: THREE.BufferGeometry[] = [];
  const metal: THREE.BufferGeometry[] = [];
  const box = (
    list: THREE.BufferGeometry[],
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    turn: number,
    ox: number,
    oz: number,
  ) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    g.rotateY(turn);
    g.translate(ox, 0, oz);
    list.push(g);
  };
  for (const f of FURNITURE) {
    const legs = (w: number, d: number, top: number, inset: number) => {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          box(
            metal,
            2.5,
            top - FLOOR_Y,
            2.5,
            sx * (w / 2 - inset),
            (top + FLOOR_Y) / 2,
            sz * (d / 2 - inset),
            f.turn,
            f.x,
            f.z,
          );
        }
      }
    };
    if (f.kind === "desk") {
      box(wood, f.w, 3, f.d, 0, DESK_TOP - 1.5, 0, f.turn, f.x, f.z);
      legs(f.w, f.d, DESK_TOP - 3, 4);
    } else {
      box(wood, f.w, 3, f.d, 0, SEAT - 1.5, 0, f.turn, f.x, f.z);
      // the back stands on the chair's +z side
      box(
        wood,
        f.w,
        CHAIR_BACK - SEAT - 8,
        2.5,
        0,
        (CHAIR_BACK + SEAT + 8) / 2,
        f.d / 2 - 1.5,
        f.turn,
        f.x,
        f.z,
      );
      legs(f.w, f.d, SEAT - 3, 3);
    }
  }
  add(
    new THREE.Mesh(
      mergeGeometries(wood),
      new THREE.MeshStandardMaterial({ color: "#b07c4f", roughness: 0.7 }),
    ),
  );
  add(
    new THREE.Mesh(
      mergeGeometries(metal),
      new THREE.MeshStandardMaterial({
        color: "#5b6066",
        roughness: 0.45,
        metalness: 0.5,
      }),
    ),
  );
  for (const g of [...wood, ...metal]) g.dispose();

  return { group, slots };
}

function wear(material: THREE.MeshStandardMaterial, texture: THREE.Texture) {
  material.map = texture;
  material.emissiveMap = texture;
  material.emissiveIntensity = 0.4;
  material.color.set("#ffffff");
  material.needsUpdate = true;
}

/**
 * Hangs a school's banner and posters in the room. Returns the textures it
 * loaded, to free when the school changes.
 */
export async function hangSchool(
  room: Room,
  sponsor: Sponsor,
  small: boolean,
): Promise<THREE.Texture[]> {
  const pics = sponsor.room;
  if (!pics) return [];
  const loader = new THREE.TextureLoader();
  const load = async (url: string) => {
    const t = await loader.loadAsync(url);
    t.colorSpace = THREE.SRGBColorSpace;
    // The walls are seen at a slant as the close-up turns: filter as hard
    // as the phone can (three caps it).
    t.anisotropy = 16;
    return t;
  };
  const jobs: [WallItemKind, string][] = [
    ["banner", small ? pics.banner.lo : pics.banner.hi],
    ["poster-logo", pics.posters.logo],
    ["poster-lessons", pics.posters.lessons],
  ];
  const loaded = await Promise.allSettled(jobs.map(([, url]) => load(url)));
  const textures: THREE.Texture[] = [];
  loaded.forEach((result, i) => {
    if (result.status !== "fulfilled") return;
    textures.push(result.value);
    for (const m of room.slots[jobs[i]![0]] ?? []) wear(m, result.value);
  });
  return textures;
}
