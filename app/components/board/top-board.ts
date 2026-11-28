/**
 * The name board on a school car's roof: the yellow board Kenyan driving
 * school cars carry, standing across the car so it reads from in front and
 * from behind. The learner's car wears its school's (`~/lib/board/school-catalog`).
 *
 * Where it stands comes from the car's own file (`roof`, written by
 * `scripts/build-car-wrap.mjs`); a car without it gets no board. The art is
 * the school's `topboard.webp` (`scripts/build-sponsor-art.mjs`).
 */
import * as THREE from "three";

import type { CarModel } from "~/components/board/car-model";
import type { TopBoard } from "~/lib/board/school-catalog";

const NAME = "top-board";
/** How thick the board is, and how far its foot lifts it off the roof. */
const THICK = 0.035;
const LIFT = 0.07;

/** The board's outline: a rectangle with its corners cut, centred on x. */
function outline({ width, height, cut }: TopBoard): THREE.Shape {
  const w = width / 2;
  const c = Math.min(cut, height / 2, w);
  const shape = new THREE.Shape();
  shape.moveTo(-w + c, 0);
  shape.lineTo(w - c, 0);
  shape.lineTo(w, c);
  shape.lineTo(w, height - c);
  shape.lineTo(w - c, height);
  shape.lineTo(-w + c, height);
  shape.lineTo(-w, height - c);
  shape.lineTo(-w, c);
  shape.closePath();
  return shape;
}

/** One face of the board, with the art across the whole of it. */
function face(spec: TopBoard, shape: THREE.Shape): THREE.ShapeGeometry {
  const geometry = new THREE.ShapeGeometry(shape);
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < position.count; i += 1) {
    uv.setXY(
      i,
      position.getX(i) / spec.width + 0.5,
      position.getY(i) / spec.height,
    );
  }
  uv.needsUpdate = true;
  return geometry;
}

function build(
  spec: TopBoard,
  art: THREE.Texture,
  simple: boolean,
): THREE.Group {
  const group = new THREE.Group();
  group.name = NAME;
  const shape = outline(spec);
  const painted = new THREE.MeshStandardMaterial({
    map: art,
    roughness: 0.55,
    metalness: 0,
  });
  const frame = new THREE.MeshStandardMaterial({
    color: spec.edge,
    roughness: 0.6,
  });
  const fittings = new THREE.MeshStandardMaterial({
    color: 0x1d1e21,
    roughness: 0.7,
  });

  // Two faces, back to back, so the name reads the right way from both ends.
  const back = new THREE.Mesh(face(spec, shape), painted);
  back.position.set(0, LIFT, THICK / 2);
  const front = new THREE.Mesh(face(spec, shape), painted);
  front.position.set(0, LIFT, -THICK / 2);
  front.rotation.y = Math.PI;
  // The board's edge, between them.
  const rim = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: THICK, bevelEnabled: false }),
    frame,
  );
  // A little thinner than the gap between the faces, so it never covers one.
  rim.position.set(0, LIFT, -THICK * 0.46);
  rim.scale.set(0.998, 0.998, 0.92);
  // A bar across the roof, on two feet.
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width * 0.86, 0.035, 0.07),
    fittings,
  );
  bar.position.y = LIFT - 0.018;
  group.add(rim, back, front, bar);
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, LIFT, 0.16),
      fittings,
    );
    foot.position.set(side * spec.width * 0.36, LIFT / 2 - 0.01, 0);
    group.add(foot);
  }
  group.traverse((node) => {
    node.castShadow = !simple;
  });
  return group;
}

/**
 * Puts a school's name board on a car from `carOnTable`, or takes it off
 * (`art` null). Returns whether the car now wears one.
 */
export function wearTopBoard(
  holder: THREE.Object3D,
  spec: TopBoard | null | undefined,
  art: THREE.Texture | null,
  simple = false,
): boolean {
  const model = holder.userData.model as CarModel | undefined;
  if (!model) return false;
  const had = model.getObjectByName(NAME);
  if (had) {
    had.removeFromParent();
    had.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      // The art is the school's, shared: only the materials go.
      (mesh.material as THREE.Material).dispose();
    });
  }
  const roof = model.userData.roof as { y: number; z: number } | undefined;
  if (!spec || !art || !roof) return false;
  const board = build(spec, art, simple);
  board.position.set(0, roof.y, roof.z);
  model.add(board);
  return true;
}
