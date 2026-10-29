// Azioni di gioco (FASE 14): ciò che il giocatore VUOLE fare, indipendente dal dispositivo. Moduli puri e senza alias `@/`
// (li carica Node nei test): questa cartella non importa nulla da componenti o scene.

export type GameAction =
  | 'left'
  | 'right'
  | 'laneUp'
  | 'laneDown'
  | 'attack'
  | 'parry'
  | 'dash'
  | 'jump'
  | 'heal'
  | 'skill'
  | 'berserk'
  | 'summon'
  | 'confirm'
  | 'back'
  | 'skip'
  | 'pause';

export const GAME_ACTIONS: readonly GameAction[] = [
  'left',
  'right',
  'laneUp',
  'laneDown',
  'attack',
  'parry',
  'dash',
  'jump',
  'heal',
  'skill',
  'berserk',
  'summon',
  'confirm',
  'back',
  'skip',
  'pause'
];

/** Le azioni che un QTE può chiedere: ciò che si preme dipende dal dispositivo, la sequenza parla in azioni. */
export type QteAction = 'attack' | 'parry' | 'skill' | 'heal' | 'jump';
export const QTE_ACTIONS: readonly QteAction[] = ['attack', 'parry', 'skill', 'heal', 'jump'];

/** Per la carica del cannone vale qualunque tasto frontale: attacco, parata, salto o scatto. */
export const CANNON_ACTIONS: readonly GameAction[] = ['attack', 'parry', 'jump', 'dash'];

export function isQteAction(value: string): value is QteAction {
  return (QTE_ACTIONS as readonly string[]).includes(value);
}

export type InputDevice = 'keyboard' | 'gamepad';
export type PadFamily = 'xbox' | 'playstation' | 'switch' | 'generic';
