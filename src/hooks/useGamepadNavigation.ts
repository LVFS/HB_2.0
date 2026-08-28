import { useEffect, useRef } from 'react';

/**
 * Mappatura standard dell'API Gamepad per i pad riconosciuti come tali
 * (Xbox, PlayStation, e la maggior parte dei pad generici): 4 = levetta
 * dorsale sinistra (L1/LB), 5 = levetta dorsale destra (R1/RB), 0 = tasto
 * frontale in basso (Croce su PlayStation, A su Xbox), 9 = Start/Options.
 */
const GAMEPAD_BUTTONS = { back: 4, advance: 5, interact: 0, toggleControls: 9 } as const;

interface UseGamepadNavigationHandlers {
  onBack: () => void;
  onAdvance: () => void;
  onInteract: () => void;
  onToggleControls: () => void;
  /** Chiamato a OGNI pressione rilevata, oltre alla callback specifica
   * dell'azione — usato da `useInputMethod` per sapere "è appena successo
   * qualcosa da joystick" senza un secondo sondaggio dedicato. */
  onAnyInput?: () => void;
}

interface UseGamepadNavigationOptions {
  /** Ascolta solo quando `true` — niente polling nelle altre fasi. */
  enabled: boolean;
}

/**
 * Naviga la sequenza di auguri da controller: L1 indietro, R1 avanti,
 * tasto d'interazione per accendere/spegnere la riproduzione automatica,
 * Start/Options per mostrare/nascondere i controlli a schermo a comando.
 *
 * Stesso schema di rilevazione di `useAnyInput` (polling via
 * `requestAnimationFrame` + un Set di bottoni già premuti, per non
 * ritriggerare 60 volte al secondo mentre si tiene premuto) — ma filtrato
 * sui quattro indici sopra invece di reagire a un bottone qualsiasi: qui
 * serve distinguere QUALE bottone è stato premuto, `useAnyInput` resta
 * intatto per il menu principale dove non importa quale. Se l'API Gamepad
 * non esiste, l'hook non fa nulla: tastiera/mouse restano comunque validi,
 * stesso trattamento tollerante già usato altrove nel branch per gli asset
 * mancanti.
 */
export function useGamepadNavigation(
  { onBack, onAdvance, onInteract, onToggleControls, onAnyInput }: UseGamepadNavigationHandlers,
  { enabled }: UseGamepadNavigationOptions
) {
  const handlers = useRef({ onBack, onAdvance, onInteract, onToggleControls, onAnyInput });
  handlers.current = { onBack, onAdvance, onInteract, onToggleControls, onAnyInput };

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
            handlers.current.onAnyInput?.();
            if (action === 'back') handlers.current.onBack();
            else if (action === 'advance') handlers.current.onAdvance();
            else if (action === 'interact') handlers.current.onInteract();
            else handlers.current.onToggleControls();
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
