import type { JumpState } from '@/game/shared/jump';
import type { PlayerActions } from '@/game/shared/usePlayerActions';
import { useArenaStore } from '@/store/arenaStore';
import type { BossMessenger } from '../BossArena/bossMessages';
import { createBarrage, updateBarrage } from './tunnelBarrage';
import { updateDirector } from './tunnelDirector';
import { updateHazards } from './tunnelCombat';
import { syncEvents, updateEvents } from './tunnelEvents';
import { publishTunnelStatus } from './tunnelHud';
import { updateCat } from './tunnelCat';
import { collectBox, consumeSlotItem } from './tunnelItems';
import { laneZ, resetLane } from './tunnelLanes';
import { resetBonuses, updateBuffs, updatePickups } from './tunnelPickups';
import { updatePerks } from './tunnelPerks';
import { updateReality } from './tunnelReality';
import { fireZoltraak } from './tunnelSpecial';
import { openWishChoice, resetWishes, resolveWishChoice, updateWishes } from './tunnelWishes';
import { updateRunner } from './tunnelPlayer';
import { resetSlancio, updateSlancio, worldDelta } from './tunnelSlancio';
import { updateGap, updateProjectiles, updatePuppet } from './tunnelPuppet';
import type { BarrageState, TunnelWorld } from './tunnelState';

/** Tutto ciò che serve a far avanzare il tunnel di un frame. */
export interface TunnelContext {
  world: TunnelWorld;
  actions: PlayerActions;
  jump: JumpState;
  messenger: BossMessenger;
  /** Chiamato una volta sola quando la corsa finisce (D ha raggiunto la marionetta). */
  onRunFinished: () => void;
  /** Chiamato una volta sola quando la raffica a doppia spada è finita, con il suo esito. */
  onBarrageFinished: (barrage: BarrageState) => void;
}

/** Porta il tunnel dalla corsa alla raffica: D si ferma davanti alle guardie, protetto. */
export function startBarrage(world: TunnelWorld): void {
  world.stage = 'barrage';
  world.barrage = createBarrage();
  // Raffica a tempo normale e senza bonus/eventi a metà.
  resetSlancio(world);
  resetBonuses(world);
  resetWishes(world);
  syncEvents(world);
  world.gapPending = 0;
  world.hudSignature = '';
  useArenaStore.getState().set({ tunnelStatus: null });
  world.runner.action = 'none';
  world.runner.anim = 'idle';
  world.strafe = 0;
  resetLane(world);
  const player = world.arena.player;
  player.healing = false;
  player.attackBox = null;
  player.parryActive = false;
  player.invulnerable = true;
  player.y = 0;
}

/**
 * Un frame del tunnel, nell'ordine: hit-stop (lo fa scendere solo qui, come
 * nell'arena) → bonus a tempo e Slancio → tempo di corsa (del mondo) → distanza
 * → giocatore → uso del bonus in casella → raccolta oggetti → minacce → eventi → realtà (onda, modalità) → stili → marionetta e
 * proiettili → direttore (nascita del copione, sezioni, sconfitta, fine). Fuori
 * dallo stadio `run` la simulazione sta ferma: dopo una sconfitta lavora solo il
 * direttore (ripartenza), durante la raffica solo la raffica e la marionetta.
 */
export function updateTunnel(ctx: TunnelContext, rawDelta: number): void {
  const { world } = ctx;
  // Un desiderio di Shenron da scegliere: il gioco è fermo (hit-stop infinito) finché non si sceglie.
  if (world.wishChoice) {
    if (!resolveWishChoice(world, ctx.messenger)) return;
    ctx.actions.consume();
  }
  if (world.arena.hitStop > 0) {
    world.arena.hitStop -= rawDelta;
    return;
  }
  const delta = Math.min(rawDelta, 0.05);

  if (world.stage === 'barrage') {
    updatePuppet(world, delta);
    if (updateBarrage(world, delta, { message: ctx.messenger.flash }) === 'done' && world.barrage) {
      const finished = world.barrage;
      world.stage = 'finished';
      ctx.onBarrageFinished(finished);
    }
    return;
  }

  if (world.stage === 'run') {
    // Bonus a tempo e Slancio sono del GIOCATORE (tempo reale); il tempo del mondo
    // (`worldDt`) è quello che lo Slancio accelera e il Ciak! rallenta.
    updateBuffs(world, delta);
    updateWishes(world, delta);
    updateSlancio(world, delta);
    const worldDt = worldDelta(world, delta);
    world.time += worldDt;
    world.elapsed += delta;
    world.shake = Math.max(0, world.shake - 0.6 * delta);
    // La deriva e le spinte sul gap PRIMA dei colpi: un colpo che porta il gap a 100 deve vederlo
    // il direttore nello stesso frame (la deriva lo riporterebbe subito sotto).
    updateGap(world, delta);
    world.runner.anim = updateRunner(world, ctx.actions, ctx.jump, delta);
    updateCat(world, delta, ctx.messenger);
    if (world.runner.useItem) consumeSlotItem(world, ctx.messenger);
    if (world.runner.useReserve && world.wishes.reserve > 0) {
      world.wishes.reserve -= 1;
      fireZoltraak(world);
      ctx.messenger.flash('Frieren: «Zoltraak.»', `Ne restano ${world.wishes.reserve}`, 1.6);
    }
    updatePickups(
      world,
      delta,
      () => collectBox(world, ctx.messenger),
      () => openWishChoice(world, ctx.messenger)
    );
    updateHazards(world, worldDt);
    updateEvents(world, delta, ctx.messenger);
    updateReality(world, delta, worldDt, ctx.messenger);
    updatePerks(world, delta, ctx.messenger);
    updatePuppet(world, delta);
    updateProjectiles(world, worldDt);
  }
  if (updateDirector({ world, jump: ctx.jump, messenger: ctx.messenger }, delta)) ctx.onRunFinished();

  // La HUD legge la distanza dallo store, che si aggiorna solo quando cambia il valore arrotondato.
  const shown = Math.round(world.gap);
  if (shown !== world.gapShown) {
    world.gapShown = shown;
    useArenaStore.getState().set({ tunnelGap: shown });
  }
  // I numeri di danno nascono nella via di D (quasi sempre è lì che succede qualcosa): ne prendono la profondità.
  for (const popup of world.arena.popups) popup.z ??= laneZ(world.lane.pos) + 1.5;
  if (world.stage === 'run' || world.stage === 'respawn') publishTunnelStatus(world);
}
