import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import type { OrthographicCamera as OrthographicCameraImpl } from 'three';
import { ArenaHud } from '@/components/ArenaHud';
import { SkipCutscene } from '@/components/SkipCutscene';
import { createJumpState } from '@/game/shared/jump';
import { usePlayerActions } from '@/game/shared/usePlayerActions';
import { useArenaStore } from '@/store/arenaStore';
import { useLevelStore } from '@/store/levelStore';
import { ARENA_CAMERA_Z, BOSS_MAX_HP, PLAYER_MAX_HP, POSTURE_MAX } from '../BossArena/arenaConfig';
import { createBossMessenger } from '../BossArena/bossMessages';
import { DamageNumbers } from '../BossArena/DamageNumbers';
import { BarrageScene } from './BarrageScene';
import { CameoCast } from './CameoCast';
import { LaneShadows } from './LaneShadows';
import { CatMount } from './CatMount';
import { CheccoPuppetRunner } from './CheccoPuppetRunner';
import { EscapeCutscene } from './EscapeCutscene';
import { PlayerRunner } from './PlayerRunner';
import { PuppetWindow } from './PuppetWindow';
import styles from './SceneManagerTunnel.module.css';
import { TunnelBackdrop } from './TunnelBackdrop';
import { TunnelBonusFx } from './TunnelBonusFx';
import { TunnelAlerts } from './TunnelAlerts';
import { TunnelAllies } from './TunnelAllies';
import { TunnelBoulder } from './TunnelBoulder';
import { TunnelFx } from './TunnelFx';
import { TunnelHazards } from './TunnelHazards';
import { PickupsLayer } from './PickupsLayer';
import { TunnelProjectiles } from './TunnelProjectiles';
import { TunnelRails } from './TunnelRails';
import { TunnelWave } from './TunnelWave';
import {
  TUNNEL_CAMERA_EYE_Y,
  TUNNEL_CAMERA_LEAD,
  TUNNEL_CAMERA_PITCH,
  TUNNEL_CAMERA_LEAD_PER_TEMPO,
  TUNNEL_SPAWN_AHEAD_MIN,
  TUNNEL_SPAWN_MARGIN,
  TUNNEL_VIEW_HEIGHT,
  TUNNEL_VIEW_MAX_WIDTH
} from './tunnelConfig';
import { startBarrage, updateTunnel, type TunnelContext } from './tunnelDriver';
import { createTunnelWorld, gapStartFor, type BarrageState, type TunnelWorld } from './tunnelState';

interface SceneManagerTunnelProps {
  /** Accende il whiteout globale (`App.tsx`) prima di lasciare il tunnel. */
  onWhiteout: (active: boolean) => void;
}

/** Fa avanzare il tunnel di un frame (unico `useFrame` della simulazione: l'ordine è deciso in `updateTunnel`). */
function TunnelDriver({ ctx }: { ctx: TunnelContext }) {
  useFrame((_, rawDelta) => updateTunnel(ctx, rawDelta));
  return null;
}

/**
 * La camera segue D di corsa (nessun altro regista in questa scena: si scrive `camera.position` direttamente).
 * L'inquadratura è la STESSA a ogni risoluzione: lo zoom si deriva dall'altezza della finestra
 * (`TUNNEL_VIEW_HEIGHT`), con un tetto alla larghezza per gli schermi ultrawide. Ogni frame scrive in
 * `world.view` fin dove si vede a destra, da cui il copione sa dove far nascere le minacce (oltre il bordo).
 */
function TunnelCameraRig({ world }: { world: TunnelWorld }) {
  const camera = useThree((state) => state.camera) as OrthographicCameraImpl;
  const size = useThree((state) => state.size);
  useFrame(() => {
    const zoom = Math.max(size.height / TUNNEL_VIEW_HEIGHT, size.width / TUNNEL_VIEW_MAX_WIDTH);
    if (camera.zoom !== zoom) {
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    }
    // Più il mondo corre (Slancio), più la camera guarda avanti: si vede arrivare ciò che arriva prima.
    const lead = TUNNEL_CAMERA_LEAD + (world.tempo - 1) * TUNNEL_CAMERA_LEAD_PER_TEMPO;
    const targetX = world.runX + lead;
    // Tremolio (crolli, decollo del razzo): scarto verticale casuale di ampiezza `shake`.
    // La camera è ortografica ma INCLINATA verso il basso: la via lontana sale sullo schermo, e TUNNEL_CAMERA_EYE_Y è
    // l'altezza SULLO SCHERMO del centro rispetto ai piedi di D (da cui la divisione per il coseno).
    const targetY = TUNNEL_CAMERA_EYE_Y / Math.cos(TUNNEL_CAMERA_PITCH) + (world.shake > 0 ? (Math.random() - 0.5) * 2 * world.shake : 0);
    camera.position.set(targetX, targetY + ARENA_CAMERA_Z * Math.sin(TUNNEL_CAMERA_PITCH), ARENA_CAMERA_Z * Math.cos(TUNNEL_CAMERA_PITCH));
    camera.lookAt(targetX, targetY, 0);
    world.view.halfW = size.width / 2 / zoom;
    world.view.rightEdge = lead + world.view.halfW;
    world.view.ahead = Math.max(TUNNEL_SPAWN_AHEAD_MIN, world.view.rightEdge + TUNNEL_SPAWN_MARGIN);
  });
  return null;
}

