"use client";

import { Suspense, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Environment, Float } from "@react-three/drei";
import * as THREE from "three";

interface BookModelProps {
  scrollProgress: number;
}

function BookModel({ scrollProgress }: BookModelProps) {
  const { scene } = useGLTF("/little_prince_pop_up_story_book.glb");
  const modelRef = useRef<THREE.Group>(null);
  const { viewport } = useThree();

  useEffect(() => {
    // Center and scale the model
    if (modelRef.current) {
      const box = new THREE.Box3().setFromObject(modelRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // Center the model
      modelRef.current.position.sub(center);

      // Scale to fit viewport
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = Math.min(viewport.width, viewport.height) * 0.4 / maxDim;
      modelRef.current.scale.setScalar(scale);
    }
  }, [viewport]);

  useFrame(() => {
    if (modelRef.current) {
      // Gentle rotation based on scroll
      modelRef.current.rotation.y = THREE.MathUtils.lerp(
        modelRef.current.rotation.y,
        scrollProgress * Math.PI * 0.3 - 0.15,
        0.05
      );

      // Slight tilt forward as scroll progresses
      modelRef.current.rotation.x = THREE.MathUtils.lerp(
        modelRef.current.rotation.x,
        scrollProgress * 0.2 - 0.1,
        0.05
      );

      // Scale up slightly as book "opens"
      const targetScale = 1 + scrollProgress * 0.15;
      modelRef.current.scale.setScalar(
        THREE.MathUtils.lerp(modelRef.current.scale.x, targetScale * 0.8, 0.05)
      );
    }
  });

  return (
    <Float
      speed={1.5}
      rotationIntensity={0.2}
      floatIntensity={0.3}
      floatingRange={[-0.1, 0.1]}
    >
      <primitive ref={modelRef} object={scene.clone()} />
    </Float>
  );
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 0.1, 1.4]} />
      <meshStandardMaterial color="#fef3c7" opacity={0.3} transparent />
    </mesh>
  );
}

interface PopupBookModelProps {
  scrollProgress: number;
  className?: string;
}

export default function PopupBookModel({
  scrollProgress,
  className = "",
}: PopupBookModelProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
        <directionalLight position={[-5, 3, -5]} intensity={0.4} />
        <pointLight position={[0, 2, 3]} intensity={0.5} color="#fef3c7" />

        <Suspense fallback={<LoadingFallback />}>
          <BookModel scrollProgress={scrollProgress} />
          <Environment preset="city" />
        </Suspense>
      </Canvas>
    </div>
  );
}

// Preload the model
useGLTF.preload("/little_prince_pop_up_story_book.glb");
