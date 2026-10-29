import type { BossMessenger } from '../BossArena/bossMessages';
import {
  CIAK,
  GOMU,
  ITEM_LABEL,
  ITEM_LOW_HP,
  ITEM_WEIGHTS,
  SAIYAN,
  NUVOLA,
  SENZU_HEAL,
  ZOLTRAAK,
  type ItemId
} from './tunnelConfig';
import { startCat } from './tunnelCat';
import { sayAbovePlayer, setPlayerHp } from './tunnelPickups';
import { clearMaluses } from './tunnelSlancio';
import { fireZoltraak } from './tunnelSpecial';
import type { TunnelWorld } from './tunnelState';

/**
 * La casella bonus (stile Mario Kart, FASE 10): una sola. La scatola la riempie con
 * un bonus estratto in base alla distanza da Checco (più sei indietro, più i bonus
 * servono a recuperare); `E` lo usa. Con la casella piena le scatole si lasciano lì.
 * Pura (niente React/Three).
 */

const ITEM_IDS = Object.keys(ITEM_LABEL) as ItemId[];

/** Estrae un bonus secondo i pesi della fascia di distanza; il Senzu pesa il triplo con poca vita. */
export function rollItem(world: TunnelWorld, random: () => number = Math.random): ItemId {
  const band = ITEM_WEIGHTS.find((entry) => world.gap <= entry.maxGap) ?? ITEM_WEIGHTS[ITEM_WEIGHTS.length - 1];
  const lowHp = world.arena.player.hp < ITEM_LOW_HP;
  const weights = ITEM_IDS.map((id) => band.weights[id] * (id === 'senzu' && lowHp ? 3 : 1));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let pick = random() * total;
  for (let i = 0; i < ITEM_IDS.length; i += 1) {
    pick -= weights[i];
    if (pick < 0) return ITEM_IDS[i];
  }
  return ITEM_IDS[ITEM_IDS.length - 1];
}

/** D tocca una scatola: se la casella è libera la riempie. Restituisce `true` se l'ha presa. */
export function collectBox(world: TunnelWorld, messenger: BossMessenger, item?: ItemId): boolean {
  if (world.slot !== null) return false;
  world.slot = item ?? rollItem(world);
  sayAbovePlayer(world, ITEM_LABEL[world.slot].toUpperCase() + '!');
  messenger.flash(`Bonus: ${ITEM_LABEL[world.slot]}`, 'Premi {skill} per usarlo', 1.8);
  return true;
}

/** `E`: usa il bonus nella casella. Restituisce `true` se c'era qualcosa da usare. */
export function consumeSlotItem(world: TunnelWorld, messenger: BossMessenger): boolean {
  const item = world.slot;
  if (item === null) return false;
  // Un solo gatto alla volta: il bonus resta in casella.
  if (item === 'gatto' && world.cat.active) return false;
  world.slot = null;
  const { buffs } = world;
  switch (item) {
    case 'gomu':
      buffs.gomu = GOMU.duration;
      sayAbovePlayer(world, 'GOMU GOMU!');
      messenger.flash('GOMU GOMU NO… PUGNO!', `${GOMU.duration} s: {attack} allunga il braccio e rimanda tutto`, 2.4);
      break;
    case 'saiyan':
      buffs.saiyan = SAIYAN.duration;
      sayAbovePlayer(world, 'SUPER SAIYAN!');
      messenger.flash('I CAPELLI SI FANNO D’ORO!', `${SAIYAN.duration} s: invincibile, travolgi tutto`, 2.4);
      break;
    case 'ciak':
      buffs.ciak = CIAK.duration;
      sayAbovePlayer(world, 'CIAK!');
      messenger.flash('CIAK… AZIONE!', `${CIAK.duration} s di bullet-time`, 1.8);
      break;
    case 'senzu':
      setPlayerHp(world, world.arena.player.hp + SENZU_HEAL);
      clearMaluses(world);
      sayAbovePlayer(world, 'SENZU!');
      messenger.flash('Fagiolo Senzu: mastichi e ti senti un altro', `+${SENZU_HEAL} vita e via i malus`, 2);
      break;
    case 'nuvola':
      buffs.nuvola = NUVOLA.duration;
      sayAbovePlayer(world, 'NUVOLA SPEEDY!');
      messenger.flash('NUVOLA SPEEDY!', 'Tieni premuto {jump} per salire, rilascia per scendere', 2.6);
      break;
    case 'gatto':
      startCat(world, messenger);
      sayAbovePlayer(world, 'MIAO!');
      break;
    case 'zoltraak':
      fireZoltraak(world);
      messenger.flash('Frieren: «Zoltraak.»', `Checco colpito: ${ZOLTRAAK.gap} m`, 2);
      break;
  }
  return true;
}
