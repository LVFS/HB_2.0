import { Fragment, useEffect, useMemo, useState } from 'react';
import { getWorldLevel, isLevelUnlocked, levels } from '@/data/levels';
import { getWorldName, worlds, type WorldInfo } from '@/data/worlds';
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
 * `isLevelUnlocked` in `data/levels.ts`; un livello `soon` mostra «Prossimamente»
 * e non si avvia (il blocco vero sta in `LevelSelectScene.handleStartLevel`).
 *
 * Il ciclo da controller (L1/R1 tra i pulsanti mondo, ✕/A per confermare)
 * resta qui, non sul marker 3D: oggi ogni mondo ha un solo livello, quindi
 * confermare un mondo equivale a selezionare l'unico livello al suo
 * interno — il giorno in cui un mondo avrà più livelli si aggiungerà un
 * secondo livello di ciclo dentro la mappa stessa (vedi `LevelMarker`).
 */
export function LevelListOverlay({ completedLevelIds, activeWorldId, onSelect, onSelectWorld }: LevelListOverlayProps) {
  // Ordinati per `order` del LIVELLO di ciascun mondo, non per l'ordine
  // dell'array `worlds` — oggi coincidono, ma ordinare esplicitamente evita
  // un bug futuro se `worlds` cambiasse ordine. Fallback a 0 per un mondo
  // senza livelli (non dovrebbe succedere, ma non deve rompere il sort).
  const orderedWorlds = useMemo(
    () => [...worlds].sort((a, b) => (getWorldLevel(a.id)?.order ?? 0) - (getWorldLevel(b.id)?.order ?? 0)),
    []
  );

  const [focusedWorldIndex, setFocusedWorldIndex] = useState(() =>
    Math.max(
      0,
      orderedWorlds.findIndex((world) => world.id === activeWorldId)
    )
  );

  // Tiene il fuoco da controller allineato alla città che un click del
  // mouse ha già portato in mostra, invece di lasciarlo indietro su un
  // mondo non più corrispondente.
  useEffect(() => {
    const index = orderedWorlds.findIndex((world) => world.id === activeWorldId);
    if (index >= 0) setFocusedWorldIndex(index);
  }, [activeWorldId, orderedWorlds]);

  useGamepadCycleSelect(
    {
      onPrevious: () => setFocusedWorldIndex((index) => (index - 1 + orderedWorlds.length) % orderedWorlds.length),
      onNext: () => setFocusedWorldIndex((index) => (index + 1) % orderedWorlds.length),
      onConfirm: () => {
        const level = getWorldLevel(orderedWorlds[focusedWorldIndex].id);
        if (level) onSelect(level.id);
      }
    },
    { enabled: true }
  );

  /** Il mondo è "completato" se il suo (unico, oggi) livello è tra quelli
   * finiti — usato per accendere il connettore verso il mondo successivo. */
  const isWorldCompleted = (world: WorldInfo): boolean => {
    const level = getWorldLevel(world.id);
    return !!level && completedLevelIds.includes(level.id);
  };

  return (
    <div className={ui.panelOverlay}>
      <div className={`${ui.panel} ${styles.panel}`}>
        <div className={ui.title}>Seleziona livello</div>
        <p className={ui.bodyText}>Scegli un luogo sulla mappa.</p>

        <div className={styles.worldRow}>
          {orderedWorlds.map((world, index) => {
            const worldLevel = getWorldLevel(world.id);
            return (
              <Fragment key={world.id}>
                {index > 0 && (
                  <span
                    className={`${styles.worldConnector} ${
                      isWorldCompleted(orderedWorlds[index - 1]) ? styles.worldConnectorCompleted : ''
                    }`}
                    aria-hidden="true"
                  />
                )}
                <button
                  type="button"
                  className={`${ui.secondary} ${styles.worldButton} ${index === focusedWorldIndex ? styles.worldButtonFocused : ''}`}
                  aria-pressed={world.id === activeWorldId}
                  onClick={() => {
                    setFocusedWorldIndex(index);
                    onSelectWorld(world.id);
                  }}
                >
                  {worldLevel && (
                    <span className={styles.worldDot} style={{ background: worldLevel.color }} aria-hidden="true" />
                  )}
                  {world.name}
                </button>
              </Fragment>
            );
          })}
        </div>

        <div className={styles.grid}>
          {levels.map((level) => {
            const unlocked = isLevelUnlocked(level, completedLevelIds);
            const completed = completedLevelIds.includes(level.id);
            // Un livello «prossimamente» resta cliccabile (si va a guardare la mappa) ma non si avvia, e non mostra
            // la descrizione: per ora i dati dei livelli senza scena sono segnaposto.
            const soon = level.status === 'soon';
            return (
              <button
                key={level.id}
                type="button"
                className={`${styles.card} ${completed ? styles.cardCompleted : ''}`}
                disabled={!unlocked && !soon}
                onClick={() => onSelect(level.id)}
              >
                <span className={styles.worldLabel}>{getWorldName(level.worldId)}</span>
                <span className={styles.cardName}>{level.name}</span>
                {!soon && <span className={styles.cardDescription}>{level.description}</span>}
                {completed && <span className={styles.completedHint}>Completato ✓</span>}
                {soon && <span className={styles.lockedHint}>Prossimamente</span>}
                {!soon && !unlocked && <span className={styles.lockedHint}>Completa il livello precedente</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
