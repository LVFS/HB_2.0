import { useArenaStore, type QteView } from '@/store/arenaStore';
import { addRing } from '../BossArena/combat';
import { rumble } from '@/input/rumble';
import { createQte, isQteFinished, pickQteKeys, updateQte, type QteState } from '../BossArena/qte';
import type { BarrageState, TunnelWorld } from './tunnelState';
import {
  BARRAGE_GAP,
  BARRAGE_GUARDS,
  BARRAGE_INTRO,
  BARRAGE_KEYS,
  BARRAGE_MAX_MISSES,
  BARRAGE_OUTRO,
  BARRAGE_WINDOWS
} from './tunnelConfig';

/**
 * La raffica a doppia spada (`combo_doppia_spada_qte`): in fondo al tunnel una
 * fila di burattini-guardia sbarra la strada e D estrae la seconda spada. È un
 * QTE (stesso `qte.ts` del finale in arena) più lungo e con finestre più
 * strette; ogni tasto riuscito è un fendente e butta giù una guardia. NON c'è
 * game over: una raffica fallita cambia solo il punteggio (`score`, 0-1) e
 * quante guardie cadono. Checco scappa comunque. Pura (niente React/Three).
 */

const STRIKE_DURATION = 0.28;

export interface BarrageHooks {
  /** Messaggio compatto sotto le barre (titolo, riga di aiuto, secondi). */
  message: (title: string, hint: string | null, seconds?: number) => void;
}

export function createBarrage(): BarrageState {
  return {
    phase: 'intro',
    t: 0,
    qte: null,
    pressed: [],
    strike: 0,
    strikeSide: 1,
    hits: 0,
    misses: 0,
    guardsFallen: 0,
    score: null
  };
}

function publishQte(qte: QteState): void {
  const view: QteView = {
    keys: qte.keys,
    index: qte.index,
    results: [...qte.results],
    windowSeconds: qte.windows[Math.min(qte.index, qte.windows.length - 1)],
    waiting: qte.gapLeft > 0 || isQteFinished(qte),
    title: 'Double sword skill!'
  };
  useArenaStore.getState().set({ qte: view });
}

/** Il giocatore ha superato la prova: pochi mancati (è uno spettacolo, non una punizione). */
export function barrageSucceeded(barrage: BarrageState): boolean {
  return barrage.misses <= BARRAGE_MAX_MISSES;
}

/**
 * Fa avanzare la raffica di `delta` secondi. Restituisce `'done'` quando è
 * finita (il chiamante passa alla fuga con `barrage.score`).
 */
export function updateBarrage(world: TunnelWorld, delta: number, hooks: BarrageHooks): 'running' | 'done' {
  const barrage = world.barrage;
  if (!barrage) return 'done';
  barrage.t += delta;
  barrage.strike = Math.max(0, barrage.strike - delta);
  // D sta fermo davanti alle guardie: in posa durante l'attesa, d'attacco a ogni fendente.
  world.runner.anim = barrage.strike > 0 ? 'attack' : 'idle';

  switch (barrage.phase) {
    case 'intro': {
      if (barrage.t >= BARRAGE_INTRO) {
        barrage.phase = 'qte';
        barrage.t = 0;
        barrage.qte = createQte(pickQteKeys(BARRAGE_KEYS, BARRAGE_WINDOWS.length), BARRAGE_WINDOWS, BARRAGE_GAP);
        publishQte(barrage.qte);
      }
      break;
    }
    case 'qte': {
      const qte = barrage.qte;
      if (!qte) break;
      const wasWaiting = qte.gapLeft > 0;
      // `updateQte` non fa scorrere la pausa dopo l'ultimo prompt: la consumiamo qui.
      if (isQteFinished(qte)) qte.gapLeft = Math.max(0, qte.gapLeft - delta);
      const event = updateQte(qte, delta, barrage.pressed.splice(0));
      if (event) {
        const player = world.arena.player;
        if (event.result === 'hit') {
          rumble('tick');
          barrage.hits += 1;
          barrage.strike = STRIKE_DURATION;
          barrage.strikeSide = barrage.strikeSide === 1 ? -1 : 1;
          // Una guardia cade in proporzione ai colpi: la raffica si legge a schermo.
          barrage.guardsFallen = Math.round((barrage.hits / qte.keys.length) * BARRAGE_GUARDS);
          addRing(world.arena, player.x + 1.4, 1.2, 1.3, 0.28, barrage.strikeSide === 1 ? '#7dd3fc' : '#fef08a');
          world.arena.hitStop = Math.max(world.arena.hitStop, 0.04);
          world.arena.popups.push({ x: player.x + 1.6, y: 2.6, amount: 0, target: 'boss', boost: 1, label: `×${barrage.hits}` });
        } else {
          barrage.misses += 1;
          world.arena.popups.push({ x: player.x + 1.6, y: 2.6, amount: 0, target: 'boss', boost: 1, label: 'MANCATO' });
        }
        publishQte(qte);
      } else if (wasWaiting && qte.gapLeft === 0) {
        publishQte(qte);
      }
      if (isQteFinished(qte) && qte.gapLeft === 0) {
        barrage.score = barrage.hits / qte.keys.length;
        barrage.phase = 'outro';
        barrage.t = 0;
        // Cadono solo le guardie dei colpi a segno: le altre sbarrano ancora la strada (lo score le conta).
        useArenaStore.getState().set({ qte: null });
        hooks.message(
          barrageSucceeded(barrage) ? 'Raffica perfetta!' : 'Basta così… la strada è libera',
          barrageSucceeded(barrage) ? null : 'Checco è già oltre il portello',
          BARRAGE_OUTRO + 0.6
        );
      }
      break;
    }
    case 'outro': {
      if (barrage.t >= BARRAGE_OUTRO) return 'done';
      break;
    }
  }
  return 'running';
}
