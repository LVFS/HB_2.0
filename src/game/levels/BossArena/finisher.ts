import type { ArenaFinisher, ArenaWorld } from './arenaState';
import { ARENA_HALF_WIDTH, FINISHER } from './arenaConfig';
import { addRing, areaBlast, hitBoss } from './combat';

/**
 * Carica con falce (abilità a barra piena del potenziamento Bloodborne): una
 * sequenza guidata, come il braccio di ferro del contrasto. Scatto addosso al
 * boss → colpo dal basso che lo lancia in aria → falce assemblata che si schianta
 * a terra con un danno ad area. Durante la sequenza giocatore e boss sono
 * comandati da qui (`BossChecco` la fa avanzare, `PlayerArena` legge
 * `playerX`/`playerY`); il giocatore è invulnerabile.
 */

const PHASE_DURATION = {
  dash: FINISHER.dashTime,
  launch: FINISHER.launchTime,
  hang: FINISHER.hangTime,
  slam: FINISHER.slamTime,
  recover: FINISHER.recoverTime
} as const;

const NEXT_PHASE: Record<ArenaFinisher['phase'], ArenaFinisher['phase'] | null> = {
  dash: 'launch',
  launch: 'hang',
  hang: 'slam',
  slam: 'recover',
  recover: null
};

/** Prepara la sequenza partendo dalla posizione attuale. */
export function createFinisher(world: ArenaWorld, damage: number, posture: number): ArenaFinisher {
  const { player, boss } = world;
  const dir: 1 | -1 = boss.x >= player.x ? 1 : -1;
  const targetX = Math.min(ARENA_HALF_WIDTH, Math.max(-ARENA_HALF_WIDTH, boss.x - dir * FINISHER.standOff));
  return {
    phase: 'dash',
    t: 0,
    dir,
    startX: player.x,
    startY: player.y,
    targetX,
    damage,
    posture,
    started: false,
    playerX: player.x,
    playerY: player.y
  };
}

const easeOut = (u: number) => 1 - (1 - u) * (1 - u);

/**
 * Fa avanzare la sequenza di `delta` secondi. Restituisce `true` quando è
 * finita (il chiamante la toglie dal mondo e fa ripartire l'IA del boss).
 */
export function updateFinisher(world: ArenaWorld, delta: number): boolean {
  const f = world.finisher;
  if (!f) return true;
  const { boss } = world;
  const hitLaunch = f.phase === 'launch' && f.t === 0;

  f.t += delta;
  const duration = PHASE_DURATION[f.phase];
  const u = Math.min(1, f.t / duration);

  switch (f.phase) {
    case 'dash': {
      f.playerX = f.startX + (f.targetX - f.startX) * easeOut(u);
      f.playerY = f.startY * (1 - u);
      boss.y = 0;
      break;
    }
    case 'launch': {
      if (hitLaunch) {
        // Primo colpo, dal basso verso l'alto.
        hitBoss(world, {
          damage: f.damage * FINISHER.launchShare,
          posture: f.posture * FINISHER.launchShare,
          source: 'player'
        });
        addRing(world, boss.x, 0.3, 1.4, 0.3, '#7dd3fc');
      }
      boss.y = FINISHER.launchHeight * easeOut(u);
      f.playerX = f.targetX;
      f.playerY = boss.y * 0.92;
      break;
    }
    case 'hang': {
      boss.y = FINISHER.launchHeight + 0.12 * Math.sin(u * Math.PI * 2);
      f.playerX = f.targetX;
      f.playerY = FINISHER.launchHeight * 0.92;
      break;
    }
    case 'slam': {
      boss.y = FINISHER.launchHeight * (1 - u * u);
      f.playerX = f.targetX;
      f.playerY = boss.y * 0.92;
      break;
    }
    case 'recover': {
      boss.y = 0;
      f.playerX = f.targetX;
      f.playerY = 0;
      break;
    }
  }

  if (f.t < duration) return false;

  // Cambio di fase.
  const next = NEXT_PHASE[f.phase];
  if (f.phase === 'slam') {
    // Schianto: secondo colpo al boss + area attorno al punto d'impatto.
    boss.y = 0;
    hitBoss(world, {
      damage: f.damage * (1 - FINISHER.launchShare),
      posture: f.posture * (1 - FINISHER.launchShare),
      source: 'player'
    });
    areaBlast(world, boss.x, FINISHER.slamRadius, f.damage * 0.1);
    addRing(world, boss.x, 0.2, FINISHER.slamRadius, 0.5, '#7dd3fc');
    world.hitStop = Math.max(world.hitStop, 0.14);
  }
  if (!next) return true;
  f.phase = next;
  f.t = 0;
  return false;
}
