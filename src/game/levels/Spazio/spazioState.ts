import type { QteState } from '../BossArena/qte';
import type { ChargeMeter } from './chargeMeter';
import { SPACE_DODGE_DISTANCE, SPACE_EVE_START, SPACE_MOTHER_POS, SPACE_ROCKET_START } from './spazioConfig';

/** Le cinque tappe interne della scena: le fasi di `levelStore` ne coprono più d'una (vedi `SceneManagerSpazio`). */
export type SpazioStage = 'opening' | 'support' | 'supportAfter' | 'cannon' | 'destruction';

/** Un colpo della nave madre verso la navicella di Eve (solo scena: il QTE non fa danni veri). */
export interface SpaceBolt {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t: number;
  /** `true` = colpisce la navicella (scintille e scossa), `false` = la manca. */
  hit: boolean;
}

/** Un anello che si espande (impatti, esplosioni) o uno sbuffo di fumo. */
export interface SpaceBurst {
  x: number;
  y: number;
  age: number;
  life: number;
  size: number;
  color: string;
  kind: 'ring' | 'puff';
}

/**
 * Tutto ciò che cambia a ogni frame nello spazio, in UN oggetto in un ref (stesso schema di `TunnelWorld`/`ArenaWorld`):
 * lo scrivono i driver e le timeline GSAP, lo leggono i componenti Three nei loro `useFrame`. Mai `useState` qui dentro.
 */
export interface SpazioWorld {
  stage: SpazioStage;
  /** Secondi dal montaggio. */
  time: number;
  /** Moltiplicatore dello scorrimento delle stelle (1 = normale). */
  scroll: number;
  /** Ampiezza del tremolio della camera. */
  shake: number;
  /** 0-1: bagliore bianco a tutto schermo nella scena. */
  flash: number;
  rocket: { x: number; y: number; rot: number; visible: boolean; flame: number };
  eve: { x: number; y: number; rot: number; visible: boolean; thrust: number; smoke: number; dodge: number; shakeX: number };
  mother: { x: number; y: number; glow: number; split: number; visible: boolean; burn: number };
  beam: { power: number; width: number };
  bolts: SpaceBolt[];
  bursts: SpaceBurst[];
  /** Tasti premuti dal giocatore nel QTE, in coda finché `updateQte` non li legge. */
  pressed: string[];
  support: {
    phase: 'intro' | 'qte' | 'outro' | 'done';
    t: number;
    qte: QteState | null;
    hits: number;
    misses: number;
  };
  cannon: {
    phase: 'ready' | 'charging' | 'fire' | 'done';
    t: number;
    meter: ChargeMeter | null;
    /** Pressioni accodate dall'input, lette dal driver. */
    taps: string[];
    /** Carica con cui spara e punteggio vero (0-1), scritti quando il cannone parte. */
    fired: number;
    score: number;
    forced: boolean;
  };
}

/** Posizione disegnata della navicella di Eve: la posizione "di scena" (timeline) più il dondolio e la schivata. */
export function eveDrawPosition(world: SpazioWorld): { x: number; y: number } {
  const { eve } = world;
  const bob = Math.sin(world.time * 1.7) * 0.18 * eve.thrust;
  return { x: eve.x + eve.shakeX, y: eve.y + bob + eve.dodge * SPACE_DODGE_DISTANCE };
}

export function createSpazioWorld(): SpazioWorld {
  return {
    stage: 'opening',
    time: 0,
    scroll: 1,
    shake: 0,
    flash: 0,
    rocket: { x: SPACE_ROCKET_START.x, y: SPACE_ROCKET_START.y, rot: -0.9, visible: true, flame: 1 },
    eve: { x: SPACE_EVE_START.x, y: SPACE_EVE_START.y, rot: 0, visible: false, thrust: 1, smoke: 0, dodge: 0, shakeX: 0 },
    mother: { x: SPACE_MOTHER_POS.x, y: SPACE_MOTHER_POS.y, glow: 0, split: 0, visible: true, burn: 0 },
    beam: { power: 0, width: 0 },
    bolts: [],
    bursts: [],
    pressed: [],
    support: { phase: 'intro', t: 0, qte: null, hits: 0, misses: 0 },
    cannon: { phase: 'ready', t: 0, meter: null, taps: [], fired: 0, score: 0, forced: false }
  };
}
