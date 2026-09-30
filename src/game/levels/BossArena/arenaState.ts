import type { AABB } from '@/game/render2d/collision';
import {
  ARENA_GROUND_Y,
  ARENA_PLAYER_SPAWN_X,
  BOSS_MAX_HP,
  BOSS_SPAWN_X,
  EVE_DOWN_X,
  HEAL_CHARGES,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_ATTACK_POSTURE,
  PLAYER_MAX_HP
} from './arenaConfig';

/** Stato di combattimento del giocatore, scritto ad ogni frame da
 *  `PlayerArena` (posizione, hitbox) e da `combat.ts` (danni, reazioni): letto
 *  dal boss senza passare da uno stato React — cambia a 60Hz. */
export interface ArenaPlayerState {
  x: number;
  y: number;
  facing: 1 | -1;
  hp: number;
  /** Hitbox di attacco: non nulla SOLO durante la finestra attiva. */
  attackBox: AABB | null;
  /** Incrementato a ogni attacco: un colpo può ferire una volta sola. */
  swingId: number;
  /** Vero durante la finestra in cui un colpo subito conta come parry. */
  parryActive: boolean;
  /** Vero durante i-frames del dash. */
  invulnerable: boolean;
  /** Secondi residui di i-frames dopo aver subito un colpo. */
  iframes: number;
  /** Secondi residui di reazione al colpo (animazione `hit`). */
  hitTimer: number;
  /** Velocità orizzontale di contraccolpo, decade da sola. */
  knockbackVx: number;
  /** Secondi residui di lampo dorato dopo una parata RIUSCITA. */
  parryFlash: number;
  /** Finestra di contraccolpo dopo una parata riuscita: danni aumentati. */
  counterWindow: number;
  /** Cure rimaste (risorsa a cariche fisse per tentativo). */
  heals: number;
  /** Vero durante la canalizzazione di una cura (nessun i-frame). */
  healing: boolean;
  /** Barra abilità 0-100. */
  skill: number;
  /** Danno/postura del fendente IN CORSO (base o abilità): letti dal boss. */
  attackDamage: number;
  attackPosture: number;
  /** Modificatori dal risultato dell'evento speciale. */
  speedMultiplier: number;
  damageMultiplier: number;
}

export interface ArenaBossState {
  x: number;
  /** Quota da terra (balzi e schianti): 0 = a terra. */
  y: number;
  facing: 1 | -1;
  hp: number;
  hpMax: number;
  posture: number;
  /** Secondi residui di barcollamento (vulnerabile: danni maggiorati). */
  staggerTimer: number;
  round: 1 | 2;
  speedMultiplier: number;
  /** Secondi residui di lampo bianco dopo aver subito un colpo. */
  hitFlash: number;
  attackBox: AABB | null;
  /** Vero durante il windup dell'evento speciale. */
  specialActive: boolean;
  /** Danno subito durante il windup dello speciale (per interromperlo). */
  specialDamageTaken: number;
}

export type EveStatus = 'down' | 'rising' | 'active' | 'staggered';

export interface ArenaEveState {
  status: EveStatus;
  x: number;
  facing: 1 | -1;
  attackBox: AABB | null;
  swingId: number;
}

/** Tutto ciò che sistemi diversi (giocatore, boss, Eve) si scambiano ad ogni
 *  frame. Un solo oggetto in un ref, mai stato React. */
export interface ArenaWorld {
  player: ArenaPlayerState;
  boss: ArenaBossState;
  eve: ArenaEveState;
  /** Secondi residui di hit-stop: mentre > 0 il gameplay è congelato. */
  hitStop: number;
  /** Esito del combattimento: dopo di esso nessuno si muove più. */
  over: 'victory' | 'defeat' | null;
}

export function createArenaWorld(): ArenaWorld {
  return {
    player: {
      x: ARENA_PLAYER_SPAWN_X,
      y: ARENA_GROUND_Y,
      facing: 1,
      hp: PLAYER_MAX_HP,
      heals: HEAL_CHARGES,
      healing: false,
      skill: 0,
      attackDamage: PLAYER_ATTACK_DAMAGE,
      attackPosture: PLAYER_ATTACK_POSTURE,
      attackBox: null,
      swingId: 0,
      parryActive: false,
      invulnerable: false,
      iframes: 0,
      hitTimer: 0,
      knockbackVx: 0,
      parryFlash: 0,
      counterWindow: 0,
      speedMultiplier: 1,
      damageMultiplier: 1
    },
    boss: {
      x: BOSS_SPAWN_X,
      y: 0,
      facing: -1,
      hp: BOSS_MAX_HP,
      hpMax: BOSS_MAX_HP,
      posture: 0,
      staggerTimer: 0,
      round: 1,
      speedMultiplier: 1,
      hitFlash: 0,
      attackBox: null,
      specialActive: false,
      specialDamageTaken: 0
    },
    eve: { status: 'down', x: EVE_DOWN_X, facing: -1, attackBox: null, swingId: 0 },
    hitStop: 0,
    over: null
  };
}
