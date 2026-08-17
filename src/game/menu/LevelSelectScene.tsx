import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls, Text } from '@react-three/drei';
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

        {/* Environment e Text caricano asset in modo asincrono e "sospendono".
            Ambient/riflessi via cubemap procedurale (`Lightformer`), non un
            preset HDR scaricato da un CDN esterno — stesso motivo/fix di
            `MainMenuSceneAnimation.tsx` (vedi CLAUDE.md, "Bundle/performance"):
            i preset drei vanno a scaricare da raw.githubusercontent.com, che
            sotto rate limit (429) manda in crash l'intero Canvas. Toni freddi
            per restare coerenti con la scena scura (fog/pavimento quasi neri). */}
        <Suspense fallback={null}>
          <Environment resolution={64}>
            <Lightformer form="rect" intensity={2} color="#3fa9d8" position={[-15, 12, 8]} scale={[14, 8, 1]} />
            <Lightformer form="rect" intensity={1.2} color="#0b2233" position={[15, 10, -8]} scale={[16, 10, 1]} />
            <Lightformer form="ring" intensity={1.6} color="#f8fafc" position={[0, 14, 12]} scale={6} />
          </Environment>

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
