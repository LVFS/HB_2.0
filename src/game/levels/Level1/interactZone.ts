// Zona d'interazione lungo l'asse X (la porta del cinema): modulo PURO, senza React/Three e senza alias `@/` (lo carica Node nei test).

export interface InteractZone {
  centerX: number;
  halfWidth: number;
}

/** `x` cade dentro la zona (bordi compresi). */
export function isInsideZone(x: number, zone: InteractZone): boolean {
  return Math.abs(x - zone.centerX) <= zone.halfWidth;
}

/**
 * Il salto è richiesto? Sul pad «interagisci» e salto sono lo stesso bottone (A): con D davanti alla porta quella pressione deve solo far
 * entrare, quindi il salto da controller non conta (`suppressPad`). Da tastiera Spazio salta e E/Invio entra: nessun conflitto, il salto
 * resta sempre. Fuori dalla zona (`suppressPad` falso) vale entrambi i dispositivi.
 */
export function jumpRequested(heldOnKeyboard: boolean, heldOnPad: boolean, suppressPad: boolean): boolean {
  return heldOnKeyboard || (heldOnPad && !suppressPad);
}

