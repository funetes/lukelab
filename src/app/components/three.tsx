"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense } from "react";

function Model(props: any) {
  const { scene } = useGLTF("blenderCat.glb"); // public 기준 경로
  return <primitive object={scene} {...props} />;
}

export default function Three() {
  return (
    <Canvas camera={{ position: [0, 1.5, 3], fov: 50 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <Suspense fallback={null}>
        <Model position={[0, 0, 0]} />
      </Suspense>
      <OrbitControls />
    </Canvas>
  );
}
