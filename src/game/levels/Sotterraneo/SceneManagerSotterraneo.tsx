import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import gsap from 'gsap';
import type { Group } from 'three';
import { DialogueBox } from '@/components/DialogueBox';
import { CharacterAnimator2D, type CharacterAnimState } from '@/game/render2d/CharacterAnimator2D';
import { getSecondSwordDialogue } from '@/data/dialogues/level1_sotterraneo';
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

/** Pausa iniziale prima che il dialogo ascolti l'input: chi ha appena finito il QTE
 *  sta ancora premendo tasti e non deve saltare la prima battuta. */
const DIALOGUE_START_DELAY_MS = 1400;
/** Quota del bordo da cui Eve guarda giù, e posizioni delle due figure. */
const LEDGE_Y = 3.4;
const D_X = -1.6;
const EVE_X = 1.3;

/** D, scaraventato giù dal crollo: parte a terra e si rialza. */
function FallenD() {
  const group = useRef<Group>(null);
  const [anim, setAnim] = useState<CharacterAnimState>('hit');

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.rotation.z = Math.PI / 2;
    g.position.set(D_X, 0.3, 0);
    const timeline = gsap.timeline({ delay: 0.9 });
    timeline.to(g.rotation, { z: 0, duration: 0.8, ease: 'power2.out' }, 0);
    timeline.to(g.position, { y: 0, duration: 0.8, ease: 'power2.out' }, 0);
    timeline.call(() => setAnim('idle'), [], 0.8);
    return () => {
      timeline.kill();
    };
  }, []);

  return (
    <group ref={group}>
      <CharacterAnimator2D variant={ARENA_PLAYER_VARIANT} state={anim} facing={1} height={ARENA_PLAYER_HEIGHT} />
    </group>
  );
}

/**
 * Sotterraneo (`transizione_seconda_spada`): subito dopo il finale del boss, D è
 * caduto sotto il piano terra e Eve resta di sopra, visibile da un varco nel
 * soffitto. Scena scriptata e senza gameplay: il dialogo a distanza (Eve gli dà
 * "un'altra spada", una riga cambia con l'esito del QTE) e poi `boss_fase2_tunnel`.
 * Segnaposto a tinte unite come il resto; se un giorno servisse un livello LDtk
 * vero, basta sostituire questo componente.
 */
export function SceneManagerSotterraneo() {
  const finalQteSuccess = useLevelStore((state) => state.finalQteSuccess);
  const lines = useMemo(() => getSecondSwordDialogue(finalQteSuccess), [finalQteSuccess]);

  const [listening, setListening] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setListening(true), DIALOGUE_START_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  const { currentLine, isDone } = useDialogue(lines, { enabled: listening });

  // A dialogo finito si passa al tunnel (da un effect, mai dal render).
  useEffect(() => {
    if (isDone) useLevelStore.getState().setPhase('boss_fase2_tunnel');
  }, [isDone]);

  return (
    <div className="scene-shell">
      <Canvas>
        <Suspense fallback={null}>
          <OrthographicCamera
            makeDefault
            position={[0, ARENA_CAMERA_EYE_Y, ARENA_CAMERA_Z]}
            zoom={ARENA_CAMERA_ZOOM}
          />

          {/* Fondale buio e pavimento di macerie. */}
          <mesh position={[0, 3, -6]}>
            <planeGeometry args={[40, 16]} />
            <meshBasicMaterial color="#0a0707" />
          </mesh>
          <mesh position={[0, -0.4, 0]}>
            <planeGeometry args={[40, 0.8]} />
            <meshBasicMaterial color="#2a1f1b" />
          </mesh>
          {[-4.6, -3.2, 3.4, 5].map((x, i) => (
            <mesh key={x} position={[x, 0.35 + (i % 2) * 0.25, -0.5]} rotation={[0, 0, (i - 1.5) * 0.18]}>
              <planeGeometry args={[1 + (i % 2) * 0.5, 0.7 + (i % 3) * 0.3]} />
              <meshBasicMaterial color="#3a2d27" />
            </mesh>
          ))}

          {/* Varco nel soffitto: fascio di luce dal bordo da cui Eve guarda giù. */}
          <mesh position={[0.2, 3, -3]}>
            <planeGeometry args={[4.4, 7]} />
            <meshBasicMaterial color="#8a7a66" transparent opacity={0.18} />
          </mesh>
          <mesh position={[0.2, LEDGE_Y - 0.15, -1]}>
            <planeGeometry args={[5, 0.3]} />
            <meshBasicMaterial color="#4a3e36" />
          </mesh>

          <group position={[EVE_X, LEDGE_Y, -0.9]}>
            <CharacterAnimator2D variant="Eve" state="idle" facing={-1} height={EVE_HEIGHT * 0.85} />
          </group>

          <FallenD />
        </Suspense>
      </Canvas>

      {currentLine && <DialogueBox line={currentLine} />}
    </div>
  );
}
