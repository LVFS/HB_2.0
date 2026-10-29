import type { GameAction } from './inputActions.ts';

/**
 * Controller → azioni. Indici della mappatura STANDARD dell'API Gamepad (`gamepad.mapping === 'standard'`): 0 A, 1 B, 2 X, 3 Y,
 * 4 LB, 5 RB, 6 LT, 7 RT, 8 Select, 9 Start, 10/11 click degli stick, 12-15 croce (su, giù, sinistra, destra).
 * I token sono `pad:b<indice>` per i bottoni e `pad:left|right|up|down` per croce E stick sinistro insieme.
 * Se un abbinamento non piace, si cambia QUI (e solo qui).
 */
export const PAD_BUTTON = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  Select: 8,
  Start: 9
} as const;

export const GAMEPAD_BINDINGS: Record<GameAction, readonly string[]> = {
  left: ['pad:left'],
  right: ['pad:right'],
  laneUp: ['pad:up'],
  laneDown: ['pad:down'],
  attack: [`pad:b${PAD_BUTTON.X}`],
  parry: [`pad:b${PAD_BUTTON.LB}`],
  dash: [`pad:b${PAD_BUTTON.B}`],
  jump: [`pad:b${PAD_BUTTON.A}`],
  heal: [`pad:b${PAD_BUTTON.Y}`],
  skill: [`pad:b${PAD_BUTTON.RB}`],
  berserk: [`pad:b${PAD_BUTTON.RT}`],
  summon: [`pad:b${PAD_BUTTON.LT}`],
  confirm: [`pad:b${PAD_BUTTON.A}`],
  back: [`pad:b${PAD_BUTTON.B}`],
  skip: [`pad:b${PAD_BUTTON.Start}`]
};

/** Stick sinistro: si «accende» sopra `STICK_ON` e si «spegne» sotto `STICK_OFF` (isteresi: niente sfarfallio al limite). */
export const STICK_ON = 0.35;
export const STICK_OFF = 0.25;
/** Un bottone analogico (grilletti) conta come premuto sopra questo valore. */
export const TRIGGER_ON = 0.5;

/** Bottoni della croce direzionale → direzione. */
export const DPAD_BUTTONS: Record<number, 'up' | 'down' | 'left' | 'right'> = { 12: 'up', 13: 'down', 14: 'left', 15: 'right' };

/** Il bottone `pad:b<n>` come numero, o null se il token non è un bottone. */
export function padButtonOf(token: string): number | null {
  const match = /^pad:b(\d+)$/.exec(token);
  return match ? Number(match[1]) : null;
}
