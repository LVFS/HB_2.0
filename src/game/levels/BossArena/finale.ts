import { useArenaStore, type QteView } from '@/store/arenaStore';
import type { ArenaFinale, ArenaWorld } from './arenaState';
import {
  ARENA_CEILING_Y,
  DEBRIS_FALL_SPEED,
  ARENA_HALF_WIDTH,
  FINALE_EVE_WALK_DELAY,
  FINALE_FLING,
  FINALE_FLING_DISTANCE,
  FINALE_GATHER,
  FINALE_LAND,
  FINALE_SIDE_DISTANCE,
  FINALE_TRANSFORM,
  QTE_GAP,
  QTE_KEYS,
  QTE_MAX_MISSES,
  QTE_WINDOWS
} from './arenaConfig';
import { addRing } from './combat';
import { countMisses, createQte, isQteFinished, pickQteKeys, updateQte, type QteState } from './qte';

/**
 * Finale del combattimento: quando Checco scende sotto `FINALE_HP_FRACTION` di
 * vita il gioco passa a una sequenza scriptata — Checco al centro come
 * bersaglio fisso, Eve si rialza (sempre) e raggiunge D, QTE cooperativo (5
 * prompt: D ed Eve colpiscono insieme), Checco atterra, diventa una marionetta
 * e scaraventa i due eroi lontano. Come `finisher.ts`, qui sta la logica e la
 * fa avanzare `BossChecco`; `PlayerArena`/`EveArena` applicano le posizioni.
 * L'esito del QTE (`qteSuccess`) NON cambia la storia: solo una riga di
 * dialogo e un piccolo bonus/malus (vedi `levelStore.finalQteSuccess`).
 */

/** Tempo dal quale, dopo l'ultimo prompt, il QTE sparisce dalla HUD (in `land`). */
const QTE_HUD_LINGER = 0.9;
const STRIKE_DURATION = 0.3;

export interface FinaleHooks {
  /** Messaggio grande al centro (titolo, riga di aiuto, secondi). */
  message: (title: string, hint: string | null, seconds?: number) => void;
}

/** Ogni quanto (s) cade un detrito di scena durante il crollo, e quanti al massimo in volo. */
const COLLAPSE_DEBRIS_INTERVAL = 0.2;
const COLLAPSE_DEBRIS_MAX = 10;

/**
 * Il "crollo" della sala durante la trasformazione e lo scaraventamento: pezzi
 * di soffitto che cadono qua e là. Solo scena (danno 0: D ed Eve sono
 * invulnerabili nel finale) — è ciò che il dialogo del Sotterraneo racconta
 * ("il crollo ha diviso la sala, pezzi di sala"), così non arriva dal nulla.
 */
function tickCollapse(world: ArenaWorld, f: ArenaFinale, delta: number): void {
  f.debrisTimer -= delta;
  if (f.debrisTimer > 0 || world.hazards.length >= COLLAPSE_DEBRIS_MAX) return;
  f.debrisTimer = COLLAPSE_DEBRIS_INTERVAL;
  world.hazards.push({
    x: (Math.random() * 2 - 1) * (ARENA_HALF_WIDTH - 1),
    y: ARENA_CEILING_Y,
    vy: -DEBRIS_FALL_SPEED,
    warn: 0,
    damage: 0,
    state: 'fall'
  });
}

const ease = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (u: number) => Math.min(1, Math.max(0, u));

function publishQte(qte: QteState): void {
  const view: QteView = {
    keys: qte.keys,
    index: qte.index,
    results: [...qte.results],
    windowSeconds: qte.windows[Math.min(qte.index, qte.windows.length - 1)],
    waiting: qte.gapLeft > 0 || isQteFinished(qte),
    title: 'Colpite insieme!'
  };
  useArenaStore.getState().set({ qte: view });
}

