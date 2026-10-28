import type { BossMessenger } from '../BossArena/bossMessages';
import { addRing } from '../BossArena/combat';
import { GATTO } from './tunnelConfig';
import type { TunnelWorld } from './tunnelState';

/**
 * Il gatto randagio (FASE 10, tappa 5): D lo cavalca. Compare davanti a lui, cresce e D ci sale; in sella è invulnerabile e il
 * mondo corre più forte, ma non si attacca né ci si cura: `J` coccola, `R` dà da mangiare. Affetto e fame calano da soli, e quanto
 * sono alti (il più basso dei due, `catHappiness`) dice quanto il gatto corre. Pura (niente React/Three).
 */

/** Quanto il gatto è contento: il più basso fra affetto e fame (0-1). */
export function catHappiness(world: TunnelWorld): number {
  return world.cat.active ? Math.max(0, Math.min(world.cat.affection, world.cat.hunger)) : 0;
}

/** Livello di Slancio minimo che il gatto garantisce, secondo quanto è contento (0 = nessuno). */
export function catTier(world: TunnelWorld): number {
  if (!world.cat.active) return 0;
  const happy = catHappiness(world);
  return happy > 0.66 ? 3 : happy > 0.33 ? 2 : 1;
}

/** Metri al secondo in più con cui D si avvicina a Checco mentre il gatto è contento (positivo = lo raggiunge più in fretta). */
export function catClosingBonus(world: TunnelWorld): number {
  return GATTO.closingBonus * catHappiness(world);
}

/** Il gatto arriva: comincia a crescere e D ci salirà. */
export function startCat(world: TunnelWorld, messenger: BossMessenger): void {
  const cat = world.cat;
  cat.active = true;
  cat.t = 0;
  cat.grow = 0;
  cat.affection = GATTO.start;
  cat.hunger = GATTO.start;
  cat.petFlash = 0;
  cat.feedFlash = 0;
  cat.petCooldown = 0;
  cat.feedCooldown = 0;
  messenger.flash('Un gatto spelacchiato ti guarda con l’unico occhio buono…', 'J: coccola · R: dagli da mangiare. Se si offende, se ne va', 3.2);
  addRing(world.arena, world.arena.player.x + 1, 0.6, 2, 0.5, '#fbbf24');
}

function endCat(world: TunnelWorld, messenger: BossMessenger, line: string): void {
  world.cat.active = false;
  world.arena.player.iframes = Math.max(world.arena.player.iframes, 0.8);
  messenger.flash(line, null, 2.4);
  addRing(world.arena, world.arena.player.x, 0.8, 2.2, 0.5, '#fbbf24');
}

/** Un frame di gatto: crescita, coccole e pappa, calo dell'affetto e della fame, fine della cavalcata. */
export function updateCat(world: TunnelWorld, delta: number, messenger: BossMessenger): void {
  const cat = world.cat;
  if (!cat.active) return;
  const { runner } = world;
  cat.t += delta;
  cat.grow = Math.min(1, cat.t / GATTO.grow);
  cat.petFlash = Math.max(0, cat.petFlash - delta);
  cat.feedFlash = Math.max(0, cat.feedFlash - delta);
  cat.petCooldown = Math.max(0, cat.petCooldown - delta);
  cat.feedCooldown = Math.max(0, cat.feedCooldown - delta);

  if (cat.grow >= 1) {
    cat.affection = Math.max(0, cat.affection - GATTO.drain * delta);
    cat.hunger = Math.max(0, cat.hunger - GATTO.drain * delta);
  }
  if (runner.pet && cat.petCooldown === 0) {
    cat.affection = Math.min(1, cat.affection + GATTO.pet.gain);
    cat.petCooldown = GATTO.pet.cooldown;
    cat.petFlash = 0.5;
  }
  if (runner.feed && cat.feedCooldown === 0) {
    cat.hunger = Math.min(1, cat.hunger + GATTO.feed.gain);
    cat.feedCooldown = GATTO.feed.cooldown;
    cat.feedFlash = 0.5;
  }

  if (cat.affection <= 0) endCat(world, messenger, 'Il gatto si è offeso: nessuna coccola, se ne va a testa alta.');
  else if (cat.hunger <= 0) endCat(world, messenger, 'Il gatto ha fame e ti pianta in asso: “miao” e basta.');
  else if (cat.t >= GATTO.maxSeconds) endCat(world, messenger, 'Il gatto ti saluta con la coda. Era un ottimo gatto.');
}
