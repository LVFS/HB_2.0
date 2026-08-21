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
 */
export function GodOfWarTableau({ active }: Props) {
  return (
    <div className={styles.root}>
      <div className={styles.stone} />
      <div className={`${styles.block} ${active ? styles.blockActive : ''}`}>
        <span className={styles.rule} />
        <h1 className={styles.title}>{TEXTS.godOfWar}</h1>
        <span className={styles.rule} />
      </div>
    </div>
  );
}