/** Prepara il finale dalla situazione attuale (e ripulisce l'arena). */
export function startFinale(world: ArenaWorld): ArenaFinale {
  const { player, boss, eve } = world;
  world.projectiles.length = 0;
  world.hazards.length = 0;
  world.turrets.length = 0;
  world.totems.length = 0;
  world.shots.length = 0;
  world.finisher = null;
  useArenaStore.getState().set({ totemsLeft: 0, message: null, hint: null });

  return {
    phase: 'gather',
    t: 0,
    playerSide: player.x <= boss.x ? -1 : 1,
    playerStartX: player.x,
    playerStartY: player.y,
    eveStartX: eve.x,
    bossStartX: boss.x,
    playerX: player.x,
    playerY: player.y,
    playerRot: 0,
    eveX: eve.x,
    eveY: 0,
    eveRot: 0,
    playerAnim: 'idle',
    eveAnim: 'idle',
    qte: null,
    pressed: [],
    qteSuccess: null,
    strikeTimer: 0,
    marionette: false,
    intermezzoDone: false,
    debrisTimer: 0
  };
}

/**
 * Fa avanzare il finale di `delta` secondi. Restituisce `'victory'` quando la
 * cutscene è finita (il chiamante chiude il combattimento), altrimenti `'running'`.
 */
