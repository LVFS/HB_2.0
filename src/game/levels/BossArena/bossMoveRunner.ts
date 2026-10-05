import { aabbOverlap } from '@/game/render2d/collision';
import { startClash } from './bossClash';
import { pickEngageDistance, totalDuration, type BossContext } from './bossRuntime';
import { spawnBolt, spawnBossProjectile, spawnDebris } from './bossSpawns';
import { CHECCO_MOVES_ROUND1, CHECCO_MOVES_ROUND2, type CheccoMove } from './checcoMoves';
import { eveHurtbox, hitPlayer, playerHurtbox } from './combat';
import {
  ARENA_HALF_WIDTH,
  BOSS_EDGE_MARGIN,
  BOSS_MOVE_COOLDOWN_ROUND1,
  BOSS_MOVE_COOLDOWN_ROUND2,
  BOSS_SPEED_ROUND1,
  BOSS_SPEED_ROUND2,
  ENGAGE_APPROACH_TOLERANCE,
  ENGAGE_RETREAT_SPEED,
  ENGAGE_RETREAT_TOLERANCE,
  EVE_AGGRO_CHANCE,
  LUNGE_MAX_SPEED,
  LUNGE_MIN_SPEED,
  LUNGE_MIN_TRAVEL,
  TELEPORT_BEHIND_DISTANCE,
  TELEPORT_EDGE_MARGIN
} from './arenaConfig';

/**
 * Esecuzione delle mosse di Checco: scelta pesata, comportamento "libero"
 * (avvicinarsi/arretrare fino alla distanza di ingaggio) e la mossa in corso
 * (telegrafo → colpi attivi → recupero: salti, proiettili, detriti, tempesta,
 * teletrasporto, cariche, contrasto). I dati delle mosse stanno in `checcoMoves.ts`.
 */

function chooseMove({ world, rt }: BossContext, distance: number): CheccoMove | null {
  const moves = world.boss.round === 1 ? CHECCO_MOVES_ROUND1 : CHECCO_MOVES_ROUND2;
  if (import.meta.env.DEV && world.forceMove) {
    const forced = CHECCO_MOVES_ROUND2.find((candidate) => candidate.id === world.forceMove);
    world.forceMove = null;
    if (forced) return forced;
  }
  const inRange = moves.filter((m) => distance >= m.minRange && distance <= m.maxRange);
  const fresh = inRange.filter((m) => m.id !== rt.lastMoveId);
  const pool = fresh.length > 0 ? fresh : inRange;
  if (pool.length === 0) return null;
  // Scelta pesata: le cariche (`weight` più alto) escono più spesso.
  const total = pool.reduce((sum, move) => sum + (move.weight ?? 1), 0);
  let roll = Math.random() * total;
  let picked = pool[pool.length - 1];
  for (const move of pool) {
    roll -= move.weight ?? 1;
    if (roll <= 0) {
      picked = move;
      break;
    }
  }
  if (import.meta.env.DEV) world.moveLog.push(picked.id);
  return picked;
}

/**
 * Libero (nessuna mossa, nessun evento): si avvicina o arretra fino alla
 * distanza di ingaggio e, a cooldown finito, sceglie una mossa.
 * `dx` = distanza col bersaglio (con segno), `targetX` = dove si trova.
 */
export function updateBossFree(ctx: BossContext, delta: number, dx: number, targetX: number, eveActive: boolean): void {
  const { world, rt } = ctx;
  const { boss } = world;
  boss.attackBox = null;
  boss.facing = dx >= 0 ? 1 : -1;
  rt.cooldown -= delta;
  const speed = (boss.round === 1 ? BOSS_SPEED_ROUND1 : BOSS_SPEED_ROUND2) * boss.speedMultiplier;
  if (rt.cooldown <= 0) {
    const move = chooseMove(ctx, Math.abs(dx));
    if (move) {
      rt.targetEve = eveActive && Math.random() < EVE_AGGRO_CHANCE;
      rt.action = {
        move,
        t: 0,
        hitDone: move.hits.map(() => false),
        projFired: (move.projectiles ?? []).map(() => false),
        debrisFired: false,
        teleported: false,
        zoneTimer: 0,
        boltsFired: 0,
        boltCount: 0,
        targetX
      };
    } else {
      boss.x += Math.sign(dx) * speed * delta;
    }
  } else if (Math.abs(dx) > rt.preferredDistance + ENGAGE_APPROACH_TOLERANCE) {
    // Raggiunge la distanza di ingaggio scelta per questo ciclo...
    boss.x += Math.sign(dx) * speed * delta;
  } else if (Math.abs(dx) < rt.preferredDistance - ENGAGE_RETREAT_TOLERANCE) {
    // ...e se il giocatore è più vicino si sposta all'indietro, più piano
    // di lui: così Checco non è sempre addosso e le cariche/i lanci a
    // distanza hanno spazio per essere scelti.
    boss.x -= Math.sign(dx) * speed * ENGAGE_RETREAT_SPEED * delta;
  }
}

