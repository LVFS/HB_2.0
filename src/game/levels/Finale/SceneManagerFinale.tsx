import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { GameCanvas } from '@/components/GameCanvas';
import { OrthographicCamera } from '@react-three/drei';
import gsap from 'gsap';
import { Color, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import { DialogueBox } from '@/components/DialogueBox';
import { SkipCutscene } from '@/components/SkipCutscene';
import { getFinalDialogue } from '@/data/dialogues/level1_finale';
import { CharacterAnimator2D, type CharacterAnimState } from '@/game/render2d/CharacterAnimator2D';
import { useDialogue } from '@/hooks/useDialogue';
import { useLevelStore } from '@/store/levelStore';
import {
  ARENA_CAMERA_EYE_Y,
  ARENA_CAMERA_Z,
  ARENA_CAMERA_ZOOM,
  ARENA_PLAYER_HEIGHT,
  ARENA_PLAYER_VARIANT,
  EVE_HEIGHT
} from '../BossArena/arenaConfig';

interface SceneManagerFinaleProps {
  /** Accende il whiteout globale (`App.tsx`) prima di lasciare la scena. */
  onWhiteout: (active: boolean) => void;
}

/** D arriva da sinistra camminando; Eve sta accanto alla navicella. */
const D_START_X = -8.5;
const D_END_X = -1.5;
const D_WALK_SECONDS = 5.5;
const EVE_X = 0.9;
const EVE_AWAY_X = 11;
const EVE_AWAY_SECONDS = 7;
const SHIP_X = 3.4;
/** Pausa fra l'arrivo di D e la prima battuta, e fra la fine del dialogo e il cambio di fase (dopo il bianco). */
const DIALOGUE_START_DELAY_MS = 700;
const WHITEOUT_TO_PHASE_MS = 600;
/** L'alba: dal cielo scuro al caldo, mentre il sole sale. */
const DAWN_SECONDS = 9;
const SKY_TOP_FROM = '#1e1b4b';
const SKY_TOP_TO = '#7dd3fc';
const SKY_LOW_FROM = '#7c2d12';
const SKY_LOW_TO = '#fde68a';
const SUN_Y_FROM = -0.2;
const SUN_Y_TO = 2.3;

/** Il fumo che esce dalla navicella conficcata: sbuffi che salgono e svaniscono, a ciclo. */
function ShipSmoke() {
  const puffs = useRef<Array<Mesh | null>>([]);
  const COUNT = 5;
  useFrame(({ clock }) => {
    puffs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const u = (clock.elapsedTime * 0.35 + i / COUNT) % 1;
      mesh.position.set(Math.sin(u * 5 + i) * 0.25, u * 2.6, 0);
      mesh.scale.setScalar(0.5 + u * 1.1);
      (mesh.material as MeshBasicMaterial).opacity = (1 - u) * 0.5;
    });
  });
  return (
    <group>
      {Array.from({ length: COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            puffs.current[i] = mesh;
          }}
        >
          <circleGeometry args={[0.4, 14]} />
          <meshBasicMaterial color="#334155" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/** Lo scenario: cielo che si schiarisce, sole che sale, campo, navicella di Eve piantata nel terreno col suo fumo (segnaposto a tinte unite). */
function Backdrop({ dawn }: { dawn: { current: { t: number } } }) {
  const top = useRef<MeshBasicMaterial>(null);
  const low = useRef<MeshBasicMaterial>(null);
  const sun = useRef<Mesh>(null);
  const colors = useMemo(
    () => ({ topFrom: new Color(SKY_TOP_FROM), topTo: new Color(SKY_TOP_TO), lowFrom: new Color(SKY_LOW_FROM), lowTo: new Color(SKY_LOW_TO) }),
    []
  );
  useFrame(() => {
    const u = dawn.current.t;
    top.current?.color.copy(colors.topFrom).lerp(colors.topTo, u);
    low.current?.color.copy(colors.lowFrom).lerp(colors.lowTo, u);
    sun.current?.position.setY(SUN_Y_FROM + (SUN_Y_TO - SUN_Y_FROM) * u);
  });
  return (
    <group>
      <mesh position={[0, 5.5, -6]}>
        <planeGeometry args={[40, 12]} />
        <meshBasicMaterial ref={top} color={SKY_TOP_FROM} />
      </mesh>
      <mesh position={[0, 0.5, -5.9]}>
        <planeGeometry args={[40, 5]} />
        <meshBasicMaterial ref={low} color={SKY_LOW_FROM} />
      </mesh>
      <mesh ref={sun} position={[-5, SUN_Y_FROM, -5.8]}>
        <circleGeometry args={[1.5, 40]} />
        <meshBasicMaterial color="#fffbeb" />
      </mesh>
      {/* Colline lontane e campo. */}
      <mesh position={[-4, 0.4, -5]} scale={[7, 1.6, 1]}>
        <circleGeometry args={[1, 32, 0, Math.PI]} />
        <meshBasicMaterial color="#365314" />
      </mesh>
      <mesh position={[6, 0.3, -5]} scale={[6, 1.2, 1]}>
        <circleGeometry args={[1, 32, 0, Math.PI]} />
        <meshBasicMaterial color="#3f6212" />
      </mesh>
      <mesh position={[0, -3.4, 0]}>
        <planeGeometry args={[40, 6.8]} />
        <meshBasicMaterial color="#4d7c0f" />
      </mesh>
      {/* La navicella di Eve, piantata di muso nel terreno. */}
      <group position={[SHIP_X, 0.2, -0.4]} rotation={[0, 0, 0.5]}>
        <mesh position={[0, 1.2, 0]}>
          <planeGeometry args={[0.9, 2.6]} />
          <meshBasicMaterial color="#cbd5e1" />
        </mesh>
        <mesh position={[0, 0.3, 0.01]} rotation={[0, 0, Math.PI]}>
          <circleGeometry args={[0.55, 3]} />
          <meshBasicMaterial color="#94a3b8" />
        </mesh>
        <mesh position={[0, 1.7, 0.02]}>
          <circleGeometry args={[0.2, 14]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        <mesh position={[0.6, 2.2, -0.01]} rotation={[0, 0, -0.5]}>
          <planeGeometry args={[0.7, 0.2]} />
          <meshBasicMaterial color="#64748b" />
        </mesh>
        <mesh position={[0, 2.4, 0.03]}>
          <planeGeometry args={[0.95, 0.5]} />
          <meshBasicMaterial color="#111827" transparent opacity={0.5} />
        </mesh>
      </group>
      <group position={[SHIP_X + 0.3, 2.4, -0.3]}>
        <ShipSmoke />
      </group>
    </group>
  );
}

/** D, che arriva da sinistra camminando mentre il cielo si schiarisce. Vive dentro il Canvas: i ref dei gruppi Three esistono solo lì. */
function DWalker({
  dawn,
  anim,
  onArrived,
  registerSkip
}: {
  dawn: { current: { t: number } };
  anim: CharacterAnimState;
  onArrived: () => void;
  registerSkip: (skip: () => void) => void;
}) {
  const group = useRef<Group>(null);
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.position.set(D_START_X, 0, 0);
    const tl = gsap.timeline();
    tl.to(dawn.current, { t: 1, duration: DAWN_SECONDS, ease: 'power1.inOut' }, 0);
    tl.to(g.position, { x: D_END_X, duration: D_WALK_SECONDS, ease: 'none', onComplete: onArrived }, 0.3);
    registerSkip(() => {
      tl.progress(1);
      g.position.set(D_END_X, 0, 0);
      onArrived();
    });
    return () => {
      tl.kill();
    };
  }, [dawn, onArrived, registerSkip]);
  return (
    <group ref={group}>
      <CharacterAnimator2D variant={ARENA_PLAYER_VARIANT} state={anim} facing={1} height={ARENA_PLAYER_HEIGHT} />
    </group>
  );
}

/** Eve accanto alla navicella; all'ultima didascalia si allontana verso il sole. */
function EveActor({ leaving }: { leaving: boolean }) {
  const group = useRef<Group>(null);
  useEffect(() => {
    group.current?.position.set(EVE_X, 0, 0);
  }, []);
  useEffect(() => {
    const g = group.current;
    if (!leaving || !g) return;
    const tween = gsap.to(g.position, { x: EVE_AWAY_X, duration: EVE_AWAY_SECONDS, ease: 'power1.in' });
    return () => {
      tween.kill();
    };
  }, [leaving]);
  return (
    <group ref={group}>
      <CharacterAnimator2D variant="Eve" state={leaving ? 'walk' : 'idle'} facing={leaving ? 1 : -1} height={EVE_HEIGHT} />
    </group>
  );
}

/**
 * Il finale a terra (`dialogo_finale`, FASE 12): cielo che si schiarisce, la navicella di Eve conficcata nel campo, D che arriva
 * camminando (saltabile) e il dialogo, con due righe che cambiano in base a `spaceResult`. Scena scriptata e senza gameplay,
 * come il Sotterraneo. A dialogo finito: bianco e `schermata_punteggio`. `applyWalkFinal` della camminata è IDEMPOTENTE.
 */
export function SceneManagerFinale({ onWhiteout }: SceneManagerFinaleProps) {
  const spaceResult = useLevelStore((state) => state.spaceResult);
  const lines = useMemo(() => getFinalDialogue(spaceResult), [spaceResult]);

  const dawn = useRef({ t: 0 });
  const [dAnim, setDAnim] = useState<CharacterAnimState>('walk');
  const [arrived, setArrived] = useState(false);
  const [listening, setListening] = useState(false);
  const skipWalk = useRef<() => void>(() => undefined);
  const registerSkip = useCallback((skip: () => void) => {
    skipWalk.current = skip;
  }, []);
  const phaseTimer = useRef<number | undefined>(undefined);
  const walkDone = useRef(false);
  const exited = useRef(false);

  /** Stato finale della camminata, IDEMPOTENTE: D è arrivato (a fine o saltando) e il dialogo può cominciare. */
  const applyWalkFinal = useCallback(() => {
    if (walkDone.current) return;
    walkDone.current = true;
    setDAnim('idle');
    setArrived(true);
  }, []);

  // Dopo l'arrivo di D, una piccola pausa e partono le battute.
  useEffect(() => {
    if (!arrived) return;
    const id = window.setTimeout(() => setListening(true), DIALOGUE_START_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [arrived]);

  const { currentLine, isDone } = useDialogue(lines, { enabled: listening });
  const leaving = currentLine !== null && currentLine === lines[lines.length - 1];

  // Dialogo finito: bianco, poi il punteggio. UNA volta sola.
  useEffect(() => {
    if (!isDone || exited.current) return;
    exited.current = true;
    onWhiteout(true);
    phaseTimer.current = window.setTimeout(() => useLevelStore.getState().setPhase('schermata_punteggio'), WHITEOUT_TO_PHASE_MS);
  }, [isDone, onWhiteout]);

  useEffect(() => () => window.clearTimeout(phaseTimer.current), []);

  return (
    <div className="scene-shell">
      <GameCanvas>
        <Suspense fallback={null}>
          <OrthographicCamera makeDefault position={[0, ARENA_CAMERA_EYE_Y, ARENA_CAMERA_Z]} zoom={ARENA_CAMERA_ZOOM} />
          <Backdrop dawn={dawn} />
          <EveActor leaving={leaving} />
          <DWalker dawn={dawn} anim={dAnim} onArrived={applyWalkFinal} registerSkip={registerSkip} />
        </Suspense>
      </GameCanvas>

      {currentLine && <DialogueBox line={currentLine} />}
      {/* Tenere premuto Esc/Invio (o il bottone) salta la camminata: il dialogo comincia subito. */}
      <SkipCutscene enabled={!arrived} onSkip={() => skipWalk.current()} />
    </div>
  );
}
