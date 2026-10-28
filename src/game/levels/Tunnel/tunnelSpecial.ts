import { addRing } from '../BossArena/combat';
import { HITSTOP_LIGHT } from '../BossArena/arenaConfig';
import { defeatGuard } from './tunnelCombat';
import { addGap } from './tunnelPuppet';
import { ZOLTRAAK } from './tunnelConfig';
import type { TunnelWorld } from './tunnelState';

/**
 * Zoltraak (Frieren): polverizza tutto ciò che sta davanti a D entro `ZOLTRAAK.range` —
 * ostacoli, guardie, raggi, detriti, proiettili — tranne le voragini. La marionetta si
 * colpisce SEMPRE, anche fuori schermo e fuori portata: la distanza cala del valore fisso
 * `ZOLTRAAK.gap` (il raggio "taglia" fino a lei; a destra compare la scritta).
 */
export function fireZoltraak(world: TunnelWorld): void {
  const { arena, puppet } = world;
  const from = arena.player.x;
  const to = from + ZOLTRAAK.range;
  world.beam = {
    life: ZOLTRAAK.duration,
    lifeMax: ZOLTRAAK.duration,
    x: from + 0.6,
    y: arena.player.y + 1.05,
    lane: world.lane.pos,
    color: 'violet',
    length: ZOLTRAAK.range,
    thickness: 1.15
  };

  for (const hazard of world.hazards) {
    if (hazard.phase === 'spent' || hazard.kind === 'pit' || hazard.x < from - 0.5 || hazard.x > to) continue;
    if (hazard.kind === 'guard') defeatGuard(world, hazard, 'ZOLTRAAK!');
    else hazard.phase = 'spent';
  }
  for (let i = arena.projectiles.length - 1; i >= 0; i -= 1) {
    const proj = arena.projectiles[i];
    if (proj.owner === 'boss' && proj.x >= from - 0.5 && proj.x <= to) arena.projectiles.splice(i, 1);
  }

  addGap(world, ZOLTRAAK.gap);
  puppet.flash = 0.5;
  // Se lei è in scena la scritta le sta sopra; sennò si appoggia al bordo destro, dove la HUD ha l'indicatore.
  const labelX = puppet.onScreen ? puppet.x : world.runX + world.view.rightEdge - 1.6;
  arena.popups.push({ x: labelX, y: 3, amount: 0, target: 'boss', boost: 1, label: `COLPITO! ${ZOLTRAAK.gap} m` });
  arena.popups.push({ x: from + 2.5, y: arena.player.y + 2.4, amount: 0, target: 'boss', boost: 1, label: 'ZOLTRAAK!' });
  arena.hitStop = Math.max(arena.hitStop, HITSTOP_LIGHT * 2);
  addRing(arena, from + 1, arena.player.y + 1, 1.8, 0.4, '#c4b5fd');
  world.shake = Math.max(world.shake, 0.12);
}
