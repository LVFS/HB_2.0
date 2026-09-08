import { useProgress } from '@react-three/drei';
import styles from './LoadingScreen.module.css';

/**
 * Fallback di `<Suspense>` in `App.tsx` mentre arrivano codice/asset di una
 * schermata (`React.lazy`) — vedi `docs/PIANO_CARICAMENTO_ASSET.md`, Fase 5.
 * `useProgress` (drei) legge il `DefaultLoadingManager` di Three.js: copre
 * SOLO gli asset Three (`useGLTF`/`useTexture`/...), non il download del
 * chunk JS della schermata stessa — comunque la stima migliore disponibile
 * senza istrumentare a mano ogni import, e la barra resta comunque un segnale
 * di "sta succedendo qualcosa" anche quando il numero non si muove.
 */
export function LoadingScreen() {
  const progress = useProgress((state) => state.progress);

  return (
    <div className="screen-fallback">
      <span>Caricamento...</span>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${Math.round(progress)}%` }} />
      </div>
    </div>
  );
}
