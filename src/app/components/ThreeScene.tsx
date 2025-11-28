import { Center, Decal, Text3D, useGLTF, useTexture } from "@react-three/drei";

function Cup(props: { scale: number }) {
  const { nodes, materials } = useGLTF("/coffee-transformed.glb");
  const texture = useTexture("/1200px-Starbucks_Logo_ab_2011.svg.png");
  return (
    <group {...props} dispose={null}>
      <mesh
        castShadow
        receiveShadow
        // @ts-expect-error type오류
        geometry={nodes.coffee_cup_top_16oz.geometry}
        material={materials["13 - Default"]}
      >
        <Decal
          position={[0, 0.75, 0.3]}
          rotation={[0, 0, 0]}
          scale={[0.52, 0.6, 0.6]}
          map={texture}
        />
      </mesh>
    </group>
  );
}

export default function Scene() {
  return (
    <>
      <Center rotation={[-0.25, -0.25, 0]}>
        <Text3D
          curveSegments={32}
          bevelEnabled
          bevelSize={0.04}
          bevelThickness={0.1}
          height={0.5}
          lineHeight={0.6}
          // letterSpacing={-0.06}
          size={1.5}
          font="/Inter_Bold.json"
        >
          {`Hello\nRoolty\nworld`}
          <meshNormalMaterial />
        </Text3D>
        <Center position={[-1.25, 0, 0]}>
          <Cup scale={2} />
        </Center>
      </Center>
    </>
  );
}
