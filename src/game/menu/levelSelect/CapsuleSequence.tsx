import { useEffect, useRef, useState } from 'react';
import { useAnimations } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { PerspectiveCamera } from 'three';
import { useCapsulaStellarGltf } from './capsulaStellarModel';
import { CAPSULE_TIMING } from './capsuleConfig';
import { primeAtStart, playOnce } from './playOnce';

const DUST_PUFF_COUNT = 4;
const ALL_ACTION_NAMES = [
  'Capsule_Descent',
  'Shockwave_Pulse',
  ...Array.from({ length: DUST_PUFF_COUNT }, (_, i) => `ImpactDust_${i}_Puff`)
];

interface CapsuleSequenceProps {
  /** Contatore: ogni incremento avvia una nuova sequenza — stesso pattern di
   * `cloudTrigger`/`skipIntroToken` (un booleano non farebbe ripartire
   * l'effetto se il valore "logico" restasse lo stesso, es. due lanci senza
   * mai tornare a `0` in mezzo). */
  trigger: number;
  /** Chiamato all'istante dell'impatto: accende il flash bianco locale
   * (vive fuori dal Canvas, in `LevelSelectScene`). */
  onImpactFlash: () => void;
  /** Chiamato a sequenza conclusa: chi la possiede accende il whiteout
   * globale (`App.tsx`) e cambia schermata. */
  onSequenceComplete: () => void;
}

/** Il marker/modello ravvicinato vive sempre all'origine (vedi
 * `LevelMapScene`: l'offset del marker rispetto al centro mappa è sempre
 * 0,0 per costruzione) — la capsula atterra nello stesso punto. */
const LANDING_POSITION: [number, number, number] = [0, 0, 0];
const SHAKE_MAGNITUDE = 0.1;
const SHAKE_STEP = 0.04;
const FOV_PUNCH = 14;

/**
 * Sequenza capsula-impatto-zoom (Parte E del piano "Stellar Blade"): fa
 * partire l'action `Capsule_Descent` del modello, poi — al momento
 * dell'impatto, calcolato in CODICE e non affidato al tempo assoluto dei
 * clip esportati (vedi `capsuleConfig.ts`) — le action di onda d'urto/
 * polvere, il flash (via callback) e due effetti "finti" al posto di una
 * vera post-elaborazione (nessuna libreria nel progetto, vedi CLAUDE.md):
 * uno shake di camera che SOMMA un offset a `camera.position` invece di
 * scriverla direttamente (stesso principio già in uso nel menu — un
 * oggetto ha un solo padrone, qui è `CameraRig`/`MapControls`, la somma
 * evita di contenderla), e uno "zoom punch" sul FOV invece di un vero
 * radial blur.
 */
export function CapsuleSequence({ trigger, onImpactFlash, onSequenceComplete }: CapsuleSequenceProps) {
  const { scene, animations } = useCapsulaStellarGltf();
  const { actions } = useAnimations(animations, scene);
  const { camera } = useThree();
  const isFirstRender = useRef(true);
  const shakeOffset = useRef({ x: 0, y: 0, z: 0 });
  const baseFov = useRef<number | null>(null);
  // Nasconde DAVVERO l'intero gruppo (scafo, anelli, scia, onda d'urto,
  // polvere) finché non parte un lancio vero. Riportare le action al loro
  // primo fotogramma (`primeAtStart`, sotto) non basta da solo: quel
  // fotogramma per la capsula è comunque in alto (Y=14) ma dentro
  // l'inquadratura della mappa vista dall'alto, quindi restava visibile a
  // galleggiare — e per onda d'urto/polvere il PRIMO keyframe delle loro
  // action non è al tempo zero (parte dal fotogramma Blender ~20), quindi
  // restavano comunque visibili in piccolo invece che a scala zero. Un
  // `visible` esplicito, non legato ai fotogrammi delle action, risolve
  // entrambi i casi in un colpo solo.
  const [visible, setVisible] = useState(false);

  // Innesca comunque ogni action al proprio fotogramma di partenza, in
  // pausa: quando `visible` torna `true` per un lancio vero, la scena
  // riparte dallo stato corretto invece che dall'ultimo fotogramma
  // renderizzato in Blender prima dell'export.
  useEffect(() => {
    for (const name of ALL_ACTION_NAMES) primeAtStart(actions[name]);
  }, [actions]);

  useEffect(() => {
    // Il contatore parte da 0 al mount: la prima esecuzione dell'effetto
    // non è un lancio vero, va ignorata come già fatto per `skipIntroToken`.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setVisible(true);

    // `playOnce`, non `.play()` nudo: senza `setLoop(LoopOnce, 1)` Three.js
    // ripete l'action all'infinito di default — qui deve accadere una
    // volta sola, non girare in loop come un'ambientazione.
    playOnce(actions['Capsule_Descent']);

    const timers: number[] = [];

    timers.push(
      window.setTimeout(() => {
        playOnce(actions['Shockwave_Pulse']);
        for (let i = 0; i < DUST_PUFF_COUNT; i++) {
          playOnce(actions[`ImpactDust_${i}_Puff`]);
        }
        onImpactFlash();

        gsap.to(shakeOffset.current, {
          x: `random(-${SHAKE_MAGNITUDE}, ${SHAKE_MAGNITUDE})`,
          y: `random(-${SHAKE_MAGNITUDE}, ${SHAKE_MAGNITUDE})`,
          duration: SHAKE_STEP,
          repeat: Math.round(CAPSULE_TIMING.shakeDuration / SHAKE_STEP),
          onComplete: () => {
            gsap.to(shakeOffset.current, { x: 0, y: 0, z: 0, duration: 0.15 });
          }
        });

        if (camera instanceof PerspectiveCamera) {
          const perspCamera = camera;
          if (baseFov.current === null) baseFov.current = perspCamera.fov;
          const restingFov = baseFov.current;
          const fovState = { value: perspCamera.fov };
          gsap.to(fovState, {
            value: restingFov + FOV_PUNCH,
            duration: 0.12,
            ease: 'power2.out',
            onUpdate: () => {
              perspCamera.fov = fovState.value;
              perspCamera.updateProjectionMatrix();
            },
            onComplete: () => {
              gsap.to(fovState, {
                value: restingFov,
                duration: 0.5,
                ease: 'power2.inOut',
                onUpdate: () => {
                  perspCamera.fov = fovState.value;
                  perspCamera.updateProjectionMatrix();
                }
              });
            }
          });
        }
      }, CAPSULE_TIMING.impact * 1000)
    );

    timers.push(
      window.setTimeout(
        () => {
          // Torna nascosta: se l'utente rivedesse questa scena senza un
          // remount (oggi non succede, `screen` cambia e la smonta, ma è
          // comunque lo stato corretto da tenere) non la ritroverebbe
          // ferma a terra a metà dell'ultimo lancio.
          setVisible(false);
          onSequenceComplete();
        },
        (CAPSULE_TIMING.impact + CAPSULE_TIMING.settle + CAPSULE_TIMING.holdAfterSettle) * 1000
      )
    );

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reagisce solo al contatore: le callback verrebbero ricreate a ogni render del genitore e farebbero ripartire l'effetto a vuoto
  }, [trigger]);

  useFrame(() => {
    if (shakeOffset.current.x === 0 && shakeOffset.current.y === 0) return;
    camera.position.x += shakeOffset.current.x;
    camera.position.y += shakeOffset.current.y;
  });

  return <primitive object={scene} position={LANDING_POSITION} visible={visible} />;
}
