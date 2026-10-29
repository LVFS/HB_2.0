import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { inputManager } from '@/input/inputManager';
import { qteActionForToken } from '@/input/tokenActions';
import { useArenaStore } from '@/store/arenaStore';
import { useLevelStore } from '@/store/levelStore';
import type { ArenaWorld } from './arenaState';
import { BossVisuals } from './BossVisuals';
import { updateClash } from './bossClash';
import { useBossVisualRefs } from './useBossVisualRefs';
import { createBossMessenger } from './bossMessages';
import { updateBossFree, updateBossMove } from './bossMoveRunner';
import { hideBossEffects, hideWarning, placeBoss, updateBossVisuals, updateFinaleVisuals } from './bossRender';
import { createBossRuntime, type BossContext } from './bossRuntime';
import { beginFinisherIfNew, endFinisher, startFinaleIfDue } from './bossSequences';
import { tickTurretTimer } from './bossSpawns';
import {
  shouldStartSpecial,
  shouldStartSummon,
  startSpecial,
  startSummon,
  tickSpecial,
  tickSummon,
  updatePowerUpChoice
} from './bossSpecial';
import { applyHitsOnBoss, handleInterrupted, updatePosture, updateStaggered } from './bossStatus';
import { createWarningTextures } from './bossWarnings';
import { updateFinale } from './finale';
import { updateFinisher } from './finisher';
import { ARENA_HALF_WIDTH, BOSS_EDGE_MARGIN, END_DELAY } from './arenaConfig';

interface BossCheccoProps {
  world: ArenaWorld;
  /** Chiamato dopo `END_DELAY` secondi dalla sconfitta del boss (Checco fugge). */
  onVictory: () => void;
  /** Chiamato dopo `END_DELAY` secondi dalla sconfitta del giocatore. */
  onDefeat: () => void;
}

/**
 * Checco Zalone: l'orchestratore del boss. Qui sta solo l'ORDINE delle sezioni
 * del frame — ogni sezione è un modulo senza React che riceve il `BossContext`:
 * scelta del potenziamento (`bossSpecial`), braccio di ferro (`bossClash`),
 * sequenze scriptate (`bossSequences`, `finale`, `finisher`), stato passivo
 * (`bossStatus`), eventi e mosse (`bossSpecial`, `bossMoveRunner`), creazione
 * di proiettili/torrette/detriti (`bossSpawns`), resa (`bossRender`). I dati
 * delle mosse stanno in `checcoMoves.ts`. L'ordine NON va cambiato: l'hit-stop
 * lo fa scendere solo questo frame e molte cose dipendono da quando.
 */
