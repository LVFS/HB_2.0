import { CanvasTexture } from 'three';
import type { CheccoMove, CheccoWarning } from './checcoMoves';

/** Quota Y massima dell'icona d'avviso (bordo alto visibile ≈ 6.3 con la camera attuale). */
export const WARNING_MAX_Y = 5.3;

/**
 * Avviso per gli attacchi non parabili (alla Sekiro): triangolo giallo con "!"
 * e la parola dell'azione giusta ("SALTA", "SCHIVA"). Texture disegnata al volo
 * via `<canvas>`, nessun asset.
 */
const WARNING_STYLES: Record<CheccoWarning, { color: string; lines: string[] }> = {
  salta: { color: '#facc15', lines: ['SALTA'] },
  schiva: { color: '#facc15', lines: ['SCHIVA'] },
  // Cariche: rosso, due soluzioni (parare o contrastare scontrandosi).
  carica: { color: '#dc1f1f', lines: ['PARA O', 'CONTRASTA'] },
  fulmine: { color: '#7dd3fc', lines: ['SCHIVA O', 'PARA IN ARIA'] }
};

function makeWarningTexture(kind: CheccoWarning): CanvasTexture {
  const { color, lines } = WARNING_STYLES[kind];
  return drawWarningTexture(color, lines);
}

/** Triangolo d'avviso con "!" e le righe di testo date, nel colore dato (anche per altre scene, es. il tunnel). */
export function drawWarningTexture(color: string, lines: string[]): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 250;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.strokeStyle = '#1a1200';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(160, 8);
    ctx.lineTo(268, 126);
    ctx.lineTo(52, 126);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1a1200';
    ctx.font = 'bold 84px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 160, 112);
    ctx.font = 'bold 46px sans-serif';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#1a1200';
    lines.forEach((line, i) => {
      const y = 176 + i * 52;
      ctx.strokeText(line, 160, y);
      ctx.fillStyle = color;
      ctx.fillText(line, 160, y);
    });
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export type WarningTextures = Record<CheccoWarning, CanvasTexture>;

/** Una texture per ogni tipo di avviso (da `dispose()` allo smontaggio). */
export function createWarningTextures(): WarningTextures {
  return {
    salta: makeWarningTexture('salta'),
    schiva: makeWarningTexture('schiva'),
    carica: makeWarningTexture('carica'),
    fulmine: makeWarningTexture('fulmine')
  };
}

/** Fine dell'ultima finestra NON parabile di una mossa (secondi dal windup): l'avviso resta fino a lì. */
export function unparryableUntil(move: CheccoMove): number {
  return Math.max(0, ...move.hits.filter((h) => h.unparryable).map((h) => h.start + h.duration));
}
