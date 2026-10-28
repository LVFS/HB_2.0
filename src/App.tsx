import { Suspense, lazy, useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useLevelStore, type LevelPhase } from '@/store/levelStore';
import { useBackgroundMusic } from '@/hooks/useBackgroundMusic';
import { useDevBossShortcut } from '@/hooks/useDevBossShortcut';
import { useAudioUnlockHint } from '@/hooks/useAudioUnlockHint';
import { useGamepadDetected } from '@/hooks/useGamepadDetected';
import { LoadingScreen } from '@/components/LoadingScreen';
import styles from './App.module.css';

// Ogni schermata viene scaricata solo quando serve davvero (code splitting).
const MenuScene = lazy(() =>
  import('@/game/menu/MenuScene').then((module) => ({ default: module.MenuScene }))
);
const LevelSelectScene = lazy(() =>
  import('@/game/menu/levelSelect/LevelSelectScene').then((module) => ({ default: module.LevelSelectScene }))
);
// Livello 1 in 2D (vedi docs/PIANO_LIVELLO1_2D.md): niente Rapier, il
// vecchio commento su "si porta dietro il motore fisico" non vale più —
// resta solo il motivo generico del code-splitting per schermata.
const SceneManager2D = lazy(() =>
  import('@/game/levels/Level1/SceneManager2D').then((module) => ({ default: module.SceneManager2D }))
);
// Interno isometrico dell'Ariston (vedi docs/FASE5_INTERNO_ISOMETRICO.md):
// montato al posto di `SceneManager2D` — mai insieme — quando `levelPhase`
// è `'attivita_stupide'` (decisione presa: quella fase VIVE nell'isometrico,
// non è un momento ancora nello scorrimento laterale).
const SceneManager2DIso = lazy(() =>
  import('@/game/levels/Level1Interior/SceneManager2DIso').then((module) => ({ default: module.SceneManager2DIso }))
);

// Arena del boss (`boss_fase1`, vedi il piano di combattimento): scorrimento
// laterale su un palco chiuso, montata al posto degli altri due — mai insieme.
const SceneManagerBossArena = lazy(() =>
  import('@/game/levels/BossArena/SceneManagerBossArena').then((module) => ({
    default: module.SceneManagerBossArena
  }))
);

// Sotterraneo (`transizione_seconda_spada`): scena scriptata dopo il finale del
// boss, dialogo a distanza fra D (caduto sotto) ed Eve (rimasta di sopra).
const SceneManagerSotterraneo = lazy(() =>
  import('@/game/levels/Sotterraneo/SceneManagerSotterraneo').then((module) => ({
    default: module.SceneManagerSotterraneo
  }))
);

// Tunnel dell'inseguimento (`boss_fase2_tunnel` → `combo_doppia_spada_qte` →
// `fuga_checco`, vedi docs/FASE8_TUNNEL_INSEGUIMENTO.md): UNA scena per tutte e tre
// le fasi, con una piccola macchina a stati interna, così il passaggio fra fasi non
// la rimonta.
const SceneManagerTunnel = lazy(() =>
  import('@/game/levels/Tunnel/SceneManagerTunnel').then((module) => ({
    default: module.SceneManagerTunnel
  }))
);

// Cutscene pre-boss (`dialogo_pre_boss`, FASE 11): i disegni dello storyboard fra la porta
// della Sala boss e l'arena.
const SceneManagerPreBoss = lazy(() =>
  import('@/game/levels/BossArena/SceneManagerPreBoss').then((module) => ({
    default: module.SceneManagerPreBoss
  }))
);

// Lo spazio (`inseguimento_spaziale_cutscene` → `qte_supporto_eve` → `carica_cannone_qte`, FASE 12): UNA scena per le tre
// fasi, come il tunnel.
const SceneManagerSpazio = lazy(() =>
  import('@/game/levels/Spazio/SceneManagerSpazio').then((module) => ({
    default: module.SceneManagerSpazio
  }))
);

// Finale a terra (`dialogo_finale`) e riepilogo con punteggio e titoli di coda (`schermata_punteggio`), FASE 12.
const SceneManagerFinale = lazy(() =>
  import('@/game/levels/Finale/SceneManagerFinale').then((module) => ({
    default: module.SceneManagerFinale
  }))
);
const SceneManagerPunteggio = lazy(() =>
  import('@/game/levels/Finale/SceneManagerPunteggio').then((module) => ({
    default: module.SceneManagerPunteggio
  }))
);

