import { useArenaStore } from '@/store/arenaStore';
import type { BossContext } from './bossRuntime';
import {
  CLASH_DECAY,
  CLASH_DURATION,
  CLASH_FLING_BOOST,
  CLASH_FLING_SPEED,
  CLASH_LOSE_DAMAGE,
  CLASH_LOSE_STUN,
  CLASH_START_PROGRESS
} from './arenaConfig';
import { counterCharge, hitPlayer } from './combat';

/**
 * Il contrasto (tiro alla fune): giocatore e Checco si bloccano e bisogna
 * premere `J`/click a ripetizione. Qui l'avvio e l'avanzamento; il lato del
 * giocatore sta in `PlayerArena` (ogni pressione alza `world.clash.progress`),
 * la barra in `ArenaHud`.
 */

/** Parte il braccio di ferro (da una carica di Checco incontrata con un dash VERSO di lui). */
export function startClash({ world, messenger }: BossContext): void {
  world.clash = { t: 0, duration: CLASH_DURATION, progress: CLASH_START_PROGRESS };
  messenger.cancel();
  useArenaStore.getState().set({ clash: CLASH_START_PROGRESS, message: null, hint: null });
}

/** Fa avanzare il braccio di ferro: vinto (Checco stordito) o perso (giocatore sbalzato via). */
export function updateClash({ world, messenger }: BossContext, delta: number): void {
  const clash = world.clash;
  if (!clash) return;
  const { boss, player } = world;
  clash.t += delta;
  const store = useArenaStore.getState();
  // Vittoria controllata PRIMA del decadimento: la pressione che riempie la
  // barra non deve essere "mangiata" dal calo dello stesso frame.
  const won = clash.progress >= 1;
  if (!won) clash.progress = Math.max(0, clash.progress - CLASH_DECAY * delta);
  const shown = Math.round(clash.progress * 50) / 50;
  if (store.clash !== shown) store.set({ clash: shown });

  if (won) {
    // Vinto: Checco stordito e fa il mini balzo indietro.
    world.clash = null;
    store.set({ clash: null });
    counterCharge(world);
    messenger.flash('CONTRASTATO!', 'Checco è stordito: colpiscilo!', 1.8);
  } else if (clash.progress <= 0 || clash.t >= clash.duration) {
    // Perso: il giocatore viene sbalzato via, con danno e stordimento.
    world.clash = null;
    store.set({ clash: null });
    player.invulnerable = false;
    player.iframes = 0;
    const away = player.x >= boss.x ? 1 : -1;
    hitPlayer(world, CLASH_LOSE_DAMAGE, { unparryable: true });
    player.knockbackVx = away * CLASH_FLING_SPEED;
    player.hitTimer = Math.max(player.hitTimer, CLASH_LOSE_STUN);
    player.airBoost = CLASH_FLING_BOOST;
    messenger.flash('SBALZATO!', 'Contrasto fallito', 1.6);
  }
}
