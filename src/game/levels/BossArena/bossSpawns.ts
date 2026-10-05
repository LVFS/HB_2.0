import { useArenaStore } from '@/store/arenaStore';
import type { ArenaWorld } from './arenaState';
import type { BossContext } from './bossRuntime';
import type { CheccoMove } from './checcoMoves';
import {
  ARENA_CEILING_Y,
  ARENA_HALF_WIDTH,
  BOLT_ORIGIN_HEIGHT,
  DEBRIS_EDGE_MARGIN,
  DEBRIS_JITTER,
  PLAYER_AIM_HEIGHT,
  PROJECTILE_LIFETIME,
  PROJECTILE_SPAWN_OFFSET,
  TOTEM_EDGE_MARGIN,
  TOTEM_HP,
  TOTEM_MIN_DISTANCE_FROM_BOSS,
  TOTEM_MIN_SPACING,
  TOTEM_PLACEMENT_ATTEMPTS,
  TURRET_CHARGE,
  TURRET_EDGE_MARGIN,
  TURRET_FLOOR_ATTEMPTS,
  TURRET_FLOOR_CHANCE,
  TURRET_HP,
  TURRET_INTERVAL_ROUND1,
  TURRET_INTERVAL_ROUND2,
  TURRET_LAUNCH_HEIGHT,
  TURRET_MAX_ROUND1,
  TURRET_MAX_ROUND2,
  TURRET_MIN_DISTANCE_FROM_PLAYER,
  TURRET_MIN_SPACING,
  TURRET_SIZE,
  TURRET_WALL_ATTEMPTS,
  TURRET_WALL_INSET,
  TURRET_WALL_MIN_GAP,
  TURRET_WALL_Y
} from './arenaConfig';

type MoveProjectile = NonNullable<CheccoMove['projectiles']>[number];
type MoveDebris = NonNullable<CheccoMove['debris']>;
type MoveStorm = NonNullable<CheccoMove['storm']>;

/**
 * Tutto ciò che Checco "crea" nel mondo (proiettili, fulmini, detriti, oggetti
 * del Buen Camino, torrette). Funzioni senza React: ricevono il mondo e vi
 * aggiungono le entità, che poi `ArenaThreats` aggiorna e disegna.
 */

/** Fa comparire gli oggetti del Buen Camino, lontani da Checco e fra loro. */
export function spawnTotems(world: ArenaWorld, count: number): void {
  const { boss } = world;
  const limit = ARENA_HALF_WIDTH - TOTEM_EDGE_MARGIN;
  const placed: number[] = [];
  for (let n = 0; n < count; n += 1) {
    let x = 0;
    for (let attempt = 0; attempt < TOTEM_PLACEMENT_ATTEMPTS; attempt += 1) {
      x = (Math.random() * 2 - 1) * limit;
      const farFromBoss = Math.abs(x - boss.x) >= TOTEM_MIN_DISTANCE_FROM_BOSS;
      const farFromOthers = placed.every((other) => Math.abs(x - other) >= TOTEM_MIN_SPACING);
      if (farFromBoss && farFromOthers) break;
    }
    placed.push(x);
    world.totems.push({ x, hp: TOTEM_HP, hpMax: TOTEM_HP, flash: 0, lastPlayerSwing: -1, lastEveSwing: -1 });
  }
  useArenaStore.getState().set({ totemsLeft: world.totems.length });
}

/**
 * Lancia una torretta: indipendente dalla mossa in corso (attacco asincrono).
 * Si pianta a terra oppure su uno dei due muri, a un'altezza raggiungibile
 * saltando (anche in doppio salto), e da lì spara da sola.
 */
