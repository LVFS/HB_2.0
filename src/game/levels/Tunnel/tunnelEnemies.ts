import { aabbOverlap } from '@/game/render2d/collision';
import { ARENA_PLAYER_HEIGHT, HITSTOP_LIGHT } from '../BossArena/arenaConfig';
import { addRing, parryProjectile, playerHurtbox } from '../BossArena/combat';
import { inPlayerLane } from './tunnelLanes';
import { spawnPickup } from './tunnelPickups';
import { boulderNudge } from './tunnelSlancio';
import { hasWish, parryStats } from './tunnelWishes';
import type { TunnelHazard, TunnelWorld } from './tunnelState';
import { ARCHER, BEAN, MALUS, PILGRIM, REMAINS } from './tunnelConfig';

/**
 * I nemici del Cammino (FASE 10, tappa 6): il **pellegrino fanatico** (corpo a corpo, si scaglia contro D) e il **balestriere** (a
 * distanza, scocca dardi parabili che, rimandati, tornano a lui e lo spezzano). Si abbattono con la spada, con la parata a tempo o
 * (il balestriere) col suo stesso dardo; cadendo lasciano dei **resti** che rallentano chi ci passa sopra e a volte un fagiolo
 * curativo. Pura (niente React/Three); non importa da `tunnelPuppet`/`tunnelCombat` per non fare giri di import.
 */

/** Il nemico cade: terreno guadagnato, scritta, resti per terra e, a volte, un fagiolo che cura. */
export function defeatEnemy(world: TunnelWorld, enemy: TunnelHazard, label: string, reward: number): void {
  enemy.phase = 'spent';
  world.gapPending += reward;
  world.arena.popups.push({ x: enemy.x, y: enemy.height + 0.3, amount: 0, target: 'object', boost: 1, label });
  world.arena.hitStop = Math.max(world.arena.hitStop, HITSTOP_LIGHT);
  addRing(world.arena, enemy.x, enemy.height / 2, 1.2, 0.3, '#fb923c');
  // I resti: un mucchio a terra nella stessa via.
  world.hazards.push({
    id: world.nextId++,
    kind: 'remains',
    x: enemy.x,
    t: enemy.t,
    lane: enemy.lane,
    y: 0,
    width: REMAINS.width,
    height: REMAINS.height,
    damage: 0,
    hp: 0,
    phase: 'active',
    flash: 0,
    damaged: false,
    lastSwing: -1,
    vy: 0,
    shoot: 0,
    swing: enemy.lane
  });
  // Coi «Fagioli a volontà» ogni nemico caduto lascia un fagiolo.
  if (hasWish(world, 'respiro') || Math.random() < BEAN.dropChance) {
    const bean = spawnPickup(world, 'bean', enemy.t, 1.0, enemy.lane);
    bean.x = enemy.x;
  }
}

/** Un colpo di spada su un nemico (un colpo per fendente); restituisce `true` se è andato a segno. */
function swordHit(world: TunnelWorld, enemy: TunnelHazard, here: boolean, reward: number): boolean {
  const { arena } = world;
  const box = { x: enemy.x, y: enemy.height / 2, halfWidth: enemy.width / 2, halfHeight: enemy.height / 2 };
  const player = arena.player;
  if (!(here && player.attackBox && enemy.lastSwing !== player.swingId && aabbOverlap(player.attackBox, box))) return false;
  enemy.lastSwing = player.swingId;
  enemy.hp -= 1;
  enemy.flash = 0.12;
  arena.hitStop = Math.max(arena.hitStop, HITSTOP_LIGHT);
  if (enemy.hp <= 0) defeatEnemy(world, enemy, 'K.O.', reward);
  else arena.popups.push({ x: enemy.x, y: enemy.height + 0.3, amount: 1, target: 'object', boost: 1 });
  return true;
}

/**
 * Un frame di un nemico. `contact` è il danno da contatto (lo decide `tunnelCombat`, che sa dell'Istinto, dei colpi e delle penalità):
 * restituisce `true` se D ha subito il colpo.
 */
