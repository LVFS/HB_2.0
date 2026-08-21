import { useMemo } from 'react';
import { TEXTS } from '../birthdayConfig';
import styles from './HollowKnightTableau.module.css';

const MOTE_COUNT = 20;
const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Quadro 3 — il sussurro. È il beat più lento della sequenza ed è qui che va
 * il messaggio vero: tutto il resto gli fa da cornice.
 *
 * Niente di appariscente apposta. L'unico movimento sono pulviscoli che
 * salgono piano, come nelle grotte silenziose del gioco: servono a impedire
 * che l'immagine sembri congelata mentre si legge, non a farsi notare.
 */
export function HollowKnightTableau() {
  const motes = useMemo(() => {
    if (prefersReducedMotion()) return [];
    return Array.from({ length: MOTE_COUNT }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      // Come per i petali: ritardi contenuti, o metà pulviscoli non farebbero
      // in tempo a entrare in scena prima che il quadro sia già svanito.
      delay: `${Math.random() * 2.6}s`,
      duration: `${7 + Math.random() * 5}s`,
      size: `${1 + Math.random() * 2}px`
    }));
  }, []);

  return (
    <div className={styles.root}>
      {motes.map((mote) => (
        <span
          key={mote.id}
          className={styles.mote}
          style={{
            left: mote.left,
            width: mote.size,
            height: mote.size,
            animationDelay: mote.delay,
            animationDuration: mote.duration
          }}
        />
      ))}
      <p className={styles.text}>{TEXTS.hollowKnight}</p>
    </div>
  );
}
