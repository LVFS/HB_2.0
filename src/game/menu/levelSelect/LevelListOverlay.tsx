import { isLevelUnlocked, levels } from '@/data/levels';
import ui from '@/styles/ui.module.css';
import styles from './LevelListOverlay.module.css';

interface LevelListOverlayProps {
  completedLevelIds: string[];
  onSelect: (levelId: string) => void;
  onBack: () => void;
}

/**
 * L'elenco dei livelli: sostituisce i vecchi cilindri cliccabili nella
 * scena 3D condivisa. Un livello bloccato resta visibile (si vede cosa
 * manca) ma disabilitato — vedi `isLevelUnlocked` in `data/levels.ts`.
 */
export function LevelListOverlay({ completedLevelIds, onSelect, onBack }: LevelListOverlayProps) {
  return (
    <div className={ui.panelOverlay}>
      <div className={`${ui.panel} ${styles.panel}`}>
        <div className={ui.title}>Seleziona livello</div>
        <p className={ui.bodyText}>Scegli un luogo sulla mappa.</p>

        <div className={styles.grid}>
          {levels.map((level) => {
            const unlocked = isLevelUnlocked(level, completedLevelIds);
            const completed = completedLevelIds.includes(level.id);
            return (
              <button
                key={level.id}
                type="button"
                className={styles.card}
                disabled={!unlocked}
                onClick={() => onSelect(level.id)}
              >
                <span className={styles.cardName}>{level.name}</span>
                <span className={styles.cardDescription}>{level.description}</span>
                {completed && <span className={styles.completedHint}>Completato</span>}
                {!unlocked && <span className={styles.lockedHint}>Completa il livello precedente</span>}
              </button>
            );
          })}
        </div>

        <button className={ui.secondary} onClick={onBack}>
          Torna al menu
        </button>
      </div>
    </div>
  );
}
