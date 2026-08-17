import { useCallback, useState } from 'react';
import { SettingsBar } from '@/components/SettingsBar';
import { levels } from '@/data/levels';
import { useGameStore } from '@/store/gameStore';
import { useProgressStore } from '@/store/progressStore';
import ui from '@/styles/ui.module.css';
import { CloudTransition } from './CloudTransition';
import { LevelListOverlay } from './LevelListOverlay';
import { LevelMapScene } from './LevelMapScene';
import styles from './LevelSelectScene.module.css';

/** Livello mostrato all'ingresso, prima di qualunque scelta: `order === 1`
 * è sempre sbloccato per costruzione (vedi `isLevelUnlocked`), quindi non
 * serve leggere lo store per calcolarlo. */
const FIRST_LEVEL_ID = levels.find((level) => level.order === 1)?.id ?? levels[0].id;

/**
 * Orchestratore della selezione livelli: un'unica scena 3D sempre visibile
 * (`LevelMapScene`) con l'elenco livelli sovrapposto all'inizio, non al
 * posto di uno schermo nero — nessun taglio secco tra "guardare l'elenco" e
 * "vedere la mappa". Possiede solo la fase e le transizioni di stato,
 * stessa filosofia di `MenuScene.tsx`.
 */
export function LevelSelectScene() {
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

  const displayedLevel = levels.find((level) => level.id === displayedLevelId) ?? levels[0];

  const handleSelectLevel = useCallback((levelId: string) => {
    setFocused(true);
    setDisplayedLevelId((current) => {
      if (current !== levelId) {
        // Città diversa da quella già mostrata: la nasconde dietro le
        // nuvole prima di cambiarla, invece di uno scatto secco sotto gli
        // occhi — vedi `handleCloudCovered`, che applica `pendingLevelId`
        // a schermo coperto.
        setPendingLevelId(levelId);
        setCloudTrigger((n) => n + 1);
        return current;
      }
      return levelId;
    });
  }, []);

  const handleCloudCovered = useCallback(() => {
    setPendingLevelId((pending) => {
      if (pending) setDisplayedLevelId(pending);
      return null;
    });
  }, []);

  const handleStartLevel = useCallback(() => {
    setSelectedLevel(displayedLevel.id);
    resetProgress();
    setScreen('game');
  }, [displayedLevel, setSelectedLevel, resetProgress, setScreen]);

  return (
    <div className="scene-shell">
      <LevelMapScene level={displayedLevel} focused={focused} />

      {focused ? (
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
          onSelect={handleSelectLevel}
          onBack={() => setScreen('menu')}
        />
      )}

      <SettingsBar />

      <CloudTransition trigger={cloudTrigger} onCovered={handleCloudCovered} />
    </div>
  );
}
