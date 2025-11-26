"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef } from "react";

export default function Three() {
  const orbitControlsRef = useRef(null);
  return (
    <Canvas ref={orbitControlsRef} camera={{ position: [6, 6, 50], fov: 40 }}>
      <OrbitControls autoRotate />
      <ambientLight intensity={1.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <mesh position-y={2.5} position-x={2.5} scale={1.25}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshNormalMaterial wireframe />
      </mesh>
      <mesh
        rotation-y={Math.PI * 0.25}
        position-x={3.5}
        position-y={-1.5}
        scale={1.5}
      >
        <boxGeometry />
        <meshBasicMaterial color="orange" />
      </mesh>
      <mesh position-y={-2} rotation-x={-Math.PI * 0.5} scale={50}>
        <planeGeometry />
        <meshBasicMaterial color="greenyellow" />
      </mesh>
    </Canvas>
  );
}