/** Una mossa in corso: un frame di telegrafo/attivo/recupero. */
export function updateBossMove(ctx: BossContext, delta: number, dx: number, eveActive: boolean): void {
  const { world, rt } = ctx;
  const { boss, player, eve } = world;
  const a = rt.action;
  if (!a) return;
  a.t += delta;
  const tt = a.t - a.move.windup;
  boss.attackBox = null;

  // --- asse verticale: balzo (si sposta verso il bersaglio) o schianto
  // (sale e scende sul posto, con una pausa in aria come segnale) ---
  const leap = a.move.leap;
  if (leap && tt >= 0) {
    if (a.leapStartX === undefined) {
      a.leapStartX = boss.x;
      a.leapTargetX =
        leap.travel === 'target'
          ? Math.min(ARENA_HALF_WIDTH - BOSS_EDGE_MARGIN, Math.max(-ARENA_HALF_WIDTH + BOSS_EDGE_MARGIN, a.targetX))
          : boss.x;
    }
    const airTime = leap.rise + leap.hang + leap.fall;
    if (tt < airTime) {
      if (leap.travel === 'target') {
        boss.x = a.leapStartX + ((a.leapTargetX ?? boss.x) - a.leapStartX) * (tt / airTime);
      }
      if (tt < leap.rise) boss.y = leap.height * Math.sin((tt / leap.rise) * (Math.PI / 2));
      else if (tt < leap.rise + leap.hang) boss.y = leap.height;
      else boss.y = leap.height * Math.cos(((tt - leap.rise - leap.hang) / leap.fall) * (Math.PI / 2));
    } else {
      boss.y = 0;
    }
  }

  // --- proiettili (a distanza, parabili e rimandabili indietro) ---
  (a.move.projectiles ?? []).forEach((pr, i) => {
    if (a.projFired[i] || tt < pr.at) return;
    a.projFired[i] = true;
    boss.facing = dx >= 0 ? 1 : -1;
    spawnBossProjectile(world, pr);
  });

  // --- detriti dal soffitto attorno al giocatore: marcatore, poi caduta ---
  const debris = a.move.debris;
  if (debris && !a.debrisFired && tt >= debris.at) {
    a.debrisFired = true;
    spawnDebris(world, debris);
  }

  // --- tempesta: in aria a caricare (zona elettrica), poi fulmini a ricerca ---
  const storm = a.move.storm;
  if (storm && leap && tt >= 0) {
    // Zona elettrica solo durante la carica; poi i fulmini partono mentre
    // Checco è ANCORA in aria (il `hang` del salto copre tutta la mossa).
    const chargeEnd = leap.rise + storm.chargeTime;
    if (tt >= leap.rise && tt < chargeEnd) {
      // Zona di danno attorno a lui: bisogna allontanarsi.
      boss.zoneRadius = storm.zoneRadius;
      a.zoneTimer -= delta;
      if (a.zoneTimer <= 0 && Math.abs(player.x - boss.x) <= storm.zoneRadius) {
        hitPlayer(world, storm.zoneDamage, { unparryable: true });
        a.zoneTimer = storm.zoneTick;
      }
    } else {
      boss.zoneRadius = null;
    }
    if (tt >= chargeEnd) {
      if (a.boltCount === 0) {
        a.boltCount = storm.boltsMin + Math.floor(Math.random() * (storm.boltsMax - storm.boltsMin + 1));
      }
      while (a.boltsFired < a.boltCount && tt >= chargeEnd + a.boltsFired * storm.boltInterval) {
        a.boltsFired += 1;
        spawnBolt(world, storm);
      }
    }
  }

  // --- teletrasporto: sparisce, marcatore dietro il giocatore, ricompare ---
  const teleport = a.move.teleport;
  if (teleport && tt >= 0) {
    if (!a.teleported && boss.teleportDestX === null) {
      boss.vanished = true;
      const behind = player.x - player.facing * TELEPORT_BEHIND_DISTANCE;
      boss.teleportDestX = Math.min(
        ARENA_HALF_WIDTH - TELEPORT_EDGE_MARGIN,
        Math.max(-ARENA_HALF_WIDTH + TELEPORT_EDGE_MARGIN, behind)
      );
    }
    if (!a.teleported && tt >= teleport.vanish) {
      a.teleported = true;
      boss.vanished = false;
      boss.x = boss.teleportDestX ?? boss.x;
      boss.teleportDestX = null;
      boss.facing = player.x >= boss.x ? 1 : -1;
    }
  }

  a.move.hits.forEach((h, i) => {
    if (tt < h.start || tt >= h.start + h.duration) return;
    if (h.lunge) {
      // Va sempre verso il punto in cui era il bersaglio alla scelta della
      // mossa e ci arriva nel tempo della finestra (velocità adattata
      // alla distanza, fra i limiti), poi si ferma: né pochi metri né
      // mezza arena a caso.
      if (a.lungeStartX === undefined) {
        a.lungeStartX = boss.x;
        boss.facing = a.targetX >= boss.x ? 1 : -1;
        // Percorrenza minima: se il bersaglio è troppo vicino prosegue
        // oltre di lui, nella stessa direzione, dentro i confini dell'arena.
        const travel = Math.max(Math.abs(a.targetX - boss.x), LUNGE_MIN_TRAVEL);
        a.lungeTargetX = Math.min(
          ARENA_HALF_WIDTH - BOSS_EDGE_MARGIN,
          Math.max(-ARENA_HALF_WIDTH + BOSS_EDGE_MARGIN, boss.x + boss.facing * travel)
        );
      }
      const lungeTarget = a.lungeTargetX ?? a.targetX;
      const total = Math.abs(lungeTarget - a.lungeStartX);
      const speed = Math.min(LUNGE_MAX_SPEED, Math.max(LUNGE_MIN_SPEED, total / h.duration));
      const remaining = Math.abs(lungeTarget - boss.x);
      boss.x += Math.sign(lungeTarget - boss.x) * Math.min(speed * delta, remaining);
    }
    // La scatola segue il corpo anche in quota (balzo): `offsetY` è relativo.
    const box = h.bothSides
      ? { x: boss.x, y: boss.y + h.offsetY, halfWidth: h.reach, halfHeight: h.halfHeight }
      : {
          x: boss.x + (boss.facing * h.reach) / 2,
          y: boss.y + h.offsetY,
          halfWidth: h.reach / 2,
          halfHeight: h.halfHeight
        };
    boss.attackBox = box;
    if (a.hitDone[i]) return;
    if (aabbOverlap(box, playerHurtbox(world))) {
      // CONTRASTO (alla mikiri): schivare CONTRO una carica la ferma e
      // stordisce Checco. Va a segno solo con un dash VERSO di lui.
      if (
        a.move.charge &&
        player.invulnerable &&
        player.dashDir !== 0 &&
        Math.sign(boss.x - player.x) === player.dashDir
      ) {
        // Contrasto: parte il braccio di ferro. Vinto (barra piena) Checco
        // è stordito, perso il giocatore viene sbalzato via.
        startClash(ctx);
        a.hitDone[i] = true;
        return;
      }
      const result = hitPlayer(world, h.damage, { unparryable: h.unparryable });
      if (result !== 'ignored') a.hitDone[i] = true;
    } else if (eveActive && aabbOverlap(box, eveHurtbox(world))) {
      eve.status = 'staggered';
      a.hitDone[i] = true;
    }
  });

  if (a.t >= totalDuration(a.move)) {
    rt.lastMoveId = a.move.id;
    rt.action = null;
    boss.attackBox = null;
    boss.y = 0;
    boss.vanished = false;
    boss.teleportDestX = null;
    boss.zoneRadius = null;
    rt.cooldown = boss.round === 1 ? BOSS_MOVE_COOLDOWN_ROUND1 : BOSS_MOVE_COOLDOWN_ROUND2;
    rt.preferredDistance = pickEngageDistance();
  }
}
