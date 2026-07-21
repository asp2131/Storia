"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, useTexture } from "@react-three/drei";
import Image from "next/image";
import * as THREE from "three";

type MascotStoryWorldProps = {
  reduceMotion?: boolean;
};

function StoryPages() {
  const pages = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => {
        const lane = index % 3;
        return {
          position: [
            -5.2 + index * 0.62,
            -1.8 + lane * 0.26 + Math.sin(index) * 0.12,
            -2.1 - lane * 0.55,
          ] as [number, number, number],
          rotation: [
            -0.4 + lane * 0.08,
            0.16,
            -0.72 + index * 0.05,
          ] as [number, number, number],
          color: index % 4 === 0 ? "#f6b28f" : index % 4 === 1 ? "#f4d77d" : "#fff8eb",
        };
      }),
    []
  );

  return (
    <group>
      {pages.map((page, index) => (
        <mesh key={index} position={page.position} rotation={page.rotation}>
          <boxGeometry args={[0.42, 0.03, 0.58]} />
          <meshStandardMaterial color={page.color} roughness={0.8} metalness={0.02} />
        </mesh>
      ))}
    </group>
  );
}

function SoundRibbons() {
  const curves = useMemo(
    () =>
      [
        ["#ed6151", 0],
        ["#2b6f5f", 0.36],
        ["#e7c169", 0.72],
      ].map(([color, offset]) => {
        const points = Array.from({ length: 32 }, (_, index) => {
          const t = index / 31;
          return new THREE.Vector3(
            -4.7 + t * 9.4,
            0.65 + Math.sin(t * Math.PI * 3 + Number(offset) * 4) * 0.34,
            -1.25 + Math.cos(t * Math.PI * 2 + Number(offset) * 3) * 0.22
          );
        });

        return {
          color: color as string,
          geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 72, 0.018, 8, false),
        };
      }),
    []
  );

  return (
    <group>
      {curves.map((curve) => (
        <mesh geometry={curve.geometry} key={curve.color}>
          <meshStandardMaterial color={curve.color} emissive={curve.color} emissiveIntensity={0.18} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

function Mascot({ reduceMotion }: MascotStoryWorldProps) {
  const texture = useTexture("/storia-landing/mascot-full.png");
  const mascotRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!mascotRef.current || reduceMotion) return;

    const t = state.clock.elapsedTime;
    mascotRef.current.rotation.y = Math.sin(t * 0.55) * 0.18;
    mascotRef.current.rotation.z = Math.sin(t * 0.8) * 0.035;
  });

  return (
    <Float speed={reduceMotion ? 0 : 1.45} rotationIntensity={reduceMotion ? 0 : 0.18} floatIntensity={reduceMotion ? 0 : 0.42}>
      <group ref={mascotRef} position={[0.15, 0.15, 0]}>
        <mesh position={[0, -0.08, -0.06]} scale={[2.15, 2.15, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={texture} transparent alphaTest={0.08} toneMapped={false} />
        </mesh>
        <mesh position={[0, -1.02, -0.22]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.35, 0.34, 1]}>
          <circleGeometry args={[1, 48]} />
          <meshBasicMaterial color="#1a1512" transparent opacity={0.12} depthWrite={false} />
        </mesh>
      </group>
    </Float>
  );
}

function WorldCamera({ reduceMotion }: MascotStoryWorldProps) {
  const { size } = useThree();
  const progressRef = useRef(0);

  useEffect(() => {
    if (reduceMotion) return;

    const onScroll = () => {
      progressRef.current = THREE.MathUtils.clamp(window.scrollY / Math.max(window.innerHeight * 0.95, 1), 0, 1);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduceMotion]);

  useFrame((state) => {
    const progress = reduceMotion ? 0 : progressRef.current;
    const isPortrait = size.width / size.height < 0.8;
    const targetX = THREE.MathUtils.lerp(isPortrait ? 0 : 0.35, isPortrait ? -0.15 : -0.4, progress);
    const targetY = THREE.MathUtils.lerp(0.1, 0.42, progress);
    const targetZ = THREE.MathUtils.lerp(isPortrait ? 7.4 : 5.35, isPortrait ? 6.15 : 4.25, progress);

    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, targetX + Math.sin(state.clock.elapsedTime * 0.22) * 0.04, 0.055);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetY, 0.055);
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetZ, 0.055);
    state.camera.lookAt(0, 0, -0.2);
  });

  return null;
}

function Scene({ reduceMotion }: MascotStoryWorldProps) {
  const { size } = useThree();
  const isPortrait = size.width / size.height < 0.8;

  return (
    <>
      <WorldCamera reduceMotion={reduceMotion} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[2.2, 3.8, 4]} intensity={2.4} color="#fff4df" />
      <pointLight position={[-3.6, 0.9, 1.8]} intensity={1.1} color="#ed6151" />
      <pointLight position={[3.8, -0.6, 0.4]} intensity={0.9} color="#6fb69b" />
      <group position={[isPortrait ? 0.15 : 0.75, -0.05, 0]}>
        <Mascot reduceMotion={reduceMotion} />
      </group>
      <group position={[0, -0.15, 0]}>
        <StoryPages />
        <SoundRibbons />
      </group>
      <mesh position={[0.4, -1.58, -1.8]} rotation={[-Math.PI / 2, 0, 0]} scale={[5.8, 2.8, 1]}>
        <circleGeometry args={[1, 72]} />
        <meshStandardMaterial color="#f5ead8" roughness={0.95} />
      </mesh>
    </>
  );
}

export default function MascotStoryWorld({ reduceMotion = false }: MascotStoryWorldProps) {
  const [ready, setReady] = useState(false);

  return (
    <div className="mascot-world" aria-hidden="true">
      {!ready && (
        <div className="mascot-world-fallback">
          <Image src="/storia-landing/mascot-full.png" alt="" width={480} height={480} priority />
        </div>
      )}
      <Canvas
        camera={{ position: [0.35, 0.1, 5.35], fov: 34 }}
        dpr={[1, 1.6]}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          setReady(true);
        }}
      >
        <Scene reduceMotion={reduceMotion} />
      </Canvas>
    </div>
  );
}
