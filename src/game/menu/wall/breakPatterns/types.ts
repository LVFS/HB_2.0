import type { WallChunk } from '../buildWallChunks';

/** Tutto quello che una variante di rottura può sapere della scena. */
export interface BreakContext {
  chunks: WallChunk[];
  /** Punto da cui parte la rottura, in coordinate mondo. */
  origin: [number, number, number];
}

/** L'ordine di "colpire un blocco", prodotto da una variante. */
export interface ChunkKick {
  /** Indice del chunk in `chunks`. */
  index: number;
  impulse: [number, number, number];
  torque: [number, number, number];
  /** Secondi dall'inizio della rottura. Permette di sfalsare l'onda d'urto. */
  delay: number;
}

/**
 * Una variante di rottura è SOLO questo: da una descrizione statica del muro
 * produce una lista di impulsi ritardati.
 *
 * Nessun accesso a React, a Three, a Rapier, alla camera o all'audio. È la
 * ragione per cui aggiungere una variante nuova non richiede di toccare la
 * scena: basta scrivere un'altra funzione con questa firma e registrarla in
 * `index.ts`. Ed è anche il motivo per cui la stessa logica funzionerà tale e
 * quale sui frammenti importati da Blender: cambia da dove arrivano i chunk,
 * non cosa ci fai sopra.
 */
export type BreakPattern = (context: BreakContext) => ChunkKick[];
