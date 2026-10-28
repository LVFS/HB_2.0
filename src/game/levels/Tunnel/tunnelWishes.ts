import { useArenaStore } from '@/store/arenaStore';
import type { BossMessenger } from '../BossArena/bossMessages';
import { PLAYER_MAX_HP } from '../BossArena/arenaConfig';
import { addRing } from '../BossArena/combat';
import {
  PERK_NUMBERS,
  SLANCIO_STEP,
  TUNNEL_DASH_COOLDOWN,
  TUNNEL_DASH_DISTANCE,
  TUNNEL_PARRY,
  WISH_NUMBERS,
  WISH_POOLS,
  WISHES,
  type WishId,
  type WishKind
} from './tunnelConfig';
import type { TunnelWorld } from './tunnelState';
import type { PerkId } from '@/data/tunnelCameos';

/**
 * I desideri di Shenron (FASE 10, tappa 4). Raccolte sette Sfere del Drago, il gioco si ferma e si sceglie un desiderio
 * fra tre — uno PERMANENTE, uno A USI, uno A TEMPO. I permanenti non sono bonus sparsi: cambiano i numeri di D (vita,
 * scatto, parata, raggio di raccolta, ritmo dello Slancio), e questo modulo è l'unico posto che li legge. Pura
 * (niente React/Three): non importa da `tunnelPickups`/`tunnelPuppet`/`tunnelSlancio`, così tutti possono importare lui.
 */

export function hasWish(world: TunnelWorld, id: WishId): boolean {
  return world.wishes.owned.includes(id);
}

/** Gli STILI permanenti (vedi `tunnelPerks.ts`): leggerli da qui, senza dipendenze, evita giri di import. */
export function hasPerk(world: TunnelWorld, id: PerkId): boolean {
  return world.perks.includes(id);
}

/** D può volare (tenendo premuto il salto): Super Saiyan o Volo. */
export function canFly(world: TunnelWorld): boolean {
  return hasPerk(world, 'saiyan') || hasPerk(world, 'fly');
}

/** Con lo smoking, a velocità massima i colpi a distanza dei nemici (balestrieri, torrette) non lo toccano. */
export function rangedImmune(world: TunnelWorld): boolean {
  return hasPerk(world, 'gentleman') && world.slancio >= PERK_NUMBERS.gentlemanTier;
}

/** Con «Passo veloce» lo Slancio non scende sotto questo livello. */
export function slancioFloor(world: TunnelWorld): number {
  return hasPerk(world, 'speed') ? PERK_NUMBERS.speedTier : 0;
}
/** Vita massima attuale (100, più il Cuore del Drago). */
export function maxHp(world: TunnelWorld): number {
  return world.maxHp;
}

/** Parata: finestra attiva, recupero e portata (l'Haki dell'osservazione le allunga). */
export function parryStats(world: TunnelWorld): { active: number; recovery: number; reach: number } {
  return hasWish(world, 'haki')
    ? { active: WISH_NUMBERS.haki.active, recovery: TUNNEL_PARRY.recovery, reach: WISH_NUMBERS.haki.reach }
    : { active: TUNNEL_PARRY.active, recovery: TUNNEL_PARRY.recovery, reach: TUNNEL_PARRY.reach };
}

/** Attesa fra due scatti: dimezzata dall'Istantanea, annullata dall'Ultreia! a tempo. */
export function dashCooldown(world: TunnelWorld): number {
  if (world.buffs.ultreia > 0) return 0;
  return hasWish(world, 'scatto') ? WISH_NUMBERS.dash.cooldown : TUNNEL_DASH_COOLDOWN;
}

/** Quanto sposta lo scatto (l'Istantanea lo allunga). */
export function dashDistance(world: TunnelWorld): number {
  return TUNNEL_DASH_DISTANCE + (hasWish(world, 'scatto') ? WISH_NUMBERS.dash.extraDistance : 0);
}

/** Secondi senza danni per salire di un livello di Slancio. */
export function slancioStep(world: TunnelWorld): number {
  return hasWish(world, 'slancio') ? WISH_NUMBERS.slancioStep : SLANCIO_STEP;
}

/** Con il Dragon Radar si raccolgono anche gli oggetti delle vie vicine e un po' più lontani. */
export function pickupReach(world: TunnelWorld, base: { lane: number; forgiveness: number }): { lane: number; forgiveness: number } {
  return hasWish(world, 'magnete') ? { lane: WISH_NUMBERS.magnet.lane, forgiveness: WISH_NUMBERS.magnet.forgiveness } : base;
}

/** Il Kaioken a tempo raddoppia la velocità con cui ci si avvicina a Checco. */
export function kaiokenDriftMultiplier(world: TunnelWorld): number {
  return world.buffs.kaioken > 0 ? WISH_NUMBERS.kaioken.driftMultiplier : 1;
}

/**
 * Istinto Superiore: se ci sono usi, il colpo che D sta per subire viene schivato da solo. Va chiamato PRIMA di
 * `hitPlayer`; restituisce `true` se ha schivato (e consuma un uso). Non scatta se D è già invulnerabile.
 */
