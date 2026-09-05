import { useEffect, useRef } from 'react';

/** Stessa mappatura standard già in uso nel ramo degli auguri
 * (`useGamepadNavigation`): 4 = L1/LB, 5 = R1/RB, 0 = tasto frontale in
 * basso (Croce PlayStation / A Xbox). */
const GAMEPAD_BUTTONS = { previous: 4, next: 5, confirm: 0 } as const;

interface UseGamepadCycleSelectHandlers {
  onPrevious: () => void;
  onNext: () => void;
  onConfirm: () => void;
}

interface UseGamepadCycleSelectOptions {
  /** Ascolta solo quando `true` — niente polling quando l'elenco non è a schermo. */
  enabled: boolean;
}

/**
 * Ciclo di selezione generico da controller: L1/R1 spostano un fuoco tra
 * elementi (senza confermare nulla), il tasto frontale conferma quello a
 * fuoco. A differenza di `useGamepadNavigation` (ramo degli auguri, azioni
 * fisse legate a una sequenza) questo hook non sa cosa significhino
 * "precedente"/"successivo"/"conferma" — lo decide chi lo usa (qui, il
 * ciclo tra i pulsanti mondo in `LevelListOverlay`).
 *
 * Stesso schema di rilevazione di `useAnyInput`/`useGamepadNavigation`:
 * polling via `requestAnimationFrame`, edge-detection con un Set di chiavi
 * `pad.index:buttonIndex` per non ritriggerare mentre il bottone resta
 * premuto. Se l'API Gamepad non esiste, non fa nulla — tastiera/mouse
 * restano comunque validi.
 */
export function useGamepadCycleSelect(
  { onPrevious, onNext, onConfirm }: UseGamepadCycleSelectHandlers,
  { enabled }: UseGamepadCycleSelectOptions
) {
  const handlers = useRef({ onPrevious, onNext, onConfirm });
  handlers.current = { onPrevious, onNext, onConfirm };

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator.getGamepads !== 'function') return;

    let rafId = 0;
    let prevPressed = new Set<string>();
    const pollGamepads = () => {
      const pads = navigator.getGamepads();
      const nextPressed = new Set<string>();
      for (const pad of pads) {
        if (!pad) continue;
        for (const [action, buttonIndex] of Object.entries(GAMEPAD_BUTTONS)) {
          const button = pad.buttons[buttonIndex];
          if (!button?.pressed) continue;
          const key = `${pad.index}:${buttonIndex}`;
          nextPressed.add(key);
          if (!prevPressed.has(key)) {
            if (action === 'previous') handlers.current.onPrevious();
            else if (action === 'next') handlers.current.onNext();
            else handlers.current.onConfirm();
          }
        }
      }
      prevPressed = nextPressed;
      rafId = requestAnimationFrame(pollGamepads);
    };
    rafId = requestAnimationFrame(pollGamepads);

    return () => cancelAnimationFrame(rafId);
  }, [enabled]);
}
