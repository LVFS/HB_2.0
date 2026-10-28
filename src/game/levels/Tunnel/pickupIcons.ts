import { CanvasTexture } from 'three';
import type { ItemId, PickupKind } from './tunnelConfig';

/**
 * Le icone del tunnel, disegnate al volo su un `<canvas>` (nessun file da caricare):
 * niente asset finché non ci sono quelli veri. Ognuna è una piccola caricatura
 * riconoscibile — Sfera del Drago, scatola-bonus, freccia gialla del Cammino (oggetti del
 * mondo) e Senzu, frutto Gomu Gomu, capelli dorati, Grimorio, claquette (bonus della casella).
 */

const SIZE = 128;
const OUTLINE = '#10131a';

type Ctx = CanvasRenderingContext2D;

function star(ctx: Ctx, cx: number, cy: number, outer: number, inner: number, points = 5): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function sphere(ctx: Ctx): void {
  const gradient = ctx.createRadialGradient(48, 44, 6, 64, 64, 54);
  gradient.addColorStop(0, '#fff3c4');
  gradient.addColorStop(0.35, '#fb923c');
  gradient.addColorStop(1, '#c2410c');
  ctx.fillStyle = gradient;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(64, 64, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Quattro stelle rosse, come la sfera a quattro stelle.
  ctx.fillStyle = '#dc2626';
  for (const [x, y] of [[50, 52], [78, 52], [50, 78], [78, 78]]) {
    star(ctx, x, y, 9, 4);
    ctx.fill();
  }
}

function senzu(ctx: Ctx): void {
  ctx.save();
  ctx.translate(64, 64);
  ctx.rotate(-0.5);
  ctx.fillStyle = '#65a30d';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(0, 0, 50, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#bef264';
  ctx.beginPath();
  ctx.ellipse(-12, -10, 24, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function gomu(ctx: Ctx): void {
  ctx.fillStyle = '#7e22ce';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(64, 70, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Le volute del frutto del diavolo.
  ctx.strokeStyle = '#e9d5ff';
  ctx.lineWidth = 5;
  for (const radius of [14, 26, 38]) {
    ctx.beginPath();
    ctx.arc(64, 70, radius, Math.PI * 0.1, Math.PI * 1.6);
    ctx.stroke();
  }
  ctx.strokeStyle = '#3f6212';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(64, 26);
  ctx.quadraticCurveTo(70, 10, 86, 8);
  ctx.stroke();
}

function saiyan(ctx: Ctx): void {
  // Ciuffo dorato a punte.
  ctx.fillStyle = '#facc15';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(20, 112);
  ctx.lineTo(14, 52);
  ctx.lineTo(36, 74);
  ctx.lineTo(40, 14);
  ctx.lineTo(60, 62);
  ctx.lineTo(78, 8);
  ctx.lineTo(88, 66);
  ctx.lineTo(114, 30);
  ctx.lineTo(108, 112);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.moveTo(44, 100);
  ctx.lineTo(52, 56);
  ctx.lineTo(70, 100);
  ctx.closePath();
  ctx.fill();
}

function grimoire(ctx: Ctx): void {
  ctx.fillStyle = '#3730a3';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 6;
  ctx.fillRect(22, 14, 84, 100);
  ctx.strokeRect(22, 14, 84, 100);
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(98, 20, 10, 88);
  ctx.fillStyle = '#facc15';
  star(ctx, 62, 64, 26, 11);
  ctx.fill();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 4;
  ctx.strokeRect(30, 22, 68, 84);
}

function ciak(ctx: Ctx): void {
  ctx.fillStyle = '#1f2937';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 6;
  ctx.fillRect(14, 50, 100, 62);
  ctx.strokeRect(14, 50, 100, 62);
  // Battente a strisce, leggermente sollevato.
  ctx.save();
  ctx.translate(14, 48);
  ctx.rotate(-0.22);
  ctx.fillStyle = '#f9fafb';
  ctx.fillRect(0, -24, 100, 24);
  ctx.fillStyle = '#111827';
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * 22 + 2, 0);
    ctx.lineTo(i * 22 + 18, 0);
    ctx.lineTo(i * 22 + 28, -24);
    ctx.lineTo(i * 22 + 12, -24);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeRect(0, -24, 100, 24);
  ctx.restore();
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(24, 66, 46, 6);
  ctx.fillRect(24, 82, 70, 6);
}

/** Freccia gialla del Cammino: una pedana piatta con chevron verso l'alto (vista di profilo, quindi larga e bassa). */
function arrow(ctx: Ctx): void {
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = '#facc15';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(4, 40, 120, 48, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#92400e';
  for (const x of [20, 50, 80]) {
    ctx.beginPath();
    ctx.moveTo(x, 78);
    ctx.lineTo(x + 14, 52);
    ctx.lineTo(x + 28, 78);
    ctx.lineTo(x + 21, 78);
    ctx.lineTo(x + 14, 64);
    ctx.lineTo(x + 7, 78);
    ctx.closePath();
    ctx.fill();
  }
}

/** Nuvola Speedy: una nuvoletta gialla e soffice, come quella di Goku bambino. */
function nuvola(ctx: Ctx): void {
  ctx.fillStyle = '#fde68a';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(40, 78, 24, Math.PI * 0.55, Math.PI * 1.5);
  ctx.arc(66, 52, 30, Math.PI * 1.1, Math.PI * 1.95);
  ctx.arc(94, 74, 24, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fffbeb';
  ctx.beginPath();
  ctx.arc(60, 56, 14, 0, Math.PI * 2);
  ctx.fill();
}

/** Gatto randagio: testa rossiccia spelacchiata, un occhio verde e uno bianco (cieco), orecchie a punta e baffi. */
function gatto(ctx: Ctx): void {
  ctx.fillStyle = '#c97b3a';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 6;
  // Orecchie
  for (const [x1, x2, tip] of [[28, 60, 16], [68, 100, 16]] as const) {
    ctx.beginPath();
    ctx.moveTo(x1, 52);
    ctx.lineTo((x1 + x2) / 2, tip);
    ctx.lineTo(x2, 52);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // Testa con il bordo irregolare (pelo a ciuffi)
  ctx.beginPath();
  ctx.moveTo(22, 70);
  for (let i = 0; i <= 8; i += 1) ctx.lineTo(22 + i * 10.5, i % 2 === 0 ? 50 : 56);
  ctx.lineTo(106, 70);
  ctx.quadraticCurveTo(110, 108, 64, 114);
  ctx.quadraticCurveTo(18, 108, 22, 70);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Chiazze di pelo mancante
  ctx.fillStyle = '#e8b27e';
  ctx.fillRect(34, 60, 16, 8);
  ctx.fillRect(78, 90, 14, 9);
  ctx.fillStyle = '#8a4b1e';
  ctx.fillRect(60, 56, 6, 20);
  // Occhi: uno verde, uno bianco e opaco (cieco) con la cicatrice
  ctx.fillStyle = '#84cc16';
  ctx.beginPath();
  ctx.arc(46, 80, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e5e7eb';
  ctx.beginPath();
  ctx.arc(84, 80, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7f1d1d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(78, 70);
  ctx.lineTo(92, 92);
  ctx.stroke();
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(43, 74, 4, 14);
  // Muso e baffi
  ctx.fillStyle = '#f9a8d4';
  ctx.beginPath();
  ctx.moveTo(60, 96);
  ctx.lineTo(68, 96);
  ctx.lineTo(64, 102);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#f3f4f6';
  ctx.lineWidth = 2;
  for (const dy of [-3, 3]) {
    ctx.beginPath();
    ctx.moveTo(56, 100 + dy);
    ctx.lineTo(28, 98 + dy * 2);
    ctx.moveTo(72, 100 + dy);
    ctx.lineTo(100, 98 + dy * 2);
    ctx.stroke();
  }
}

/** Scatola-bonus: cubo dorato con il punto interrogativo, dorso arcobaleno (come le scatole di Mario Kart). */
function box(ctx: Ctx): void {
  const gradient = ctx.createLinearGradient(0, 0, 128, 128);
  gradient.addColorStop(0, '#f472b6');
  gradient.addColorStop(0.35, '#facc15');
  gradient.addColorStop(0.7, '#4ade80');
  gradient.addColorStop(1, '#38bdf8');
  ctx.fillStyle = gradient;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.roundRect(14, 14, 100, 100, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 6;
  ctx.font = 'bold 84px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText('?', 64, 70);
  ctx.fillText('?', 64, 70);
}

const WORLD_PAINTERS: Record<PickupKind, (ctx: Ctx) => void> = { sphere, arrow, box, bean: senzu };
/** Le icone dei bonus della casella (la HUD le mostra): il Grimorio di Frieren è l'icona dello Zoltraak. */
const ITEM_PAINTERS: Record<ItemId, (ctx: Ctx) => void> = { gomu, saiyan, zoltraak: grimoire, ciak, senzu, nuvola, gatto };

function drawCanvas(painter: (ctx: Ctx) => void): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) painter(ctx);
  return canvas;
}

/** Una texture per ogni oggetto del mondo (da `dispose()` allo smontaggio). */
export function createPickupTextures(): Record<PickupKind, CanvasTexture> {
  const result = {} as Record<PickupKind, CanvasTexture>;
  (Object.keys(WORLD_PAINTERS) as PickupKind[]).forEach((kind) => {
    const texture = new CanvasTexture(drawCanvas(WORLD_PAINTERS[kind]));
    texture.needsUpdate = true;
    result[kind] = texture;
  });
  return result;
}

/** Un'immagine (data URL) per ogni bonus della casella, per la HUD HTML. */
export function createItemIconUrls(): Record<ItemId, string> {
  const result = {} as Record<ItemId, string>;
  (Object.keys(ITEM_PAINTERS) as ItemId[]).forEach((id) => {
    result[id] = drawCanvas(ITEM_PAINTERS[id]).toDataURL('image/png');
  });
  return result;
}
