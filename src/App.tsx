import { Suspense, lazy, useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useBackgroundMusic } from '@/hooks/useBackgroundMusic';
import styles from './App.module.css';

// Ogni schermata viene scaricata solo quando serve davvero (code splitting).
// Il guadagno grosso è la scena di gioco: si porta dietro il motore fisico
// Rapier, che nel menu e nella selezione livelli non serve a niente.
const MenuScene = lazy(() =>
  import('@/game/menu/MenuScene').then((module) => ({ default: module.MenuScene }))
);
// ⚠️ SOLO SU QUESTO BRANCH (buon-compleanno-easter-egg): al posto della
// selezione livelli si monta la sequenza di auguri. La selezione livelli vera
// resta intatta negli altri branch — questo è l'unico punto in cui i due rami
// divergono, tenuto apposta su una riga sola perché i merge restino puliti.
const LevelSelectScene = lazy(() =>
  import('@/game/birthday/BirthdayScene').then((module) => ({ default: module.BirthdayScene }))
);
const SceneManager = lazy(() =>
  import('@/game/levels/Level1/SceneManager').then((module) => ({ default: module.SceneManager }))
);

// App è il componente principale dell'app React.
// Decide quale schermo mostrare in base allo stato globale del gioco.
function App() {
  const screen = useGameStore((state) => state.screen);

  // Musica di sottofondo: vive quanto l'app, indipendente dallo schermo
  // attivo — MA silenziata (non distrutta) durante `levelSelect`, perché su
  // questo branch quello schermo è `BirthdayScene`, che ha una musica sua
  // (`useBirthdayMusic`, un quadro alla volta): senza il muted, il tema del
  // menu continuerebbe a suonare sotto, sovrapposto. Stessa riga-sola
  // "SOLO SU QUESTO BRANCH" del commento sopra, per lo stesso motivo.
  useBackgroundMusic({ muted: screen === 'levelSelect' });

  // Fade to white di chiusura del menu (vedi CameraDirector, finale
  // "attraverso il varco"): vive QUI, non dentro `MenuScene`, perché quando
  // `screen` cambia `MenuScene` sparisce di colpo (nessun cross-fade tra
  // componenti React) — se l'overlay vivesse lì, sparirebbe insieme a lei
  // nel fotogramma esatto del taglio, e non ci sarebbe più nulla a coprirlo.
  const [whiteout, setWhiteout] = useState(false);

  // Ogni cambio di schermata con il bianco ancora attivo lo riporta a
  // trasparente un istante dopo il mount della schermata nuova: si legge
  // come "sfuma dal bianco", non come un secondo taglio secco. Chi ha
  // acceso il bianco (oggi solo `CameraDirector`) decide QUANDO cambiare
  // schermata, non se riportarlo giù: quello è generico, sta qui una volta sola.
  useEffect(() => {
    if (!whiteout) return;
    const id = requestAnimationFrame(() => setWhiteout(false));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- si vuole reagire SOLO al cambio schermata, non a ogni variazione di whiteout (altrimenti si richiuderebbe da solo appena acceso)
  }, [screen]);

  return (
    <div className="app-shell">
      {/* Suspense mostra il fallback mentre il codice della schermata arriva. */}
      <Suspense fallback={<div className="screen-fallback">Caricamento...</div>}>
        {/* Menu cinematografico in 3D con portone e animazione */}
        {screen === 'menu' && <MenuScene onWhiteout={setWhiteout} />}

        {/* Schermata di selezione dei livelli dopo aver aperto il portone */}
        {screen === 'levelSelect' && <LevelSelectScene />}

        {/* Mostra la scena di gioco 3D quando è il momento di giocare */}
        {screen === 'game' && <SceneManager />}
      </Suspense>

      <div className={`${styles.whiteout} ${whiteout ? styles.whiteoutActive : ''}`} />
    </div>
  );
}

export default App;
