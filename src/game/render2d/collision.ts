// Test di sovrapposizione scritti a mano per il modo 2D (vedi
// docs/PIANO_LIVELLO1_2D.md, Fase 1): niente Rapier qui, cammino/schivata/
// colpo/QTE sono eventi scriptati da rilevare, non simulazioni fisiche.
// Funzioni pure, senza dipendenze da React/Three — riusabili anche fuori da
// un componente (pattern di attacco boss, sequenze QTE: vedi Fase 2/4).

export interface AABB {
  /** Centro del rettangolo, non un angolo. */
  x: number;
  y: number;
  halfWidth: number;
  halfHeight: number;
}

export interface Circle2D {
  x: number;
  y: number;
  radius: number;
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return (
    Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth &&
    Math.abs(a.y - b.y) < a.halfHeight + b.halfHeight
  );
}

export function circleOverlap(a: Circle2D, b: Circle2D): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const radiusSum = a.radius + b.radius;
  return dx * dx + dy * dy < radiusSum * radiusSum;
}

export function circleAabbOverlap(circle: Circle2D, box: AABB): boolean {
  const closestX = clamp(circle.x, box.x - box.halfWidth, box.x + box.halfWidth);
  const closestY = clamp(circle.y, box.y - box.halfHeight, box.y + box.halfHeight);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.radius * circle.radius;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
