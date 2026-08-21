import { useMemo } from 'react';
import { AGE, TEXTS } from '../birthdayConfig';
import styles from './ExpeditionTableau.module.css';

const PETAL_COUNT = 24;
const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Props {
  active: boolean;
}

/**
 * Quadro 4 — il tocco pittorico.
 *
 * Se `AGE` è null il numero sparisce e resta la sola frase: il quadro regge
 * lo stesso, non si rompe né lascia un buco. È voluto — l'età di qualcuno non
 * è un dato che si dà per scontato di poter mettere a schermo.
 */
export function ExpeditionTableau({ active }: Props) {
  const petals = useMemo(() => {
    if (prefersReducedMotion()) return [];
    return Array.from({ length: PETAL_COUNT }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      // I ritardi vanno tenuti ben sotto la durata del quadro: un petalo che
      // parte al sesto secondo, su un quadro che ne dura quattro, non lo vede
      // nessuno. Stesso ragionamento per la durata della caduta.
      delay: `${Math.random() * 2.2}s`,
      duration: `${5.5 + Math.random() * 4}s`,
      size: `${5 + Math.random() * 7}px`,
      tilt: `${Math.random() * 360}deg`
    }));
  }, []);

  return (
    <div className={styles.root}>
      {petals.map((petal) => (
        <span
          key={petal.id}
          className={styles.petal}
          style={{
            left: petal.left,
            width: petal.size,
            height: petal.size,
            animationDelay: petal.delay,
            animationDuration: petal.duration,
            rotate: petal.tilt
          }}
        />
      ))}

      <div className={styles.stack}>
        {AGE !== null && (
          <span className={`${styles.number} ${active ? styles.numberActive : ''}`}>{AGE}</span>
        )}
        <p className={styles.caption}>
          {AGE !== null ? TEXTS.expedition : TEXTS.expeditionFallback}
        </p>
      </div>
    </div>
  );
}
