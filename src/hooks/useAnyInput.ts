import { useEffect, useRef } from 'react';
import { isPaused } from '@/store/pauseStore';

/** Select (8) e Start/Options (9): servono alle impostazioni, alla pausa e al salto delle cutscene, non fanno avanzare i dialoghi. */
const IGNORED_PAD_BUTTONS = new Set([8, 9]);

interface UseAnyInputOptions {
  /** Ascolta solo quando `true` — niente listener/polling nelle altre fasi. */
  enabled: boolean;
}

/**
 * Intercetta "una pressione qualsiasi" — tastiera, mouse/touch, un bottone
 * di un controller — e la traduce in un'unica callback, indipendentemente
 * da quale dispositivo l'ha generata.
 *
 * Il gamepad è il pezzo scomodo: l'API Gamepad del browser non ha un evento
 * affidabile per "bottone premuto" su tutti i browser (Chrome non lo emette
 * affatto), quindi va sondato a ogni fotogramma con `navigator.getGamepads()`
 * e confrontato con lo stato del fotogramma precedente — altrimenti un
 * bottone tenuto premuto ritriggererebbe 60 volte al secondo invece di una
 * volta sola. Se l'API non esiste (browser vecchio, contesto non sicuro),
 * quella parte viene semplicemente ignorata: tastiera/mouse/touch restano
 * comunque validi, stesso trattamento tollerante già usato per l'audio
 * mancante in `useSfx`/`useBackgroundMusic`.
 */
export function useAnyInput(onInput: () => void, { enabled }: UseAnyInputOptions) {
  // Ref, non stato: i chiamanti non avvolgono sempre `onInput` in
  // useCallback, quindi qui dentro potrebbe arrivare una funzione nuova a
  // ogni render — la ref garantisce che i listener vedano sempre l'ultima
  // versione senza dover essere ricreati (e senza il rischio di "chiudere"
  // su una versione vecchia di `phase` letta dal chiamante).
  const callback = useRef(onInput);
  callback.current = onInput;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return; // tasto tenuto premuto: un solo trigger, non uno al frame
      // Esc/Options hanno un significato loro (impostazioni, pausa, salto tenuti): non contano come «un tasto qualsiasi».
      if (event.key === 'Escape' || isPaused()) return;
      callback.current();
    };
    const handlePointerDown = () => {
      if (!isPaused()) callback.current();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    let rafId = 0;
    let prevPressed = new Set<string>();
    const pollGamepads = () => {
      if (typeof navigator.getGamepads === 'function') {
        const pads = navigator.getGamepads();
        const nextPressed = new Set<string>();
        for (const pad of pads) {
          if (!pad) continue;
          pad.buttons.forEach((button, index) => {
            if (!button.pressed) return;
            const key = `${pad.index}:${index}`;
            nextPressed.add(key);
            if (!prevPressed.has(key) && !IGNORED_PAD_BUTTONS.has(index) && !isPaused()) callback.current();
          });
        }
        prevPressed = nextPressed;
      }
      rafId = requestAnimationFrame(pollGamepads);
    };
    rafId = requestAnimationFrame(pollGamepads);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
      cancelAnimationFrame(rafId);
    };
  }, [enabled]);
}
