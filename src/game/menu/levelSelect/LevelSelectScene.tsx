import { useCallback, useRef, useState } from 'react';
import { HomeButton } from '@/components/HomeButton';
import { SettingsBar } from '@/components/SettingsBar';
import { getWorldLevel, levels } from '@/data/levels';
import { useGameStore } from '@/store/gameStore';
import { useProgressStore } from '@/store/progressStore';
import ui from '@/styles/ui.module.css';
import { CAPSULE_TIMING } from './capsuleConfig';
import { CloudTransition } from './CloudTransition';
import { LevelListOverlay } from './LevelListOverlay';
import { LevelMapScene } from './LevelMapScene';
import styles from './LevelSelectScene.module.css';

/** Livello mostrato all'ingresso, prima di qualunque scelta: `order === 1`
 * è sempre sbloccato per costruzione (vedi `isLevelUnlocked`), quindi non
 * serve leggere lo store per calcolarlo. */
const FIRST_LEVEL_ID = levels.find((level) => level.order === 1)?.id ?? levels[0].id;

interface LevelSelectSceneProps {
  /** Fade to white di chiusura sequenza — vive in `App`, vedi lì il
   * perché (stesso meccanismo già usato da `MenuScene`, esteso qui per
   * coprire il taglio verso `SceneManager` alla fine della sequenza
   * capsula). */
  onWhiteout: (active: boolean) => void;
}

/**
 * Orchestratore della selezione livelli: un'unica scena 3D sempre visibile
 * (`LevelMapScene`) con l'elenco livelli sovrapposto all'inizio, non al
 * posto di uno schermo nero — nessun taglio secco tra "guardare l'elenco" e
 * "vedere la mappa". Possiede solo la fase e le transizioni di stato,
 * stessa filosofia di `MenuScene.tsx`.
 */
