import { aabbOverlap } from '@/game/render2d/collision';
import { addRing, hitPlayer, playerHurtbox } from '../BossArena/combat';
import { HITSTOP_LIGHT } from '../BossArena/arenaConfig';
import { defeatEnemy, updateEnemy } from './tunnelEnemies';
import { spawnPickup } from './tunnelPickups';
import { inPlayerLane } from './tunnelLanes';
import { addGap } from './tunnelPuppet';
import { onPlayerHit } from './tunnelSlancio';
import { hasPerk, tryInstinct } from './tunnelWishes';
import type { HazardKind, TunnelHazard, TunnelWorld } from './tunnelState';
import {
  TUNNEL_CRATE,
  TUNNEL_DEBRIS,
  TUNNEL_DESPAWN_BEHIND,
  TUNNEL_GAP_HIT_PENALTY,
  TUNNEL_GUARD,
  ARCHER,
  PAPARAZZO,
  PILGRIM,
  REMAINS,
  PENDULUM,
  TUNNEL_LANE_START,
  TUNNEL_LOW,
  TUNNEL_PIT,
  TUNNEL_RAY,
  TUNNEL_RUN_SPEED,
  TUNNEL_TURRET,
  TUNNEL_WALL
} from './tunnelConfig';

/**
 * Regole del tunnel, pure (niente React/Three): nascita delle minacce, loro
 * ciclo di vita, collisioni con D, danno, effetto sulla distanza dalla
 * marionetta. Le minacce sono definite dal momento in cui D ci ARRIVA
 * (`t`, secondi di corsa): la corsa è a velocità costante, quindi la posizione
 * è `startX + t * velocità` e telegrafi e raggi si sincronizzano sul tempo.
 */

/** Opzioni di nascita: i raggi scelgono l'altezza. */
export interface HazardOptions {
  rayHeight?: 'low' | 'high';
  /** Via in cui sta (0 = la più lontana; default: quella di partenza di D). */
  lane?: number;
}

/** Quanto prima dell'arrivo di D il detrito comincia a cadere (così atterra quando ci arriva). */
const DEBRIS_FALL_LEAD = 0.3;
/** Il raggio si accende leggermente prima dell'arrivo e resta attivo per `TUNNEL_RAY.active`. */
const RAY_ACTIVE_LEAD = 0.1;

