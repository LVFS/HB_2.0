import {
  BOULDER,
  CIAK,
  MALUS,
  SLANCIO_EASE,
  SLANCIO_GAP_DRIFT,
  SLANCIO_TEMPO
} from './tunnelConfig';
import type { TunnelWorld } from './tunnelState';
import { catTier } from './tunnelCat';
import { kaiokenDriftMultiplier, slancioFloor, slancioStep } from './tunnelWishes';

/**
 * Slancio (FASE 9): più si corre senza farsi male, più il MONDO va veloce.
 * Il livello sale ogni `SLANCIO_STEP` secondi senza danni e un colpo subito lo
 * azzera. Il tempo del mondo (`world.tempo`) rincorre il livello: minacce,
 * proiettili, detriti e lanci avanzano di `delta * tempo`, mentre salto, dash,
 * parata e timer del giocatore restano in tempo reale — quindi più Slancio =
 * meno tempo per reagire. Il Ciak! lo rallenta (bullet-time). Pura.
 */

const MAX_TIER = SLANCIO_TEMPO.length - 1;

/** Livello di Slancio attuale: dai secondi senza danni, al massimo con il Kaioken, l'aura Super Saiyan o la modalità shonen. */
export function slancioTier(world: TunnelWorld): number {
  if (world.buffs.kaioken > 0 || world.buffs.saiyan > 0 || world.mode.id === 'anime') return MAX_TIER;
  // Il gatto contento garantisce un minimo di Slancio.
  return Math.max(catTier(world), slancioFloor(world), Math.min(MAX_TIER, Math.floor(world.noHitTime / slancioStep(world))));
}

/** Moltiplicatore con cui il livello attuale fa calare la distanza dalla marionetta. */
export function gapDriftMultiplier(world: TunnelWorld): number {
  return SLANCIO_GAP_DRIFT[world.slancio] * kaiokenDriftMultiplier(world);
}

/** Un frame di Slancio: conta i secondi senza danni e fa rincorrere al tempo del mondo il suo bersaglio. */
export function updateSlancio(world: TunnelWorld, delta: number): void {
  // Frenato (un dardo ti ha preso): per qualche secondo lo Slancio non riprende a salire.
  if (world.brakeT > 0) world.brakeT = Math.max(0, world.brakeT - delta);
  else world.noHitTime += delta;
  world.slowT = Math.max(0, world.slowT - delta);
  world.slancio = slancioTier(world);
  const target = SLANCIO_TEMPO[world.slancio] * (world.buffs.ciak > 0 ? CIAK.tempo : 1);
  world.tempo += (target - world.tempo) * Math.min(1, SLANCIO_EASE * delta);
}

/** Tempo del mondo per questo frame (rallentato se D sta sui resti dei nemici). */
export function worldDelta(world: TunnelWorld, delta: number): number {
  return delta * world.tempo * (world.slowT > 0 ? MALUS.slowTempo : 1);
}

/** Un malus subito (frenato, rallentato) avvicina il masso che rotola alle spalle di D, come un colpo ma meno. */
export function boulderNudge(world: TunnelWorld): void {
  if (world.boulder.active) world.boulder.dist = Math.max(0, world.boulder.dist - BOULDER.malusStep);
}

/** Toglie i malus (frenato, rallentato): lo fanno la modalità shonen e il Senzu. */
export function clearMaluses(world: TunnelWorld): void {
  world.brakeT = 0;
  world.slowT = 0;
}

/** D ha subito un colpo (ostacolo o proiettile): Slancio azzerato, una Sfera del Drago persa e, se rotola il masso, questo si avvicina. */
export function onPlayerHit(world: TunnelWorld): void {
  world.noHitTime = 0;
  world.slancio = slancioTier(world);
  if (world.boulder.active) world.boulder.dist = Math.max(0, world.boulder.dist - BOULDER.hitStep);
  if (world.spheres > 0) {
    world.spheres -= 1;
    const { player } = world.arena;
    world.arena.popups.push({ x: player.x, y: player.y + 2.9, amount: 0, target: 'player', boost: 1, label: '−1 SFERA' });
  }
}

/** Azzera Slancio e tempo (ripartenza da un checkpoint). */
export function resetSlancio(world: TunnelWorld): void {
  world.noHitTime = 0;
  world.slancio = 0;
  world.tempo = 1;
  clearMaluses(world);
}
