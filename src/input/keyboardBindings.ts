import type { GameAction } from './inputActions.ts';

/**
 * Tastiera e mouse → azioni. I token sono i tasti in minuscolo, come `event.key.toLowerCase()`, più `mouse0`/`mouse2`
 * (click sinistro/destro). Invariati rispetto a prima della FASE 14: per cambiare un tasto basta cambiare questa tabella.
 * `laneUp`/`laneDown` (cambio di via) li legge solo il tunnel, dove `jump` si sovrascrive a solo Spazio.
 */
export const KEYBOARD_BINDINGS: Record<GameAction, readonly string[]> = {
  left: ['a', 'arrowleft'],
  right: ['d', 'arrowright'],
  laneUp: ['w', 'arrowup'],
  laneDown: ['s', 'arrowdown'],
  attack: ['j', 'mouse0'],
  parry: ['k', 'mouse2'],
  dash: ['shift'],
  jump: [' ', 'w', 'arrowup'],
  heal: ['r'],
  skill: ['e'],
  berserk: ['q'],
  summon: ['f'],
  confirm: ['enter', ' '],
  /** Usa/entra (la porta del cinema): non comprende Spazio, che è il salto. */
  interact: ['e', 'enter'],
  back: ['backspace'],
  skip: ['escape', 'enter'],
  pause: ['escape']
};

/** Come si scrive il tasto principale di un'azione (icone e testi con la tastiera). */
export const KEYBOARD_LABELS: Record<GameAction, string> = {
  left: 'A',
  right: 'D',
  laneUp: 'W',
  laneDown: 'S',
  attack: 'J',
  parry: 'K',
  dash: 'Maiusc',
  jump: 'Spazio',
  heal: 'R',
  skill: 'E',
  berserk: 'Q',
  summon: 'F',
  confirm: 'Invio',
  interact: 'E',
  back: 'Canc',
  skip: 'Esc',
  pause: 'Esc'
};

/** Binding che un modo di gioco può sostituire a quelli di default (es. il tunnel: salto solo con Spazio). */
export type KeyboardOverrides = Partial<Record<GameAction, readonly string[]>>;
