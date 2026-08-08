import { useGameStore } from './store/gameStore';
import { MenuScene } from './game/menu/MenuScene';
import { LevelSelectScene } from './game/menu/LevelSelectScene';
import { SceneManager } from './game/scene/SceneManager';
import { AudioManager } from './game/AudioManager';

// App è il componente principale dell'app React.
// Decide quale schermo mostrare in base allo stato globale del gioco.
function App() {
  const screen = useGameStore((state) => state.screen);

  return (
    <div className="app-shell">
      {/* AudioManager non rende nulla a video, ma gestisce la musica in background */}
      <AudioManager />

      {/* Menu cinematografico in 3D con portone e animazione */}
      {screen === 'menu' && <MenuScene />}

      {/* Schermata di selezione dei livelli dopo aver aperto il portone */}
      {screen === 'levelSelect' && <LevelSelectScene />}

      {/* Mostra la scena di gioco 3D quando è il momento di giocare */}
      {screen === 'game' && <SceneManager />}
    </div>
  );
}

export default App;
