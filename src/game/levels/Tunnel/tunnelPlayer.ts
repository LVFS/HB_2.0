import { resetJump, stepJump, type JumpConfig, type JumpState } from '@/game/shared/jump';
import type { PlayerActions } from '@/game/shared/usePlayerActions';
import type { RunnerAnim, TunnelWorld } from './tunnelState';
import {
  ARENA_DOUBLE_JUMP_SPEED,
  ARENA_GRAVITY,
  ARENA_GROUND_Y,
  ARENA_JUMP_SPEED,
  ARENA_MAX_JUMPS,
  ARENA_PLAYER_HEIGHT,
  ATTACK_HALF_HEIGHT,
  ATTACK_REACH,
  ATTACK_TIMING,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_ATTACK_POSTURE
} from '../BossArena/arenaConfig';
import { addRing } from '../BossArena/combat';
import { clampLane } from './tunnelLanes';
import { thunderSlam } from './tunnelPerks';
import { canFly, dashCooldown, dashDistance, hasPerk, parryStats } from './tunnelWishes';
import {
  GOMU,
  NUVOLA,
  PERK_NUMBERS,
  TUNNEL_LANE_CHANGE_TIME,
  TUNNEL_DASH_DURATION,
  TUNNEL_DASH_TRAVEL,
  TUNNEL_RUN_SPEED,
  TUNNEL_STRAFE_RANGE,
  TUNNEL_STRAFE_SPEED
} from './tunnelConfig';

/**
 * D in corsa: corre da solo verso destra, il giocatore salta (anche doppio),
 * schiva con i-frames, para, attacca e si sposta di poco avanti e
 * indietro. Stesse costanti e stesse regole di `PlayerArena` (è lo stesso D),
 * ma molto più piccolo: niente loadout, abilità, berserk. Input e fisica di
 * salto vengono dalle primitive condivise (`game/shared/`).
 *
 * Scrive su `world.arena.player` (la forma che `combat.ts` si aspetta), quindi
 * `hitPlayer` e la parata funzionano uguali all'arena.
 */

const TUNNEL_JUMP_CONFIG: JumpConfig = {
  gravity: ARENA_GRAVITY,
  groundY: ARENA_GROUND_Y,
  jumpSpeed: ARENA_JUMP_SPEED,
  doubleJumpSpeed: ARENA_DOUBLE_JUMP_SPEED,
  maxJumps: ARENA_MAX_JUMPS
};

/** Tiene lo scarto avanti/indietro dentro `TUNNEL_STRAFE_RANGE`. */
function clampStrafe(value: number): number {
  return Math.min(TUNNEL_STRAFE_RANGE, Math.max(-TUNNEL_STRAFE_RANGE, value));
}