export function spawnTurret(world: ArenaWorld): void {
  const { boss, player } = world;
  const max = boss.round === 1 ? TURRET_MAX_ROUND1 : TURRET_MAX_ROUND2;
  if (world.turrets.length >= max) return;

  let x = 0;
  let y = 0;
  let mount: 'floor' | 'wall' = 'floor';
  if (Math.random() < TURRET_FLOOR_CHANCE) {
    y = TURRET_SIZE / 2;
    for (let attempt = 0; attempt < TURRET_FLOOR_ATTEMPTS; attempt += 1) {
      x = (Math.random() * 2 - 1) * (ARENA_HALF_WIDTH - TURRET_EDGE_MARGIN);
      const farFromPlayer = Math.abs(x - player.x) >= TURRET_MIN_DISTANCE_FROM_PLAYER;
      const farFromOthers = world.turrets.every((other) => Math.abs(other.x - x) >= TURRET_MIN_SPACING);
      if (farFromPlayer && farFromOthers) break;
    }
  } else {
    mount = 'wall';
    const side = Math.random() < 0.5 ? -1 : 1;
    x = side * (ARENA_HALF_WIDTH - TURRET_SIZE / 2 + TURRET_WALL_INSET);
    for (let attempt = 0; attempt < TURRET_WALL_ATTEMPTS; attempt += 1) {
      y = TURRET_WALL_Y[0] + Math.random() * (TURRET_WALL_Y[1] - TURRET_WALL_Y[0]);
      const clearOfOthers = world.turrets.every(
        (other) => other.x !== x || Math.abs(other.y - y) >= TURRET_WALL_MIN_GAP
      );
      if (clearOfOthers) break;
    }
  }
  world.turrets.push({
    x,
    y,
    mount,
    state: 'flying',
    fromX: boss.x,
    fromY: boss.y + TURRET_LAUNCH_HEIGHT,
    flyT: 0,
    hp: TURRET_HP,
    hpMax: TURRET_HP,
    // Prima di sparare passa un po': non appena atterra non deve fare fuoco.
    fireTimer: TURRET_CHARGE + 1 + Math.random(),
    flash: 0,
    lastPlayerSwing: -1,
    lastEveSwing: -1
  });
}

/** Timer indipendente delle torrette: ne lancia una a intervalli casuali, qualunque cosa faccia Checco. */
export function tickTurretTimer({ world, rt }: BossContext, delta: number): void {
  rt.turretTimer -= delta;
  if (rt.turretTimer <= 0) {
    spawnTurret(world);
    const [minGap, maxGap] = world.boss.round === 1 ? TURRET_INTERVAL_ROUND1 : TURRET_INTERVAL_ROUND2;
    rt.turretTimer = minGap + Math.random() * (maxGap - minGap);
  }
}

/** Proiettile orizzontale davanti a Checco (parabile e rimandabile indietro). */
export function spawnBossProjectile(world: ArenaWorld, projectile: MoveProjectile): void {
  const { boss } = world;
  world.projectiles.push({
    x: boss.x + boss.facing * PROJECTILE_SPAWN_OFFSET,
    y: projectile.y,
    vx: boss.facing * projectile.speed,
    damage: projectile.damage,
    owner: 'boss',
    life: PROJECTILE_LIFETIME
  });
}

/** Detriti dal soffitto attorno al giocatore: marcatore a terra, poi caduta (non parabili). */
export function spawnDebris(world: ArenaWorld, debris: MoveDebris): void {
  const { player } = world;
  // Ordine di caduta mescolato, così non si legge una sequenza fissa.
  const order = Array.from({ length: debris.count }, (_, i) => i).sort(() => Math.random() - 0.5);
  order.forEach((slot, n) => {
    const offset = (slot - (debris.count - 1) / 2) * debris.spacing + (Math.random() - 0.5) * DEBRIS_JITTER;
    const x = Math.min(
      ARENA_HALF_WIDTH - DEBRIS_EDGE_MARGIN,
      Math.max(-ARENA_HALF_WIDTH + DEBRIS_EDGE_MARGIN, player.x + offset)
    );
    world.hazards.push({
      x,
      y: ARENA_CEILING_Y,
      vy: 0,
      warn: debris.warn + n * debris.stagger,
      damage: debris.damage,
      state: 'warn'
    });
  });
}

/** Fulmine a ricerca lanciato da Checco (in aria) verso il giocatore. */
export function spawnBolt(world: ArenaWorld, storm: MoveStorm): void {
  const { boss, player } = world;
  const originX = boss.x;
  const originY = boss.y + BOLT_ORIGIN_HEIGHT;
  const dxToPlayer = player.x - originX;
  const dyToPlayer = player.y + PLAYER_AIM_HEIGHT - originY;
  const length = Math.hypot(dxToPlayer, dyToPlayer) || 1;
  world.projectiles.push({
    x: originX,
    y: originY,
    vx: (dxToPlayer / length) * storm.boltSpeed,
    vy: (dyToPlayer / length) * storm.boltSpeed,
    damage: storm.boltDamage,
    owner: 'boss',
    life: PROJECTILE_LIFETIME,
    homing: true,
    kind: 'bolt'
  });
}
