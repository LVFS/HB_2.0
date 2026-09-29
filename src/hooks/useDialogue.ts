import { useState } from 'react';
import { useAnyInput } from './useAnyInput';

interface UseDialogueOptions {
  /** Ascolta l'input solo quando `true` — una fase di dialogo non attiva
   *  non deve far avanzare un indice che nessuno sta mostrando. */
  enabled?: boolean;
}

/**
 * Avanza un array di battute una per pressione (`useAnyInput`, tastiera/
 * mouse-touch/gamepad indifferentemente). Generico su `T`: non conosce la
 * forma di una riga (`DialogueLine` in `data/dialogues/level1_intro.ts`),
 * così qualunque dialogo futuro può riusarlo senza importare un tipo da un
 * file di dati specifico di un'altra scena.
 */
export function useDialogue<T>(lines: T[], { enabled = true }: UseDialogueOptions = {}) {
  const [index, setIndex] = useState(0);
  const isDone = index >= lines.length;

  useAnyInput(
    () => {
      if (!isDone) setIndex((current) => current + 1);
    },
    { enabled: enabled && !isDone }
  );

  return {
    currentLine: isDone ? null : lines[index],
    isDone
  };
}