export function LevelSelectScene({ onWhiteout }: LevelSelectSceneProps) {
  const setScreen = useGameStore((state) => state.setScreen);
  const setSelectedLevel = useGameStore((state) => state.setSelectedLevel);
  const resetProgress = useGameStore((state) => state.resetProgress);
  const completedLevelIds = useProgressStore((state) => state.completedLevelIds);

  const [displayedLevelId, setDisplayedLevelId] = useState(FIRST_LEVEL_ID);
  // `false`: inquadratura d'insieme, elenco livelli sopra. `true`: camera
  // dollata sul marker scelto, elenco nascosto — vedi `LevelMapScene`
  // (`CameraRig`) per chi possiede davvero la camera nei due casi.
  const [focused, setFocused] = useState(false);
  // Solo la callback serve: il valore si legge dentro l'updater funzionale
  // di `handleCloudCovered`, mai direttamente nel render.
  const [, setPendingLevelId] = useState<string | null>(null);
  const [cloudTrigger, setCloudTrigger] = useState(0);
  // Un ciclo nuvole è in corso da quando parte la copertura a quando le
  // nuvole sono di nuovo fuori schermo (`handleCloudCleared`) — non solo
  // fino al cambio città (`handleCloudCovered`), altrimenti una nuova
  // richiesta durante l'uscita romperebbe comunque il ciclo a metà.
  const isTransitioningRef = useRef(false);
  // Città dell'ultimo click arrivato MENTRE un ciclo era già in corso: non
  // fa partire un nuovo ciclo GSAP sovrapposto (che ucciderebbe quello in
  // corso a metà, lasciando le nuvole a un fotogramma intermedio), viene
  // applicata solo quando il ciclo corrente si è chiuso del tutto.
  const queuedLevelIdRef = useRef<string | null>(null);

  const displayedLevel = levels.find((level) => level.id === displayedLevelId) ?? levels[0];

  const startCloudTransitionTo = useCallback((levelId: string) => {
    isTransitioningRef.current = true;
    setPendingLevelId(levelId);
    setCloudTrigger((n) => n + 1);
  }, []);

  /**
   * Cambia SOLO la città mostrata sulla mappa 3D (dietro le nuvole se
   * diversa da quella attuale) — riusata sia da chi sceglie un mondo
   * (`handleSelectWorld`, niente zoom) sia da chi sceglie un livello vero
   * (`handleSelectLevel`, che ci aggiunge lo zoom).
   */
  const changeDisplayedCity = useCallback(
    (levelId: string) => {
      setDisplayedLevelId((current) => {
        if (current !== levelId) {
          // Città diversa da quella già mostrata: la nasconde dietro le
          // nuvole prima di cambiarla, invece di uno scatto secco sotto gli
          // occhi — vedi `handleCloudCovered`, che applica `pendingLevelId`
          // a schermo coperto. Se un ciclo è già in corso, si accoda invece
          // di sovrapporsi (vedi `queuedLevelIdRef` sopra).
          if (isTransitioningRef.current) {
            queuedLevelIdRef.current = levelId;
          } else {
            startCloudTransitionTo(levelId);
          }
          return current;
        }
        queuedLevelIdRef.current = null;
        return levelId;
      });
    },
    [startCloudTransitionTo]
  );

  /** Pulsante "mondo": cambia la città mostrata, non tocca lo zoom — vedi
   * "Parte 1" del piano. */
  const handleSelectWorld = useCallback(
    (worldId: string) => {
      const level = getWorldLevel(worldId);
      if (level) changeDisplayedCity(level.id);
    },
    [changeDisplayedCity]
  );

  /** Selezione di un livello vero (elenco o marker 3D): cambia città E fa
   * partire lo zoom. */
  const handleSelectLevel = useCallback(
    (levelId: string) => {
      setFocused(true);
      changeDisplayedCity(levelId);
    },
    [changeDisplayedCity]
  );

  const handleCloudCovered = useCallback(() => {
    setPendingLevelId((pending) => {
      if (pending) setDisplayedLevelId(pending);
      return null;
    });
  }, []);

  const handleCloudCleared = useCallback(() => {
    isTransitioningRef.current = false;
    const queued = queuedLevelIdRef.current;
    queuedLevelIdRef.current = null;
    if (!queued) return;
    setDisplayedLevelId((current) => {
      if (current !== queued) startCloudTransitionTo(queued);
      return current;
    });
  }, [startCloudTransitionTo]);

  // `true` dal click su "Avvia livello" fino al taglio vero e proprio:
  // nasconde elenco/controlli/angolo in alto per lasciare la scena pulita
  // durante la sequenza capsula-impatto-zoom (Parte E, "Stellar Blade").
  const [launching, setLaunching] = useState(false);
  const [launchTrigger, setLaunchTrigger] = useState(0);
  const [flashActive, setFlashActive] = useState(false);

  /** Fa partire la sequenza — non cambia schermata subito: quello lo fa
   * `handleSequenceComplete`, a sequenza (capsula + impatto + pausa)
   * conclusa. Un contatore, non un booleano: un secondo "Avvia livello"
   * nella stessa sessione (improbabile ma non impossibile con `launching`
   * come guard) deve poter far ripartire l'effetto in `CapsuleSequence`
   * anche se il valore logico "sto lanciando" non cambierebbe da solo. */
  const handleStartLevel = useCallback(() => {
    if (launching) return;
    setLaunching(true);
    setLaunchTrigger((n) => n + 1);
  }, [launching]);

  const handleImpactFlash = useCallback(() => {
    setFlashActive(true);
    window.setTimeout(() => setFlashActive(false), CAPSULE_TIMING.flashDuration * 1000);
  }, []);

  /** Sequenza conclusa: accende il whiteout globale (`App.tsx`) e cambia
   * davvero schermata un istante dopo, quando il bianco ha già coperto lo
   * schermo (la sua transizione CSS dura 0.5s, vedi `App.module.css`). */
  const handleSequenceComplete = useCallback(() => {
    onWhiteout(true);
    window.setTimeout(() => {
      setSelectedLevel(displayedLevel.id);
      resetProgress();
      setScreen('game');
    }, 550);
  }, [displayedLevel, setSelectedLevel, resetProgress, setScreen, onWhiteout]);

  return (
    <div className="scene-shell">
      <LevelMapScene
        level={displayedLevel}
        focused={focused}
        onActivateMarker={() => handleSelectLevel(displayedLevel.id)}
        launchTrigger={launchTrigger}
        onImpactFlash={handleImpactFlash}
        onSequenceComplete={handleSequenceComplete}
      />

      <div className={`${styles.impactFlash} ${flashActive ? styles.impactFlashActive : ''}`} />

      {!launching &&
        (focused ? (
          <div className={styles.controls}>
            <button className={ui.secondary} onClick={() => setFocused(false)}>
              Elenco livelli
            </button>
            <button className={ui.primary} onClick={handleStartLevel}>
              Avvia livello
            </button>
          </div>
        ) : (
          <LevelListOverlay
            completedLevelIds={completedLevelIds}
            activeWorldId={displayedLevel.worldId}
            onSelect={handleSelectLevel}
            onSelectWorld={handleSelectWorld}
          />
        ))}

      {!launching && (
        <div className={styles.topRightBar}>
          <HomeButton onClick={() => setScreen('menu')} />
          <SettingsBar />
        </div>
      )}

      <CloudTransition trigger={cloudTrigger} onCovered={handleCloudCovered} onCleared={handleCloudCleared} />
    </div>
  );
}
