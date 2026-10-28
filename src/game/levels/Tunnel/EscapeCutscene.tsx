import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import type { Group, Mesh } from 'three';
import { useLevelStore } from '@/store/levelStore';
import type { BossMessenger } from '../BossArena/bossMessages';
import { addRing } from '../BossArena/combat';
import { ESCAPE_DURATION } from './tunnelConfig';
import type { TunnelWorld } from './tunnelState';

/** Quanto prima della fine parte il bianco, e quanto dura prima del cambio di fase (come `handleVictory` dell'arena). */
const WHITEOUT_LEAD = 2.4;
const WHITEOUT_TO_PHASE_MS = 550;

interface EscapeCutsceneProps {
  world: TunnelWorld;
  messenger: BossMessenger;
  /** Accende il whiteout globale (`App.tsx`). */
  onWhiteout: (active: boolean) => void;
  /** Riceve la funzione che salta la scena (portandola allo stato finale). */
  registerSkip: (skip: () => void) => void;
}

/**
 * La fuga (`fuga_checco`): cutscene breve (~12 s), saltabile.
 *  1. La marionetta corre al portello e ci salta dentro.
 *  2. Sotto il Cinema si accende un razzo; il pavimento trema.
 *  3. D corre verso il portello: troppo tardi — quanto ci arriva vicino dipende dalla raffica (`barrageScore`).
 *  4. Il razzo sfonda il soffitto, il tunnel trema, whiteout.
 *  5. `setPhase('inseguimento_spaziale_cutscene')`.
 * Una sola timeline GSAP su un oggetto `anim`; ogni frame lo si copia nel mondo
 * e sulle mesh. `applyFinalState()` è IDEMPOTENTE: la timeline che finisce e il
 * salto passano per lo stesso punto, quindi saltare non lascia mai la scena a
 * metà (vedi `docs/FASE8_TUNNEL_INSEGUIMENTO.md`, sez. 9). Segnaposto a tinte unite.
 */
