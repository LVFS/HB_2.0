import { Suspense, lazy, useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useBackgroundMusic } from '@/hooks/useBackgroundMusic';
import { useAudioUnlockHint } from '@/hooks/useAudioUnlockHint';
import { useGamepadDetected } from '@/hooks/useGamepadDetected';
import styles from './App.module.css';

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
  import('@/game/levels/Level1/SceneManager').then((module) => ({ default: module.SceneManager }))
);

// App è il componente principale dell'app React.
// Decide quale schermo mostrare in base allo stato globale del gioco.
function App() {
  const screen = useGameStore((state) => state.screen);

  // Musica di sottofondo: vive quanto l'app, indipendente dallo schermo attivo.
  useBackgroundMusic();

  // I browser bloccano l'audio finché non c'è stata un'interazione
  // "attendibile" sulla pagina (click/tasto/tocco) — un bottone del
  // controller non è mai in quella lista, su nessun browser (l'API Gamepad
  // non ha un evento nativo a cui il browser possa appoggiarsi). Una
  // sessione condotta SOLO da controller non sblocca mai l'audio da sola:
  // questo avviso (sotto, nel JSX) resta finché non arriva un'interazione
  // di altro tipo, da qualunque schermata.
  const gamepadDetected = useGamepadDetected();
  const audioLocked = useAudioUnlockHint();

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

      {/* Non un gate, solo un avviso: la visuale non si blocca mai per
          questo, vedi useAudioUnlockHint. `pointer-events: none` perché non
          è un pulsante — qualunque tocco/tasto/click ALTROVE sulla pagina
          lo fa sparire da solo (Howler ascolta già lui stesso quegli
          eventi), non serve interagire proprio con questo elemento. */}
      {audioLocked && (
        <div className={styles.audioHint}>
          {gamepadDetected
            ? 'L’audio non può essere sbloccato dal controller — tocca lo schermo o premi un tasto per attivarlo'
            : 'Tocca lo schermo o premi un tasto per attivare l’audio'}
        </div>
      )}
    </div>
  );
}

export default App;
