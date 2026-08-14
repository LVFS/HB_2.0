/**
 * Tutti i numeri del muro in un posto solo.
 *
 * Il layout viene calcolato da questi valori, quindi cambiare `cols`/`rows`
 * o le dimensioni non richiede di toccare nessun componente.
 */
export const WALL = {
  /** Blocchi in orizzontale. cols * rows = numero di corpi fisici. */
  cols: 16,
  /** Blocchi in verticale. */
  rows: 11,
  width: 40,
  height: 26,
  depth: 1.8,
  /** Fessura tra un blocco e l'altro: rende visibile la muratura. */
  gap: 0.05,
  /** Centro della base del muro nel mondo. */
  center: [0, 0, -8] as [number, number, number]
} as const;

/** Numero totale di chunk: usato per dimensionare l'InstancedMesh. */
export const CHUNK_COUNT = WALL.cols * WALL.rows;

/** Coordinata z della faccia frontale del muro (quella rivolta alla camera). */
export const WALL_FRONT_Z = WALL.center[2] + WALL.depth / 2;

/**
 * Forza degli impulsi.
 *
 * ATTENZIONE, è il punto dove si sbaglia più spesso: un impulso non è una
 * velocità, è massa × variazione-di-velocità. Un blocco di 2.5 × 2.4 × 1.8
 * con densità 1 pesa circa 10 kg, quindi per spedirlo via a ~10 m/s serve un
 * impulso di ~100, non di 5. Se cambi le dimensioni dei blocchi, la massa
 * cambia con il cubo e questi valori vanno ritarati.
 */
export const IMPULSE = {
  base: 200,
  torque: 62
} as const;

/** Le varianti di rottura disponibili. */
export type BreakVariant = 'radial' | 'collapse' | 'punch';

/**
 * Da dove parte la rottura, per ogni variante.
 * Per la variante `punch` questo valore verrà sostituito, in futuro, dalla
 * posizione reale del pugno del personaggio (vedi docs/MENU_INTRO.md).
 */
export const VARIANT_ORIGIN: Record<BreakVariant, [number, number, number]> = {
  radial: [0, WALL.height * 0.55, WALL_FRONT_Z],
  collapse: [0, 0, WALL_FRONT_Z],
  punch: [-4, WALL.height * 0.42, WALL_FRONT_Z + 2]
};

/**
 * Secondi tra l'inizio della sequenza e il momento in cui il muro incassa.
 *
 * Per `punch` è più lungo perché è il tempo di caricare il colpo: è esattamente
 * il valore che andrà sostituito con l'istante in cui il pugno tocca il muro
 * nella clip esportata da Blender. Camera, audio e impulsi leggono tutti da
 * qui, quindi cambiando questo numero restano sincronizzati da soli.
 */
export const VARIANT_IMPACT_DELAY: Record<BreakVariant, number> = {
  radial: 0.1,
  collapse: 0.1,
  punch: 0.55
};
