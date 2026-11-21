/**
 * The saloon in a school's paint, on its own, for `/tools/sponsor`: turn it
 * round by hand, or jump to the board camera's own tilt from each side to see
 * what a learner at the table sees. Loaded lazily: all of three is in here.
 */
import * as React from "react";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { carFromGltf } from "~/components/board/car-glb";
import { loadWrap, wearWrap } from "~/components/board/board-sponsor";
import { BOARD_CARS, type BoardCarId } from "~/lib/board/cars";

export type CarView = { heading: number; tilt: number; dist: number };

function Car({
  src,
  wrapUrl,
  base,
}: {
  src: string;
  wrapUrl: string | null;
  base: string;
}) {
  const gltf = useLoader(GLTFLoader, src, (loader) =>
    loader.setMeshoptDecoder(MeshoptDecoder),
  );
  const invalidate = useThree((s) => s.invalidate);
  const holder = React.useMemo(() => {
    const group = new THREE.Group();
    const model = carFromGltf(gltf.scene, {
      paint: new THREE.Color(base).getHex(),
    });
    group.add(model);
    group.userData.model = model;
    return group;
  }, [gltf, base]);
  React.useEffect(() => {
    if (!wrapUrl) return;
    let alive = true;
    let texture: THREE.Texture | null = null;
    loadWrap(wrapUrl, 8).then((loaded) => {
      if (!alive) return loaded.dispose();
      texture = loaded;
      wearWrap(holder, loaded, base);
      invalidate();
    });
    return () => {
      alive = false;
      wearWrap(holder, null, base);
      texture?.dispose();
    };
  }, [holder, wrapUrl, base, invalidate]);
  return <primitive object={holder} />;
}

function Aim({ view }: { view: CarView }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3;
    update: () => void;
  } | null;
  React.useEffect(() => {
    const h = (view.heading * Math.PI) / 180;
    const t = (view.tilt * Math.PI) / 180;
    camera.position.set(
      Math.sin(h) * Math.cos(t) * view.dist,
      0.7 + Math.sin(t) * view.dist,
      Math.cos(h) * Math.cos(t) * view.dist,
    );
    camera.lookAt(0, 0.7, 0);
    controls?.target.set(0, 0.7, 0);
    controls?.update();
  }, [camera, controls, view]);
  return null;
}

export default function SponsorCarCanvas({
  car = "saloon",
  wrapUrl,
  base,
  view,
}: {
  car?: BoardCarId;
  wrapUrl: string | null;
  base: string;
  view: CarView;
}) {
  return (
    <Canvas
      camera={{ fov: 35, position: [6, 4, 6] }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.95;
      }}
    >
      <color attach="background" args={["#4f4c47"]} />
      <hemisphereLight args={["#ffffff", "#6b6155", 1.4]} />
      <directionalLight position={[6, 10, 4]} intensity={2.2} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.001}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#1b1c1f" roughness={0.95} />
      </mesh>
      <React.Suspense fallback={null}>
        <Car
          key={car}
          src={BOARD_CARS.find((c) => c.id === car)!.src}
          wrapUrl={wrapUrl}
          base={base}
        />
      </React.Suspense>
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={4}
        maxDistance={20}
      />
      <Aim view={view} />
    </Canvas>
  );
}
