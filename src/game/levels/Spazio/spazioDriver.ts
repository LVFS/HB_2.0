import { useArenaStore, type QteView } from '@/store/arenaStore';
import { SPACE_SUPPORT_CHATTER } from '@/data/dialogues/level1_spazio';
import type { DialogueLine } from '@/data/dialogues/level1_intro';
import { rumble } from '@/input/rumble';
import { createQte, isQteFinished, pickQteKeys, updateQte, type QteState } from '../BossArena/qte';
import { chargeOutcome, createChargeMeter, tap, updateChargeMeter } from './chargeMeter';
import {
  CANNON_FIRE_HOLD,
  CANNON_READY_DELAY,
  SPACE_BOLT_SECONDS,
  SUPPORT_INTRO,
  SUPPORT_OUTRO,
  SUPPORT_QTE_COUNT,
  SUPPORT_QTE_GAP,
  SUPPORT_QTE_KEYS,
  SUPPORT_QTE_TITLE,
  SUPPORT_QTE_WINDOW_FIRST,
  SUPPORT_QTE_WINDOW_LAST
} from './spazioConfig';
import type { SpaceBurst, SpazioWorld } from './spazioState';

/** Moduli di simulazione dello spazio, SENZA React: li chiama l'unico `useFrame` di `SceneManagerSpazio`. */

export interface SpazioHooks {
  /** Mostra una battuta breve per qualche secondo (le didascalie del QTE). */
  caption: (line: DialogueLine, seconds: number) => void;
}

const MAX_BURSTS = 26;

export function addBurst(world: SpazioWorld, burst: Omit<SpaceBurst, 'age'>): void {
  if (world.bursts.length >= MAX_BURSTS) world.bursts.shift();
  world.bursts.push({ ...burst, age: 0 });
}

export function addRing(world: SpazioWorld, x: number, y: number, size: number, life = 0.5, color = '#ffffff'): void {
  addBurst(world, { x, y, size, life, color, kind: 'ring' });
}

/** Effetti di ogni frame (in qualunque tappa): colpi in volo, anelli e fumo che svaniscono, tremolio e bagliore che si smorzano. */
export function updateEffects(world: SpazioWorld, delta: number): void {
  for (let i = world.bolts.length - 1; i >= 0; i -= 1) {
    const bolt = world.bolts[i];
    bolt.t += delta / SPACE_BOLT_SECONDS;
    if (bolt.t < 1) continue;
    if (bolt.hit) {
      addRing(world, bolt.toX, bolt.toY, 0.9, 0.35, '#fb923c');
      world.shake = Math.max(world.shake, 0.22);
      world.eve.smoke = Math.min(1, world.eve.smoke + 0.28);
      world.eve.shakeX = 0.25;
    }
    world.bolts.splice(i, 1);
  }
  for (let i = world.bursts.length - 1; i >= 0; i -= 1) {
    const burst = world.bursts[i];
    burst.age += delta;
    if (burst.kind === 'puff') {
      burst.x -= delta * 1.6;
      burst.y += delta * 0.25;
    }
    if (burst.age >= burst.life) world.bursts.splice(i, 1);
  }
  // Fumo dalla navicella ferita: più è danneggiata, più sbuffi.
  if (world.eve.visible && world.eve.smoke > 0 && Math.random() < world.eve.smoke * delta * 9) {
    addBurst(world, { x: world.eve.x - 0.9, y: world.eve.y, life: 1.1, size: 0.8 + Math.random() * 0.5, color: '#475569', kind: 'puff' });
  }
  world.eve.dodge *= Math.exp(-delta * 4.5);
  world.eve.shakeX *= Math.exp(-delta * 9);
  world.shake *= Math.exp(-delta * 6);
  if (world.shake < 0.002) world.shake = 0;
  world.flash = Math.max(0, world.flash - delta * 1.6);
}

// ---------- QTE di supporto a Eve ----------

function publishSupportQte(qte: QteState): void {
  const view: QteView = {
    keys: qte.keys,
    index: qte.index,
    results: [...qte.results],
    windowSeconds: qte.windows[Math.min(qte.index, qte.windows.length - 1)],
    waiting: qte.gapLeft > 0 || isQteFinished(qte),
    title: SUPPORT_QTE_TITLE
  };
  useArenaStore.getState().set({ qte: view });
}

export function startSupport(world: SpazioWorld): void {
  world.stage = 'support';
  world.pressed.length = 0;
  world.support = { phase: 'intro', t: 0, qte: null, hits: 0, misses: 0 };
}

/** Quanto è andato bene il supporto (tasti riusciti / totale), 0-1. */
export function supportScore(world: SpazioWorld): number {
  const total = world.support.qte?.keys.length ?? SUPPORT_QTE_COUNT;
  return total === 0 ? 0 : world.support.hits / total;
}

/**
 * Un frame del QTE: intro → prompt a tempo → fine. Ogni tasto riuscito fa schivare la navicella (il colpo la manca),
 * ogni tasto mancato la fa colpire (scintille e scossa). NON cambia la storia: lo scafo è compromesso comunque.
 */
