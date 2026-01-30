"use client";

import { useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

function PrinceCharacter() {
  const { scene } = useGLTF("/landing/prince.glb");
  const modelRef = useRef<THREE.Group>(null);
  const { viewport } = useThree();

  useEffect(() => {
    if (modelRef.current) {
      // Center the model
      const box = new THREE.Box3().setFromObject(modelRef.current);
      const center = box.getCenter(new THREE.Vector3());
      modelRef.current.position.x = -center.x;
      modelRef.current.position.y = -center.y;
      modelRef.current.position.z = -center.z;
    }
    
    return () => {
      // Cleanup
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    };
  }, [scene]);

  useFrame((state) => {
    if (modelRef.current) {
      // Subtle floating animation
      modelRef.current.position.y += Math.sin(state.clock.elapsedTime * 0.5) * 0.002;
      // Slow rotation
      modelRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.1;
    }
  });

  // Scale based on viewport
  const scale = Math.min(viewport.width, viewport.height) * 0.4;

  return (
    <primitive 
      ref={modelRef}
      object={scene} 
      scale={scale} 
      position={[0, 0, 0]}
    />
  );
}

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 7]} intensity={1} />
      <pointLight position={[-5, 5, -5]} intensity={0.5} color="#fef3c7" />
    </>
  );
}

function Loader() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-amber-200/30 border-t-amber-200 rounded-full animate-spin" />
    </div>
  );
}

export default function PrinceModel() {
  return (
    <div className="w-full h-full">
      <Suspense fallback={<Loader />}>
        <Canvas
          gl={{ 
            antialias: false, 
            alpha: true,
            powerPreference: "high-performance",
          }}
          dpr={1}
          camera={{ position: [0, 0, 5], fov: 45 }}
          onCreated={({ gl }) => {
            gl.setPixelRatio(Math.min(window.devicePixelRatio, 1));
          }}
        >
          <PerspectiveCamera makeDefault position={[0, 0, 5]} />
          <Lighting />
          <PrinceCharacter />
          <OrbitControls 
            enablePan={false}
            enableZoom={false}
            enableRotate={true}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.5}
            autoRotate
            autoRotateSpeed={0.5}
          />
        </Canvas>
      </Suspense>
    </div>
  );
}

// Preload the model
useGLTF.preload("/landing/prince.glb");
