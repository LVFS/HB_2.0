import { TEXTS } from '../birthdayConfig';
import styles from './GodOfWarTableau.module.css';

interface Props {
  active: boolean;
}

/**
 * Quadro 2 — titolo cerimoniale alla God of War.
 *
 * Cinzel è ispirato ai caratteri romani scolpiti nella pietra: è la stessa
 * radice del lettering dei titoli del gioco. Maiuscolo e molto spaziato,
 * perché è così che si legge un'iscrizione, non un titolo.
 *
 * Il micro-ingrandimento in entrata è una @keyframes e non GSAP: la timeline
 * generale detta QUANDO appare il quadro, il quadro decide COME si presenta.
 * Tenere le due cose separate evita di dover sincronizzare due orologi.
 *
 * La runa sopra il titolo è un simbolo geometrico disegnato a mano (non una
 * copia dell'ascia Leviatano del gioco) che si "incide" con uno
 * stroke-dashoffset — stessa durata/curva di `carve` sul titolo
 * (1.6s, lo stesso cubic-bezier), così leggono come UNA sola incisione,
 * non due animazioni per caso sincronizzate. `pathLength="1"` normalizza la
 * lunghezza di ogni tratto a 1: permette di animare `stroke-dasharray`/
 * `stroke-dashoffset` con lo stesso valore su tratti di lunghezza diversa,
 * senza calcolare la lunghezza reale di ciascuno.
 */
export function GodOfWarTableau({ active }: Props) {
  return (
    <div className={styles.root}>
      {/* Slot opzionale: resta trasparente se il file manca, la texture di
          pietra procedurale sotto fa comunque da base. */}
      <div className={styles.bgImage} />
      {/* <div className={styles.stone} /> */}
      <div className={`${styles.block} ${active ? styles.blockActive : ''}`}>
        <svg className={styles.rune} viewBox="0 0 40 48" aria-hidden="true">
          <g className={styles.runeStroke}>
            <line pathLength="1" x1="20" y1="4" x2="20" y2="44" />
            <line pathLength="1" x1="20" y1="4" x2="34" y2="16" />
            <line pathLength="1" x1="20" y1="22" x2="32" y2="30" />
            <line pathLength="1" x1="20" y1="4" x2="6" y2="16" />
            <line pathLength="1" x1="20" y1="22" x2="8" y2="30" />
          </g>
        </svg>
        <span className={styles.rule} />
        <h1 className={styles.title}>{TEXTS.godOfWar}</h1>
        <span className={styles.rule} />
      </div>
    </div>
  );
}
