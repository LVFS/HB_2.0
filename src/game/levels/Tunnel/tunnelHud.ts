import { useArenaStore, type TunnelHudBuff, type TunnelHudSlot, type TunnelHudStatus } from '@/store/arenaStore';
import { createItemIconUrls } from './pickupIcons';
import { CIAK, GOMU, ITEM_LABEL, MALUS, NUVOLA, PERKS, SAIYAN, SLANCIO_TEMPO, SPHERES_FOR_SHENRON, TUNNEL_TIME_LIMIT, WISH_NUMBERS, WISHES } from './tunnelConfig';
import type { TunnelWorld } from './tunnelState';
import { canFly } from './tunnelWishes';

/** Percentuale di tempo che resta, a passi del 10% (così la HUD si aggiorna poche volte al secondo). */
function pct(left: number, total: number): number {
  return Math.round(Math.max(0, Math.min(1, left / total)) * 10) * 10;
}

let itemIcons: ReturnType<typeof createItemIconUrls> | null = null;

function slotView(world: TunnelWorld): TunnelHudSlot | null {
  if (world.slot === null) return null;
  itemIcons ??= createItemIconUrls();
  return { id: world.slot, label: ITEM_LABEL[world.slot], icon: itemIcons[world.slot] };
}

/**
 * Copia nello store ciò che la HUD del tunnel mostra (Slancio, Sfere, casella bonus,
 * bonus a tempo, tempo rimasto, indicatore della marionetta fuori schermo), ma solo
 * quando cambia: la firma serve a non scrivere ogni frame.
 */
export function publishTunnelStatus(world: TunnelWorld): void {
  const { buffs } = world;
  const timed: TunnelHudBuff[] = [];
  if (buffs.saiyan > 0) timed.push({ id: 'saiyan', label: 'Super Saiyan', pct: pct(buffs.saiyan, SAIYAN.duration) });
  if (buffs.kaioken > 0) timed.push({ id: 'kaioken', label: 'Kaioken ×10', pct: pct(buffs.kaioken, WISH_NUMBERS.kaioken.seconds) });
  if (buffs.ultreia > 0) timed.push({ id: 'ultreia', label: 'Ultreia!', pct: pct(buffs.ultreia, WISH_NUMBERS.ultreia.seconds) });
  if (buffs.gomu > 0) timed.push({ id: 'gomu', label: 'Gomu Gomu', pct: pct(buffs.gomu, GOMU.duration) });
  if (buffs.ciak > 0) timed.push({ id: 'ciak', label: 'Ciak!', pct: pct(buffs.ciak, CIAK.duration) });
  if (buffs.nuvola > 0) timed.push({ id: 'nuvola', label: 'Nuvola Speedy', pct: pct(buffs.nuvola, NUVOLA.duration) });
  // I malus (rossi nella HUD): frenato dal dardo, rallentato sui resti.
  if (world.brakeT > 0) timed.push({ id: 'brake', label: 'MALUS: Frenato (niente Slancio)', pct: pct(world.brakeT, MALUS.brake), bad: true });
  if (world.slowT > 0) timed.push({ id: 'slow', label: 'MALUS: Rallentato', pct: pct(world.slowT, MALUS.slow), bad: true });
  const status: TunnelHudStatus = {
    slancio: world.slancio,
    slancioMax: SLANCIO_TEMPO.length - 1,
    speedPct: Math.round((SLANCIO_TEMPO[world.slancio] - 1) * 100),
    spheres: world.spheres,
    spheresMax: SPHERES_FOR_SHENRON,
    slot: slotView(world),
    buffs: timed,
    timeLeft: Math.max(0, Math.ceil(TUNNEL_TIME_LIMIT - world.elapsed)),
    offscreen: !world.puppet.onScreen,
    dark: Math.round(world.dark * 10) * 10,
    darkX: Math.round((0.5 - (world.view.rightEdge - world.view.halfW) / (2 * world.view.halfW)) * 100),
    blind: world.blindCount,
    perks: world.perks.filter((id) => id !== 'zoro' || world.perkState.zoroT > 0).map((id) => PERKS[id].label),
    flight: canFly(world) ? pct(world.perkState.flight, 1) : null,
    cat: world.cat.active ? { affection: Math.round(world.cat.affection * 20) * 5, hunger: Math.round(world.cat.hunger * 20) * 5 } : null,
    wishes: { owned: world.wishes.owned.map((id) => WISHES[id].short), instinct: world.wishes.instinct, reserve: world.wishes.reserve },
    threat: world.wave ? { meters: Math.max(0, Math.round(world.wave.x - world.arena.player.x)), lanes: world.wave.lanes } : null,
    mode: world.mode.id
      ? {
          id: world.mode.id,
          pct: pct(world.mode.duration - world.mode.elapsed, world.mode.duration),
          finale: world.mode.finale !== 'none'
        }
      : null
  };
  // L'icona (data URL) non entra nella firma: basta l'id del bonus.
  const signature = JSON.stringify({ ...status, slot: status.slot?.id ?? null });
  if (signature === world.hudSignature) return;
  world.hudSignature = signature;
  useArenaStore.getState().set({ tunnelStatus: status });
}
