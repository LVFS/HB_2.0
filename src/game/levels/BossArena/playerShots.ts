import type { ArenaProjectile, ArenaWorld } from './arenaState';
import {
  ARENA_HALF_WIDTH,
  ARENA_PLAYER_HEIGHT,
  BOSS_HALF_WIDTH,
  BOSS_HEIGHT,
  GUN_DAMAGE,
  GUN_HEIGHT,
  GUN_OBJECT_DAMAGE,
  GUN_PARRY_POSTURE,
  GUN_POSTURE,
  GUN_RAY_HALF_HEIGHT,
  GUN_TRACER_LIFE,
  PROJECTILE_HALF_SIZE,
  SHOCK_DAMAGE,
  SHOCK_HALF_HEIGHT,
  SHOCK_POSTURE,
  SHOCK_SPEED,
  TOTEM_HALF_WIDTH,
  TOTEM_HEIGHT,
  TURRET_SIZE,
  WAVE_HALF_HEIGHT,
  WAVE_SPEED
} from './arenaConfig';
import {
  addRing,
  damageTotem,
  damageTurret,
  gunParryBoss,
  hitBoss,
  parryProjectile,
  reflectProjectileToBoss
} from './combat';

/**
 * Colpi a distanza del giocatore nel potenziamento Bloodborne: la pistola
 * (istantanea), il fendente celeste (onda che viaggia fino al primo ostacolo) e
 * l'onda d'urto del berserk (attraversa tutto). Regola comune: tutto ciò che si
 * frappone fra il colpo e il boss/il muro viene "parato" — i proiettili nemici
 * rimandati o distrutti, torrette e oggetti del Buen Camino danneggiati — e se
 * Checco sta eseguendo un attacco parabile il colpo è una PARATA, non un attacco.
 */

type ShotTarget =
  | { kind: 'projectile'; ref: ArenaProjectile; dist: number }
  | { kind: 'turret'; ref: ArenaWorld['turrets'][number]; dist: number }
  | { kind: 'totem'; ref: ArenaWorld['totems'][number]; dist: number }
  | { kind: 'boss'; ref: ArenaWorld['boss']; dist: number };

/** Tutto ciò che il colpo incontra fra `x` e `x + dir * maxDist`, dal più vicino. */
function collectTargets(
  world: ArenaWorld,
  x: number,
  y: number,
  dir: 1 | -1,
  halfHeight: number,
  maxDist: number
): ShotTarget[] {
  const found: ShotTarget[] = [];
  const consider = (centerX: number, centerY: number, halfW: number, halfH: number): number | null => {
    const ahead = (centerX - x) * dir;
    if (ahead <= 0) return null;
    if (Math.abs(centerY - y) > halfH + halfHeight) return null;
    const dist = Math.max(0, ahead - halfW);
    return dist <= maxDist ? dist : null;
  };

  for (const proj of world.projectiles) {
    if (proj.owner !== 'boss') continue;
    const dist = consider(proj.x, proj.y, PROJECTILE_HALF_SIZE, PROJECTILE_HALF_SIZE);
    if (dist !== null) found.push({ kind: 'projectile', ref: proj, dist });
  }
  for (const turret of world.turrets) {
    if (turret.state !== 'active') continue;
    const dist = consider(turret.x, turret.y, TURRET_SIZE / 2, TURRET_SIZE / 2);
    if (dist !== null) found.push({ kind: 'turret', ref: turret, dist });
  }
  for (const totem of world.totems) {
    const dist = consider(totem.x, TOTEM_HEIGHT / 2, TOTEM_HALF_WIDTH, TOTEM_HEIGHT / 2);
    if (dist !== null) found.push({ kind: 'totem', ref: totem, dist });
  }
  const { boss } = world;
  if (boss.hp > 0 && !boss.vanished) {
    const dist = consider(boss.x, boss.y + BOSS_HEIGHT / 2, BOSS_HALF_WIDTH, BOSS_HEIGHT / 2);
    if (dist !== null) found.push({ kind: 'boss', ref: boss, dist });
  }
  return found.sort((a, b) => a.dist - b.dist);
}

interface ShotPayload {
  /** Danno e postura se il bersaglio è Checco (non in attacco). */
  damage: number;
  posture: number;
  /** Danno a torrette e oggetti del Buen Camino. */
  objectDamage: number;
  /** Postura data a Checco se il colpo lo PARA. */
  parryPosture: number;
  /** Proiettile nemico: rimandato contro Checco (`true`) o distrutto (`false`). */
  reflect: boolean;
}

