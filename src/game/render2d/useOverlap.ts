import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { aabbOverlap, type AABB } from './collision';

interface UseOverlapCallbacks {
  /** Il primo fotogramma in cui le due box iniziano a sovrapporsi. */
  onEnter?: () => void;
  /** Ogni fotogramma in cui restano sovrapposte (incluso quello di onEnter). */
  onStay?: () => void;
  /** Il primo fotogramma in cui smettono di sovrapporsi. */
  onExit?: () => void;
}

/**
 * Test rettangolo/rettangolo ripetuto ad ogni fotogramma in `useFrame`,
 * con semantica enter/stay/exit — stessa forma di `onIntersectionEnter` di
 * Rapier (già nota nel progetto, vedi CLAUDE.md), ma senza fisica sotto:
 * `getBoxA`/`getBoxB` sono funzioni perché le posizioni vivono in ref, non
 * in stato React (cambiano ogni frame, vedi le regole architetturali).
 * Un box `null` (es. un bersaglio non ancora spawnato) salta il test senza
 * disattivare l'hook.
 */
export function useOverlap(
  getBoxA: () => AABB | null,
  getBoxB: () => AABB | null,
  { onEnter, onStay, onExit }: UseOverlapCallbacks,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const wasOverlapping = useRef(false);

  useFrame(() => {
    if (!enabled) return;

    const a = getBoxA();
    const b = getBoxB();
    const overlapping = a !== null && b !== null && aabbOverlap(a, b);

    if (overlapping && !wasOverlapping.current) onEnter?.();
    if (overlapping) onStay?.();
    if (!overlapping && wasOverlapping.current) onExit?.();

    wasOverlapping.current = overlapping;
  });
}
