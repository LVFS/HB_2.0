import { fragments, totalFragments } from '@/data/fragments';
import { useGameStore } from '@/store/gameStore';
import styles from './GameOverlay.module.css';

// GameOverlay è il piccolo pannello laterale visibile mentre giochi.
// Mostra informazioni utili senza interferire con la scena 3D.
export function GameOverlay() {
  const collectedFragmentIds = useGameStore((state) => state.collectedFragmentIds);

  return (
    <aside className={styles.overlay}>
      {/* Primo blocco: missione e contatore */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Missione</div>
        <div className={styles.text}>Raccogli tutti i frammenti verdi</div>
        <div className={styles.counter}>{collectedFragmentIds.length} / {totalFragments}</div>
      </div>

      {/* Secondo blocco: anteprima dei frammenti */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Anteprima frammenti</div>
        <div className={styles.previewList}>
          {fragments.map((fragment) => (
            <div
              key={fragment.id}
              className={`${styles.previewItem} ${
                collectedFragmentIds.includes(fragment.id) ? styles.collected : ''
              }`}
            >
              {/* Il colore dell'icona corrisponde al frammento nella scena 3D */}
              <span className={styles.badge} style={{ backgroundColor: fragment.color }} />
              <span>{fragment.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Terzo blocco: guida rapida ai controlli */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Controlli</div>
        <div className={styles.controlRow}>
          <span className={styles.controlKey}>W/A/S/D</span>
          <span>Muovi</span>
        </div>
        <div className={styles.controlRow}>
          <span className={styles.controlKey}>Space</span>
          <span>Salta</span>
        </div>
        <div className={styles.controlRow}>
          <span className={styles.controlKey}>Drag</span>
          <span>Ruota telecamera</span>
        </div>
      </div>
    </aside>
  );
}
