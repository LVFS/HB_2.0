import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

interface UseXTriggerOptions {
  enabled?: boolean;
}

/**
 * Richiama `onReach` UNA VOLTA SOLA quando `getX()` supera `thresholdX` (mai
 * più, anche tornando indietro) — stesso principio one-shot di
 * `wasOverlapping` in `DemoObstacle.tsx`. Pensato per i trigger segnaposto
 * di `data/level1/triggers.ts` (Fase 4 del piano, vedi
 * docs/PIANO_LIVELLO1_2D.md): quando arriveranno le zone vere lette da
 * LDtk, questa firma resta la stessa, cambiano solo i numeri.
 */
export function useXTrigger(
  getX: () => number,
  thresholdX: number,
  onReach: () => void,
  { enabled = true }: UseXTriggerOptions = {}
) {
  const fired = useRef(false);

  useFrame(() => {
    if (!enabled || fired.current) return;
    if (getX() >= thresholdX) {
      fired.current = true;
      onReach();
    }
  });
}
