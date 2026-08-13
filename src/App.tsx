import { Suspense, lazy } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useBackgroundMusic } from '@/hooks/useBackgroundMusic';

// Ogni schermata viene scaricata solo quando serve davvero (code splitting).
// Il guadagno grosso è la scena di gioco: si porta dietro il motore fisico
// Rapier, che nel menu e nella selezione livelli non serve a niente.
const MenuScene = lazy(() =>
  import('@/game/menu/MenuScene').then((module) => ({ default: module.MenuScene }))
);
const LevelSelectScene = lazy(() =>
  import('@/game/menu/LevelSelectScene').then((module) => ({ default: module.LevelSelectScene }))
);
const SceneManager = lazy(() =>
  import('@/game/scene/SceneManager').then((module) => ({ default: module.SceneManager }))
);

// App è il componente principale dell'app React.
// Decide quale schermo mostrare in base allo stato globale del gioco.
function App() {
  const screen = useGameStore((state) => state.screen);

  // Musica di sottofondo: vive quanto l'app, indipendente dallo schermo attivo.
  useBackgroundMusic();

  return (
    <div className="app-shell">
      {/* Suspense mostra il fallback mentre il codice della schermata arriva. */}
      <Suspense fallback={<div className="screen-fallback">Caricamento...</div>}>
        {/* Menu cinematografico in 3D con portone e animazione */}
        {screen === 'menu' && <MenuScene />}

        {/* Schermata di selezione dei livelli dopo aver aperto il portone */}
        {screen === 'levelSelect' && <LevelSelectScene />}

        {/* Mostra la scena di gioco 3D quando è il momento di giocare */}
        {screen === 'game' && <SceneManager />}
      </Suspense>
    </div>
  );
}

export default App;
