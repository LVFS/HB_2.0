import { startFinale } from './finale';
import { pickEngageDistance, type BossContext } from './bossRuntime';
import { BOSS_COOLDOWN_AFTER_FINISHER, FINALE_HP_FRACTION } from './arenaConfig';

/**
 * Il boss cede il controllo a una sequenza scriptata (il finale con QTE e
 * cutscene, la carica con falce del giocatore): qui il "passaggio di consegne"
 * — cosa azzerare quando una sequenza parte e quando finisce. La sequenza
 * stessa sta in `finale.ts` / `finisher.ts`; il frame del boss le fa avanzare.
 */

/** Azzera ciò che il boss stava facendo (mossa, evento, stati a mezz'aria, avvisi). */
function dropBossActions({ world, rt }: BossContext): void {
  const { boss } = world;
  rt.action = null;
  boss.attackBox = null;
  boss.vanished = false;
  boss.teleportDestX = null;
  boss.zoneRadius = null;
  boss.hopTime = 0;
  boss.parryable = false;
  boss.interrupted = false;
}

/** Sotto `FINALE_HP_FRACTION` di vita parte il finale (una sola volta). */
export function startFinaleIfDue(ctx: BossContext): void {
  const { world, rt } = ctx;
  const { boss, player } = world;
  if (world.finale || boss.hp > boss.hpMax * FINALE_HP_FRACTION) return;
  dropBossActions(ctx);
  rt.special = null;
  rt.summon = null;
  rt.specialDone = true;
  boss.specialActive = false;
  boss.staggerTimer = 0;
  player.healing = false;
  world.finale = startFinale(world);
}

/** Primo frame della carica con falce: il boss lascia ciò che faceva. */
export function beginFinisherIfNew(ctx: BossContext): void {
  const finisher = ctx.world.finisher;
  if (!finisher || finisher.started) return;
  finisher.started = true;
  dropBossActions(ctx);
}

/** Carica con falce finita: Checco riprende l'IA da terra, dopo una pausa. */
export function endFinisher({ world, rt }: BossContext): void {
  world.finisher = null;
  world.boss.y = 0;
  rt.cooldown = BOSS_COOLDOWN_AFTER_FINISHER;
  rt.preferredDistance = pickEngageDistance();
}
