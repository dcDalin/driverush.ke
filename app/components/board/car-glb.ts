/**
 * A board car made from one of the downloaded models (`~/lib/board/cars`).
 *
 * It hands back the same thing `buildCar` does: a group with its nose down -z
 * and its wheels on y = 0, whose `userData` holds the tail lamps to light, the
 * wheels to roll and the front hubs to steer. The scene drives either kind the
 * same way.
 *
 * Two kinds of model come in. The realistic cars (`extras.smooth`, from
 * `scripts/build-real-cars.mjs`) keep their own materials, shade smoothly and
 * have their windows in a `glass` node. The older low-poly cars are coloured
 * by vertex and shaded flat.
 *
 * The model's shapes, and a realistic car's own materials, are shared by every
 * car made from it; each car gets its own paint and its own brake lamps.
 */
import * as THREE from "three";

import type { CarModel } from "~/components/board/car-model";

export type GlbCarOptions = {
  paint: number;
  /** Plain materials, for phones that struggle. */
  simple?: boolean;
};

/**
 * Geometry or a material marked this way belongs to the loader's cache, shared
 * by every car made from the model: never dispose it.
 */
export const SHARED = "sharedGeometry";

const WHEEL = /^wheel_(f|r)(l|r)$/;

export function carFromGltf(
  source: THREE.Object3D,
  { paint, simple = false }: GlbCarOptions,
): CarModel {
  const car = new THREE.Group();
  const copy = source.clone(true);
  car.add(copy);

  let smooth = false;
  let wheelRadius = 0.32;
  let roof: { y: number; z: number } | undefined;
  copy.traverse((node) => {
    if (node.userData.smooth === true) smooth = true;
    const at = node.userData.roof as { y?: unknown; z?: unknown } | undefined;
    if (typeof at?.y === "number" && typeof at.z === "number") {
      roof = { y: at.y, z: at.z };
    }
    const radius = node.userData.wheelRadius;
    if (typeof radius === "number") wheelRadius = radius;
  });

  const paintwork = simple
    ? new THREE.MeshStandardMaterial({
        color: paint,
        flatShading: !smooth,
        roughness: 0.45,
      })
    : new THREE.MeshPhysicalMaterial({
        color: paint,
        flatShading: !smooth,
        roughness: smooth ? 0.32 : 0.38,
        metalness: 0.1,
        clearcoat: smooth ? 0.9 : 0.7,
        clearcoatRoughness: smooth ? 0.1 : 0.18,
        envMapIntensity: 0.7,
      });

  // Flat-shaded low-poly cars: one vertex-coloured body and a plain red lamp.
  const body = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.62,
    metalness: 0.05,
    envMapIntensity: 0.6,
  });
  let tail: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
    color: 0xa30f12,
    emissive: 0x900000,
    emissiveIntensity: 0.5,
    flatShading: true,
    roughness: 0.3,
  });
  // Dark tinted windows, both faces drawn, so the empty cabin never shows
  // through: you look through two tinted panes. Opaque on phones that struggle.
  const glass = simple
    ? new THREE.MeshStandardMaterial({
        color: 0x161b20,
        roughness: 0.2,
        side: THREE.DoubleSide,
      })
    : new THREE.MeshPhysicalMaterial({
        color: 0x161b20,
        roughness: 0.06,
        metalness: 0.2,
        transparent: true,
        opacity: 0.86,
        envMapIntensity: 1.2,
        side: THREE.DoubleSide,
      });
  let tailTaken = false;

  copy.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.userData[SHARED] = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (mesh.name === "paint") {
      mesh.material = paintwork;
    } else if (mesh.name === "glass") {
      mesh.material = glass;
      mesh.castShadow = false;
    } else if (mesh.name === "tail") {
      if (smooth && !tailTaken) {
        // The model's own lamp, made able to glow for this car alone.
        const own = (mesh.material as THREE.MeshStandardMaterial).clone();
        own.emissive.set(0x900000);
        own.emissiveIntensity = 0.5;
        tail = own;
        tailTaken = true;
      }
      mesh.material = tail;
    } else if (smooth) {
      // The model's own materials, shared with every car made from it.
      const list = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of list) material.userData[SHARED] = true;
    } else {
      mesh.material = body;
    }
  });

  // Each wheel goes inside a hub that stays on the axle: the hub turns to
  // steer, the group inside it turns to roll. A wheel made of several
  // materials loads as a group, so wheels are found by name.
  const wheelObjects: THREE.Object3D[] = [];
  copy.traverse((node) => {
    if (WHEEL.test(node.name) && !WHEEL.test(node.parent?.name ?? "")) {
      wheelObjects.push(node);
    }
  });
  const wheels: THREE.Group[] = [];
  const steering: THREE.Group[] = [];
  for (const wheel of wheelObjects) {
    const parent = wheel.parent!;
    const hub = new THREE.Group();
    hub.position.copy(wheel.position);
    const spin = new THREE.Group();
    wheel.position.set(0, 0, 0);
    hub.add(spin);
    spin.add(wheel);
    parent.add(hub);
    wheels.push(spin);
    if (wheel.name.startsWith("wheel_f")) steering.push(hub);
  }

  car.userData = { tail, wheels, steering, wheelRadius, paintwork, roof };
  return car as CarModel;
}
