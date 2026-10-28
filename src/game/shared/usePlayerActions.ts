import { useEffect, useRef } from 'react';

/**
 * Input del giocatore tradotto in AZIONI: una sola mappa tastiera/mouse →
 * azioni, riusabile da ogni modo di gioco con un giocatore comandato in tempo
 * reale (oggi l'arena del boss; domani il tunnel). Stesso principio di
 * `Player2D`/`PlayerArena`: i tasti vivono in `Set` dentro un ref, mai in stato
 * React (un `setState` dentro `useFrame` causerebbe 60 render al secondo). In
 * più `justPressed` raccoglie le PRESSIONI (senza l'auto-repeat del tasto
 * tenuto): attacco/parata/dash sono azioni a scatto, non a tasto tenuto.
 *
 * L'input in coda NON si perde durante un hit-stop: chi lo consuma decide
 * quando svuotarlo con `consume()` (es. a ogni frame di gioco, o durante un
 * dialogo/una scelta per non accumulare tasti).
 */

export type PlayerAction =
  | 'attack'
  | 'parry'
  | 'dash'
  | 'jump'
  | 'heal'
  | 'skill'
  | 'berserk'
  | 'summon'
  | 'laneUp'
  | 'laneDown';

/**
 * Binding: tasti (minuscoli, come `event.key`) e `mouse0`/`mouse2` (click sinistro/destro).
 * `laneUp`/`laneDown` (cambio di via) li legge solo il tunnel, dove `jump` è sovrascritto a solo Spazio.
 */
const BINDINGS: Record<PlayerAction, readonly string[]> = {
  attack: ['j', 'mouse0'],
  parry: ['k', 'mouse2'],
  dash: ['shift'],
  jump: [' ', 'w', 'arrowup'],
  heal: ['r'],
  skill: ['e'],
  berserk: ['q'],
  summon: ['f'],
  laneUp: ['w', 'arrowup'],
  laneDown: ['s', 'arrowdown']
};

/** Binding che un modo di gioco può sostituire a quelli di default (es. il tunnel: salto solo con Spazio). */
export type BindingOverrides = Partial<Record<PlayerAction, readonly string[]>>;
const LEFT_KEYS = ['a', 'arrowleft'] as const;
const RIGHT_KEYS = ['d', 'arrowright'] as const;

export interface PlayerActions {
  /** Asse orizzontale tenuto: -1 sinistra, 1 destra, 0 fermo (o entrambi). */
  moveX: () => -1 | 0 | 1;
  /** L'azione è tenuta premuta adesso. */
  isHeld: (action: PlayerAction) => boolean;
  /** L'azione è stata premuta da quando si è svuotata la coda (senza auto-repeat). */
  justPressed: (action: PlayerAction) => boolean;
  /** Pressione di un tasto grezzo (es. le anteprime di sviluppo `1`/`2`/`3`). */
  keyJustPressed: (key: string) => boolean;
  /** Svuota le pressioni in coda (i tasti tenuti restano tenuti). */
  consume: () => void;
}

function createPlayerActions(overrides: BindingOverrides): PlayerActions & { _held: Set<string>; _pressed: Set<string> } {
  const bindings: Record<PlayerAction, readonly string[]> = { ...BINDINGS, ...overrides };
  const held = new Set<string>();
  const pressed = new Set<string>();
  const anyOf = (set: Set<string>, keys: readonly string[]) => keys.some((key) => set.has(key));
  return {
    _held: held,
    _pressed: pressed,
    moveX: () => {
      let x = 0;
      if (anyOf(held, LEFT_KEYS)) x -= 1;
      if (anyOf(held, RIGHT_KEYS)) x += 1;
      return x as -1 | 0 | 1;
    },
    isHeld: (action) => anyOf(held, bindings[action]),
    justPressed: (action) => anyOf(pressed, bindings[action]),
    keyJustPressed: (key) => pressed.has(key),
    consume: () => pressed.clear()
  };
}

/**
 * Registra i listener della finestra finché il componente è montato e
 * restituisce un oggetto STABILE (letto dentro `useFrame`, mai in render).
 */
export function usePlayerActions(overrides: BindingOverrides = {}): PlayerActions {
  const ref = useRef<ReturnType<typeof createPlayerActions> | null>(null);
  if (!ref.current) ref.current = createPlayerActions(overrides);
  const actions = ref.current;

  useEffect(() => {
    const held = actions._held;
    const pressed = actions._pressed;
    const press = (key: string, repeat = false) => {
      if (!repeat) pressed.add(key);
      held.add(key);
    };
    const onKeyDown = (event: KeyboardEvent) => press(event.key.toLowerCase(), event.repeat);
    const onKeyUp = (event: KeyboardEvent) => held.delete(event.key.toLowerCase());
    const onMouseDown = (event: MouseEvent) => press(event.button === 2 ? 'mouse2' : 'mouse0');
    const onMouseUp = (event: MouseEvent) => held.delete(event.button === 2 ? 'mouse2' : 'mouse0');
    // Il click destro è la parata: niente menu del browser.
    const onContextMenu = (event: MouseEvent) => event.preventDefault();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
      held.clear();
      pressed.clear();
    };
  }, [actions]);

  return actions;
}