/**
 * Tunnel dell'inseguimento (vedi `docs/FASE8_TUNNEL_INSEGUIMENTO.md`): UNA scena
 * per `boss_fase2_tunnel`, `combo_doppia_spada_qte` e `fuga_checco`, con una
 * piccola macchina a stati interna (corsa → raffica → fuga), così il passaggio
 * fra fasi non rimonta il `<Canvas>`. La corsa e la raffica vivono nel mondo
 * (`tunnelDriver`); questo componente collega i passaggi di fase allo store del
 * livello.
 */
export function SceneManagerTunnel({ onWhiteout }: SceneManagerTunnelProps) {
  // Nel tunnel il salto è solo Spazio: W/S cambiano via.
  const actions = usePlayerActions({ jump: [' '] });
  const world = useMemo(() => createTunnelWorld(gapStartFor(useLevelStore.getState().finalQteSuccess)), []);
  const jump = useRef(createJumpState());
  const [messenger] = useState(createBossMessenger);
  const [escaping, setEscaping] = useState(false);
  const [running, setRunning] = useState(true);
  // La cutscene della fuga registra qui la sua funzione di salto.
  const skipEscape = useRef<() => void>(() => undefined);
  const registerSkip = useCallback((skip: () => void) => {
    skipEscape.current = skip;
  }, []);
  useEffect(() => () => messenger.dispose(), [messenger]);

  const ctx = useMemo<TunnelContext>(
    () => ({
      world,
      actions,
      jump: jump.current,
      messenger,
      // Raggiunta la marionetta: parte la raffica a doppia spada.
      onRunFinished: () => {
        startBarrage(world);
        setRunning(false);
        useLevelStore.getState().setPhase('combo_doppia_spada_qte');
      },
      // Raffica finita (riuscita o no, la storia non cambia): si salva l'esito e parte la fuga.
      onBarrageFinished: (barrage: BarrageState) => {
        useLevelStore.getState().setTunnelResult({ gapEnd: world.gap, barrageScore: barrage.score ?? 0 });
        useLevelStore.getState().setPhase('fuga_checco');
        setEscaping(true);
      }
    }),
    [world, actions, messenger]
  );

  // Tasti del QTE della raffica: si accodano nel mondo e li legge `updateBarrage`.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const barrage = world.barrage;
      if (!barrage || barrage.phase !== 'qte' || event.repeat) return;
      barrage.pressed.push(event.key === ' ' ? 'space' : event.key.toLowerCase());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [world]);

  useEffect(() => {
    // La HUD riusa lo store dell'arena (vita, cure, messaggi): si azzera all'ingresso.
    useArenaStore.getState().reset(PLAYER_MAX_HP, BOSS_MAX_HP, POSTURE_MAX);
    // Il reset può arrivare dopo i primi frame: rifai pubblicare distanza e battuta della sezione.
    world.gapShown = -1;
    world.announcedSection = -1;
    if (import.meta.env.DEV) (window as unknown as { __tunnelWorld?: unknown }).__tunnelWorld = world;
  }, [world]);

  return (
    <div className="scene-shell">
      <Canvas>
        <Suspense fallback={null}>
          {/* Lo zoom lo imposta `TunnelCameraRig` (stessa inquadratura a ogni risoluzione). */}
          <OrthographicCamera makeDefault position={[0, TUNNEL_CAMERA_EYE_Y, ARENA_CAMERA_Z]} />
          <TunnelRails world={world} />
          <TunnelCameraRig world={world} />
          <TunnelBackdrop world={world} />
          <TunnelDriver ctx={ctx} />
          <LaneShadows world={world} />
          <TunnelHazards world={world} />
          <PickupsLayer world={world} />
          <TunnelBoulder world={world} />
          <TunnelWave world={world} />
          <TunnelAlerts world={world} />
          <TunnelAllies world={world} />
          <CameoCast world={world} />
          <BarrageScene world={world} />
          <CheccoPuppetRunner world={world} />
          <TunnelProjectiles world={world} />
          <CatMount world={world} />
          <PlayerRunner world={world} />
          {escaping && (
            <EscapeCutscene world={world} messenger={messenger} onWhiteout={onWhiteout} registerSkip={registerSkip} />
          )}
          <TunnelFx world={world} />
          <TunnelBonusFx world={world} />
          <PuppetWindow world={world} />
          <DamageNumbers world={world.arena} />
        </Suspense>
      </Canvas>
      <ArenaHud mode="tunnel" />

      {/* Fuga: cutscene saltabile (tenere premuto Esc/Invio o il bottone). */}
      <SkipCutscene enabled={escaping} onSkip={() => skipEscape.current()} />

      {running && (
        <div className={styles.hint}>
          <span className={styles.hintPill}>
            Spazio salta (anche doppio) · Shift schiva · K para (rimanda i colpi arancioni) · J attacca · E usa il bonus · A/D avanti e indietro · W/S cambia via
          </span>
        </div>
      )}
    </div>
  );
}