export function EscapeCutscene({ world, messenger, onWhiteout, registerSkip }: EscapeCutsceneProps) {
  const rocket = useRef<Group>(null);
  const flame = useRef<Mesh>(null);
  const glow = useRef<Mesh>(null);
  const finished = useRef(false);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const time = useRef(0);
  const anim = useRef({ puppetX: 0, puppetY: 0, puppetVisible: 1, rocketY: -5, flame: 0, dX: 0, shake: 0 });
  const target = useRef({ hatchX: 0, dEnd: 0 });
  const previousX = useRef(0);

  useEffect(() => {
    const player = world.arena.player;
    const score = useLevelStore.getState().tunnelResult?.barrageScore ?? 0;
    const hatchX = world.puppet.x + 1.4;
    // D arriva tanto più vicino al portello quanto meglio è andata la raffica (le guardie rimaste lo frenano).
    const dEnd = player.x + 2.4 + score * 3.6;
    target.current = { hatchX, dEnd };
    const a = anim.current;
    a.puppetX = world.puppet.x;
    a.dX = player.x;
    previousX.current = player.x;

    /** Stato finale, IDEMPOTENTE: vale sia a timeline finita sia saltando. */
    const applyFinalState = () => {
      if (finished.current) return;
      finished.current = true;
      a.puppetVisible = 0;
      a.rocketY = 16;
      a.dX = dEnd;
      a.shake = 0;
      onWhiteout(true);
      window.setTimeout(() => useLevelStore.getState().setPhase('inseguimento_spaziale_cutscene'), WHITEOUT_TO_PHASE_MS);
    };

    const tl = gsap.timeline({ onComplete: applyFinalState });
    timeline.current = tl;
    // 1. La marionetta corre al portello e ci salta dentro.
    tl.to(a, { puppetX: hatchX, duration: 1.4, ease: 'power1.in' }, 0.4);
    tl.to(a, { puppetY: 2.4, duration: 0.5, ease: 'power2.out' }, 1.3);
    tl.to(a, { puppetVisible: 0, duration: 0.2 }, 1.8);
    // 2. Il razzo si accende sotto il pavimento.
    tl.to(a, { flame: 1, shake: 0.05, rocketY: 0.6, duration: 1.8, ease: 'power1.out' }, 2.2);
    // 3. D corre verso il portello (troppo tardi).
    tl.call(() => messenger.flash('Aspetta!', null, 2), [], 3.0);
    tl.to(a, { dX: dEnd, duration: 2.8, ease: 'power1.out' }, 3.0);
    // 4. Decollo: sfonda il soffitto, il tunnel trema.
    tl.to(a, { flame: 1.8, shake: 0.18, rocketY: 16, duration: 2.6, ease: 'power3.in' }, 5.8);
    tl.call(() => addRing(world.arena, hatchX, 5.2, 4, 0.6, '#fde68a'), [], 7.6);
    // Riempimento fino alla durata prevista, con il bianco poco prima della fine.
    tl.to({}, { duration: ESCAPE_DURATION - WHITEOUT_LEAD }, 0);
    tl.call(() => onWhiteout(true), [], ESCAPE_DURATION - WHITEOUT_LEAD);
    tl.to({}, { duration: WHITEOUT_LEAD }, ESCAPE_DURATION - WHITEOUT_LEAD);

    registerSkip(() => {
      tl.progress(1);
      applyFinalState();
    });
    return () => {
      tl.kill();
      world.shake = 0;
      world.puppet.visible = true;
    };
  }, [world, messenger, onWhiteout, registerSkip]);

  useFrame((_, rawDelta) => {
    time.current += Math.min(rawDelta, 0.05);
    const a = anim.current;
    const { hatchX } = target.current;
    // La marionetta (CheccoPuppetRunner) e D (PlayerRunner) leggono dal mondo.
    world.puppet.x = a.puppetX;
    world.puppet.visible = a.puppetVisible > 0.5;
    world.shake = a.shake;
    world.puppet.lift = a.puppetY;
    world.arena.player.x = a.dX;
    // D corre finché si sposta, poi resta fermo a guardare il razzo.
    world.runner.anim = Math.abs(a.dX - previousX.current) > 0.0005 ? 'walk' : 'idle';
    previousX.current = a.dX;
    const r = rocket.current;
    if (r) {
      r.visible = a.flame > 0;
      r.position.set(hatchX, a.rocketY, -0.6);
    }
    if (flame.current) {
      const flicker = 0.85 + 0.25 * Math.sin(time.current * 40);
      flame.current.scale.set(0.55, Math.max(0.01, a.flame * 1.4 * flicker), 1);
      flame.current.position.set(0, -1.5 - a.flame * 0.7, 0);
    }
    if (glow.current) glow.current.scale.setScalar(1 + a.flame * 0.6);
  });

  return (
    <group ref={rocket} visible={false}>
      {/* Bagliore alle spalle del razzo. */}
      <mesh ref={glow} position={[0, 0, -0.1]}>
        <circleGeometry args={[0.9, 24]} />
        <meshBasicMaterial color="#fb923c" transparent opacity={0.22} />
      </mesh>
      {/* Corpo, ogiva, finestrino e pinne. */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[0.9, 2.8]} />
        <meshBasicMaterial color="#e5e7eb" />
      </mesh>
      <mesh position={[0, 1.7, 0]} rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[0.64, 0.64]} />
        <meshBasicMaterial color="#dc2626" />
      </mesh>
      <mesh position={[0, 0.5, 0.02]}>
        <planeGeometry args={[0.34, 0.34]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.6, -1.1, -0.01]}>
          <planeGeometry args={[0.45, 0.8]} />
          <meshBasicMaterial color="#dc2626" />
        </mesh>
      ))}
      <mesh ref={flame}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#f59e0b" />
      </mesh>
    </group>
  );
}
