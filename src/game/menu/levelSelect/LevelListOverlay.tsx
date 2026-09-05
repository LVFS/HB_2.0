import { useEffect, useState } from 'react';
import { getWorldLevel, isLevelUnlocked, levels } from '@/data/levels';
import { getWorldName, worlds } from '@/data/worlds';
import { useGamepadCycleSelect } from '@/hooks/useGamepadCycleSelect';
import ui from '@/styles/ui.module.css';
import styles from './LevelListOverlay.module.css';

interface LevelListOverlayProps {
  completedLevelIds: string[];
  /** Mondo (città) oggi mostrato sulla mappa 3D — evidenzia il pulsante
   * mondo corrispondente e inizializza il fuoco da controller su di lui. */
  activeWorldId: string;
  onSelect: (levelId: string) => void;
  /** Cambia SOLO la città mostrata, senza zoomare — vedi `handleSelectWorld`
   * in `LevelSelectScene`. */
  onSelectWorld: (worldId: string) => void;
}

/**
 * L'elenco dei livelli, con sopra la fila dei "mondi" (le città mostrate
 * sulla mappa 3D dietro): cliccare un mondo cambia SOLO la città mostrata,
 * cliccare un livello cambia città E fa partire lo zoom. Un livello
 * bloccato resta visibile (si vede cosa manca) ma disabilitato — vedi
 * `isLevelUnlocked` in `data/levels.ts`.
 *
 * Il ciclo da controller (L1/R1 tra i pulsanti mondo, ✕/A per confermare)
 * resta qui, non sul marker 3D: oggi ogni mondo ha un solo livello, quindi
 * confermare un mondo equivale a selezionare l'unico livello al suo
 * interno — il giorno in cui un mondo avrà più livelli si aggiungerà un
 * secondo livello di ciclo dentro la mappa stessa (vedi `LevelMarker`).
 */
export function LevelListOverlay({ completedLevelIds, activeWorldId, onSelect, onSelectWorld }: LevelListOverlayProps) {
  const [focusedWorldIndex, setFocusedWorldIndex] = useState(() =>
    Math.max(
      0,
      worlds.findIndex((world) => world.id === activeWorldId)
    )
  );

  // Tiene il fuoco da controller allineato alla città che un click del
  // mouse ha già portato in mostra, invece di lasciarlo indietro su un
  // mondo non più corrispondente.
  useEffect(() => {
    const index = worlds.findIndex((world) => world.id === activeWorldId);
    if (index >= 0) setFocusedWorldIndex(index);
  }, [activeWorldId]);

  useGamepadCycleSelect(
    {
      onPrevious: () => setFocusedWorldIndex((index) => (index - 1 + worlds.length) % worlds.length),
      onNext: () => setFocusedWorldIndex((index) => (index + 1) % worlds.length),
      onConfirm: () => {
        const level = getWorldLevel(worlds[focusedWorldIndex].id);
        if (level) onSelect(level.id);
      }
    },
    { enabled: true }
  );

  return (
    <div className={ui.panelOverlay}>
      <div className={`${ui.panel} ${styles.panel}`}>
        <div className={ui.title}>Seleziona livello</div>
        <p className={ui.bodyText}>Scegli un luogo sulla mappa.</p>

        <div className={styles.worldRow}>
          {worlds.map((world, index) => (
            <button
              key={world.id}
              type="button"
              className={`${ui.secondary} ${styles.worldButton} ${index === focusedWorldIndex ? styles.worldButtonFocused : ''}`}
              aria-pressed={world.id === activeWorldId}
              onClick={() => {
                setFocusedWorldIndex(index);
                onSelectWorld(world.id);
              }}
            >
              {world.name}
            </button>
          ))}
        </div>

        <div className={styles.grid}>
          {levels.map((level) => {
            const unlocked = isLevelUnlocked(level, completedLevelIds);
            const completed = completedLevelIds.includes(level.id);
            return (
              <button
                key={level.id}
                type="button"
                className={`${styles.card} ${completed ? styles.cardCompleted : ''}`}
                disabled={!unlocked}
                onClick={() => onSelect(level.id)}
              >
                <span className={styles.worldLabel}>{getWorldName(level.worldId)}</span>
                <span className={styles.cardName}>{level.name}</span>
                <span className={styles.cardDescription}>{level.description}</span>
                {completed && <span className={styles.completedHint}>Completato</span>}
                {!unlocked && <span className={styles.lockedHint}>Completa il livello precedente</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
