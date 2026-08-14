import { WALL } from './wallConfig';

export interface WallChunk {
  index: number;
  col: number;
  /** 0 = fila più in basso. */
  row: number;
  /** Centro del blocco in coordinate mondo. */
  position: [number, number, number];
  size: [number, number, number];
  /** Variazione di colore 0..1, deterministica: vedi nota sotto. */
  shade: number;
}

/**
 * Rumore pseudo-casuale ma DETERMINISTICO a partire da un indice.
 *
 * Perché non Math.random(): il muro viene disegnato da due componenti diversi
 * (Wall quando è intatto, WallShatter quando esplode) e al momento dello
 * scambio i blocchi devono avere esattamente lo stesso colore, altrimenti si
 * vedrebbe un lampo. Con Math.random() i due componenti otterrebbero valori
 * diversi; così invece l'indice produce sempre lo stesso numero.
 */
function hashNoise(index: number): number {
  const x = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Calcola la griglia di blocchi del muro.
 *
 * È una funzione pura: nessun riferimento a React, a Three o a Rapier. Questo
 * la rende l'unica fonte di verità sulla forma del muro, condivisa da tutti i
 * componenti, e permette di testarla senza montare niente.
 */
export function buildWallChunks(): WallChunk[] {
  const { cols, rows, width, height, depth, gap, center } = WALL;

  const cellW = width / cols;
  const cellH = height / rows;
  // La fessura si ricava restringendo il blocco, non allargando la cella:
  // così il muro mantiene le dimensioni totali dichiarate in config.
  const size: [number, number, number] = [cellW - gap, cellH - gap, depth];

  const chunks: WallChunk[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      chunks.push({
        index,
        col,
        row,
        position: [
          center[0] - width / 2 + cellW * (col + 0.5),
          center[1] + cellH * (row + 0.5),
          center[2]
        ],
        size,
        shade: hashNoise(index)
      });
    }
  }

  return chunks;
}

/**
 * Il layout è statico, quindi lo calcoliamo una volta sola all'import invece
 * di rifarlo a ogni mount con useMemo.
 */
export const wallChunks = buildWallChunks();
