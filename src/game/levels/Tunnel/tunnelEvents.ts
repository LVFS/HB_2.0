import { addRing, hitPlayer } from '../BossArena/combat';
import type { BossMessenger } from '../BossArena/bossMessages';
import {
  BOULDER,
  BOULDER_REWARD,
  DETACH_GAP_BONUS,
  DARK,
  DETACH_GAP_CAP,
  KARAOKE,
  TUNNEL_EVENTS,
  TUNNEL_GAP_HIT_PENALTY,
  TUNNEL_LANES,
  TUNNEL_RUN_SPEED,
  type TunnelEventDef
} from './tunnelConfig';
import { spawnPickup } from './tunnelPickups';
import { resetReality } from './tunnelReality';
import { tryInstinct } from './tunnelWishes';
import { addGap, scheduleThrow } from './tunnelPuppet';
import type { TunnelHazard, TunnelWorld } from './tunnelState';

/**
 * Gli eventi che cambiano le regole (FASE 9). Ognuno è una finestra di tempo
 * dentro UNA sezione (così il checkpoint la ripropone intera):
 *
 *  - A «Checco si stacca»: la marionetta parte su uno scooter, la distanza
 *    sale, si apre la finestra su di lei. Le guardie del cinema (nel copione)
 *    sbarrano la strada; finita la finestra Checco riappare.
 *  - B «Il masso»: rotola alle spalle di D a distanza FISSA (non lo insegue); ogni colpo o malus subito lo
 *    avvicina e al secondo contatto schiaccia. Finisce quando si schianta contro un muro o un ostacolo che D si
 *    è lasciato dietro (o allo scadere): pioggia di Sfere.
 *
 * Pura (niente React/Three): la resa legge `world.boulder` e `world.window`. Checco
 * non viene "nascosto": la distanza è fisica, quindi dopo la spinta sta semplicemente lontano.
 */

/** Una scritta sopra D. */
function sayAbove(world: TunnelWorld, label: string): void {
  const { player } = world.arena;
  world.arena.popups.push({ x: player.x, y: player.y + 2.6, amount: 0, target: 'boss', boost: 1, label });
}

/** Secondi in cui la finestra resta aperta per il masso (Checco che tira la leva). */
const BOULDER_WINDOW_SECONDS = 3.2;
/** Velocità con cui il masso entra in scena dal fondo (u/s). */
const BOULDER_ENTER_SPEED = 5;

function defOf(id: string): TunnelEventDef | undefined {
  return TUNNEL_EVENTS.find((event) => event.id === id);
}

/** Dopo un salto nel tempo o una ripartenza: nessun evento in corso; sono "fatti" quelli già finiti. */
export function syncEvents(world: TunnelWorld): void {
  world.activeEvent = null;
  world.boulder.active = false;
  world.boulder.dist = BOULDER.enterDist;
  world.window.open = false;
  world.window.kind = null;
  world.window.t = 0;
  world.dark = 0;
  world.karaokeHits = 0;
  world.eventsDone = TUNNEL_EVENTS.filter((event) => event.end <= world.time).map((event) => event.id);
  resetReality(world);
}

function startEvent(world: TunnelWorld, def: TunnelEventDef, messenger: BossMessenger): void {
  world.activeEvent = def.id;
  // Il buio non ha finestra: è tutto lo schermo a spegnersi.
  if (def.id !== 'dark') {
    world.window.open = true;
    world.window.kind = def.id;
    world.window.t = 0;
  }
  if (def.id === 'karaoke') {
    world.karaokeHits = 0;
    KARAOKE.notes.forEach((note, i) => {
      scheduleThrow(world, def.start + KARAOKE.lead + i * KARAOKE.spacing, note.parry, note.lane, true);
    });
  }
  if (def.id === 'detach') {
    // Checco sgomma via: la distanza sale (di colpo non si può, è fisica: la spinta si versa in ~1 s),
    // ma mai fino alla sconfitta.
    addGap(world, Math.max(0, Math.min(DETACH_GAP_BONUS, DETACH_GAP_CAP - world.gap - world.gapPending)));
  } else if (def.id === 'boulder') {
    world.boulder.active = true;
    world.boulder.dist = BOULDER.enterDist;
  }
  messenger.flash(def.bark[0], def.bark[1], 3.4);
}

function endEvent(world: TunnelWorld, def: TunnelEventDef, messenger: BossMessenger): void {
  world.eventsDone.push(def.id);
  world.activeEvent = null;
  world.window.open = false;
  if (def.id === 'boulder') {
    world.boulder.active = false;
    // Il masso si schianta: una pioggia di Sfere davanti a D.
    for (let i = 0; i < BOULDER_REWARD.count; i += 1) {
      spawnPickup(world, 'sphere', world.time + 1.4 + i * BOULDER_REWARD.spacing, 1.1, i % TUNNEL_LANES);
    }
  }
  if (def.id === 'karaoke' && world.karaokeHits === 0) {
    // Nessuna nota ti ha preso: il pubblico applaude e Checco ci rimane male.
    addGap(world, KARAOKE.perfectGap);
    sayAbove(world, 'APPLAUSI!');
  }
  if (def.endBark) messenger.flash(def.endBark[0], def.endBark[1], 2.6);
}

