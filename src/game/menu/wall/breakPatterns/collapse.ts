import { IMPULSE } from '../wallConfig';
import type { BreakPattern } from './types';

/** Ritardo tra una fila e la successiva. */
const ROW_STAGGER = 0.085;

/**
 * Crollo: quasi nessun impulso: le fondamenta cedono e il resto lo fa la
 * gravità. La fila più in basso viene liberata per prima, poi via via le
 * altre, così il muro si accartoccia su sé stesso invece di esplodere.
 *
 * È la variante che mostra meglio perché conviene lasciar fare alla fisica:
 * la parte più spettacolare qui non è scritta da nessuna parte.
 */
export const collapseBreak: BreakPattern = ({ chunks }) =>
  chunks.map((chunk) => {
    // Una spintarella orizzontale casuale ma deterministica: senza, i blocchi
    // resterebbero perfettamente impilati e cadrebbero come un blocco unico.
    const nudge = (chunk.shade - 0.5) * IMPULSE.base * 0.12;

    return {
      index: chunk.index,
      impulse: [nudge, 0, nudge * 0.6 - IMPULSE.base * 0.05],
      torque: [
        (chunk.shade - 0.5) * IMPULSE.torque * 0.3,
        0,
        (0.5 - chunk.shade) * IMPULSE.torque * 0.3
      ],
      delay: chunk.row * ROW_STAGGER
    };
  });
