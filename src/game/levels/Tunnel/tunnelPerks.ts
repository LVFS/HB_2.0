import type { PerkId } from '@/data/tunnelCameos';
import { useArenaStore } from '@/store/arenaStore';
import type { BossMessenger } from '../BossArena/bossMessages';
import { HITSTOP_LIGHT } from '../BossArena/arenaConfig';
import { addRing } from '../BossArena/combat';
import { clearAhead } from './tunnelClear';
import { PERK_NUMBERS, PERKS } from './tunnelConfig';
import { defeatEnemy } from './tunnelEnemies';
import { fireZoltraak } from './tunnelSpecial';
import { setPlayerHp } from './tunnelPickups';
import type { TunnelWorld } from './tunnelState';
import { hasPerk } from './tunnelWishes';

/**
 * Gli STILI permanenti (FASE 10, tappa 7): quando devii l'onda di Checco, l'ospite che arriva ti lascia uno stile che dura fino alla
 * ripartenza dall'INIZIO dell'inseguimento (la sconfitta per vita lo mantiene, come i desideri). Qui sta tutto ciò che non è
 * dentro il movimento del giocatore: come si ottiene, i poteri automatici (Zoltraak, scudo), Zoro in scorta, il fulmine del Dio
 * del tuono e lo smoking. Il volo e l'attacco in caduta sono in `tunnelPlayer.ts`; l'aspetto in `PlayerRunner.tsx`/`TunnelAllies.tsx`.
 * Pura (niente React/Three).
 */

/** Ricomincia dall'INIZIO: via tutti gli stili. */
export function resetPerks(world: TunnelWorld): void {
  world.perks = [];
  const state = world.perkState;
  state.magicT = 0;
  state.calmT = 0;
  state.thorCd = 0;
  state.slamming = false;
  state.lastTier = 0;
  state.zoroT = 0;
  state.zoroLeaving = false;
  state.zoroAhead = 0;
  state.flight = 1;
  state.flightOn = false;
  state.zoroFlash = 0;
  state.thorFlash = 0;
}

/** Zoro arriva in scorta (o torna, se era già andato via). */
function startZoro(world: TunnelWorld): void {
  const state = world.perkState;
  state.zoroT = PERK_NUMBERS.zoro.stay;
  state.zoroLane = Math.round(world.lane.pos);
  state.zoroHitT = 0.6;
  state.zoroWanderT = PERK_NUMBERS.zoro.wanderEvery;
  state.zoroFollowT = PERK_NUMBERS.zoro.followFor;
  state.zoroLeaving = false;
  state.zoroAhead = PERK_NUMBERS.zoro.ahead + 6;
}

/** Concede uno stile: l'effetto immediato e il messaggio. Restituisce `false` se D lo aveva già. */
export function grantPerk(world: TunnelWorld, id: PerkId): boolean {
  const player = world.arena.player;
  if (id === 'zoro') {
    // Zoro è una scorta a tempo: ogni volta che lo si guadagna, torna.
    if (!hasPerk(world, id)) world.perks.push(id);
    startZoro(world);
    return true;
  }
  if (hasPerk(world, id)) return false;
  world.perks.push(id);
  const state = world.perkState;
  switch (id) {
    case 'hero':
      world.maxHp += PERK_NUMBERS.heroHp;
      player.hp = Math.min(world.maxHp, player.hp + PERK_NUMBERS.heroHp);
      useArenaStore.getState().set({ playerHpMax: world.maxHp, playerHp: Math.round(player.hp) });
      break;
    case 'magic':
      state.magicT = PERK_NUMBERS.magicEvery * 0.5;
      break;
    case 'calm':
      state.calmT = PERK_NUMBERS.calm.every * 0.5;
      break;
    case 'gentleman':
      state.lastTier = world.slancio;
      break;
    default:
      break;
  }
  return true;
}

/** Gli stili di un ospite: se tutti già avuti, in cambio una piccola cura. Annuncia ciò che cambia. */
export function grantPerks(world: TunnelWorld, ids: readonly PerkId[], messenger: BossMessenger): void {
  const player = world.arena.player;
  const gained = ids.filter((id) => grantPerk(world, id));
  if (gained.length === 0) {
    setPlayerHp(world, player.hp + PERK_NUMBERS.heroHp);
    messenger.flash('Lo stile ce l’avevi già…', `+${PERK_NUMBERS.heroHp} di vita`, 2.6);
    return;
  }
  const names = gained.map((id) => PERKS[id].label).join(' + ');
  messenger.flash(`NUOVO STILE: ${names}!`, gained.map((id) => PERKS[id].description).join(' '), 4.6);
  world.arena.popups.push({ x: player.x, y: player.y + 3.1, amount: 0, target: 'boss', boost: 1, label: names.toUpperCase() });
  addRing(world.arena, player.x, player.y + 1, 2.2, 0.6, '#fde047');
}

