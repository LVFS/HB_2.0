import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { OrbitControls } from '@react-three/drei';
import { EnvironmentScene } from './EnvironmentScene';
import { Player } from './Player';
import { Fragments } from './Fragments';
import { GameOverlay } from '@/components/GameOverlay';
import { totalFragments } from '@/data/fragments';
import { useGameStore } from '@/store/gameStore';
import { useProgressStore } from '@/store/progressStore';

export function SceneManager() {
  // Segna il livello come completato quando tutti i frammenti sono
  // raccolti — unico aggancio, oggi, tra la selezione livelli (mappa reale)
  // e lo sblocco progressivo (`progressStore`): nessun finale/achievement
  // ancora costruito, questo effetto si limita alla bookkeeping.
  const selectedLevel = useGameStore((state) => state.selectedLevel);
  const collectedFragmentIds = useGameStore((state) => state.collectedFragmentIds);
  const completeLevel = useProgressStore((state) => state.completeLevel);

  useEffect(() => {
    if (selectedLevel && collectedFragmentIds.length >= totalFragments) {
      completeLevel(selectedLevel);
    }
  }, [selectedLevel, collectedFragmentIds, completeLevel]);

  return (
    <div className="scene-shell">
      {/* Overlay in-game con missione, anteprima frammenti e controlli */}
      <GameOverlay />

      {/* Canvas è il contenitore WebGL dove disegniamo la scena 3D */}
      <Canvas shadows camera={{ position: [0, 4, 8], fov: 55 }}>
        {/* Effetti di luce e atmosfera nella scena */}
        <fog attach="fog" args={["#020617", 15, 32]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[8, 16, 8]} intensity={1.2} castShadow />

        {/* Suspense: gli asset 3D si caricano in modo asincrono e "sospendono".
            Senza un boundary React solleverebbe un errore al primo caricamento. */}
        <Suspense fallback={null}>
          {/* Physics avvolge gli oggetti fisici del gioco */}
          <Physics gravity={[0, -30.81, 0]}>
            <EnvironmentScene />
            <Player />
            <Fragments />
          </Physics>
        </Suspense>

        {/* OrbitControls permette di ruotare la camera con il mouse */}
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={6}
          maxDistance={18}
          rotateSpeed={0.6}
        />
      </Canvas>
    </div>
  );
}
