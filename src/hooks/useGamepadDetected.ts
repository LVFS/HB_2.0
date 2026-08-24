import { useEffect, useState } from 'react';

/**
 * Vero dalla prima pressione rilevata su un controller — non importa quale
 * bottone, serve solo sapere che uno è in uso. Resta vero per il resto
 * della sessione una volta rilevato, mai più a `false`.
 *
 * Nessun evento nativo "bottone premuto" esiste per l'API Gamepad (stesso
 * limite già documentato in `useGamepadNavigation`): va sondata a ogni
 * fotogramma con `navigator.getGamepads()`. Vive qui, sollevato a livello
 * di `App`, perché serve in più punti — l'avviso di sblocco audio
 * (`useAudioUnlockHint`) e le etichette L1/R1/AUTO di `BirthdayScene` — e
 * un solo sondaggio condiviso evita di ripeterlo in ognuno.
 */
export function useGamepadDetected(): boolean {
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    if (detected) return;
    if (typeof navigator.getGamepads !== 'function') return;

    let rafId = 0;
    const poll = () => {
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (pad?.buttons.some((button) => button.pressed)) {
          setDetected(true);
          return;
        }
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);

    return () => cancelAnimationFrame(rafId);
  }, [detected]);

  return detected;
}