/**
 * Il masso: entra alle spalle di D e poi resta A DISTANZA FISSA (non lo insegue, non recupera): si avvicina solo quando D subisce
 * un colpo o un malus, e se arriva vicinissimo schiaccia. Finisce quando si schianta contro un muro o un ostacolo che D si
 * è lasciato dietro (vedi `boulderCrash`).
 */
function updateBoulder(world: TunnelWorld, delta: number): void {
  const boulder = world.boulder;
  boulder.spin += ((TUNNEL_RUN_SPEED * world.tempo) / BOULDER.radius) * delta;
  if (boulder.dist > BOULDER.startDist) {
    boulder.dist = Math.max(BOULDER.startDist, boulder.dist - BOULDER_ENTER_SPEED * delta);
  }
  world.shake = Math.max(world.shake, 0.04 + 0.05 * (1 - boulder.dist / BOULDER.enterDist));

  if (boulder.dist <= BOULDER.crushDist) {
    const { arena } = world;
    // L'Istinto Superiore schiva anche lo schiacciamento del masso.
    if (tryInstinct(world)) {
      boulder.dist = BOULDER.startDist;
      return;
    }
    const result = hitPlayer(arena, BOULDER.damage, { unparryable: true, sourceX: arena.player.x - 1 });
    if (result === 'hit') {
      // Schiacciato: si perde terreno e il masso, "rimbalzato", si ritira.
      addGap(world, TUNNEL_GAP_HIT_PENALTY);
      world.noHitTime = 0;
      boulder.dist = BOULDER.startDist;
      world.shake = Math.max(world.shake, 0.3);
    }
  }
}

/** Cosa può fermare il masso: un muro, una cassa o un ostacolo basso ancora in piedi alle spalle di D. */
const BOULDER_STOPPERS: readonly string[] = ['wall', 'crate', 'low'];

/** Il primo ostacolo intatto che il masso (centro a `runX - dist`, raggio `radius`) ha raggiunto, se c'è. */
function boulderCrash(world: TunnelWorld): TunnelHazard | undefined {
  const front = world.runX - world.boulder.dist;
  return world.hazards.find(
    (hazard) =>
      BOULDER_STOPPERS.includes(hazard.kind) &&
      hazard.phase !== 'spent' &&
      hazard.x < world.runX - 0.4 &&
      hazard.x <= front + BOULDER.radius * 0.8 &&
      hazard.x > front - 2.5
  );
}

/** Un frame di eventi: avvio e fine delle finestre, masso, finestra sulla marionetta. */
export function updateEvents(world: TunnelWorld, delta: number, messenger: BossMessenger): void {
  if (world.activeEvent === null) {
    const next = TUNNEL_EVENTS.find((event) => !world.eventsDone.includes(event.id) && world.time >= event.start && world.time < event.end);
    if (next) startEvent(world, next, messenger);
  } else {
    const def = defOf(world.activeEvent);
    if (def && world.time >= def.end) endEvent(world, def, messenger);
  }

  // Il buio si accende e si spegne piano.
  const darkTarget = world.activeEvent === 'dark' ? 1 : 0;
  world.dark += (darkTarget - world.dark) * Math.min(1, DARK.speed * delta);
  if (Math.abs(darkTarget - world.dark) < 0.002) world.dark = darkTarget;

  if (world.window.open) {
    world.window.t += delta;
    // Il masso: la finestra serve solo a vedere Checco che tira la leva.
    if (world.window.kind === 'boulder' && world.window.t > BOULDER_WINDOW_SECONDS) world.window.open = false;
  }
  if (world.boulder.active) {
    updateBoulder(world, delta);
    // Schianto: il masso (arrivato alla sua distanza) travolge il primo muro/ostacolo intatto alle spalle di D e l'evento finisce.
    const crashed = world.boulder.dist <= BOULDER.startDist + 0.01 ? boulderCrash(world) : undefined;
    const def = world.activeEvent ? defOf(world.activeEvent) : undefined;
    if (crashed && def && def.id === 'boulder') {
      crashed.phase = 'spent';
      world.shake = Math.max(world.shake, 0.7);
      addRing(world.arena, crashed.x, 1.4, 3.2, 0.5, '#fb923c');
      world.arena.hitStop = Math.max(world.arena.hitStop, 0.12);
      world.arena.popups.push({ x: crashed.x, y: 2.6, amount: 0, target: 'object', boost: 1, label: 'SCHIANTATO!' });
      endEvent(world, def, messenger);
    }
  }
}
