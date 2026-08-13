import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, Text } from '@react-three/drei';
import { levels } from '@/data/levels';
import { useGameStore } from '@/store/gameStore';
import ui from '@/styles/ui.module.css';
import styles from './LevelSelectScene.module.css';

export function LevelSelectScene() {
  const selectedLevel = useGameStore((state) => state.selectedLevel);
  const setSelectedLevel = useGameStore((state) => state.setSelectedLevel);
  const setScreen = useGameStore((state) => state.setScreen);
  const resetProgress = useGameStore((state) => state.resetProgress);

  const selected = levels.find((level) => level.id === selectedLevel) ?? null;

  const handleStartLevel = () => {
    if (!selected) return;
    resetProgress();
    setScreen('game');
  };

  return (
    <div className="scene-shell">
      <Canvas shadows camera={{ position: [0, 9, 14], fov: 55 }}>
        <fog attach="fog" args={["#081014", 10, 60]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[8, 18, 12]} intensity={1.3} castShadow />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#07121d" />
        </mesh>

        {/* Environment e Text caricano asset in modo asincrono e "sospendono". */}
        <Suspense fallback={null}>
          <Environment preset="dawn" />

          {levels.map((level) => (
            <group key={level.id} position={level.position}>
              <mesh onClick={() => setSelectedLevel(level.id)} castShadow position={[0, 1.1, 0]}>
                <cylinderGeometry args={[1.2, 1.2, 2.4, 32]} />
                <meshStandardMaterial
                  color={selectedLevel === level.id ? '#fbbf24' : level.color}
                  emissive={selectedLevel === level.id ? '#fbbf24' : '#000000'}
                  emissiveIntensity={selectedLevel === level.id ? 0.35 : 0}
                />
              </mesh>
              <Text position={[0, 2.8, 0]} fontSize={0.35} color="#f8fafc" anchorX="center" anchorY="middle">
                {level.name}
              </Text>
            </group>
          ))}
        </Suspense>

        <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.2} />
      </Canvas>

      <div className={styles.overlay}>
        <div className={styles.card}>
          <div className={ui.title}>Seleziona livello</div>
          {selected ? (
            <>
              <div className={styles.infoTitle}>{selected.name}</div>
              <p className={ui.bodyText}>{selected.description}</p>
              <button className={ui.primary} onClick={handleStartLevel}>
                Avvia livello
              </button>
            </>
          ) : (
            <p className={ui.bodyText}>Clicca su un punto nella scena per vedere i dettagli del livello.</p>
          )}
          <button className={ui.secondary} onClick={() => setScreen('menu')}>
            Torna indietro
          </button>
        </div>
      </div>
    </div>
  );
}