export function updateEnemy(world: TunnelWorld, enemy: TunnelHazard, delta: number, contact: (hazard: TunnelHazard) => boolean): void {
  const { arena } = world;
  const player = arena.player;
  const here = inPlayerLane(world, enemy.lane);
  const ahead = enemy.x - player.x;

  if (enemy.kind === 'pilgrim') {
    if (swordHit(world, enemy, here, PILGRIM.gapReward)) return;
    if (enemy.phase === 'warn' && ahead > 0 && ahead <= PILGRIM.range) {
      enemy.phase = 'active';
      enemy.shoot = 0;
    }
    if (enemy.phase === 'active') {
      enemy.shoot += delta;
      const windingUp = enemy.shoot < PILGRIM.windup;
      const lunging = !windingUp && enemy.shoot < PILGRIM.windup + PILGRIM.lunge;
      if (windingUp) enemy.flash = 0.06;
      if (lunging) {
        enemy.x -= PILGRIM.speed * delta;
        // Parata a tempo mentre si scaglia: cade subito (e la parata rende come un colpo parato).
        const reach = parryStats(world).reach;
        const parryBox = { x: player.x + reach / 2, y: player.y + ARENA_PLAYER_HEIGHT / 2, halfWidth: reach / 2, halfHeight: ARENA_PLAYER_HEIGHT / 2 };
        const box = { x: enemy.x, y: enemy.height / 2, halfWidth: enemy.width / 2, halfHeight: enemy.height / 2 };
        if (here && player.parryActive && aabbOverlap(parryBox, box)) {
          parryProjectile(arena);
          defeatEnemy(world, enemy, 'PARATO!', PILGRIM.parryReward);
          return;
        }
      }
    }
    if (here && !enemy.damaged && aabbOverlap({ x: enemy.x, y: enemy.height / 2, halfWidth: enemy.width / 2, halfHeight: enemy.height / 2 }, playerHurtbox(arena))) {
      contact(enemy);
    }
    return;
  }

  if (enemy.kind === 'archer') {
    if (swordHit(world, enemy, here, ARCHER.gapReward)) return;
    if (here && !enemy.damaged && aabbOverlap({ x: enemy.x, y: enemy.height / 2, halfWidth: enemy.width / 2, halfHeight: enemy.height / 2 }, playerHurtbox(arena))) {
      contact(enemy);
    }
    // Scocca nella sua via mentre D si avvicina: avviso (la balestra si arrossa), poi il dardo parabile.
    if (ahead > 2 && ahead < world.view.ahead - 1) {
      enemy.shoot += delta;
      if (enemy.shoot >= ARCHER.every) {
        enemy.shoot = 0;
        arena.projectiles.push({
          x: enemy.x - 0.5,
          y: ARCHER.shotY,
          vx: ARCHER.shotSpeed,
          damage: ARCHER.shotDamage,
          owner: 'boss',
          life: 6,
          lane: enemy.lane,
          source: enemy.id,
          brake: true,
          ranged: true
        });
      }
    }
    return;
  }

  // 'remains': sta lì per `life` secondi e rallenta chi ci passa sopra a terra.
  if (enemy.kind === 'remains') {
    enemy.shoot += delta;
    if (enemy.shoot >= REMAINS.life) {
      enemy.phase = 'spent';
      return;
    }
    if (here && player.y <= REMAINS.height && Math.abs(player.x - enemy.x) < enemy.width / 2) {
      if (world.slowT <= 0) {
        arena.popups.push({ x: player.x, y: player.y + 2.4, amount: 0, target: 'player', boost: 1, label: 'RALLENTATO!' });
        boulderNudge(world);
      }
      world.slowT = MALUS.slow;
    }
  }
}

/** Un nemico ancora in piedi, dal suo id (il dardo rimandato lo cerca per tornargli addosso). */
export function enemyById(world: TunnelWorld, id: number): TunnelHazard | undefined {
  return world.hazards.find((hazard) => hazard.id === id && hazard.phase !== 'spent');
}
