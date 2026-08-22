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
 *
 * Il simbolo di rischio biologico dietro il timbro è il simbolo universale
 * (non un'icona proprietaria di Resident Evil — nessun gioco lo possiede),
 * disegnato a mano in SVG e tenuto molto tenue, in filigrana. Il glitch RGB
 * (due `<span>` dello stesso testo, sfalsati in rosso/ciano) scatta insieme
 * a `slam`: rinforza la citazione VHS già presente nelle `.scanlines` nello
 * stesso istante in cui il timbro "atterra".
 */
export function ResidentEvilTableau({ active }: Props) {
  return (
    <div className={styles.root}>
      {/* Slot opzionale: resta trasparente se il file manca, lo sfondo
          scuro di `.root` fa comunque da base. */}
      <div className={styles.bgImage} />
      <div className={styles.scanlines} />

      <svg className={styles.biohazard} viewBox="0 0 120 120" aria-hidden="true">
        <g fill="currentColor">
          <circle cx="60" cy="60" r="7" />
          <path transform="rotate(0 60 60)" d="M60,60 L60,30 A18,18 0 1,1 41,42 Z" />
          <path transform="rotate(120 60 60)" d="M60,60 L60,30 A18,18 0 1,1 41,42 Z" />
          <path transform="rotate(240 60 60)" d="M60,60 L60,30 A18,18 0 1,1 41,42 Z" />
        </g>
      </svg>

      <div className={`${styles.stamp} ${active ? styles.stampActive : ''}`}>
        <span className={styles.stampText}>{TEXTS.residentEvil}</span>
        {active && (
          <>
            <span aria-hidden="true" className={`${styles.stampText} ${styles.glitchRed}`}>
              {TEXTS.residentEvil}
            </span>
            <span aria-hidden="true" className={`${styles.stampText} ${styles.glitchCyan}`}>
              {TEXTS.residentEvil}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