export function updateFinale(world: ArenaWorld, delta: number, hooks: FinaleHooks): 'running' | 'victory' {
  const f = world.finale;
  if (!f) return 'victory';
  const { boss } = world;
  const side = f.playerSide;
  const sideX = FINALE_SIDE_DISTANCE;

  f.t += delta;
  f.strikeTimer = Math.max(0, f.strikeTimer - delta);
  boss.facing = side;

  switch (f.phase) {
    case 'gather': {
      // Checco barcolla verso il centro; D si porta a un lato, Eve all'altro
      // (dopo essersi rialzata, se era a terra).
      const u = ease(clamp01(f.t / FINALE_GATHER));
      boss.x = f.bossStartX * (1 - u);
      boss.y = 0;
      f.playerX = f.playerStartX + (side * sideX - f.playerStartX) * u;
      f.playerY = f.playerStartY * (1 - u);
      const ue = ease(clamp01((f.t - FINALE_EVE_WALK_DELAY) / (FINALE_GATHER - FINALE_EVE_WALK_DELAY)));
      f.eveX = f.eveStartX + (-side * sideX - f.eveStartX) * ue;
      f.playerAnim = u < 1 ? 'walk' : 'idle';
      f.eveAnim = ue > 0 && ue < 1 ? 'walk' : 'idle';
      if (f.t >= FINALE_GATHER) {
        f.phase = 'qte';
        f.t = 0;
        f.qte = createQte(pickQteKeys(QTE_KEYS, QTE_WINDOWS.length), QTE_WINDOWS, QTE_GAP);
        publishQte(f.qte);
      }
      break;
    }

    case 'qte': {
      f.playerX = side * sideX;
      f.eveX = -side * sideX;
      const qte = f.qte;
      if (!qte) break;
      const wasWaiting = qte.gapLeft > 0;
      // `updateQte` non fa scorrere la pausa dopo l'ultimo prompt: la consumiamo qui.
      if (isQteFinished(qte)) qte.gapLeft = Math.max(0, qte.gapLeft - delta);
      const event = updateQte(qte, delta, f.pressed.splice(0));
      if (event) {
        if (event.result === 'hit') {
          f.strikeTimer = STRIKE_DURATION;
          addRing(world, boss.x, 1.2, 1.4, 0.3, '#ffffff');
          world.hitStop = Math.max(world.hitStop, 0.05);
          world.popups.push({ x: boss.x, y: 3.1, amount: 0, target: 'boss', boost: 1, label: 'INSIEME!' });
        } else {
          world.popups.push({ x: boss.x, y: 3.1, amount: 0, target: 'boss', boost: 1, label: 'MANCATO' });
        }
        publishQte(qte);
      } else if (wasWaiting && qte.gapLeft === 0) {
        // Il prossimo prompt è partito: la HUD riavvia la barra.
        publishQte(qte);
      }
      boss.y = f.strikeTimer > 0 ? 0.35 * (f.strikeTimer / STRIKE_DURATION) : 0;
      f.playerAnim = f.eveAnim = f.strikeTimer > 0 ? 'attack' : 'idle';

      if (isQteFinished(qte) && qte.gapLeft === 0) {
        f.qteSuccess = countMisses(qte) <= QTE_MAX_MISSES;
        f.phase = 'land';
        f.t = 0;
        // Resta la striscia dei risultati a schermo ancora un istante.
        hooks.message(
          f.qteSuccess ? 'BEL COLPO DI SQUADRA!' : 'SCOORDINATI…',
          f.qteSuccess ? null : 'Ma Checco va comunque a terra',
          1.6
        );
      }
      break;
    }

    case 'land': {
      // Un colpo lo scaraventa in alto, poi atterra e resta a terra.
      const v = clamp01(f.t / 0.7);
      boss.y = 1.6 * 4 * v * (1 - v);
      f.playerAnim = f.eveAnim = 'idle';
      if (f.t >= QTE_HUD_LINGER && useArenaStore.getState().qte) useArenaStore.getState().set({ qte: null });
      if (f.t >= FINALE_LAND) {
        // Checco è a terra: parte l'intermezzo a fumetti (FASE 11), che il mondo aspetta.
        f.phase = 'intermezzo';
        f.t = 0;
        f.qte = null;
        useArenaStore.getState().set({ qte: null, intermezzo: true });
      }
      break;
    }

    case 'intermezzo': {
      // Il mondo sta fermo (la sequenza è scriptata, gli input sono già ignorati) finché `SceneManagerBossArena` non
      // segna l'intermezzo come finito o saltato. Poi la trasformazione parte con la marionetta GIÀ svelata: l'hanno
      // raccontata i disegni, quindi niente «tell» di 0.5 s né messaggio. `fling` e il crollo restano com'erano.
      boss.y = 0;
      f.playerAnim = f.eveAnim = 'idle';
      if (f.intermezzoDone) {
        f.phase = 'transform';
        f.t = 0;
        f.marionette = true;
        addRing(world, boss.x, 1.4, 2.4, 0.5, '#c4b5fd');
        world.hitStop = Math.max(world.hitStop, 0.1);
      }
      break;
    }

    case 'transform': {
      // Si tende come tirato da fili: a metà diventa una marionetta.
      if (!f.marionette && f.t >= 0.5) {
        f.marionette = true;
        addRing(world, boss.x, 1.4, 2.4, 0.5, '#c4b5fd');
        world.hitStop = Math.max(world.hitStop, 0.1);
        hooks.message('CHECCO SI TRASFORMA', null, 1.4);
      }
      boss.y = f.marionette ? 0.7 * ease(clamp01((f.t - 0.5) / 0.6)) : 0;
      f.playerAnim = f.eveAnim = f.marionette ? 'stagger' : 'idle';
      if (f.marionette) tickCollapse(world, f, delta);
      if (f.t >= FINALE_TRANSFORM) {
        f.phase = 'fling';
        f.t = 0;
        addRing(world, boss.x, 1.2, 4, 0.5, '#c4b5fd');
        world.hitStop = Math.max(world.hitStop, 0.12);
      }
      break;
    }

    case 'fling': {
      // La marionetta scansa i due eroi: scaraventati lontano, uno per lato.
      const u = clamp01(f.t / FINALE_FLING);
      const out = 1 - (1 - u) * (1 - u);
      const arc = Math.sin(Math.PI * u);
      boss.y = 0.7 + 0.08 * Math.sin(f.t * 12);
      tickCollapse(world, f, delta);
      f.playerX = side * (sideX + FINALE_FLING_DISTANCE * out);
      f.playerY = 0.3 + 3 * arc * (1 - 0.3 * u);
      f.playerRot = -side * (Math.PI / 2 + 2 * Math.PI) * out;
      f.eveX = -side * (sideX + FINALE_FLING_DISTANCE * out);
      f.eveY = 0.3 + 3 * arc * (1 - 0.3 * u);
      f.eveRot = side * (Math.PI / 2 + 2 * Math.PI) * out;
      f.playerAnim = f.eveAnim = 'hit';
      if (f.t >= FINALE_FLING) {
        f.phase = 'fade';
        f.t = 0;
        return 'victory';
      }
      break;
    }

    case 'fade':
      return 'victory';
  }

  // I due eroi restano dentro l'arena (tranne scaraventati: lì escono di scena).
  if (f.phase !== 'fling') {
    f.playerX = Math.min(ARENA_HALF_WIDTH, Math.max(-ARENA_HALF_WIDTH, f.playerX));
    f.eveX = Math.min(ARENA_HALF_WIDTH, Math.max(-ARENA_HALF_WIDTH, f.eveX));
  }
  return 'running';
}
