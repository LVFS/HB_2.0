import { useEffect, useState } from 'react';

/**
 * Vero dalla prima pressione rilevata su un controller — non importa quale
 * bottone, serve solo sapere che uno è in uso. Resta vero per il resto
 * della sessione una volta rilevato, mai più a `false`.
 *
 * Nessun evento nativo "bottone premuto" esiste per l'API Gamepad: va
 * sondata a ogni fotogramma con `navigator.getGamepads()`. Usato da
 * `useAudioUnlockHint` per adattare il testo dell'avviso di sblocco audio
 * a seconda che sia stato rilevato o no un controller.
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