/** Il fulmine del Dio del tuono: D, in caduta, si schianta e scarica un'area di fulmini (tutte le vie, davanti e un po' dietro). */
export function thunderSlam(world: TunnelWorld): void {
  const { arena } = world;
  const player = arena.player;
  const from = player.x - PERK_NUMBERS.thor.behind;
  const range = PERK_NUMBERS.thor.ahead + PERK_NUMBERS.thor.behind;
  // I nemici cadono come tali (resti e fagiolo); il resto si polverizza.
  for (const hazard of world.hazards) {
    if (hazard.phase === 'spent' || (hazard.kind !== 'pilgrim' && hazard.kind !== 'archer') || hazard.x < from || hazard.x > from + range) continue;
    defeatEnemy(world, hazard, 'FULMINE!', -3);
  }
  const count = clearAhead(world, from, range, undefined, 0);
  world.perkState.thorFlash = 0.5;
  world.shake = Math.max(world.shake, 0.45);
  arena.hitStop = Math.max(arena.hitStop, HITSTOP_LIGHT * 2);
  for (let i = 0; i < 3; i += 1) addRing(arena, player.x + 0.6 + i * 1.8, 0.4, 2.2 - i * 0.3, 0.45, i % 2 === 0 ? '#fde047' : '#7dd3fc');
  arena.popups.push({ x: player.x + 1.8, y: 2.8, amount: 0, target: 'boss', boost: 1, label: count > 0 ? 'FULMINE!' : 'TUONO!' });
}

/** Zoro in scorta: corre davanti a D, spazza la sua via ogni tanto; va a zonzo (cambia via a caso) e alla fine perde l'orientamento e se ne va. */
function updateZoro(world: TunnelWorld, delta: number, messenger: BossMessenger): void {
  const state = world.perkState;
  if (state.zoroT <= 0 && state.zoroAhead <= -8) return;
  const z = PERK_NUMBERS.zoro;
  state.zoroFlash = Math.max(0, state.zoroFlash - delta);
  if (state.zoroT > 0) {
    state.zoroT -= delta;
    // Entra da destra e si piazza davanti a D.
    state.zoroAhead += (z.ahead - state.zoroAhead) * Math.min(1, 3 * delta);
    // All'inizio segue la via di D, poi va a zonzo.
    if (state.zoroFollowT > 0) {
      state.zoroFollowT -= delta;
      state.zoroLane = Math.round(world.lane.pos);
    } else {
      state.zoroWanderT -= delta;
      if (state.zoroWanderT <= 0) {
        state.zoroWanderT = z.wanderEvery;
        state.zoroLane = Math.floor(Math.random() * 3);
        world.arena.popups.push({ x: world.arena.player.x + state.zoroAhead, y: 2.6, amount: 0, target: 'boss', boost: 1, label: '…di qua?' });
      }
    }
    state.zoroHitT -= delta;
    if (state.zoroHitT <= 0) {
      state.zoroHitT = z.every;
      const from = world.arena.player.x + state.zoroAhead - 1.2;
      const count = clearAhead(world, from, z.range * 0.4, state.zoroLane);
      state.zoroFlash = 0.18;
      if (count > 0) world.arena.popups.push({ x: from + 1.4, y: 2.4, amount: 0, target: 'boss', boost: 1, label: 'ONI GIRI!' });
    }
    if (state.zoroT <= 0) {
      state.zoroLeaving = true;
      messenger.flash('Zoro: «Aspetta… da che parte era l’uscita?»', 'Se ne va nella direzione sbagliata', 3);
    }
  } else {
    // Perde l'orientamento: corre all'indietro, fuori dallo schermo.
    state.zoroAhead -= 9 * delta;
  }
}

/** Un frame di stili: poteri automatici, smoking, Zoro e lampi. */
export function updatePerks(world: TunnelWorld, delta: number, messenger: BossMessenger): void {
  const state = world.perkState;
  const player = world.arena.player;
  state.thorCd = Math.max(0, state.thorCd - delta);
  state.thorFlash = Math.max(0, state.thorFlash - delta);

  // Gear 5: il pugno a gomma resta sempre attivo (riusa il frutto Gomu Gomu).
  if (hasPerk(world, 'gear5')) world.buffs.gomu = Math.max(world.buffs.gomu, 99);

  if (hasPerk(world, 'magic')) {
    state.magicT -= delta;
    if (state.magicT <= 0) {
      state.magicT = PERK_NUMBERS.magicEvery;
      fireZoltraak(world);
    }
  }
  if (hasPerk(world, 'calm')) {
    state.calmT -= delta;
    if (state.calmT <= 0) {
      state.calmT = PERK_NUMBERS.calm.every;
      player.iframes = Math.max(player.iframes, PERK_NUMBERS.calm.seconds);
      addRing(world.arena, player.x, player.y + 1, 1.8, 0.4, '#a7f3d0');
      world.arena.popups.push({ x: player.x, y: player.y + 2.6, amount: 0, target: 'boss', boost: 1, label: 'SCUDO AMICO!' });
    }
  }
  if (hasPerk(world, 'gentleman')) {
    if (world.slancio > state.lastTier) {
      world.arena.popups.push({ x: player.x, y: player.y + 2.7, amount: 0, target: 'boss', boost: 1, label: world.slancio >= PERK_NUMBERS.gentlemanTier ? 'VAI UOMO! (IMPASSIBILE)' : 'VAI UOMO!' });
    }
    state.lastTier = world.slancio;
  }
  updateZoro(world, delta, messenger);
}
