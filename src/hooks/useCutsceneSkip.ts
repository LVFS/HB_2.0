import { useCallback, useEffect, useRef, useState } from 'react';

/** Per quanto (ms) si tiene premuto per saltare: abbastanza da non scattare per sbaglio. */
export const CUTSCENE_SKIP_HOLD_MS = 600;
const SKIP_KEYS = new Set(['Escape', 'Enter']);

interface UseCutsceneSkipOptions {
  /** Ascolta solo quando `true` (es. non durante il caricamento). */
  enabled?: boolean;
  holdMs?: number;
}

/**
 * Saltare una cutscene TENENDO premuto `Esc`/`Invio` (o il bottone a schermo)
 * per ~0.6 s — mai con un tap, per evitare salti accidentali. Restituisce
 * `progress` (0-1, per la barra) e i gestori del bottone. `onSkip` scatta UNA
 * volta sola.
 *
 * Regola per chi scrive una cutscene (vedi `docs/FASE8_TUNNEL_INSEGUIMENTO.md`,
 * sez. 9): ha una funzione `applyFinalState()` IDEMPOTENTE (posizioni finali,
 * flag nello store, fase successiva) e una timeline; "salta" = portare la
 * timeline alla fine + `applyFinalState()`. Così saltare non lascia mai la
 * scena a metà.
 */
export function useCutsceneSkip(onSkip: () => void, { enabled = true, holdMs = CUTSCENE_SKIP_HOLD_MS }: UseCutsceneSkipOptions = {}) {
  const [progress, setProgress] = useState(0);
  const holdStart = useRef<number | null>(null);
  const raf = useRef<number | undefined>(undefined);
  const fired = useRef(false);
  // L'ultima `onSkip` senza ri-registrare i listener a ogni render.
  const callback = useRef(onSkip);
  callback.current = onSkip;

  const stop = useCallback(() => {
    holdStart.current = null;
    if (raf.current !== undefined) cancelAnimationFrame(raf.current);
    raf.current = undefined;
    setProgress(0);
  }, []);

  const tick = useCallback(() => {
    if (holdStart.current === null) return;
    const value = Math.min(1, (performance.now() - holdStart.current) / holdMs);
    setProgress(value);
    if (value >= 1) {
      if (!fired.current) {
        fired.current = true;
        callback.current();
      }
      holdStart.current = null;
      raf.current = undefined;
      return;
    }
    raf.current = requestAnimationFrame(tick);
  }, [holdMs]);

  const start = useCallback(() => {
    if (!enabled || fired.current || holdStart.current !== null) return;
    holdStart.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  }, [enabled, tick]);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (SKIP_KEYS.has(event.key) && !event.repeat) start();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (SKIP_KEYS.has(event.key) && !fired.current) stop();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (raf.current !== undefined) cancelAnimationFrame(raf.current);
    };
  }, [enabled, start, stop]);

  return {
    progress,
    /** Gestori del bottone a schermo (tenere premuto, mouse o touch). */
    buttonProps: { onPointerDown: start, onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop }
  };
}
