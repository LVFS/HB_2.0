// Carica del cannone (FASE 12): LOGICA PURA e testabile (`tests/chargeMeter.test.mjs`), senza React/Three/store.
// Si martellano J / K / Spazio (o click): ogni pressione aggiunge energia, ferma la carica non cala per un attimo
// (premia il ritmo) e poi decade; c'è un tempo massimo e a tempo scaduto il cannone spara SEMPRE, al minimo `CANNON_FORCED_MIN`.

import {
  CANNON_ALTERNATE_BONUS,
  CANNON_DECAY_PER_SECOND,
  CANNON_FORCED_MIN,
  CANNON_GAIN_PER_TAP,
  CANNON_IDLE_GRACE,
  CANNON_TIME_LIMIT
} from './spazioConfig.ts';

export interface ChargeMeter {
  /** Carica attuale, 0-1. */
  charge: number;
  /** Secondi trascorsi dall'inizio della carica. */
  elapsed: number;
  /** Secondi dall'ultima pressione (per la tregua del decadimento). */
  sinceTap: number;
  /** Ultimo tasto premuto (per il bonus dell'alternanza), o null. */
  lastKey: string | null;
  taps: number;
  /** Il massimo raggiunto prima della fine (non cala col decadimento): è il punteggio. */
  peak: number;
  state: 'charging' | 'full' | 'timeout';
}

export type ChargeStatus = ChargeMeter['state'];

export function createChargeMeter(): ChargeMeter {
  return { charge: 0, elapsed: 0, sinceTap: 0, lastKey: null, taps: 0, peak: 0, state: 'charging' };
}

/** Una pressione: aggiunge energia (di più se il tasto è diverso dal precedente). Ignorata a carica finita. */
export function tap(meter: ChargeMeter, key: string): void {
  if (meter.state !== 'charging') return;
  const alternating = meter.lastKey !== null && meter.lastKey !== key;
  meter.charge = Math.min(1, meter.charge + CANNON_GAIN_PER_TAP * (alternating ? CANNON_ALTERNATE_BONUS : 1));
  meter.peak = Math.max(meter.peak, meter.charge);
  meter.lastKey = key;
  meter.sinceTap = 0;
  meter.taps += 1;
  if (meter.charge >= 1) meter.state = 'full';
}

/** Fa passare `delta` secondi: decadimento dopo la tregua e controllo del tempo massimo. Restituisce lo stato. */
export function updateChargeMeter(meter: ChargeMeter, delta: number): ChargeStatus {
  if (meter.state !== 'charging') return meter.state;
  meter.elapsed += delta;
  meter.sinceTap += delta;
  if (meter.sinceTap > CANNON_IDLE_GRACE) meter.charge = Math.max(0, meter.charge - CANNON_DECAY_PER_SECOND * delta);
  if (meter.elapsed >= CANNON_TIME_LIMIT) meter.state = 'timeout';
  return meter.state;
}

export interface ChargeOutcome {
  /** Punteggio del cannone, 0-1: la carica massima raggiunta prima della fine (quella vera, non quella forzata). */
  score: number;
  /** Carica con cui il cannone spara davvero: mai sotto `CANNON_FORCED_MIN`. */
  fired: number;
  /** Il cannone ha sparato con la carica forzata (tempo scaduto sotto il minimo). */
  forced: boolean;
}

export function chargeOutcome(meter: ChargeMeter): ChargeOutcome {
  const score = meter.state === 'full' ? 1 : meter.peak;
  const fired = Math.max(score, CANNON_FORCED_MIN);
  return { score, fired, forced: score < CANNON_FORCED_MIN };
}
