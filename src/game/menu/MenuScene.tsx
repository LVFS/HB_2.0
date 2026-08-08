import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Text } from '@react-three/drei';
import { Mesh, Vector3 } from 'three';
import { useGameStore } from '../../store/gameStore';

const introStart = new Vector3(0, -6, -18);
const introEnd = new Vector3(0, 4, 8);
const lookAtTarget = new Vector3(0, 2, 0);

function CameraIntro({ onComplete }: { onComplete: () => void }) {
  const { camera } = useThree();
  const progress = useRef(0);

  useEffect(() => {
    camera.position.copy(introStart);
    camera.lookAt(lookAtTarget);
  }, [camera]);

  useFrame((_, delta) => {
    if (progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + delta * 0.22);
    camera.position.lerpVectors(introStart, introEnd, progress.current);
    camera.lookAt(lookAtTarget);
    if (progress.current === 1) {
      onComplete();
    }
  });

  return null;
}

const doorOpenRotationSpeed = 1.3;

function DoorFrame({ open }: { open: boolean }) {
  const leftDoor = useRef<Mesh>(null!);
  const rightDoor = useRef<Mesh>(null!);

  useFrame((_, delta) => {
    if (!open || !leftDoor.current || !rightDoor.current) return;
    leftDoor.current.rotation.y = Math.min(1.45, leftDoor.current.rotation.y + delta * doorOpenRotationSpeed);
    rightDoor.current.rotation.y = Math.max(-1.45, rightDoor.current.rotation.y - delta * doorOpenRotationSpeed);
  });

  return (
    <>
      <mesh position={[-5.8, 1.9, 8.4]} ref={leftDoor} castShadow>
        <boxGeometry args={[5.2, 7.2, 0.2]} />
        <meshStandardMaterial color="#1f2a3d" metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[5.8, 1.9, 8.4]} ref={rightDoor} castShadow>
        <boxGeometry args={[5.2, 7.2, 0.2]} />
        <meshStandardMaterial color="#1f2a3d" metalness={0.3} roughness={0.6} />
      </mesh>
    </>
  );
}

export function MenuScene() {
  const setScreen = useGameStore((state) => state.setScreen);
  const [introComplete, setIntroComplete] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  function handlePlay() {
    setDoorOpen(true);
    timeoutRef.current = window.setTimeout(() => setScreen('levelSelect'), 1400);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="scene-shell">
      <Canvas shadows camera={{ position: [0, -6, -18], fov: 55 }}>
        <fog attach="fog" args={["#070b13", 10, 60]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[10, 18, 15]} intensity={1.2} castShadow />
        <Environment preset="sunset" />

        <CameraIntro onComplete={() => setIntroComplete(true)} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#0d1724" />
        </mesh>

        <mesh position={[0, 1.9, 8]} receiveShadow>
          <boxGeometry args={[22, 8, 1.4]} />
          <meshStandardMaterial color="#27334f" metalness={0.15} roughness={0.7} />
        </mesh>

        <DoorFrame open={doorOpen} />

        <Text position={[0, 4.2, 8.6]} fontSize={0.7} color="#f8fafc" anchorX="center" anchorY="middle">
          Epic Birthday Quest
        </Text>

        <mesh position={[0, 1, 5]} castShadow>
          <boxGeometry args={[18, 1.2, 1.5]} />
          <meshStandardMaterial color="#2a3a5a" emissive="#18315a" emissiveIntensity={0.15} />
        </mesh>
      </Canvas>

      <div className="menu-hero-overlay">
        <div className="menu-hero-card">
          <div className="menu-title">Epic Birthday Quest</div>
          <p className="menu-description">
            Parti in una corsa attraverso un’isola misteriosa e raggiungi il grande portone che apre la strada ai livelli.
          </p>
          <div className="menu-buttons">
            <button className="primary" onClick={handlePlay}>
              {doorOpen ? 'Apro il portone...' : 'Gioca'}
            </button>
            <button className="secondary" onClick={() => setScreen('levelSelect')}>
              Seleziona livello
            </button>
          </div>
          <div className="menu-status">
            {introComplete ? 'Menu pronto. Clicca Gioca per aprire il portone.' : 'Animazione in corso...'}
          </div>
        </div>
      </div>
    </div>
  );
}