export function spawnHazard(world: TunnelWorld, kind: HazardKind, t: number, options: HazardOptions = {}): TunnelHazard {
  const x = world.startX + t * TUNNEL_RUN_SPEED;
  const base = { id: world.nextId++, kind, x, t, lane: options.lane ?? TUNNEL_LANE_START, y: 0, hp: 0, phase: 'active' as const, flash: 0, damaged: false, lastSwing: -1, vy: 0, shoot: 0, swing: options.lane ?? TUNNEL_LANE_START };
  let hazard: TunnelHazard;
  switch (kind) {
    case 'low':
      hazard = { ...base, width: TUNNEL_LOW.width, height: TUNNEL_LOW.height, damage: TUNNEL_LOW.damage };
      break;
    case 'wall':
      hazard = { ...base, width: TUNNEL_WALL.width, height: TUNNEL_WALL.height, damage: TUNNEL_WALL.damage };
      break;
    case 'crate':
      hazard = { ...base, width: TUNNEL_CRATE.width, height: TUNNEL_CRATE.height, damage: TUNNEL_CRATE.damage, hp: TUNNEL_CRATE.hp };
      break;
    case 'pit':
      hazard = { ...base, width: TUNNEL_PIT.width, height: 0.2, damage: TUNNEL_PIT.damage };
      break;
    case 'ray': {
      const [from, to] = TUNNEL_RAY[options.rayHeight ?? 'low'];
      hazard = {
        ...base,
        phase: 'warn',
        y: from,
        width: TUNNEL_RAY.width,
        height: to - from,
        damage: TUNNEL_RAY.damage,
        rayHeight: options.rayHeight ?? 'low'
      };
      break;
    }
    case 'debris':
      hazard = {
        ...base,
        phase: 'warn',
        y: TUNNEL_DEBRIS.height,
        width: TUNNEL_DEBRIS.halfSize * 2,
        height: TUNNEL_DEBRIS.halfSize * 2,
        damage: TUNNEL_DEBRIS.damage
      };
      break;
    case 'guard':
      hazard = { ...base, width: TUNNEL_GUARD.width, height: TUNNEL_GUARD.height, damage: TUNNEL_GUARD.damage, hp: TUNNEL_GUARD.hp };
      break;
    case 'pendulum':
      // Botafumeiro: `lane` è la via in cui sarà quando D lo raggiunge; `swing` la via in cui sta adesso.
      hazard = { ...base, y: PENDULUM.y, width: PENDULUM.width, height: PENDULUM.height, damage: PENDULUM.damage };
      break;
    case 'paparazzo':
      // Il fotografo non fa danno: abbaglia (vedi `updateHazards`).
      hazard = { ...base, phase: 'warn', width: PAPARAZZO.width, height: PAPARAZZO.height, damage: 0 };
      break;
    case 'pilgrim':
      // Pellegrino fanatico: fermo (`warn`) finché D non gli è a tiro, poi si carica e si scaglia (vedi `tunnelEnemies`).
      hazard = { ...base, phase: 'warn', width: PILGRIM.width, height: PILGRIM.height, damage: PILGRIM.damage, hp: PILGRIM.hp };
      break;
    case 'archer':
      // Balestriere: `shoot` è il suo orologio, che corre solo quando D è a tiro; il primo dardo parte `firstDelay` s dopo.
      hazard = { ...base, phase: 'warn', width: ARCHER.width, height: ARCHER.height, damage: ARCHER.damage, hp: ARCHER.hp, shoot: ARCHER.every - ARCHER.firstDelay };
      break;
    case 'remains':
      hazard = { ...base, width: REMAINS.width, height: REMAINS.height, damage: 0 };
      break;
    case 'turret':
      // Torretta volante (modalità Buen Camino): y sono i PIEDI, quindi il centro sta a TUNNEL_TURRET.y.
      hazard = {
        ...base,
        y: TUNNEL_TURRET.y - TUNNEL_TURRET.height / 2,
        width: TUNNEL_TURRET.width,
        height: TUNNEL_TURRET.height,
        damage: TUNNEL_TURRET.damage,
        hp: TUNNEL_TURRET.hp,
        shoot: -0.6
      };
      break;
  }
  world.hazards.push(hazard);
  return hazard;
}

/** Colpito: danno al giocatore e un po' di terreno perso rispetto alla marionetta. Restituisce `true` se ha fatto danno. */
function damagePlayer(world: TunnelWorld, hazard: TunnelHazard): boolean {
  // L'Istinto Superiore schiva da solo il colpo (se ci sono usi).
  if (tryInstinct(world)) return false;
  // Il contraccolpo spinge D all'indietro rispetto all'ostacolo (sourceX davanti a lui).
  const result = hitPlayer(world.arena, hazard.damage, { unparryable: true, sourceX: hazard.x + 1 });
  if (result === 'ignored') return false;
  hazard.damaged = true;
  addGap(world, TUNNEL_GAP_HIT_PENALTY);
  onPlayerHit(world);
  return true;
}

/** Una guardia cade: distanza recuperata e una Sfera del Drago al suo posto. */
export function defeatGuard(world: TunnelWorld, guard: TunnelHazard, label = 'K.O.'): void {
  guard.phase = 'spent';
  addGap(world, TUNNEL_GUARD.gapReward);
  world.arena.popups.push({ x: guard.x, y: guard.height + 0.3, amount: 0, target: 'object', boost: 1, label });
  spawnPickup(world, 'sphere', guard.t, 1.1, guard.lane);
}

/** Una torretta cade: distanza recuperata, una Sfera del Drago e un'esplosione. */
export function defeatTurret(world: TunnelWorld, turret: TunnelHazard): void {
  turret.phase = 'spent';
  addGap(world, TUNNEL_TURRET.gapReward);
  world.arena.popups.push({ x: turret.x, y: TUNNEL_TURRET.y + 0.6, amount: 0, target: 'object', boost: 1, label: 'ABBATTUTA!' });
  addRing(world.arena, turret.x, TUNNEL_TURRET.y, 1.6, 0.4, '#fb923c');
  spawnPickup(world, 'sphere', turret.t, TUNNEL_TURRET.y - 0.4, turret.lane);
}

