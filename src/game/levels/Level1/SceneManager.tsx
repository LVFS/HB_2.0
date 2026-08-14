import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { OrbitControls } from '@react-three/drei';
import { EnvironmentScene } from './EnvironmentScene';
import { Player } from './Player';
import { Fragments } from './Fragments';
import { GameOverlay } from '@/components/GameOverlay';

export function SceneManager() {
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
