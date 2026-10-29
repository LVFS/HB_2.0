import { Fragment, useMemo, useRef } from 'react';
import { getWorldLevel, isLevelUnlocked, levels } from '@/data/levels';
import { getWorldName, worlds, type WorldInfo } from '@/data/worlds';
import { usePadNavLayer } from '@/input/padNav';
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
  /** ○/B dal controller: di solito «torna al menu» (con conferma). */
  onBack: () => void;
}

/**
 * L'elenco dei livelli, con sopra la fila dei "mondi" (le città mostrate
 * sulla mappa 3D dietro): cliccare un mondo cambia SOLO la città mostrata,
 * cliccare un livello cambia città E fa partire lo zoom. Un livello
 * bloccato resta visibile (si vede cosa manca) ma disabilitato — vedi
 * `isLevelUnlocked` in `data/levels.ts`; un livello `soon` mostra «Prossimamente»
 * e non si avvia (il blocco vero sta in `LevelSelectScene.handleStartLevel`).
 *
 * Il controller naviga questi elementi (`data-nav`) con croce/stick e conferma con ✕/X: vedi `usePadNavLayer`.
 */
export function LevelListOverlay({ completedLevelIds, activeWorldId, onSelect, onSelectWorld, onBack }: LevelListOverlayProps) {
  // Ordinati per `order` del LIVELLO di ciascun mondo, non per l'ordine
  // dell'array `worlds` — oggi coincidono, ma ordinare esplicitamente evita
  // un bug futuro se `worlds` cambiasse ordine. Fallback a 0 per un mondo
  // senza livelli (non dovrebbe succedere, ma non deve rompere il sort).
  const orderedWorlds = useMemo(
    () => [...worlds].sort((a, b) => (getWorldLevel(a.id)?.order ?? 0) - (getWorldLevel(b.id)?.order ?? 0)),
    []
  );

  // Controller: questo pannello è un livello di navigazione (croce/stick, X conferma, ○ chiede di tornare al menu).
  const panel = useRef<HTMLDivElement>(null);
  usePadNavLayer(panel, true, onBack);

  /** Il mondo è "completato" se il suo (unico, oggi) livello è tra quelli
   * finiti — usato per accendere il connettore verso il mondo successivo. */
  const isWorldCompleted = (world: WorldInfo): boolean => {
    const level = getWorldLevel(world.id);
    return !!level && completedLevelIds.includes(level.id);
  };

  return (
    <div className={ui.panelOverlay}>
      <div ref={panel} className={`${ui.panel} ${styles.panel}`}>
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
                  className={`${ui.secondary} ${styles.worldButton}`}
                  aria-pressed={world.id === activeWorldId}
                  data-nav
                  onClick={() => onSelectWorld(world.id)}
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
                data-nav
                data-nav-default={level.worldId === activeWorldId ? '' : undefined}
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