/** Fa avanzare il giocatore di `delta` secondi (movimento di corsa, azioni, salto, timer). */
export function updateRunner(world: TunnelWorld, actions: PlayerActions, jump: JumpState, delta: number): RunnerAnim {
  const { arena, runner } = world;
  const state = arena.player;

  // --- timer che scendono da soli ---
  state.iframes = Math.max(0, state.iframes - delta);
  state.hitTimer = Math.max(0, state.hitTimer - delta);
  state.parryFlash = Math.max(0, state.parryFlash - delta);
  state.counterWindow = Math.max(0, state.counterWindow - delta);
  runner.dashCooldown = Math.max(0, runner.dashCooldown - delta);

  const stunned = state.hitTimer > 0;
  const perks = world.perkState;
  if (stunned) perks.slamming = false;
  // In sella al gatto J coccola e R dà da mangiare (non si attacca né ci si cura).
  const riding = world.cat.active;
  const wantsAttack = !stunned && !riding && actions.justPressed('attack');
  const wantsParry = !stunned && actions.justPressed('parry');
  const wantsDash = !stunned && actions.justPressed('dash');
  const wantsJump = !stunned && actions.justPressed('jump');
  runner.pet = !stunned && riding && actions.justPressed('attack');
  // (Niente cure con R: ci sono i fagioli.) In sella al gatto, R dà da mangiare.
  runner.feed = !stunned && riding && actions.justPressed('heal');
  // `E`: usa il bonus nella casella (lo fa il driver, dopo il movimento).
  runner.useItem = !stunned && actions.justPressed('skill');
  // `Q`: uno Zoltraak di riserva (desiderio «Riserva di Frieren»).
  runner.useReserve = !stunned && actions.justPressed('berserk');
  // W/S: cambio di via (non mentre si è storditi o ci si cura).
  const wantsLaneUp = !stunned && actions.justPressed('laneUp');
  const wantsLaneDown = !stunned && actions.justPressed('laneDown');
  const moveX = actions.moveX();
  actions.consume();
  // --- le tre vie: il bersaglio cambia con W/S, la posizione lo raggiunge in `TUNNEL_LANE_CHANGE_TIME` ---
  const { lane } = world;
  if (wantsLaneUp) lane.target = clampLane(lane.target - 1);
  if (wantsLaneDown) lane.target = clampLane(lane.target + 1);
  const laneStep = delta / TUNNEL_LANE_CHANGE_TIME;
  lane.pos += Math.min(laneStep, Math.max(-laneStep, lane.target - lane.pos));

  // --- macchina a stati dell'azione ---
  if (runner.action === 'none') {
    if (wantsDash && runner.dashCooldown === 0) {
      runner.action = 'dash';
      runner.actionTime = 0;
      runner.dashCooldown = dashCooldown(world);
      // Scatto nella direzione tenuta (A indietro, D avanti); senza direzione, in avanti.
      runner.dashDir = moveX !== 0 ? moveX : 1;
      runner.dashFrom = world.strafe;
      runner.dashTo = clampStrafe(world.strafe + runner.dashDir * dashDistance(world));
      addRing(arena, state.x, state.y + ARENA_PLAYER_HEIGHT / 2, 1.5, 0.3, '#7dd3fc');
    } else if (wantsParry) {
      runner.action = 'parry';
      runner.actionTime = 0;
    } else if (wantsAttack && hasPerk(world, 'thor') && state.y > 0.45 && perks.thorCd <= 0 && !perks.slamming) {
      // Dio del tuono: un attacco in aria diventa una caduta a martello che scarica fulmini all'arrivo (vedi sotto).
      perks.slamming = true;
      perks.thorCd = PERK_NUMBERS.thor.cooldown;
    } else if (wantsAttack) {
      runner.action = 'attack';
      runner.actionTime = 0;
      state.swingId += 1;
      state.attackDamage = PLAYER_ATTACK_DAMAGE;
      state.attackPosture = PLAYER_ATTACK_POSTURE;
    }
  } else if (stunned) {
    runner.action = 'none';
    state.healing = false;
  }

  runner.actionTime += delta;
  const t = runner.actionTime;
  let attackActive = false;
  let parryActive = false;
  let dashing = false;
  switch (runner.action) {
    case 'attack': {
      const { windup, active, recovery } = ATTACK_TIMING;
      attackActive = t >= windup && t < windup + active;
      if (t >= windup + active + recovery) runner.action = 'none';
      break;
    }
    case 'parry': {
      const parry = parryStats(world);
      parryActive = t < parry.active;
      if (t >= parry.active + parry.recovery) runner.action = 'none';
      break;
    }
    case 'dash': {
      dashing = true;
      // Lo spostamento avviene nei primi istanti (curva che frena), poi si resta invulnerabili fino alla fine.
      const u = Math.min(1, t / TUNNEL_DASH_TRAVEL);
      world.strafe = runner.dashFrom + (runner.dashTo - runner.dashFrom) * (1 - (1 - u) ** 3);
      if (t >= TUNNEL_DASH_DURATION) runner.action = 'none';
      break;
    }
    default:
      break;
  }

  // --- movimento: corsa automatica + piccolo scarto laterale ---
  const locked = runner.action === 'attack' || runner.action === 'parry' || stunned;
  world.runX = world.startX + world.time * TUNNEL_RUN_SPEED;
  if (!locked && !dashing && moveX !== 0) {
    world.strafe = clampStrafe(world.strafe + moveX * TUNNEL_STRAFE_SPEED * delta);
  }
  // Contraccolpo dopo un colpo subito: decade da solo.
  state.knockbackVx -= state.knockbackVx * Math.min(1, 10 * delta);
  world.strafe = clampStrafe(world.strafe + state.knockbackVx * delta);

  let y: number;
  const held = !stunned && actions.isHeld('jump');
  const cloud = world.buffs.nuvola > 0;
  // Volo (Super Saiyan, Esquie): tenendo premuto il salto in aria si passa al volo, che si consuma salendo e si ricarica a terra.
  if (!cloud && canFly(world) && !perks.flightOn && !perks.slamming && held && !wantsJump && perks.flight > 0.05 && state.y > 0.3) perks.flightOn = true;
  if (perks.slamming) {
    // Caduta a martello: veloce, D è invulnerabile; all'arrivo scarica il fulmine ad area.
    y = Math.max(0, state.y - PERK_NUMBERS.thor.fallSpeed * delta);
    resetJump(jump, y <= 0.001);
    if (y <= 0.001) {
      perks.slamming = false;
      state.x = world.runX + world.strafe;
      thunderSlam(world);
    }
  } else if (cloud || perks.flightOn) {
    // Nuvola Speedy / volo: tenendo premuto il salto si sale, rilasciandolo si scende (niente salto vero e proprio).
    const fly = PERK_NUMBERS.fly;
    const rising = held && (cloud || perks.flight > 0);
    const rise = cloud ? NUVOLA.rise : fly.rise;
    const fall = cloud ? NUVOLA.fall : fly.fall;
    const maxY = cloud ? NUVOLA.maxY : fly.maxY;
    y = Math.min(maxY, Math.max(0, state.y + (rising ? rise : -fall) * delta));
    if (!cloud && rising) perks.flight = Math.max(0, perks.flight - fly.drain * delta);
    if (y <= 0.001) perks.flightOn = false;
    resetJump(jump, y <= 0.001);
  } else {
    y = stepJump(
      jump,
      TUNNEL_JUMP_CONFIG,
      { wantsJump: wantsJump && !locked && !dashing, airBoost: runner.boost },
      state.y,
      delta
    );
  }
  runner.boost = 0;
  // Il volo si ricarica a terra.
  if (y <= 0.001 && !perks.flightOn) perks.flight = Math.min(1, perks.flight + PERK_NUMBERS.fly.recharge * delta);

  // --- stato condiviso (letto da `combat.ts` e dalle minacce) ---
  state.x = world.runX + world.strafe;
  state.y = y;
  state.facing = 1;
  // Col frutto Gomu Gomu il fendente diventa un pugno a gomma: portata molto più lunga.
  const reach = world.buffs.gomu > 0 ? ATTACK_REACH * GOMU.reachMultiplier : ATTACK_REACH;
  state.attackBox = attackActive
    ? {
        x: state.x + reach / 2,
        y: state.y + ARENA_PLAYER_HEIGHT / 2,
        halfWidth: reach / 2,
        halfHeight: ATTACK_HALF_HEIGHT
      }
    : null;
  state.parryActive = parryActive;
  // L'aura Super Saiyan rende invincibili quanto un dash.
  state.invulnerable = dashing || world.buffs.saiyan > 0 || world.cat.active || perks.slamming;
  state.dashDir = dashing ? runner.dashDir : 0;

  if (state.hitTimer > 0) return 'hit';
  if (state.parryFlash > 0) return 'parry';
  if (runner.action === 'attack') return 'attack';
  return 'walk';
}
