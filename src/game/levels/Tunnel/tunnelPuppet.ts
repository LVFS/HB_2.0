import { aabbOverlap } from '@/game/render2d/collision';
import { hitPlayer, parryProjectile, playerHurtbox } from '../BossArena/combat';
import { ARENA_PLAYER_HEIGHT, HITSTOP_LIGHT, PROJECTILE_HALF_SIZE } from '../BossArena/arenaConfig';
import { puppetDistanceFor, type TunnelWorld } from './tunnelState';
import {
  ARCHER,
  BARRAGE_PUPPET_DIST,
  MALUS,
  MODE_ANIME,
  MODE_CAMINO,
  sectionIndexAt,
  TUNNEL_DESPAWN_BEHIND,
  TUNNEL_GAP_DRIFT_PER_SEC,
  TUNNEL_GAP_FLOOR_BEFORE_FINALE,
  TUNNEL_GAP_HIT_PENALTY,
  TUNNEL_GAP_MAX,
  TUNNEL_GAP_MELEE,
  TUNNEL_GAP_REFLECT_BONUS,
  TUNNEL_GAP_SMOOTH,
  TUNNEL_RUN_SPEED,
  TUNNEL_SECTIONS,
  TUNNEL_THROW
} from './tunnelConfig';
import { catClosingBonus } from './tunnelCat';
import { defeatEnemy, enemyById } from './tunnelEnemies';
import { inPlayerLane } from './tunnelLanes';
import { boulderNudge, gapDriftMultiplier, onPlayerHit } from './tunnelSlancio';
import { parryStats, rangedImmune, tryInstinct } from './tunnelWishes';

/**
 * La marionetta di Checco, che corre davanti a D, e la distanza (`gap`, in metri)
 * fra i due: lanci telegrafati, proiettili parabili (la parata li RIMANDA contro di
 * lei e recupera terreno) o da saltare. La distanza è FISICA: la marionetta sta
 * `TUNNEL_PUPPET_DIST_MIN + gap` unità davanti a D, quindi fuori dallo schermo
 * finché è lontana. Ogni spinta sul `gap` (colpi, rimbalzi, eventi) si accumula in
 * `gapPending` e si applica in circa un secondo: la marionetta non scatta mai.
 * Pura (niente React/Three). I proiettili vivono in `world.arena.projectiles` e la
 * marionetta è `world.arena.boss` per le regole di `combat.ts` che le riguardano.
 */

/** Altezza del centro della marionetta, per mirare i proiettili rimandati. */
const PUPPET_CENTER_Y = 1.2;
const PUPPET_HALF_WIDTH = 0.6;
const PUPPET_HALF_HEIGHT = 1.2;
/** Margine (unità) oltre il bordo destro entro cui la marionetta conta ancora come "in scena". */
const ON_SCREEN_MARGIN = 0.6;
/** Con che prontezza (1/s) la marionetta segue lo scarto laterale di D. */
const PUPPET_FOLLOW_SPEED = 3;

/** Minimo del `gap`: prima dell'ultima sezione non scende troppo, così la corsa dura. */
function gapFloor(world: TunnelWorld): number {
  return world.sectionIndex < TUNNEL_SECTIONS.length - 1 ? TUNNEL_GAP_FLOOR_BEFORE_FINALE : 0;
}

/** Imposta il `gap` rispettando i limiti (0..100 e il minimo della sezione). */
function setGap(world: TunnelWorld, value: number): void {
  world.gap = Math.min(TUNNEL_GAP_MAX, Math.max(gapFloor(world), value));
}

/**
 * Una spinta sulla distanza (metri, positiva = Checco si allontana). NON cambia il `gap` subito:
 * la versa `updateGap` nel giro di ~1 s, così la marionetta si muove in modo continuo.
 */
export function addGap(world: TunnelWorld, amount: number): void {
  world.gapPending += amount;
}

/** Programma un lancio che ARRIVA a D al secondo `t`; quando parte lo decide `updatePuppet` in base alla distanza. */
export function scheduleThrow(world: TunnelWorld, t: number, parryable: boolean, lane: number, note = false): void {
  world.throws.push({ t, parryable, lane, note, launchT: null, dist: 0 });
  world.throws.sort((a, b) => a.t - b.t);
}

/** Velocità con cui un proiettile lanciato si avvicina a D (la corsa di D più la sua, che va in senso opposto). */
export const THROW_APPROACH_SPEED = TUNNEL_RUN_SPEED - TUNNEL_THROW.speed;

/** La distanza cala da sola mentre D corre (più in fretta con lo Slancio) e riceve le spinte accumulate. */
export function updateGap(world: TunnelWorld, delta: number): void {
  world.sectionIndex = sectionIndexAt(world.time);
  // Le modalità spostano il ritmo: nel Buen Camino Checco scappa (+), nella modalità shonen inciampa (−).
  const modeRate = world.mode.id === 'camino' ? MODE_CAMINO.gapRate : world.mode.id === 'anime' ? MODE_ANIME.gapRate : 0;
  // Rallentato (sui resti dei nemici): Checco guadagna terreno.
  const slowRate = world.slowT > 0 ? MALUS.slowGap : 0;
  const closing = (TUNNEL_GAP_DRIFT_PER_SEC * gapDriftMultiplier(world) + modeRate + slowRate - catClosingBonus(world)) * delta;
  const step = world.gapPending * Math.min(1, TUNNEL_GAP_SMOOTH * delta);
  world.gapPending -= step;
  setGap(world, world.gap + closing + step);
}

