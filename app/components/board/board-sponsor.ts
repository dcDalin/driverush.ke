/**
 * A sponsoring driving school on the 3D table: its paint on the learner's
 * car, its logo engraved on the frame's brass plates, and its logo painted
 * faintly in one green field of the board. Which school, and the rules for
 * picking it, are in `~/lib/board/sponsors`.
 *
 * Everything here waits for its pictures: until they arrive (or if they never
 * do) the table looks as it does with no sponsor, and the car wears the
 * school's plain body colour.
 */
import * as THREE from "three";

import type { CarModel } from "~/components/board/car-model";
import type { BoardCarId } from "~/lib/board/cars";
import { SPONSOR_PAINT, sponsorSpot } from "~/lib/board/full-board";
import type { Sponsor } from "~/lib/board/sponsors";

const loader = new THREE.TextureLoader();

/** A school's wrap picture, ready for the saloon's paint (laid out as glTF expects). */
export async function loadWrap(
  url: string,
  anisotropy: number,
): Promise<THREE.Texture> {
  const texture = await loader.loadAsync(url);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  // three caps this at what the graphics card can do.
  texture.anisotropy = anisotropy;
  return texture;
}

/** A school's picture for a flat surface (the roof board), the usual way up. */
export async function loadPicture(
  url: string,
  anisotropy: number,
): Promise<THREE.Texture> {
  const texture = await loader.loadAsync(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

/**
 * Fetches a school's pictures for one car ahead of need, into the browser's
 * own cache: the school changes with every new task, and its paint should be
 * there when it does. Not on a connection the learner has asked to save.
 */
export function warmSchool(
  sponsor: Sponsor,
  car: BoardCarId,
  small: boolean,
): void {
  const saving = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection?.saveData;
  if (saving) return;
  const paint = sponsor.livery?.cars[car];
  const room = sponsor.room;
  const textures = [
    paint && (small ? paint.lo : paint.hi),
    sponsor.topBoard?.src,
    room && (small ? room.banner.lo : room.banner.hi),
    room?.posters.logo,
    room?.posters.lessons,
  ];
  for (const url of textures) {
    if (!url) continue;
    const image = new Image();
    // Asked for the way three's loader asks, so it is the same cache entry.
    image.crossOrigin = "anonymous";
    image.src = url;
  }
  // The logo for the plates and the board is loaded plainly (`loadImage`).
  new Image().src = sponsor.logo.mono;
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${url}`));
    image.src = url;
  });
}

/**
 * Puts a school's paint on a car from `carOnTable`, or takes it off. Only a
 * downloaded model's bodywork can take it; the car built in code keeps its
 * colour. Returns whether the paint went on.
 */
export function wearWrap(
  holder: THREE.Object3D,
  wrap: THREE.Texture | null,
  base: string,
): boolean {
  const model = holder.userData.model as CarModel | undefined;
  const paintwork = model?.userData.paintwork;
  if (!paintwork) return false;
  // A model without the wrap template (an older copy from a cache, or not
  // the saloon) would show one stretched pixel of the picture: plain paint.
  const body = model?.getObjectByName("paint") as THREE.Mesh | undefined;
  if (wrap && !body?.geometry.getAttribute("uv")) wrap = null;
  // The wrap is shared and outlives the car: never let the car's clean-up
  // free it.
  paintwork.map = wrap;
  paintwork.color.set(wrap ? "#ffffff" : base);
  paintwork.needsUpdate = true;
  return wrap !== null;
}

// ---- brass plates ---------------------------------------------------------------

/** The plate's size in metres, without and with a school's logo on it. */
export const PLATE = { width: 15, depth: 2.7, sponsoredWidth: 26 } as const;

function brass(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const shine = ctx.createLinearGradient(0, 0, 0, h);
  shine.addColorStop(0, "#e9cf86");
  shine.addColorStop(0.5, "#b8923c");
  shine.addColorStop(1, "#d8bb6a");
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#6b5220";
  ctx.lineWidth = h * 0.05;
  ctx.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h * 0.88);
}

/**
 * The frame's plate with a school's logo engraved beside the board's name:
 * the logo is cut into the brass (dark, with a lit lower edge), never printed
 * in colour, so it reads as part of the table.
 */
export function sponsoredPlate(logo: HTMLImageElement): THREE.CanvasTexture {
  const h = 320;
  const w = Math.round((h * PLATE.sponsoredWidth) / PLATE.depth);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  if (!ctx) return texture;

  brass(ctx, w, h);
  const split = w * 0.56;
  ctx.fillStyle = "#3d2f12";
  ctx.font = `bold ${Math.round(h * 0.4)}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("MODEL TOWN BOARD", split / 2 + h * 0.06, h * 0.52);
  ctx.fillRect(split, h * 0.2, h * 0.025, h * 0.6);

  // The logo, fitted to the right-hand part.
  const room = {
    x: split + h * 0.2,
    y: h * 0.16,
    w: w - split - h * 0.4,
    h: h * 0.68,
  };
  const k = Math.min(room.w / logo.width, room.h / logo.height);
  const lw = logo.width * k;
  const lh = logo.height * k;
  const lx = room.x + (room.w - lw) / 2;
  const ly = room.y + (room.h - lh) / 2;
  const cut = (colour: string) => {
    const c = document.createElement("canvas");
    c.width = Math.ceil(lw);
    c.height = Math.ceil(lh);
    const g = c.getContext("2d");
    if (!g) return c;
    g.drawImage(logo, 0, 0, lw, lh);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = colour;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  };
  ctx.drawImage(cut("rgba(255, 244, 205, 0.7)"), lx, ly + 2);
  ctx.drawImage(cut("#3d2f12"), lx, ly);
  texture.needsUpdate = true;
  return texture;
}

// ---- the logo painted on the board ------------------------------------------------

/**
 * The school's logo painted in its green field, pale and faded like old
 * board paint, so it never competes with the road markings. Reads upright
 * from the south side of the table.
 */
export function boardLogo(logo: HTMLImageElement): THREE.Mesh {
  const spot = sponsorSpot();
  const w = spot.x1 - spot.x0;
  const h = spot.z1 - spot.z0;
  // Fit the logo inside the spot, keeping its shape.
  const k = Math.min(w / logo.width, h / logo.height);
  const texture = new THREE.Texture(logo);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(logo.width * k, logo.height * k),
    new THREE.MeshStandardMaterial({
      map: texture,
      color: SPONSOR_PAINT.color,
      transparent: true,
      opacity: SPONSOR_PAINT.opacity,
      depthWrite: false,
      roughness: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((spot.x0 + spot.x1) / 2, 0.04, (spot.z0 + spot.z1) / 2);
  mesh.renderOrder = 2;
  mesh.receiveShadow = true;
  return mesh;
}
