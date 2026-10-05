import type { ArenaWorld } from './arenaState';
import type { BossMessenger } from './bossMessages';
import type { CheccoMove } from './checcoMoves';
import {
  ENGAGE_CLOSE_CHANCE,
  ENGAGE_CLOSE_DISTANCE,
  ENGAGE_FAR_MIN,
  ENGAGE_FAR_SPREAD,
  TURRET_FIRST_DELAY
} from './arenaConfig';

/** Stato di una mossa in corso (i dati della mossa stanno in `checcoMoves.ts`). */
export interface MoveRuntime {
  move: CheccoMove;
  t: number;
  hitDone: boolean[];
  /** Proiettili già lanciati / detriti già fatti cadere / teletrasporto già fatto. */
  projFired: boolean[];
  debrisFired: boolean;
  teleported: boolean;
  /** Tempesta: prossimo colpo della zona, fulmini già lanciati e quanti ne lancerà. */
  zoneTimer: number;
  boltsFired: number;
  boltCount: number;
  /** Punti di partenza/arrivo del balzo, fissati quando comincia. */
  leapStartX?: number;
  leapTargetX?: number;
  /** Dove si trovava il bersaglio quando Checco ha scelto la mossa: è il punto
   *  d'arrivo di ogni carica/balzo, sempre quello, qualunque cosa faccia il
   *  giocatore dopo. */
  targetX: number;
  lungeStartX?: number;
  /** Arrivo effettivo della carica (il bersaglio, o oltre se era troppo vicino). */
  lungeTargetX?: number;
}

/** Stato dell'IA di Checco che non serve agli altri sistemi (quello condiviso sta in `ArenaWorld`). */
export interface BossRuntime {
  action: MoveRuntime | null;
  cooldown: number;
  /** Secondi alla prossima torretta (timer indipendente dalle mosse). */
  turretTimer: number;
  /** Distanza a cui Checco vuole stare prima di scegliere la mossa (cambia a ogni ciclo). */
  preferredDistance: number;
  lastMoveId: string;
  special: { t: number } | null;
  specialDone: boolean;
  /** Evocazione degli oggetti del Buen Camino in corso, e quante ne sono già scattate. */
  summon: { t: number } | null;
  totemEvents: number;
  targetEve: boolean;
  lastPlayerSwing: number;
  lastEveSwing: number;
  lastPosture: number;
  sinceGain: number;
  time: number;
  endTimer: number;
  endNotified: boolean;
}

/**
 * Tutto ciò che i moduli del boss ricevono: il mondo condiviso, lo stato
 * dell'IA e il messaggio al centro. Un solo oggetto stabile per istanza del
 * componente (nessun modulo importa da `BossChecco.tsx`).
 */
export interface BossContext {
  world: ArenaWorld;
  rt: BossRuntime;
  messenger: BossMessenger;
}

/**
 * Distanza di ingaggio per il prossimo ciclo: metà delle volte da vicino
 * (mischia), le altre da lontano (cariche, balzi, lanci). Senza questo Checco
 * si avvicinava sempre a ~1.6 prima di scegliere e le mosse a distanza non
 * uscivano mai.
 */
export function pickEngageDistance(): number {
  return Math.random() < ENGAGE_CLOSE_CHANCE ? ENGAGE_CLOSE_DISTANCE : ENGAGE_FAR_MIN + Math.random() * ENGAGE_FAR_SPREAD;
}

export function createBossRuntime(): BossRuntime {
  return {
    action: null,
    cooldown: 1.4,
    turretTimer: TURRET_FIRST_DELAY,
    preferredDistance: pickEngageDistance(),
    lastMoveId: '',
    special: null,
    specialDone: false,
    summon: null,
    totemEvents: 0,
    targetEve: false,
    lastPlayerSwing: -1,
    lastEveSwing: -1,
    lastPosture: 0,
    sinceGain: 0,
    time: 0,
    endTimer: -1,
    endNotified: false
  };
}

/** Durata totale di una mossa: windup + l'evento più lungo (colpi, lanci, detriti, aria, fulmini) + recupero. */
export function totalDuration(move: CheccoMove): number {
  const lastHitEnd = Math.max(0, ...move.hits.map((h) => h.start + h.duration));
  const lastProjectile = Math.max(0, ...(move.projectiles ?? []).map((p) => p.at));
  const debris = move.debris;
  const lastDebris = debris ? debris.at + debris.warn + debris.stagger * debris.count : 0;
  const leap = move.leap;
  const airTime = leap ? leap.rise + leap.hang + leap.fall : 0;
  const storm = move.storm;
  const lastBolt = leap && storm ? leap.rise + storm.chargeTime + storm.boltsMax * storm.boltInterval : 0;
  return move.windup + Math.max(lastHitEnd, lastProjectile, lastDebris, airTime, lastBolt) + move.recovery;
}
