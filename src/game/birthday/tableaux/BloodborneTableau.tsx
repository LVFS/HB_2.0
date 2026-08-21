import { TEXTS } from '../birthdayConfig';
import styles from './BloodborneTableau.module.css';

/**
 * Quadro 1 — apertura misteriosa alla Bloodborne.
 *
 * La cornice dorata sottile è la citazione: nei Souls-like introduce il nome
 * di un boss. Qui, al posto del nome, una frase. Sta in basso al centro come
 * l'originale, non al centro dello schermo.
 */
export function BloodborneTableau() {
  return (
    <div className={styles.root}>
      <div className={styles.vignette} />
      <div className={styles.frame}>
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