export function updateSupport(world: SpazioWorld, delta: number, hooks: SpazioHooks): 'running' | 'done' {
  const support = world.support;
  const mother = world.mother;

  switch (support.phase) {
    case 'intro': {
      mother.glow = 0;
      support.t += delta;
      if (support.t >= SUPPORT_INTRO) {
        const windows = Array.from(
          { length: SUPPORT_QTE_COUNT },
          (_, i) => SUPPORT_QTE_WINDOW_FIRST + ((SUPPORT_QTE_WINDOW_LAST - SUPPORT_QTE_WINDOW_FIRST) * i) / Math.max(1, SUPPORT_QTE_COUNT - 1)
        );
        support.qte = createQte(pickQteKeys(SUPPORT_QTE_KEYS, SUPPORT_QTE_COUNT), windows, SUPPORT_QTE_GAP);
        support.phase = 'qte';
        support.t = 0;
        world.pressed.length = 0;
        publishSupportQte(support.qte);
      }
      break;
    }
    case 'qte': {
      const qte = support.qte;
      if (!qte) break;
      const wasWaiting = qte.gapLeft > 0;
      // `updateQte` non fa scorrere la pausa dopo l'ultimo prompt: la consumiamo qui.
      if (isQteFinished(qte)) qte.gapLeft = Math.max(0, qte.gapLeft - delta);
      const event = updateQte(qte, delta, world.pressed.splice(0));
      // La torretta si accende mentre il prompt corre: si legge COSA sta per arrivare.
      mother.glow = qte.gapLeft > 0 || isQteFinished(qte) ? 0 : Math.min(1, qte.t / qte.windows[qte.index]);
      if (event) {
        const hit = event.result === 'hit';
        const from = { x: mother.x + (event.index % 2 === 0 ? -1.6 : 1.6), y: mother.y - 1.1 };
        const eve = world.eve;
        if (hit) {
          rumble('tick');
          support.hits += 1;
          eve.dodge = 1;
          addRing(world, eve.x, eve.y, 0.7, 0.3, '#7dd3fc');
          // Il colpo passa dove la navicella era un attimo fa.
          world.bolts.push({ fromX: from.x, fromY: from.y, toX: eve.x - 0.4, toY: eve.y - 0.1, t: 0, hit: false });
        } else {
          rumble('hit');
          support.misses += 1;
          world.bolts.push({ fromX: from.x, fromY: from.y, toX: eve.x, toY: eve.y, t: 0, hit: true });
        }
        const chatter = SPACE_SUPPORT_CHATTER.find((entry) => entry.afterPrompt === event.index);
        if (chatter) hooks.caption(chatter.line, 2);
        publishSupportQte(qte);
      } else if (wasWaiting && qte.gapLeft === 0) {
        publishSupportQte(qte);
      }
      if (isQteFinished(qte) && qte.gapLeft === 0) {
        support.phase = 'outro';
        support.t = 0;
        mother.glow = 0;
        useArenaStore.getState().set({ qte: null });
      }
      break;
    }
    case 'outro': {
      support.t += delta;
      if (support.t >= SUPPORT_OUTRO) {
        support.phase = 'done';
        return 'done';
      }
      break;
    }
    case 'done':
      return 'done';
  }
  return 'running';
}

// ---------- Carica del cannone ----------

export function startCannon(world: SpazioWorld): void {
  world.stage = 'cannon';
  world.cannon = { phase: 'ready', t: 0, meter: createChargeMeter(), taps: [], fired: 0, score: 0, forced: false };
}

/** Un frame del cannone: pausa iniziale (le pressioni del dialogo non contano), carica, sparo. */
export function updateCannon(world: SpazioWorld, delta: number): 'running' | 'done' {
  const cannon = world.cannon;
  const meter = cannon.meter;
  if (!meter) return 'done';

  switch (cannon.phase) {
    case 'ready': {
      cannon.taps.length = 0;
      cannon.t += delta;
      if (cannon.t >= CANNON_READY_DELAY) cannon.phase = 'charging';
      break;
    }
    case 'charging': {
      for (const key of cannon.taps.splice(0)) tap(meter, key);
      const status = updateChargeMeter(meter, delta);
      // La navicella vibra sempre di più con la carica.
      world.shake = Math.max(world.shake, meter.charge * 0.08);
      if (status !== 'charging') {
        const outcome = chargeOutcome(meter);
        cannon.fired = outcome.fired;
        cannon.score = outcome.score;
        cannon.forced = outcome.forced;
        cannon.phase = 'fire';
        cannon.t = 0;
        rumble('slam');
        world.flash = Math.max(world.flash, 0.5);
        addRing(world, world.eve.x + 1.5, world.eve.y, 1.6, 0.5, '#c4b5fd');
      }
      break;
    }
    case 'fire': {
      cannon.t += delta;
      if (cannon.t >= CANNON_FIRE_HOLD) {
        cannon.phase = 'done';
        return 'done';
      }
      break;
    }
    case 'done':
      return 'done';
  }
  return 'running';
}
