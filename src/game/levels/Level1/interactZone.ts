// Zona d'interazione lungo l'asse X (la porta del cinema): modulo PURO, senza React/Three e senza alias `@/` (lo carica Node nei test).

export interface InteractZone {
  centerX: number;
  halfWidth: number;
}

/** `x` cade dentro la zona (bordi compresi). */
export function isInsideZone(x: number, zone: InteractZone): boolean {
  return Math.abs(x - zone.centerX) <= zone.halfWidth;
}