/** Applica il colpo a un bersaglio. */
function resolveTarget(world: ArenaWorld, target: ShotTarget, payload: ShotPayload): void {
  switch (target.kind) {
    case 'projectile': {
      const index = world.projectiles.indexOf(target.ref);
      if (index < 0) return;
      if (payload.reflect && target.ref.kind !== 'bolt') {
        reflectProjectileToBoss(world, target.ref);
      } else {
        // Fulmini e onda d'urto: il proiettile viene fermato (conta come parata).
        world.projectiles.splice(index, 1);
        parryProjectile(world);
      }
      return;
    }
    case 'turret': {
      const index = world.turrets.indexOf(target.ref);
      if (index >= 0) damageTurret(world, index, payload.objectDamage);
      return;
    }
    case 'totem': {
      const index = world.totems.indexOf(target.ref);
      if (index >= 0) damageTotem(world, index, payload.objectDamage);
      return;
    }
    case 'boss': {
      if (world.boss.parryable) gunParryBoss(world, payload.parryPosture);
      else hitBoss(world, { damage: payload.damage, posture: payload.posture, source: 'player' });
    }
  }
}

const GUN_PAYLOAD: ShotPayload = {
  damage: GUN_DAMAGE,
  posture: GUN_POSTURE,
  objectDamage: GUN_OBJECT_DAMAGE,
  parryPosture: GUN_PARRY_POSTURE,
  reflect: true
};

/** Pistola: colpo istantaneo nella direzione in cui guarda il giocatore. */
export function fireGun(world: ArenaWorld): void {
  const { player } = world;
  const x = player.x + player.facing * 0.45;
  const y = player.y + GUN_HEIGHT;
  const target = collectTargets(world, x, y, player.facing, GUN_RAY_HALF_HEIGHT, Infinity)[0];
  const length = target ? target.dist : ARENA_HALF_WIDTH + 1.5 - player.facing * x;
  world.shots.push({
    kind: 'tracer',
    x,
    y,
    dir: player.facing,
    x2: x + player.facing * length,
    life: GUN_TRACER_LIFE,
    damage: 0,
    posture: 0
  });
  if (target) resolveTarget(world, target, GUN_PAYLOAD);
}

/** Fendente celeste (mezza barra): onda che viaggia finché non trova qualcosa. */
export function launchWave(world: ArenaWorld, damage: number, posture: number): void {
  const { player } = world;
  world.shots.push({
    kind: 'wave',
    x: player.x + player.facing * 0.8,
    y: player.y + GUN_HEIGHT,
    dir: player.facing,
    life: 3,
    damage,
    posture
  });
}

/** Ruggito del berserk: onda d'urto che attraversa tutto fino al bordo dell'arena. */
export function launchShock(world: ArenaWorld): void {
  const { player } = world;
  world.shots.push({
    kind: 'shock',
    x: player.x + player.facing * 0.6,
    y: player.y + ARENA_PLAYER_HEIGHT / 2,
    dir: player.facing,
    life: 3,
    damage: SHOCK_DAMAGE,
    posture: SHOCK_POSTURE,
    hit: new Set<object>()
  });
  addRing(world, player.x, player.y + ARENA_PLAYER_HEIGHT / 2, 2.2, 0.45, '#ef4444');
  world.hitStop = Math.max(world.hitStop, 0.12);
}

/** Muove onde e tracce e risolve gli impatti. Un frame di gioco (non in hit-stop). */
export function updateShots(world: ArenaWorld, delta: number): void {
  for (let i = world.shots.length - 1; i >= 0; i -= 1) {
    const shot = world.shots[i];
    if (shot.kind === 'tracer') {
      shot.life -= delta;
      if (shot.life <= 0) world.shots.splice(i, 1);
      continue;
    }

    const isShock = shot.kind === 'shock';
    const step = (isShock ? SHOCK_SPEED : WAVE_SPEED) * delta;
    const halfHeight = isShock ? SHOCK_HALF_HEIGHT : WAVE_HALF_HEIGHT;
    const targets = collectTargets(world, shot.x, shot.y, shot.dir, halfHeight, step).filter(
      (target) => !shot.hit?.has(target.ref)
    );

    if (isShock) {
      // L'onda d'urto non si ferma: colpisce una sola volta ciascun bersaglio.
      const payload: ShotPayload = {
        damage: shot.damage,
        posture: shot.posture,
        objectDamage: shot.damage,
        parryPosture: shot.posture,
        reflect: false
      };
      for (const target of targets) {
        shot.hit?.add(target.ref);
        resolveTarget(world, target, payload);
      }
    } else if (targets.length > 0) {
      resolveTarget(world, targets[0], {
        damage: shot.damage,
        posture: shot.posture,
        objectDamage: shot.damage,
        parryPosture: shot.posture,
        reflect: true
      });
      world.shots.splice(i, 1);
      addRing(world, shot.x + shot.dir * targets[0].dist, shot.y, 1.1, 0.25, '#7dd3fc');
      continue;
    }

    shot.x += shot.dir * step;
    shot.life -= delta;
    if (shot.life <= 0 || Math.abs(shot.x) > ARENA_HALF_WIDTH + 2) world.shots.splice(i, 1);
  }
}
