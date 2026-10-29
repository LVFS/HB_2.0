import { useEffect, useRef } from 'react';
import { inputManager, type InputChannel } from '@/input/inputManager';
import type { KeyboardOverrides } from '@/input/keyboardBindings';
import type { InputDevice } from '@/input/inputActions';

/**
 * Input del giocatore tradotto in AZIONI: da FASE 14 è un ADATTATORE sottile sul gestore unico `src/input/inputManager.ts`
 * (tastiera, mouse e controller leggono le stesse azioni), con la STESSA interfaccia di prima — `PlayerArena`, `PlayerRunner` e il
 * tunnel non sanno quale dispositivo c'è dietro. I tasti vivono nel gestore (mai in stato React: un `setState` dentro `useFrame`
 * causerebbe 60 render al secondo) e `justPressed` raccoglie le PRESSIONI senza l'auto-repeat: attacco/parata/dash sono azioni a scatto.
 *
 * L'input in coda NON si perde durante un hit-stop: chi lo consuma decide quando svuotarlo con `consume()` (es. a ogni frame di
 * gioco, o durante un dialogo/una scelta per non accumulare tasti). Ogni chiamata a `usePlayerActions` ha la SUA coda.
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

/** Binding di TASTIERA che un modo di gioco può sostituire a quelli di default (es. il tunnel: salto solo con Spazio). */
export type BindingOverrides = Partial<Record<PlayerAction, readonly string[]>> & KeyboardOverrides;

export interface PlayerActions {
  /** Asse orizzontale tenuto: -1 sinistra, 1 destra, 0 fermo (o entrambi). Tastiera, croce e stick sinistro. */
  moveX: () => -1 | 0 | 1;
  /** L'azione è tenuta premuta adesso. */
  isHeld: (action: PlayerAction) => boolean;
  /** Come `isHeld` ma solo da un dispositivo (dove due azioni condividono un bottone del pad: es. salto e «interagisci» sul pad A). */
  isHeldOn: (action: PlayerAction, device: InputDevice) => boolean;
  /** L'azione è stata premuta da quando si è svuotata la coda (senza auto-repeat). */
  justPressed: (action: PlayerAction) => boolean;
  /** Pressione di un tasto grezzo di TASTIERA (es. le anteprime di sviluppo `1`/`2`/`3`). */
  keyJustPressed: (key: string) => boolean;
  /** Svuota le pressioni in coda (i tasti tenuti restano tenuti). */
  consume: () => void;
}

/**
 * Apre un canale sul gestore finché il componente è montato e restituisce un oggetto STABILE (letto dentro `useFrame`, mai in
 * render). Il click destro è la parata: mentre il canale esiste il menu del browser è bloccato.
 */
export function usePlayerActions(overrides: BindingOverrides = {}, { blockContextMenu = true }: { blockContextMenu?: boolean } = {}): PlayerActions {
  const channel = useRef<InputChannel | null>(null);
  const stable = useRef<PlayerActions | null>(null);
  if (!stable.current) {
    stable.current = {
      moveX: () => channel.current?.moveX() ?? 0,
      isHeld: (action) => channel.current?.isHeld(action) ?? false,
      isHeldOn: (action, device) => channel.current?.isHeldOn(action, device) ?? false,
      justPressed: (action) => channel.current?.justPressed(action) ?? false,
      keyJustPressed: (key) => channel.current?.keyJustPressed(key) ?? false,
      consume: () => channel.current?.consume()
    };
  }

  // Le sostituzioni si leggono una volta sola, all'apertura del canale (come prima: erano fissate alla creazione).
  const initial = useRef(overrides);
  useEffect(() => {
    const opened = inputManager.createChannel(initial.current, { blockContextMenu });
    channel.current = opened;
    return () => {
      channel.current = null;
      opened.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- il canale si apre una volta sola per montaggio
  }, []);

  return stable.current;
}