const TUNNEL_PHASES: LevelPhase[] = ['boss_fase2_tunnel', 'combo_doppia_spada_qte', 'fuga_checco'];
const SPACE_PHASES: LevelPhase[] = ['inseguimento_spaziale_cutscene', 'qte_supporto_eve', 'carica_cannone_qte'];
// Le fasi che hanno una scena tutta loro: tutte le altre (intro e cammino fuori dall'Ariston) restano a `SceneManager2D`.
const OWN_SCENE_PHASES: LevelPhase[] = [
  'attivita_stupide',
  'dialogo_pre_boss',
  'boss_fase1',
  'transizione_seconda_spada',
  ...TUNNEL_PHASES,
  ...SPACE_PHASES,
  'dialogo_finale',
  'schermata_punteggio'
];

// App è il componente principale dell'app React.
// Decide quale schermo mostrare in base allo stato globale del gioco.
function App() {
  const screen = useGameStore((state) => state.screen);
  const levelPhase = useLevelStore((state) => state.phase);

  // Musica di sottofondo: vive quanto l'app, indipendente dallo schermo attivo.
  useBackgroundMusic();

  // Solo in sviluppo: F9/F8 saltano all'arena del boss e ritorno.
  useDevBossShortcut();

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

  // Ogni cambio di schermata (o, dentro `screen==='game'`, di `levelPhase` —
  // il passaggio scorrimento laterale ↔ interno isometrico è anch'esso un
  // taglio secco fra due componenti, non un cambio di `screen`) con il
  // bianco ancora attivo lo riporta a trasparente un istante dopo il mount
  // del nuovo contenuto: si legge come "sfuma dal bianco", non come un
  // secondo taglio secco. Chi ha acceso il bianco (`CameraDirector`,
  // `SceneManager2D.handleReachAriston`, `SceneManager2DIso.handleExitToExterior`)
  // decide QUANDO cambiare schermata/fase, non se riportarlo giù: quello è
  // generico, sta qui una volta sola.
  useEffect(() => {
    if (!whiteout) return;
    const id = requestAnimationFrame(() => setWhiteout(false));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- si vuole reagire SOLO al cambio schermata/fase, non a ogni variazione di whiteout (altrimenti si richiuderebbe da solo appena acceso)
  }, [screen, levelPhase]);

  return (
    <div className="app-shell">
      {/* Suspense mostra il fallback mentre il codice della schermata arriva. */}
      <Suspense fallback={<LoadingScreen />}>
        {/* Menu cinematografico in 3D con portone e animazione */}
        {screen === 'menu' && <MenuScene onWhiteout={setWhiteout} />}

        {/* Schermata di selezione dei livelli dopo aver aperto il portone */}
        {screen === 'levelSelect' && <LevelSelectScene onWhiteout={setWhiteout} />}

        {/* Livello 1: scorrimento laterale fuori dall'Ariston, interno
            isometrico dentro (decisione presa: `attivita_stupide` VIVE
            nell'isometrico) — mai insieme, `levelPhase` decide quale. */}
        {screen === 'game' && levelPhase === 'attivita_stupide' && (
          <SceneManager2DIso onWhiteout={setWhiteout} />
        )}
        {screen === 'game' && levelPhase === 'dialogo_pre_boss' && <SceneManagerPreBoss onWhiteout={setWhiteout} />}
        {screen === 'game' && levelPhase === 'boss_fase1' && <SceneManagerBossArena onWhiteout={setWhiteout} />}
        {screen === 'game' && levelPhase === 'transizione_seconda_spada' && <SceneManagerSotterraneo />}
        {screen === 'game' && TUNNEL_PHASES.includes(levelPhase) && <SceneManagerTunnel onWhiteout={setWhiteout} />}
        {screen === 'game' && SPACE_PHASES.includes(levelPhase) && <SceneManagerSpazio onWhiteout={setWhiteout} />}
        {screen === 'game' && levelPhase === 'dialogo_finale' && <SceneManagerFinale onWhiteout={setWhiteout} />}
        {screen === 'game' && levelPhase === 'schermata_punteggio' && <SceneManagerPunteggio />}
        {screen === 'game' && !OWN_SCENE_PHASES.includes(levelPhase) && <SceneManager2D onWhiteout={setWhiteout} />}
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
