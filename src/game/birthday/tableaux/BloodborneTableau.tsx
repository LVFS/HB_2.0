import { useMemo } from 'react';
import { TEXTS } from '../birthdayConfig';
import styles from './BloodborneTableau.module.css';

const EMBER_COUNT = 5;
const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Quadro 1 — apertura misteriosa alla Bloodborne.
 *
 * La cornice dorata sottile è la citazione: nei Souls-like introduce il nome
 * di un boss. Qui, al posto del nome, una frase. Sta in basso al centro come
 * l'originale, non al centro dello schermo.
 *
 * La lanterna sopra la cornice è un'icona disegnata a mano (pochi tratti
 * SVG), non un asset del gioco: richiama l'oggetto senza riprodurne nulla.
 * Le braci rosse sono la stessa idea dei pulviscoli di Hollow Knight, ma
 * più rade (5 invece di 20) e rossastre — danno respiro alla vignettatura
 * altrimenti statica senza distogliere dal testo.
 */
export function BloodborneTableau() {
  const embers = useMemo(() => {
    if (prefersReducedMotion()) return [];
    return Array.from({ length: EMBER_COUNT }, (_, i) => ({
      id: i,
      left: `${8 + Math.random() * 84}%`,
      delay: `${Math.random() * 3.5}s`,
      duration: `${9 + Math.random() * 6}s`
    }));
  }, []);

  return (
    <div className={styles.root}>
      {/* Slot opzionale: se public/images/birthday/bloodborne-bg.jpg non
          c'è, questo div resta semplicemente trasparente — il gradiente di
          `.root` sotto fa da base sempre presente, nessuna icona rotta. */}
      <div className={styles.bgImage} />
      <div className={styles.vignette} />

      {embers.map((ember) => (
        <span
          key={ember.id}
          className={styles.ember}
          style={{ left: ember.left, animationDelay: ember.delay, animationDuration: ember.duration }}
        />
      ))}

      <div className={styles.frame}>
        <svg className={styles.icon} viewBox="0 0 24 30" aria-hidden="true">
          <path className={styles.iconStroke} d="M7 8 Q12 2 17 8" />
          <rect className={styles.iconStroke} x="7" y="8" width="10" height="13" rx="1.2" />
          <path className={styles.iconFlame} d="M12 11.5 Q9 16 12 20 Q15 16 12 11.5 Z" />
          <line className={styles.iconStroke} x1="9" y1="24" x2="15" y2="24" />
        </svg>

        <div className={styles.rule}>
          <span className={styles.diamond} />
          <span className={styles.line} />
          <span className={styles.diamond} />
        </div>
        <p className={styles.text}>{TEXTS.bloodborne}</p>
        <div className={styles.rule}>
          <span className={styles.diamond} />
          <span className={styles.line} />
          <span className={styles.diamond} />
        </div>
      </div>
    </div>
  );
}
