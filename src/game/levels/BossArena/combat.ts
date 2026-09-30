import { useArenaStore } from '@/store/arenaStore';
import type { AABB } from '@/game/render2d/collision';
import type { ArenaWorld } from './arenaState';
import {
  ARENA_PLAYER_HEIGHT,
  BOSS_HALF_WIDTH,
  BOSS_HEIGHT,
  BOSS_STAGGER_DAMAGE_MULTIPLIER,
  BOSS_STAGGER_DURATION,
  COUNTER_MULTIPLIER,
  COUNTER_WINDOW,
  EVE_HEIGHT,
  HITSTOP_LIGHT,
  HITSTOP_PARRY,
  PARRY_POSTURE_GAIN,
  PLAYER_HIT_STUN,
  PLAYER_IFRAMES_AFTER_HIT,
  PLAYER_KNOCKBACK,
  POSTURE_MAX,
  SKILL_GAIN_HIT,
  SKILL_GAIN_PARRY,
  SKILL_GAIN_STAGGER,
  SKILL_MAX
} from './arenaConfig';

/**
 * Carica la barra abilità del giocatore. Si guadagna solo facendo bene (colpo
 * a segno, parata riuscita, barcollamento INFLITTO al boss) — mai subendo,
 * altrimenti premierebbe l'essere colpiti.
 */
export function gainSkill(world: ArenaWorld, amount: number): void {
  const { player } = world;
  player.skill = Math.min(SKILL_MAX, player.skill + amount);
  useArenaStore.getState().set({ skill: Math.round(player.skill) });
}

/** Bersaglio dei colpi: le scatole "che possono essere colpite". */
export function playerHurtbox(world: ArenaWorld): AABB {
  return { x: world.player.x, y: world.player.y + ARENA_PLAYER_HEIGHT / 2, halfWidth: 0.35, halfHeight: ARENA_PLAYER_HEIGHT / 2 };
}
export function bossHurtbox(world: ArenaWorld): AABB {
  return { x: world.boss.x, y: world.boss.y + BOSS_HEIGHT / 2, halfWidth: BOSS_HALF_WIDTH, halfHeight: BOSS_HEIGHT / 2 };
}
export function eveHurtbox(world: ArenaWorld): AABB {
  return { x: world.eve.x, y: EVE_HEIGHT / 2, halfWidth: 0.35, halfHeight: EVE_HEIGHT / 2 };
}

function requestHitStop(world: ArenaWorld, seconds: number) {
  world.hitStop = Math.max(world.hitStop, seconds);
}

/**
 * Un colpo (del giocatore o di Eve) va a segno sul boss: danno, postura,
 * eventuale barcollamento. I moltiplicatori si compongono: buff del giocatore,
 * contraccolpo dopo una parata riuscita, boss già barcollante (= "danno
 * critico" alla Sekiro, ma senza uccisione istantanea).
 */
export function hitBoss(
  world: ArenaWorld,
  hit: { damage: number; posture: number; source: 'player' | 'eve' }
): void {
  const { boss, player } = world;
  if (boss.hp <= 0 || world.over) return;

  let damage = hit.damage;
  if (hit.source === 'player') {
    damage *= player.damageMultiplier;
    if (player.counterWindow > 0) damage *= COUNTER_MULTIPLIER;
  }
  if (boss.staggerTimer > 0) damage *= BOSS_STAGGER_DAMAGE_MULTIPLIER;

  boss.hp = Math.max(0, boss.hp - damage);
  boss.hitFlash = 0.1;
  if (boss.specialActive) boss.specialDamageTaken += damage;
  requestHitStop(world, HITSTOP_LIGHT);

  if (hit.source === 'player') gainSkill(world, SKILL_GAIN_HIT);
  if (boss.staggerTimer <= 0) addPosture(world, hit.posture, hit.source === 'player');

  useArenaStore.getState().set({ bossHp: Math.round(boss.hp) });
}

/**
 * Aggiunge postura; a soglia massima il boss barcolla (finestra di danno).
 * `byPlayer`: se il barcollamento lo provoca il giocatore (colpi o parata),
 * carica la barra abilità — non quando lo causa Eve o un effetto dell'evento.
 */
export function addPosture(world: ArenaWorld, amount: number, byPlayer = false): void {
  const { boss } = world;
  if (boss.staggerTimer > 0) return;
  boss.posture = Math.min(POSTURE_MAX, boss.posture + amount);
  if (boss.posture >= POSTURE_MAX) {
    boss.staggerTimer = BOSS_STAGGER_DURATION;
    if (byPlayer) gainSkill(world, SKILL_GAIN_STAGGER);
  }
  useArenaStore.getState().set({ bossPosture: Math.round(boss.posture) });
}

export type PlayerHitResult = 'hit' | 'parried' | 'ignored';

/**
 * Un colpo del boss raggiunge il giocatore. Dash e i-frames lo ignorano; una
 * parata a timing lo annulla, aumenta la postura del boss e apre la finestra
 * di contraccolpo; altrimenti danno, reazione e brevi i-frames.
 */
export function hitPlayer(
  world: ArenaWorld,
  damage: number,
  { unparryable = false }: { unparryable?: boolean } = {}
): PlayerHitResult {
  const { player, boss } = world;
  if (world.over || player.invulnerable || player.iframes > 0) return 'ignored';

  // Un colpo non parabile (es. l'onda dello schianto) si schiva o si salta:
  // la parata non lo annulla.
  if (player.parryActive && !unparryable) {
    player.parryFlash = 0.25;
    player.counterWindow = COUNTER_WINDOW;
    requestHitStop(world, HITSTOP_PARRY);
    gainSkill(world, SKILL_GAIN_PARRY);
    addPosture(world, PARRY_POSTURE_GAIN, true);
    return 'parried';
  }

  player.healing = false;
  player.hp = Math.max(0, player.hp - damage);
  player.hitTimer = PLAYER_HIT_STUN;
  player.iframes = PLAYER_IFRAMES_AFTER_HIT;
  player.knockbackVx = (player.x >= boss.x ? 1 : -1) * PLAYER_KNOCKBACK;
  requestHitStop(world, HITSTOP_LIGHT);
  useArenaStore.getState().set({ playerHp: Math.round(player.hp) });

  if (player.hp <= 0) {
    world.over = 'defeat';
    useArenaStore.getState().set({ message: 'Sconfitto', hint: 'Si riparte dall’inizio' });
  }
  return 'hit';
}
