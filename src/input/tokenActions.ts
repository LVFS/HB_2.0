import { GAMEPAD_BINDINGS } from './gamepadBindings.ts';
import { CANNON_ACTIONS, GAME_ACTIONS, QTE_ACTIONS, type GameAction, type QteAction } from './inputActions.ts';
import { KEYBOARD_BINDINGS, type KeyboardOverrides } from './keyboardBindings.ts';

/** Le azioni a cui un token (tasto, click o bottone del pad) corrisponde; `overrides` sostituisce i binding di tastiera. FUNZIONE PURA. */
export function actionsForToken(token: string, overrides: KeyboardOverrides = {}): GameAction[] {
  return GAME_ACTIONS.filter((action) => {
    const keyboard = overrides[action] ?? KEYBOARD_BINDINGS[action];
    return keyboard.includes(token) || GAMEPAD_BINDINGS[action].includes(token);
  });
}

/** Per i QTE il salto da tastiera è SOLO Spazio (come prima della FASE 14: W e freccia su non erano fra i tasti del QTE). */
const QTE_KEYBOARD_OVERRIDES: KeyboardOverrides = { jump: [' '] };

/** L'azione di QTE che un token preme, o null (gli altri tasti, scatto compreso, nei QTE non contano). FUNZIONE PURA. */
export function qteActionForToken(token: string): QteAction | null {
  const found = actionsForToken(token, QTE_KEYBOARD_OVERRIDES).find((action) => (QTE_ACTIONS as readonly string[]).includes(action));
  return (found as QteAction | undefined) ?? null;
}

/** La carica del cannone: vale qualunque fra attacco, parata, salto e scatto. FUNZIONE PURA. */
export function isCannonToken(token: string): boolean {
  return actionsForToken(token).some((action) => CANNON_ACTIONS.includes(action));
}
