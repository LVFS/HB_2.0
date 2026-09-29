import ui from '@/styles/ui.module.css';
import styles from './DialogueBox.module.css';

export interface DialogueBoxLine {
  speaker: string;
  text: string;
}

interface DialogueBoxProps {
  line: DialogueBoxLine;
}

// Il narratore non ha un "nome parlante" da mostrare: solo il testo, in
// corsivo, per leggersi come una didascalia e non come una battuta.
const NARRATOR_SPEAKERS = new Set(['narratore', 'narrator']);

/**
 * Overlay HTML per una riga di dialogo (Fase 4 del piano, vedi
 * docs/PIANO_LIVELLO1_2D.md) — vive fuori dal `<Canvas>` (stesso motivo del
 * video di salto nel menu: è testo, R3F non sa montare un `<div>`), mostrato
 * dalla schermata quando la fase corrente è "di dialogo". Non sa nulla di
 * `useDialogue`/da dove viene `line`: si limita a disegnarla.
 */
export function DialogueBox({ line }: DialogueBoxProps) {
  const isNarrator = NARRATOR_SPEAKERS.has(line.speaker.toLowerCase());

  return (
    <div className={styles.overlay}>
      <div className={`${ui.panel} ${styles.box}`}>
        {!isNarrator && <div className={ui.label}>{line.speaker}</div>}
        <p className={isNarrator ? styles.narratorText : styles.text}>{line.text}</p>
        <div className={styles.hint}>premi un tasto per continuare</div>
      </div>
    </div>
  );
}
