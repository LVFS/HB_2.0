import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, Text } from '@react-three/drei';
import { useGameStore } from '../../store/gameStore';

export function LevelSelectScene() {
  const levels = useGameStore((state) => state.levels);
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
        <Environment preset="dawn" />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#07121d" />
        </mesh>

        {levels.map((level) => (
          <group key={level.id} position={level.position}>
            <mesh
              onClick={() => setSelectedLevel(level.id)}
              castShadow
              position={[0, 1.1, 0]}
            >
              <cylinderGeometry args={[1.2, 1.2, 2.4, 32]} />
              <meshStandardMaterial
                color={selectedLevel === level.id ? '#fbbf24' : level.color}
                emissive={selectedLevel === level.id ? '#fbbf24' : '#000000'}
                emissiveIntensity={selectedLevel === level.id ? 0.35 : 0}
              />
            </mesh>
            <Text
              position={[0, 2.8, 0]}
              fontSize={0.35}
              color="#f8fafc"
              anchorX="center"
              anchorY="middle"
            >
              {level.name}
            </Text>
          </group>
        ))}

        <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.2} />
      </Canvas>

      <div className="level-select-overlay">
        <div className="level-select-card">
          <div className="menu-title">Seleziona livello</div>
          {selected ? (
            <>
              <div className="level-info-title">{selected.name}</div>
              <p className="level-info-text">{selected.description}</p>
              <button className="primary" onClick={handleStartLevel}>
                Avvia livello
              </button>
            </>
          ) : (
            <p className="level-info-text">Clicca su un punto nella scena per vedere i dettagli del livello.</p>
          )}
          <button className="secondary" onClick={() => setScreen('menu')}>
            Torna indietro
          </button>
        </div>
      </div>
    </div>
  );
}