/** Posizione, avvisi e lanci della marionetta. */
export function updatePuppet(world: TunnelWorld, delta: number): void {
  const { arena, puppet } = world;
  // La distanza visiva segue con un po' di ritardo quella ricavata dal `gap` (fisica, in metri).
  const targetDist = world.barrage ? BARRAGE_PUPPET_DIST : puppetDistanceFor(world.gap);
  puppet.dist += (targetDist - puppet.dist) * Math.min(1, 6 * delta);
  // Lo scatto o lo spostamento di D NON accorcia la distanza: la marionetta segue (piano) lo scarto laterale di D.
  puppet.follow += (world.strafe - puppet.follow) * Math.min(1, PUPPET_FOLLOW_SPEED * delta);
  puppet.lane += (world.lane.pos - puppet.lane) * Math.min(1, PUPPET_FOLLOW_SPEED * delta);
  puppet.x = world.runX + puppet.follow + puppet.dist;
  puppet.onScreen = puppet.x - world.runX <= world.view.rightEdge + ON_SCREEN_MARGIN;
  // La marionetta è anche "il boss" dell'arena-mondo: serve a `combat.ts` per mirare/rimandare.
  arena.boss.x = puppet.x;
  arena.boss.y = 0;
  puppet.flash = Math.max(0, puppet.flash - delta);

  // Un colpo di spada (anche col pugno a gomma) che la raggiunge conta come terreno guadagnato.
  const player = arena.player;
  if (player.attackBox && puppet.lastSwing !== player.swingId) {
    const box = { x: puppet.x, y: PUPPET_CENTER_Y, halfWidth: PUPPET_HALF_WIDTH, halfHeight: PUPPET_HALF_HEIGHT };
    if (aabbOverlap(player.attackBox, box)) {
      puppet.lastSwing = player.swingId;
      addGap(world, TUNNEL_GAP_MELEE);
      puppet.flash = 0.3;
      arena.hitStop = Math.max(arena.hitStop, HITSTOP_LIGHT);
      arena.popups.push({ x: puppet.x, y: 3, amount: 0, target: 'boss', boost: 1, label: world.buffs.gomu > 0 ? 'GOMU GOMU!' : 'COLPITO!' });
    }
  }

  // Lanci: si fissa quando parte (arrivo − distanza / avvicinamento) all'inizio dell'avviso.
  puppet.telegraph = 0;
  puppet.telegraphKind = null;
  for (const next of world.throws) {
    if (next.launchT === null) {
      const leadTime = puppet.dist / THROW_APPROACH_SPEED;
      if (world.time >= next.t - leadTime - TUNNEL_THROW.telegraph) {
        next.launchT = next.t - leadTime;
        next.dist = puppet.dist;
      } else continue;
    }
    if (puppet.telegraphKind === null && world.time < next.launchT) {
      puppet.telegraph = Math.max(0.001, (world.time - (next.launchT - TUNNEL_THROW.telegraph)) / TUNNEL_THROW.telegraph);
      puppet.telegraphKind = next.parryable ? 'parry' : 'dodge';
    }
  }
  // Il proiettile esce dalla mano alla distanza fissata: arriva a D esattamente al secondo del copione.
  for (let i = world.throws.length - 1; i >= 0; i -= 1) {
    const next = world.throws[i];
    if (next.launchT === null || world.time < next.launchT) continue;
    world.throws.splice(i, 1);
    arena.projectiles.push({
      x: world.runX + next.dist - 0.4,
      y: next.parryable ? TUNNEL_THROW.y : TUNNEL_THROW.redY,
      vx: TUNNEL_THROW.speed,
      damage: TUNNEL_THROW.damage,
      owner: 'boss',
      life: next.dist / THROW_APPROACH_SPEED + 2,
      unparryable: !next.parryable,
      lane: next.lane,
      note: next.note
    });
  }
}