export function BossChecco({ world, onVictory, onDefeat }: BossCheccoProps) {
  const refs = useBossVisualRefs();
  const warningTextures = useMemo(() => createWarningTextures(), []);
  useEffect(
    () => () => {
      Object.values(warningTextures).forEach((texture) => texture.dispose());
    },
    [warningTextures]
  );

  // Un solo contesto stabile per istanza (mondo + stato dell'IA + messaggi).
  const [messenger] = useState(createBossMessenger);
  const ctxRef = useRef<BossContext | null>(null);
  if (!ctxRef.current) ctxRef.current = { world, rt: createBossRuntime(), messenger };
  const ctx = ctxRef.current;
  useEffect(() => () => messenger.dispose(), [messenger]);

  // Azioni del QTE del finale (da tastiera o da pad): si accodano nel mondo e le legge `updateFinale`.
  useEffect(
    () =>
      inputManager.subscribeTokens((token, down) => {
        const finale = world.finale;
        if (!down || !finale || !finale.qte) return;
        const action = qteActionForToken(token);
        if (action) finale.pressed.push(action);
      }),
    [world]
  );

  useFrame((_, rawDelta) => {
    if (!refs.group.current) return;
    const { rt } = ctx;

    // --- scelta del potenziamento: gioco fermo (hit-stop infinito) ---
    if (updatePowerUpChoice(ctx, rawDelta)) return;

    // Hit-stop: unico punto che lo fa scendere (giocatore e boss controllano
    // solo che sia > 0, così scade una volta sola per frame).
    if (world.hitStop > 0) {
      world.hitStop -= rawDelta;
      return;
    }
    const delta = Math.min(rawDelta, 0.05);
    const { boss, player, eve } = world;
    rt.time += delta;

    // --- fine del combattimento ---
    if (!world.over && boss.hp <= 0) {
      world.over = 'victory';
      world.finisher = null;
      boss.y = 0;
      boss.attackBox = null;
      useArenaStore.getState().set({ message: 'Checco fugge!', hint: null });
    }
    if (world.over) {
      if (rt.endTimer < 0) rt.endTimer = END_DELAY;
      rt.endTimer -= delta;
      if (rt.endTimer <= 0 && !rt.endNotified) {
        rt.endNotified = true;
        if (world.over === 'victory') onVictory();
        else onDefeat();
      }
      return;
    }

    // --- braccio di ferro del contrasto: tutto fermo finché non si decide.
    // L'avviso rosso va spento qui: il blocco di resa non gira e resterebbe sopra la scritta. ---
    if (world.clash) {
      hideWarning(refs);
      updateClash(ctx, delta);
      return;
    }

    // --- finale: sotto `FINALE_HP_FRACTION` di vita il combattimento si ferma e
    // parte la sequenza scriptata (QTE cooperativo + cutscene), vedi `finale.ts` ---
    startFinaleIfDue(ctx);
    if (world.finale) {
      const finale = world.finale;
      hideBossEffects(refs, true);
      const status = updateFinale(world, delta, { message: messenger.flash });
      updateFinaleVisuals(refs, boss, finale);
      if (status === 'victory' && !rt.endNotified) {
        // Cutscene finita: il combattimento si chiude (whiteout e cambio di fase li fa il padre).
        rt.endNotified = true;
        world.over = 'victory';
        useLevelStore.getState().setFinalQteSuccess(finale.qteSuccess ?? true);
        onVictory();
      }
      return;
    }

    // --- carica con falce (Bloodborne): sequenza guidata, boss e giocatore
    // comandati da `finisher.ts`; l'IA di Checco resta ferma ---
    if (world.finisher) {
      beginFinisherIfNew(ctx);
      hideBossEffects(refs);
      if (updateFinisher(world, delta)) endFinisher(ctx);
      placeBoss(refs, boss);
      return;
    }

    handleInterrupted(ctx);
    boss.hitFlash = Math.max(0, boss.hitFlash - delta);
    tickTurretTimer(ctx, delta);
    updatePosture(ctx, delta);
    applyHitsOnBoss(ctx);

    const staggered = boss.staggerTimer > 0;
    const eveActive = eve.status === 'active';
    const targetX = rt.targetEve && eveActive ? eve.x : player.x;
    const dx = targetX - boss.x;

    // Una sola cosa per frame, in questa priorità: barcolla / evento "Avvia il
    // film" / evocazione dei totem / mossa in corso / libero.
    if (staggered) {
      updateStaggered(ctx, delta);
    } else if (rt.special) {
      tickSpecial(ctx, delta);
    } else if (shouldStartSpecial(ctx)) {
      startSpecial(ctx);
    } else if (rt.summon) {
      tickSummon(ctx, delta);
    } else if (shouldStartSummon(ctx)) {
      startSummon(ctx);
    } else if (rt.action) {
      updateBossMove(ctx, delta, dx, eveActive);
    } else {
      updateBossFree(ctx, delta, dx, targetX, eveActive);
    }

    boss.x = Math.min(ARENA_HALF_WIDTH - BOSS_EDGE_MARGIN, Math.max(-ARENA_HALF_WIDTH + BOSS_EDGE_MARGIN, boss.x));

    // Sta eseguendo (o caricando) un attacco parabile? Un colpo a distanza lo
    // para invece di ferirlo. Mosse con sole finestre non parabili: no.
    const action = rt.action;
    boss.parryable =
      action !== null &&
      !staggered &&
      action.move.hits.some((h) => !h.unparryable && action.t - action.move.windup < h.start + h.duration);

    updateBossVisuals(ctx, refs, warningTextures, delta);
  });

  return <BossVisuals refs={refs} startX={world.boss.x} />;
}