/** Fa avanzare minacce e collisioni di `delta` secondi. */
export function updateHazards(world: TunnelWorld, delta: number): void {
  const { arena } = world;
  const player = arena.player;
  const hurt = playerHurtbox(arena);

  for (let i = world.hazards.length - 1; i >= 0; i -= 1) {
    const h = world.hazards[i];
    h.flash = Math.max(0, h.flash - delta);
    if (h.x < player.x - TUNNEL_DESPAWN_BEHIND || h.phase === 'spent') {
      world.hazards.splice(i, 1);
      continue;
    }

    // Solo chi sta nella stessa via di D può essere colpito, travolto o raccolto.
    const here = inPlayerLane(world, h.lane);

    // Con l'aura Super Saiyan si travolge tutto ciò che ha un corpo (raggi, voragini e detriti no: si attraversano).
    // Super Saiyan (frutto o stile): si travolge ciò che ha un corpo. L'aura del frutto travolge anche i muri; quella dello stile no.
    const trample = world.buffs.saiyan > 0 || (hasPerk(world, 'saiyan') && h.kind !== 'wall');
    if (here && trample && (h.kind === 'low' || h.kind === 'wall' || h.kind === 'crate' || h.kind === 'guard' || h.kind === 'pilgrim' || h.kind === 'archer')) {
      if (aabbOverlap({ x: h.x, y: h.y + h.height / 2, halfWidth: h.width / 2, halfHeight: h.height / 2 }, hurt)) {
        if (h.kind === 'pilgrim' || h.kind === 'archer') defeatEnemy(world, h, 'TRAVOLTO!', PILGRIM.gapReward);
        else if (h.kind === 'guard') defeatGuard(world, h, 'TRAVOLTA!');
        else {
          h.phase = 'spent';
          arena.popups.push({ x: h.x, y: h.height + 0.3, amount: 0, target: 'object', boost: 1, label: 'TRAVOLTO!' });
        }
        arena.hitStop = Math.max(arena.hitStop, HITSTOP_LIGHT);
        continue;
      }
    }

    switch (h.kind) {
      case 'pilgrim':
      case 'archer':
      case 'remains':
        updateEnemy(world, h, delta, (enemy) => damagePlayer(world, enemy));
        break;
      case 'low':
      case 'wall': {
        if (here && !h.damaged && aabbOverlap({ x: h.x, y: h.y + h.height / 2, halfWidth: h.width / 2, halfHeight: h.height / 2 }, hurt)) {
          damagePlayer(world, h);
        }
        break;
      }
      case 'crate':
      case 'guard': {
        const box = { x: h.x, y: h.y + h.height / 2, halfWidth: h.width / 2, halfHeight: h.height / 2 };
        // Una spada la rompe (un colpo per fendente), altrimenti si salta o ci si fa male.
        if (here && player.attackBox && h.lastSwing !== player.swingId && aabbOverlap(player.attackBox, box)) {
          h.lastSwing = player.swingId;
          h.hp -= 1;
          h.flash = 0.12;
          arena.hitStop = Math.max(arena.hitStop, HITSTOP_LIGHT);
          if (h.hp <= 0) {
            if (h.kind === 'guard') defeatGuard(world, h);
            else {
              h.phase = 'spent';
              arena.popups.push({ x: h.x, y: h.height + 0.3, amount: 1, target: 'object', boost: 1, label: 'ROTTA' });
            }
          } else {
            arena.popups.push({ x: h.x, y: h.height + 0.3, amount: 1, target: 'object', boost: 1 });
          }
        } else if (here && !h.damaged && aabbOverlap(box, hurt)) {
          damagePlayer(world, h);
        }
        break;
      }
      case 'pendulum': {
        // Oscilla attraverso le vie; D lo evita saltando, scattando o trovandosi in un'altra via quando passa.
        h.swing = Math.min(2.4, Math.max(-0.4, h.lane + PENDULUM.amplitude * Math.sin((2 * Math.PI * (world.time - h.t)) / PENDULUM.period)));
        const box = { x: h.x, y: h.y + h.height / 2, halfWidth: h.width / 2, halfHeight: h.height / 2 };
        if (!h.damaged && Math.abs(h.swing - world.lane.pos) < 0.6 && aabbOverlap(box, hurt)) damagePlayer(world, h);
        break;
      }
      case 'paparazzo': {
        // Il lampo parte quando D gli arriva DAVANTI (distanza, non tempo: con scatti, passi indietro o Slancio il tempo non coincide con la
        // posizione): chi è nella sua via (e non scatta) resta abbagliato. Se D l'ha già superato senza che scattasse, niente lampo alle spalle.
        const ahead = h.x - player.x;
        if (h.phase === 'warn' && ahead < -PAPARAZZO.passedBy) {
          h.phase = 'spent';
        } else if (h.phase === 'warn' && ahead <= PAPARAZZO.flashRange) {
          h.phase = 'active';
          h.flash = PAPARAZZO.flashSeconds;
          if (here && !player.invulnerable) {
            world.blindCount += 1;
            world.noHitTime = 0;
            addGap(world, PAPARAZZO.gap);
            arena.popups.push({ x: h.x, y: 2.4, amount: 0, target: 'player', boost: 1, label: 'ABBAGLIATO!' });
          }
        } else if (h.phase === 'active' && h.flash <= 0) {
          h.phase = 'spent';
        }
        break;
      }
      case 'turret': {
        const box = { x: h.x, y: h.y + h.height / 2, halfWidth: h.width / 2, halfHeight: h.height / 2 };
        // Si abbatte con un colpo di spada dato in salto (o col pugno Gomu Gomu, o con lo Zoltraak).
        if (here && player.attackBox && h.lastSwing !== player.swingId && aabbOverlap(player.attackBox, box)) {
          h.lastSwing = player.swingId;
          h.hp -= 1;
          h.flash = 0.12;
          arena.hitStop = Math.max(arena.hitStop, HITSTOP_LIGHT);
          if (h.hp <= 0) defeatTurret(world, h);
        } else if (here && !h.damaged && aabbOverlap(box, hurt)) {
          damagePlayer(world, h);
        }
        // Spara nella sua via mentre D le si avvicina: avviso rosso, poi il colpo (parabile).
        const ahead = h.x - player.x;
        if (ahead > 2 && ahead < world.view.ahead) {
          h.shoot += delta;
          if (h.shoot >= TUNNEL_TURRET.shootEvery) {
            h.shoot = 0;
            arena.projectiles.push({
              x: h.x - 0.5,
              y: 1.1,
              vx: TUNNEL_TURRET.shotSpeed,
              damage: TUNNEL_TURRET.shotDamage,
              owner: 'boss',
              life: 6,
              lane: h.lane,
              ranged: true
            });
          }
        }
        break;
      }
      case 'pit': {
        // Una voragine fa male solo a chi è a terra mentre ci passa sopra.
        if (here && !h.damaged && player.y <= 0.15 && Math.abs(player.x - h.x) < h.width / 2) damagePlayer(world, h);
        break;
      }
      case 'ray': {
        const activeFrom = h.t - RAY_ACTIVE_LEAD;
        const activeTo = activeFrom + TUNNEL_RAY.active;
        h.phase = world.time >= activeTo ? 'spent' : world.time >= activeFrom ? 'active' : 'warn';
        if (
          h.phase === 'active' &&
          here &&
          !h.damaged &&
          aabbOverlap({ x: h.x, y: h.y + h.height / 2, halfWidth: h.width / 2, halfHeight: h.height / 2 }, hurt)
        ) {
          damagePlayer(world, h);
        }
        break;
      }
      case 'debris': {
        // Marcatore a terra, poi cade in modo da atterrare quando D ci arriva.
        const fallFrom = h.t - DEBRIS_FALL_LEAD;
        if (h.phase === 'warn' && world.time >= fallFrom) {
          h.phase = 'active';
          h.vy = -TUNNEL_DEBRIS.fallSpeed;
        }
        if (h.phase === 'active') {
          h.y += h.vy * delta;
          if (here && !h.damaged && aabbOverlap({ x: h.x, y: h.y, halfWidth: h.width / 2, halfHeight: h.height / 2 }, hurt)) {
            damagePlayer(world, h);
          }
          if (h.y <= TUNNEL_DEBRIS.halfSize) h.phase = 'spent';
        }
        break;
      }
    }
  }
}
