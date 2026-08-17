/**
 * Percorso dell'ambientazione Blender "Ingresso Oristano" (strada, cartello,
 * case, vegetazione, muro con portone), esportata con +Y Up: le coordinate
 * Blender (X destra, Y profondità, Z alto) diventano in Three
 * `x3 = xB`, `y3 = zB` (altezza), `z3 = -yB` (profondità).
 */
export const MODEL_URL = `${import.meta.env.BASE_URL}models/ingresso-oristano.glb`;

/**
 * Centro del portone in coordinate Three, a metà altezza dell'apertura.
 * Blender: gate a (0, 115, ~6) → Three (0, 6, -115).
 * Usato come punto di rottura (`VARIANT_ORIGIN`) e come target camera per lo
 * shot `break`.
 */
export const GATE_ORIGIN: [number, number, number] = [0, 6, -115];

/** Coordinata Z della faccia frontale del portone (Blender FRONT_Y=113.25). */
export const GATE_FRONT_Z = -115.25;

/**
 * Forza degli impulsi.
 *
 * ATTENZIONE, è il punto dove si sbaglia più spesso: un impulso non è una
 * velocità, è massa × variazione-di-velocità. I pezzi del portone (ante +
 * bande metalliche) hanno una massa diversa dai vecchi cubi 2.5×2.4×1.8: i
 * valori sotto sono un punto di partenza, da ritarare a vista nel browser.
 */
export const IMPULSE = {
  base: 200,
  torque: 62
} as const;

/** Le varianti di rottura disponibili. */
export type BreakVariant = 'radial' | 'collapse' | 'punch';

/**
 * Range (in Three Y, altezza) entro cui pescare un punto d'impatto casuale:
 * copre l'anta del portone (0..11.6 in Blender, stesso valore in Three) con
 * un margine ai due estremi, così l'impatto non capita mai esattamente sul
 * bordo superiore/inferiore, dove sembrerebbe un errore più che una scelta.
 */
const IMPACT_Y_RANGE: [number, number] = [2.2, 9.4];

/**
 * Pesca un'altezza d'impatto casuale, diversa ogni volta che si preme
 * "Gioca". Chi la chiama (`MenuScene`) la genera una volta per rottura e la
 * fa scendere fino a `getVariantOrigin`/alla camera, così tutto — impulsi,
 * inquadratura — resta coerente sullo stesso punto.
 */
export function randomImpactY(): number {
  const [min, max] = IMPACT_Y_RANGE;
  return min + Math.random() * (max - min);
}

/**
 * Da dove parte la rottura, per ogni variante. Tutte puntano al portone: è
 * il cuore dell'impatto. Il muro intero (pannelli + contrafforti) è
 * frantumato in Blender ed è quindi POTENZIALMENTE tutto rompibile, ma solo
 * la zona entro `AFFECT_RADIUS` da questa origine prende vita per davvero —
 * vedi il filtro in `WallShatter.tsx`.
 *
 * `impactY` è casuale a ogni rottura (vedi `randomImpactY`): `collapse` non
 * lo usa apposta, un crollo parte sempre dalle fondamenta, non da un punto a
 * mezz'aria.
 */
export function getVariantOrigin(
  variant: BreakVariant,
  impactY: number
): [number, number, number] {
  switch (variant) {
    case 'radial':
      return [GATE_ORIGIN[0], impactY, GATE_ORIGIN[2]];
    case 'collapse':
      return [GATE_ORIGIN[0], 0, GATE_ORIGIN[2]];
    case 'punch':
      return [GATE_ORIGIN[0] - 1.5, impactY - 1, GATE_FRONT_Z];
  }
}

/**
 * Secondi tra l'inizio della sequenza e il momento in cui il portone incassa.
 *
 * `punch` era più lungo (0.55) per dare il tempo di "caricare il colpo" con
 * uno scatto in 3D prima dell'impatto — quello scatto non c'è più (il video
 * del salto lo sostituisce, vedi `SAITAMA_TIMING.leapVideo` in
 * `characterConfig.ts`): il pugno tocca già il muro quando questa fase
 * inizia, quindi qui serve un valore quasi immediato come le altre varianti,
 * non un'attesa. Camera, audio e impulsi leggono tutti da qui, quindi
 * cambiando questo numero restano sincronizzati da soli.
 */
export const VARIANT_IMPACT_DELAY: Record<BreakVariant, number> = {
  radial: 0.1,
  collapse: 0.1,
  punch: 0.05
};

/**
 * Raggio (distanza ORIZZONTALE dall'origine, lungo la faccia del muro) entro
 * cui un pezzo diventa fisico. L'intero muro è frantumato in Blender —
 * portone, 34 pannelli, 8 contrafforti, ~218 pezzi in tutto — ma un impatto
 * deve coinvolgere solo la zona colpita: oltre questo raggio i pezzi restano
 * scenografia statica, anche se geometricamente "rompibili". Calcolato solo
 * su X/Z (non l'altezza Y) così un'intera colonna vicina al portone — dal
 * pannello più basso al più alto — resta coinvolta, invece di escludere i
 * pezzi in alto perché "lontani" lungo un asse che qui non conta.
 */
export const AFFECT_RADIUS: Record<BreakVariant, number> = {
  radial: 26,
  collapse: 24,
  punch: 20
};
