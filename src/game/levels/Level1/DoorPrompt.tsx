import type { Ref } from 'react';
import { ActionGlyph } from '@/components/ActionGlyph';
import styles from './SceneManager2D.module.css';

interface DoorPromptProps {
  /** Il contenitore: lo posiziona e lo mostra/nasconde `DoorPromptDriver` (dentro il Canvas) senza passare da uno stato React. */
  promptRef: Ref<HTMLDivElement>;
}

/** Suggerimento «Entra» sopra la porta: HTML fuori dal `<Canvas>`, con l'icona del tasto giusto per l'ultimo dispositivo usato. */
export function DoorPrompt({ promptRef }: DoorPromptProps) {
  return (
    <div ref={promptRef} className={styles.doorPrompt} data-visible="false" aria-hidden="true">
      <span className={styles.hintPill}>
        <ActionGlyph action="interact" label="Entra" />
      </span>
    </div>
  );
}
