import type { BreakVariant } from '../wallConfig';
import { collapseBreak } from './collapse';
import { punchBreak } from './punch';
import { radialBreak } from './radial';
import type { BreakContext, BreakPattern, ChunkKick } from './types';

export type { BreakContext, BreakPattern, ChunkKick } from './types';

/**
 * Il registro delle varianti. Per aggiungerne una:
 *   1. scrivi la funzione in un file accanto a questi
 *   2. aggiungi il nome a `BreakVariant` in wallConfig.ts
 *   3. registrala qui
 * Il tipo Record obbliga TypeScript a segnalare il punto 3 se lo dimentichi.
 */
export const breakPatterns: Record<BreakVariant, BreakPattern> = {
  radial: radialBreak,
  collapse: collapseBreak,
  punch: punchBreak
};

/** Etichette per la UI: stanno qui così l'overlay non conosce le implementazioni. */
export const breakVariantLabels: Record<BreakVariant, string> = {
  radial: 'Esplosione',
  collapse: 'Crollo',
  punch: 'Pugno'
};

/**
 * Applica una variante e restituisce gli impulsi ORDINATI PER RITARDO.
 *
 * L'ordinamento è fatto qui una volta sola perché il consumatore
 * (WallShatter) possa limitarsi a scorrere la lista con un cursore, invece di
 * rovistare in tutti gli impulsi a ogni fotogramma.
 */
export function planBreak(variant: BreakVariant, context: BreakContext): ChunkKick[] {
  return [...breakPatterns[variant](context)].sort((a, b) => a.delay - b.delay);
}
