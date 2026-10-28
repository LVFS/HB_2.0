import { aabbOverlap } from '@/game/render2d/collision';
import { useArenaStore } from '@/store/arenaStore';
import { addCuriosity } from '@/store/runStatsStore';
import { playerHurtbox } from '../BossArena/combat';
import {
  ARROW_BOOST,
  BEAN,
  PICKUP_DEFAULT_Y,
  PICKUP_SIZE,
  SPHERES_FOR_SHENRON,
  TUNNEL_DESPAWN_BEHIND,
  TUNNEL_LANE_START,
  TUNNEL_RUN_SPEED,
  type PickupKind
} from './tunnelConfig';
import { inPlayerLane } from './tunnelLanes';
import { hasWish, maxHp, pickupReach } from './tunnelWishes';
import type { TunnelPickup, TunnelWorld } from './tunnelState';

/**
 * Gli oggetti del percorso (FASE 9-10): nascita, raccolta ed effetti immediati.
 * Sono tre: la Sfera del Drago (sette = un desiderio di Shenron), la freccia gialla del Cammino (una
 * pedana che lancia in alto) e la scatola-bonus, che riempie la casella (cosa ci sia
 * dentro lo decide `tunnelItems.ts`; qui arriva come callback per non creare un giro
 * di import). Pura (niente React/Three).
 */

/** Secondi in cui un oggetto raccolto resta in scena (si dissolve). */
export const PICKUP_FADE = 0.25;
/** Margine in più attorno all'oggetto, perché raccoglierlo sia generoso a 9 unità al secondo. */
const PICKUP_FORGIVENESS = 0.2;
/** Un oggetto si raccoglie anche cambiando via all'ultimo: tolleranza più larga di quella delle minacce. */
const PICKUP_LANE_TOLERANCE = 0.7;

/** Fa nascere un oggetto nel punto dove D arriva al secondo di corsa `t`. */
export function spawnPickup(world: TunnelWorld, kind: PickupKind, t: number, y?: number, lane: number = TUNNEL_LANE_START): TunnelPickup {
  const pickup: TunnelPickup = {
    id: world.nextId++,
    kind,
    x: world.startX + t * TUNNEL_RUN_SPEED,
    y: y ?? (kind === 'arrow' ? PICKUP_SIZE.arrow.height / 2 : PICKUP_DEFAULT_Y),
    t,
    lane,
    takenFor: 0
  };
  world.pickups.push(pickup);
  return pickup;
}

/** Popup con una scritta sopra D (riusa i numeri di danno dell'arena). */
export function sayAbovePlayer(world: TunnelWorld, label: string, y = 2.4): void {
  const { player } = world.arena;
  world.arena.popups.push({ x: player.x, y: player.y + y, amount: 0, target: 'boss', boost: 1, label });
}

export function setPlayerHp(world: TunnelWorld, hp: number): void {
  const player = world.arena.player;
  player.hp = Math.min(maxHp(world), hp);
  useArenaStore.getState().set({ playerHp: Math.round(player.hp) });
}

/** Effetto di un oggetto raccolto (la scatola è gestita da chi chiama). */
function applyPickup(world: TunnelWorld, pickup: TunnelPickup, onSeven: () => void): void {
  switch (pickup.kind) {
    case 'sphere': {
      world.spheres += 1;
      // Sette Sfere: il drago esaudisce un desiderio (il gioco si ferma e si sceglie).
      if (world.spheres >= SPHERES_FOR_SHENRON) {
        sayAbovePlayer(world, 'SHENRON!');
        onSeven();
      }
      break;
    }
    case 'arrow':
      world.runner.boost = ARROW_BOOST;
      addCuriosity('pickup:arrow');
      sayAbovePlayer(world, 'ULTREIA!', 1.2);
      break;
    case 'bean':
      {
        const heal = hasWish(world, 'respiro') ? Math.round(BEAN.heal * 1.5) : BEAN.heal;
        addCuriosity('pickup:bean');
        setPlayerHp(world, world.arena.player.hp + heal);
        sayAbovePlayer(world, `+${heal} VITA`, 1.6);
      }
      break;
    case 'box':
      break;
  }
}

/**
 * Un frame di raccolta: toglie gli oggetti rimasti indietro e fa scattare quelli toccati da D.
 * `onBox` riceve la scatola toccata e dice se l'ha presa (falso = casella piena: la scatola resta lì).
 */
export function updatePickups(world: TunnelWorld, delta: number, onBox: () => boolean, onSeven: () => void): void {
  const { player } = world.arena;
  const hurt = playerHurtbox(world.arena);
  for (let i = world.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = world.pickups[i];
    if (pickup.takenFor > 0) {
      pickup.takenFor += delta;
      if (pickup.takenFor >= PICKUP_FADE) world.pickups.splice(i, 1);
      continue;
    }
    if (pickup.x < player.x - TUNNEL_DESPAWN_BEHIND) {
      world.pickups.splice(i, 1);
      continue;
    }
    const size = PICKUP_SIZE[pickup.kind];
    // La freccia gialla scatta solo a chi ci passa sopra a terra; gli altri al contatto.
    // Si raccoglie solo dalla propria via.
    const reach = pickupReach(world, { lane: PICKUP_LANE_TOLERANCE, forgiveness: PICKUP_FORGIVENESS });
    if (!inPlayerLane(world, pickup.lane, reach.lane)) continue;
    const touched =
      pickup.kind === 'arrow'
        ? player.y <= 0.4 && Math.abs(player.x - pickup.x) < size.width / 2 + reach.forgiveness
        : aabbOverlap(
            { x: pickup.x, y: pickup.y, halfWidth: size.width / 2 + reach.forgiveness, halfHeight: size.height / 2 + reach.forgiveness },
            hurt
          );
    if (!touched) continue;
    if (pickup.kind === 'box' && !onBox()) continue;
    pickup.takenFor = 0.0001;
    applyPickup(world, pickup, onSeven);
  }
}

/** I bonus a tempo scendono (in tempo reale: sono del giocatore); il raggio dello Zoltraak si spegne. */
export function updateBuffs(world: TunnelWorld, delta: number): void {
  const { buffs } = world;
  buffs.gomu = Math.max(0, buffs.gomu - delta);
  buffs.saiyan = Math.max(0, buffs.saiyan - delta);
  buffs.ciak = Math.max(0, buffs.ciak - delta);
  buffs.nuvola = Math.max(0, buffs.nuvola - delta);
  if (world.beam) {
    world.beam.life -= delta;
    if (world.beam.life <= 0) world.beam = null;
  }
}

/** Ripartenza da un checkpoint: nessun bonus, nessuna sfera, casella vuota. */
export function resetBonuses(world: TunnelWorld): void {
  world.pickups.length = 0;
  world.spheres = 0;
  world.slot = null;
  world.beam = null;
  world.runner.boost = 0;
  world.buffs.gomu = 0;
  world.buffs.saiyan = 0;
  world.buffs.ciak = 0;
  world.buffs.nuvola = 0;
  world.cat.active = false;
}
