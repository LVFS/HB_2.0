import { useArenaStore } from '@/store/arenaStore';
import { aabbOverlap } from '@/game/render2d/collision';
import { resolveSpecial } from './bossSpecial';
import { pickEngageDistance, type BossContext } from './bossRuntime';
import { bossHurtbox, hitBoss, onPlayerMeleeHit } from './combat';
import {
  BOSS_COOLDOWN_AFTER_INTERRUPT,
  COUNTER_HOP_DURATION,
  COUNTER_HOP_HEIGHT,
  EVE_ATTACK_DAMAGE,
  EVE_ATTACK_POSTURE,
  POSTURE_DECAY_DELAY,
  POSTURE_DECAY_PER_SECOND
} from './arenaConfig';

/**
 * Stato "passivo" del boss che ogni frame va aggiornato prima delle azioni:
 * interruzioni dall'esterno, postura che decade, colpi ricevuti da giocatore
 * ed Eve, barcollamento. Nessun React.
 */

/** Un colpo a distanza ha PARATO la sua mossa: la interrompe (lo segna `gunParryBoss` in `combat.ts`). */
export function handleInterrupted({ world, rt }: BossContext): void {
  const { boss } = world;
  if (!boss.interrupted) return;
  boss.interrupted = false;
  if (rt.action) {
    rt.lastMoveId = rt.action.move.id;
    rt.action = null;
    boss.attackBox = null;
    boss.y = 0;
    boss.vanished = false;
    boss.teleportDestX = null;
    boss.zoneRadius = null;
    rt.cooldown = BOSS_COOLDOWN_AFTER_INTERRUPT;
    rt.preferredDistance = pickEngageDistance();
  }
}

/** Postura: a zero a fine barcollamento, altrimenti decade da sola se non guadagna per un po'. */
export function updatePosture({ world, rt }: BossContext, delta: number): void {
  const { boss } = world;
  if (boss.posture > rt.lastPosture) rt.sinceGain = 0;
  rt.sinceGain += delta;
  if (boss.staggerTimer > 0) {
    boss.staggerTimer -= delta;
    if (boss.staggerTimer <= 0) {
      boss.posture = 0;
      useArenaStore.getState().set({ bossPosture: 0 });
    }
  } else if (rt.sinceGain > POSTURE_DECAY_DELAY && boss.posture > 0) {
    boss.posture = Math.max(0, boss.posture - POSTURE_DECAY_PER_SECOND * delta);
    if (Math.round(boss.posture) !== Math.round(rt.lastPosture)) {
      useArenaStore.getState().set({ bossPosture: Math.round(boss.posture) });
    }
  }
  rt.lastPosture = boss.posture;
}

/** Colpi del giocatore e di Eve sul boss (una volta per fendente). */
export function applyHitsOnBoss({ world, rt }: BossContext): void {
  const { player, eve } = world;
  const hurt = bossHurtbox(world);
  if (player.attackBox && rt.lastPlayerSwing !== player.swingId && aabbOverlap(player.attackBox, hurt)) {
    rt.lastPlayerSwing = player.swingId;
    // Danno e postura del fendente in corso li fissa `PlayerArena` (attacco
    // base o abilità) quando lo inizia.
    hitBoss(world, { damage: player.attackDamage, posture: player.attackPosture, source: 'player' });
    onPlayerMeleeHit(world);
  }
  if (eve.attackBox && rt.lastEveSwing !== eve.swingId && aabbOverlap(eve.attackBox, hurt)) {
    rt.lastEveSwing = eve.swingId;
    hitBoss(world, { damage: EVE_ATTACK_DAMAGE, posture: EVE_ATTACK_POSTURE, source: 'eve' });
  }
}

/** Barcolla: niente azioni (se stava caricando lo speciale, lo perde — esito "interrotto"). */
export function updateStaggered(ctx: BossContext, delta: number): void {
  const { world, rt } = ctx;
  const { boss } = world;
  rt.action = null;
  boss.attackBox = null;
  boss.vanished = false;
  boss.teleportDestX = null;
  boss.zoneRadius = null;
  if (boss.hopTime > 0) {
    // Mini balzo all'indietro dopo un contrasto: un arco corto, poi a terra.
    boss.hopTime = Math.max(0, boss.hopTime - delta);
    const u = 1 - boss.hopTime / COUNTER_HOP_DURATION;
    boss.y = COUNTER_HOP_HEIGHT * 4 * u * (1 - u);
    boss.x += boss.hopVx * delta;
  } else {
    boss.y = 0;
  }
  if (rt.special) resolveSpecial(ctx, 'interrupted');
}