export function tryInstinct(world: TunnelWorld): boolean {
  const { player } = world.arena;
  if (world.wishes.instinct <= 0 || player.invulnerable || player.iframes > 0) return false;
  world.wishes.instinct -= 1;
  player.iframes = Math.max(player.iframes, 0.6);
  world.arena.popups.push({ x: player.x, y: player.y + 2.6, amount: 0, target: 'boss', boost: 1, label: 'ISTINTO!' });
  addRing(world.arena, player.x, player.y + 1, 1.8, 0.4, '#fde047');
  world.arena.hitStop = Math.max(world.arena.hitStop, 0.06);
  return true;
}

/** Un frame di desideri: i timer dei desideri a tempo (in tempo reale, sono di D). */
export function updateWishes(world: TunnelWorld, delta: number): void {
  world.buffs.kaioken = Math.max(0, world.buffs.kaioken - delta);
  world.buffs.ultreia = Math.max(0, world.buffs.ultreia - delta);
}

/** Ricomincia l'inseguimento dall'inizio: i desideri svaniscono e la vita massima torna a quella di base. */
export function resetWishes(world: TunnelWorld): void {
  world.wishes.owned = [];
  world.wishes.instinct = 0;
  world.wishes.reserve = 0;
  world.buffs.kaioken = 0;
  world.buffs.ultreia = 0;
  world.maxHp = PLAYER_MAX_HP;
  world.arena.player.hp = Math.min(world.arena.player.hp, PLAYER_MAX_HP);
  world.wishChoice = null;
  useArenaStore.getState().set({ playerHpMax: PLAYER_MAX_HP, powerUpChoice: null, powerUpPicked: null, powerUpChoiceTitle: null });
}

/** Estrae un desiderio per tipo: i permanenti già avuti non tornano (se li hai finiti, ne esce uno a caso lo stesso). */
export function rollWishChoice(world: TunnelWorld, random: () => number = Math.random): WishId[] {
  const kinds: WishKind[] = ['permanente', 'a usi', 'a tempo'];
  return kinds.map((kind) => {
    const pool = WISH_POOLS[kind];
    const fresh = pool.filter((id) => !hasWish(world, id));
    const from = fresh.length > 0 ? fresh : pool;
    return from[Math.min(from.length - 1, Math.floor(random() * from.length))];
  });
}

/** Le sette Sfere sono raccolte: il gioco si ferma e compare la scelta (la schermata è la stessa del potenziamento dell'arena). */
export function openWishChoice(world: TunnelWorld, messenger: BossMessenger): void {
  world.spheres = 0;
  world.wishChoice = rollWishChoice(world);
  // Il gioco resta fermo finché non si sceglie: il driver lo ferma con l'hit-stop e lo riprende alla scelta.
  world.arena.hitStop = Infinity;
  useArenaStore.getState().set({
    powerUpChoice: world.wishChoice.map((id) => ({
      id,
      label: WISHES[id].label,
      description: `${WISHES[id].kind.toUpperCase()} — ${WISHES[id].description}`
    })),
    powerUpPicked: null,
    powerUpChoiceTitle: 'Shenron: esprimi un desiderio'
  });
  messenger.flash('SHENRON: «ESPRIMI UN DESIDERIO!»', null, 2);
}

function popup(world: TunnelWorld, label: string): void {
  const { player } = world.arena;
  world.arena.popups.push({ x: player.x, y: player.y + 2.5, amount: 0, target: 'boss', boost: 1, label });
}

/** Esaudisce un desiderio. */
export function applyWish(world: TunnelWorld, id: WishId): void {
  const { player } = world.arena;
  const store = useArenaStore.getState();
  if (WISHES[id].kind === 'permanente') world.wishes.owned.push(id);
  switch (id) {
    case 'cuore':
      world.maxHp += WISH_NUMBERS.heartBonus;
      player.hp = Math.min(world.maxHp, player.hp + WISH_NUMBERS.heartBonus);
      store.set({ playerHpMax: world.maxHp, playerHp: Math.round(player.hp) });
      break;
    case 'respiro':
      player.hp = Math.min(world.maxHp, player.hp + 20);
      store.set({ playerHp: Math.round(player.hp) });
      break;
    case 'istinto':
      world.wishes.instinct += WISH_NUMBERS.instinctUses;
      break;
    case 'riserva':
      world.wishes.reserve += WISH_NUMBERS.reserveCharges;
      break;
    case 'kaioken':
      world.buffs.kaioken = WISH_NUMBERS.kaioken.seconds;
      break;
    case 'ultreia':
      world.buffs.ultreia = WISH_NUMBERS.ultreia.seconds;
      break;
    default:
      break;
  }
  popup(world, WISHES[id].label.toUpperCase() + '!');
}

/**
 * Mentre si sceglie: legge la carta scelta dallo store (la scrive la schermata `PowerUpChoice`), esaudisce il
 * desiderio, chiude la schermata e rimette in moto il gioco. Restituisce `true` se la scelta è stata fatta.
 */
export function resolveWishChoice(world: TunnelWorld, messenger: BossMessenger): boolean {
  if (!world.wishChoice) return true;
  const picked = useArenaStore.getState().powerUpPicked;
  const id = world.wishChoice.find((candidate) => candidate === picked);
  if (!id) return false;
  world.wishChoice = null;
  world.arena.hitStop = 0;
  useArenaStore.getState().set({ powerUpChoice: null, powerUpPicked: null, powerUpChoiceTitle: null });
  applyWish(world, id);
  messenger.flash(`Desiderio esaudito: ${WISHES[id].label}`, WISHES[id].description, 3);
  return true;
}
