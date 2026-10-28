import type { TunnelWorld } from './tunnelState';

/**
 * Polverizza minacce e proiettili nemici davanti a `from` entro `range` (le voragini restano). Con `lane` solo quelli di quella
 * via, senza `lane` di tutte le vie. Restituisce quante ne ha tolte. Usata da ospiti, Eve, Zoro, Zoltraak automatico e fulmini.
 * Pura (niente React/Three).
 */
export function clearAhead(world: TunnelWorld, from: number, range: number, lane?: number, behind = 0.5): number {
  const inLane = (value: number | undefined): boolean => lane === undefined || Math.abs((value ?? lane) - lane) < 0.6;
  let count = 0;
  for (const hazard of world.hazards) {
    if (hazard.phase === 'spent' || hazard.kind === 'pit' || hazard.x < from - behind || hazard.x > from + range || !inLane(hazard.lane)) continue;
    hazard.phase = 'spent';
    count += 1;
  }
  const { projectiles } = world.arena;
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const proj = projectiles[i];
    if (proj.owner === 'boss' && proj.x >= from - behind && proj.x <= from + range && inLane(proj.lane)) {
      projectiles.splice(i, 1);
      count += 1;
    }
  }
  return count;
}