/** Proiettili: quelli della marionetta colpiscono D o vengono parati (e rimandati); quelli rimandati inseguono la marionetta. */
export function updateProjectiles(world: TunnelWorld, delta: number): void {
  const { arena, puppet } = world;
  const player = arena.player;
  const hurt = playerHurtbox(arena);
  const parryReach = parryStats(world).reach;
  const parryBox = {
    x: player.x + parryReach / 2,
    y: player.y + ARENA_PLAYER_HEIGHT / 2,
    halfWidth: parryReach / 2,
    halfHeight: ARENA_PLAYER_HEIGHT / 2
  };

  for (let i = arena.projectiles.length - 1; i >= 0; i -= 1) {
    const proj = arena.projectiles[i];
    proj.life -= delta;

    // Un dardo rimandato torna a chi l'ha scoccato (se è ancora in piedi) e lo spezza; altrimenti insegue la marionetta.
    const shooter = proj.owner === 'player' && proj.source !== undefined ? enemyById(world, proj.source) : undefined;
    if (shooter) {
      const dx = shooter.x - proj.x;
      const dy = shooter.height / 2 - proj.y;
      const length = Math.hypot(dx, dy) || 1;
      proj.vx = (dx / length) * TUNNEL_THROW.reflectSpeed;
      proj.vy = (dy / length) * TUNNEL_THROW.reflectSpeed;
      proj.x += proj.vx * delta;
      proj.y += proj.vy * delta;
      if (Math.abs(proj.x - shooter.x) < shooter.width / 2 + PROJECTILE_HALF_SIZE && Math.abs(proj.y - shooter.height / 2) < shooter.height / 2 + PROJECTILE_HALF_SIZE) {
        defeatEnemy(world, shooter, 'SPEZZATO!', ARCHER.reflectReward);
        arena.projectiles.splice(i, 1);
      } else if (proj.life <= 0) arena.projectiles.splice(i, 1);
      continue;
    }
    if (proj.owner === 'player') {
      // Rimandato: insegue la marionetta (che corre via) più veloce di lei.
      const dx = puppet.x - proj.x;
      const dy = PUPPET_CENTER_Y - proj.y;
      const length = Math.hypot(dx, dy) || 1;
      proj.vx = (dx / length) * TUNNEL_THROW.reflectSpeed;
      proj.vy = (dy / length) * TUNNEL_THROW.reflectSpeed;
    }
    proj.x += proj.vx * delta;
    proj.y += (proj.vy ?? 0) * delta;
    const box = { x: proj.x, y: proj.y, halfWidth: PROJECTILE_HALF_SIZE, halfHeight: PROJECTILE_HALF_SIZE };
    let remove = proj.life <= 0 || proj.x < player.x - TUNNEL_DESPAWN_BEHIND;

    if (proj.owner === 'boss') {
      // Un proiettile colpisce o si para solo nella via di D; nelle altre passa oltre.
      const here = proj.lane === undefined || inPlayerLane(world, proj.lane);
      if (!here) {
        // niente
      } else if (player.parryActive && !proj.unparryable && aabbOverlap(box, parryBox)) {
        // Parata a timing: il proiettile torna contro la marionetta.
        proj.owner = 'player';
        proj.damage = 0;
        proj.life = TUNNEL_THROW.reflectLife;
        parryProjectile(arena);
      } else if (world.buffs.gomu > 0 && player.attackBox && aabbOverlap(box, player.attackBox)) {
        // Col pugno a gomma si rimanda indietro anche ciò che non si può parare.
        proj.owner = 'player';
        proj.damage = 0;
        proj.unparryable = false;
        proj.life = TUNNEL_THROW.reflectLife;
        arena.popups.push({ x: proj.x, y: proj.y + 0.4, amount: 0, target: 'boss', boost: 1, label: 'GOMU GOMU!' });
      } else if (proj.ranged && rangedImmune(world) && aabbOverlap(box, hurt)) {
        // Smoking a velocità massima: i colpi a distanza dei nemici non lo toccano.
        arena.popups.push({ x: proj.x, y: proj.y + 0.5, amount: 0, target: 'boss', boost: 1, label: 'IMPASSIBILE!' });
        remove = true;
      } else if (aabbOverlap(box, hurt)) {
        // L'Istinto Superiore lo schiva da solo (e il proiettile passa oltre).
        if (tryInstinct(world)) continue;
        const result = hitPlayer(arena, proj.damage, { unparryable: proj.unparryable, sourceX: proj.x + 1 });
        if (result !== 'ignored') {
          if (proj.note) world.karaokeHits += 1;
          if (proj.brake) {
            world.brakeT = MALUS.brake;
            boulderNudge(world);
            arena.popups.push({ x: player.x, y: player.y + 2.4, amount: 0, target: 'player', boost: 1, label: 'FRENATO!' });
          }
          addGap(world, TUNNEL_GAP_HIT_PENALTY);
          onPlayerHit(world);
          remove = true;
        }
      }
    } else if (aabbOverlap(box, { x: puppet.x, y: PUPPET_CENTER_Y, halfWidth: PUPPET_HALF_WIDTH, halfHeight: PUPPET_HALF_HEIGHT })) {
      // Rimbalzo a segno: la marionetta incassa e D recupera terreno (valore fisso, anche se lei è fuori schermo).
      addGap(world, TUNNEL_GAP_REFLECT_BONUS);
      puppet.flash = 0.4;
      arena.hitStop = Math.max(arena.hitStop, HITSTOP_LIGHT);
      arena.popups.push({ x: Math.min(puppet.x, world.runX + world.view.rightEdge - 1.5), y: 3, amount: 0, target: 'boss', boost: 1, label: 'RIMBALZO!' });
      remove = true;
    }
    if (remove) arena.projectiles.splice(i, 1);
  }
}
