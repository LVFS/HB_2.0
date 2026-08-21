import { TEXTS } from '../birthdayConfig';
import styles from './ResidentEvilTableau.module.css';

interface Props {
  active: boolean;
}

/**
 * Quadro 5 — il siparietto.
 *
 * Serve a rompere il tono: dopo tre quadri solenni arriva uno stacco secco,
 * senza dissolvenza (vedi i tempi in birthdayConfig: fadeIn 0.05). Se entrasse
 * in dissolvenza come gli altri la battuta non funzionerebbe — le gag hanno
 * bisogno di essere improvvise.
 *
 * Il timbro è storto di proposito: uno perfettamente allineato sembra un
 * bottone, uno storto sembra sbattuto sopra un referto.
 */
export function ResidentEvilTableau({ active }: Props) {
  return (
    <div className={styles.root}>
      <div className={styles.scanlines} />
      <div className={`${styles.stamp} ${active ? styles.stampActive : ''}`}>
        <span className={styles.stampText}>{TEXTS.residentEvil}</span>
      </div>
    </div>
  );
}
