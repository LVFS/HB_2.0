import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useAnimations } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { PerspectiveCamera, Vector3 } from 'three';
import { useCapsulaStellarGltf } from './capsulaStellarModel';
import { CAPSULE_TIMING } from './capsuleConfig';
import { primeAtStart, playOnce } from './playOnce';

const DUST_PUFF_COUNT = 4;
const SPARK_COUNT = 8;
const DEBRIS_COUNT = 5;

const ALL_ACTION_NAMES = [
  'Capsule_Descent',
  'Shockwave_Pulse',
  'FlightTrailAction',
  ...Array.from({ length: DUST_PUFF_COUNT }, (_, i) => `ImpactDust_${i}_Puff`),
  ...Array.from({ length: SPARK_COUNT }, (_, i) => `ImpactSpark_${i}Action`),
  ...Array.from({ length: DEBRIS_COUNT }, (_, i) => `ImpactDebris_${i}Action`)
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
  /** Chiamato all'inizio dello zoom finale: accende un blur CSS locale
   * (vive fuori dal Canvas, in `LevelSelectScene` — stesso principio di
   * `onImpactFlash`, un filtro sul DOM non si fa da dentro il Canvas). */
  onOutroBlur: () => void;
  /** Chiamato a sequenza conclusa: chi la possiede accende il whiteout
   * globale (`App.tsx`) e cambia schermata. */
  onSequenceComplete: () => void;
  /** `true` mentre questo componente possiede la camera per il push-in
   * finale — stesso principio di `ownsCamera` in `CharacterIntro`: un
   * guard esplicito su ENTRAMBI i lati, qui letto da `CameraRig`
   * (`LevelMapScene.tsx`) per smettere di scrivere su `camera.position`
   * mentre dura lo zoom, altrimenti `MapControls.update()` la
   * riporterebbe indietro ogni fotogramma anche a `enabled=false` (quel
   * flag blocca solo l'input utente, non il ricalcolo interno). */
  cameraLockedRef: MutableRefObject<boolean>;
}

/** Il marker/modello ravvicinato vive sempre all'origine (vedi
 * `LevelMapScene`: l'offset del marker rispetto al centro mappa è sempre
 * 0,0 per costruzione) — la capsula atterra nello stesso punto. */
const LANDING_POSITION: [number, number, number] = [0, 0, 0];
const SHAKE_MAGNITUDE = 0.1;
const SHAKE_STEP = 0.04;
const FOV_PUNCH = 14;
/** Punto verso cui la camera fa il push-in finale — il modello atterrato,
 * non l'origine esatta della scena (il corpo si assesta un po' sopra
 * terra, vedi il fix di orientamento in `capsula_stellar.blend`: solo la
 * punta di coda si conficca). */
const OUTRO_ZOOM_TARGET = new Vector3(0, 1, 0);
/** Frazione della distanza residua percorsa durante il push-in — un dolly
 * completo fino al target sarebbe uno zoom eccessivo/dentro il modello. */
const OUTRO_ZOOM_DOLLY_FRACTION = 0.45;
/** FOV più stretto durante il push-in, per rinforzare l'effetto zoom oltre
 * al solo dolly di posizione. */
const OUTRO_ZOOM_FOV_NARROW = 8;
/** Frazione di `outroZoom` dopo la quale scatta davvero il cambio schermata
 * (nascondere la capsula + accendere il whiteout globale) — PRIMA che il
 * dolly/FOV abbiano finito di animare, non dopo: il taglio deve cadere
 * mentre lo zoom è ancora visibilmente in corso (richiesta esplicita), e la
 * capsula deve sparire già ben coperta da blur CSS (`onOutroBlur`, transizione
 * di 0.6s in `LevelSelectScene.module.css`) invece che a schermo ancora
 * nitido. Il dolly/FOV continuano comunque per l'intera `outroZoom`: la coda
 * del movimento resta in corso ma ormai dietro al whiteout in arrivo, quindi
 * non si vede fermarsi di scatto. */
const OUTRO_CUT_FRACTION = 0.6;

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
 * radial blur. Chiude con un push-in di camera + blur CSS sul modello
 * atterrato (`cameraLockedRef`/`onOutroBlur`) prima del whiteout finale.
 */
export function CapsuleSequence({
  trigger,
  onImpactFlash,
  onOutroBlur,
  onSequenceComplete,
  cameraLockedRef
}: CapsuleSequenceProps) {
  const { scene, animations } = useCapsulaStellarGltf();
  const { actions } = useAnimations(animations, scene);
  const { camera, gl, scene: rootScene } = useThree();
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

  // Compila ombreggiatori/materiali SUBITO al caricamento del modello, non
  // al primo lancio vero (`visible` sopra passa a `true` solo lì): il file
  // è già scaricato (`.preload()` in `capsulaStellarModel.ts`, più il
  // prefetch da `MenuScene.tsx`), ma finché nessuna mesh viene disegnata
  // almeno una volta GPU e shader restano da preparare — stesso scatto
  // residuo già risolto per il Cinema Ariston in `LevelMarker.tsx`, vedi
  // il commento lì per il perché `visible=false` non lo impedisce.
  useEffect(() => {
    gl.compileAsync(scene, camera, rootScene).catch(() => {});
  }, [gl, camera, rootScene, scene]);

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
    // Scia di volo: copre l'intero volo (fotogrammi 1->26), quindi parte
    // insieme alla discesa, non al momento dell'impatto come onda d'urto/
    // scintille/detriti/polvere sotto.
    playOnce(actions['FlightTrailAction']);

    const timers: number[] = [];

    timers.push(
      window.setTimeout(() => {
        playOnce(actions['Shockwave_Pulse']);
        for (let i = 0; i < DUST_PUFF_COUNT; i++) {
          playOnce(actions[`ImpactDust_${i}_Puff`]);
        }
        for (let i = 0; i < SPARK_COUNT; i++) {
          playOnce(actions[`ImpactSpark_${i}Action`]);
        }
        for (let i = 0; i < DEBRIS_COUNT; i++) {
          playOnce(actions[`ImpactDebris_${i}Action`]);
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
          // Da qui in poi la camera ha un solo padrone: questo componente.
          // `CameraRig` (in `LevelMapScene.tsx`) legge lo stesso ref e
          // smette di scrivere su `camera.position`/`controls.update()` —
          // altrimenti `MapControls` la riporterebbe indietro ogni
          // fotogramma (vedi il commento su `cameraLockedRef`).
          cameraLockedRef.current = true;
          onOutroBlur();

          const startPos = camera.position.clone();
          const dollyTarget = startPos.clone().lerp(OUTRO_ZOOM_TARGET, OUTRO_ZOOM_DOLLY_FRACTION);
          gsap.to(camera.position, {
            x: dollyTarget.x,
            y: dollyTarget.y,
            z: dollyTarget.z,
            duration: CAPSULE_TIMING.outroZoom,
            ease: 'power2.inOut'
          });

          if (camera instanceof PerspectiveCamera) {
            const perspCamera = camera;
            const restingFov = baseFov.current ?? perspCamera.fov;
            const fovState = { value: perspCamera.fov };
            gsap.to(fovState, {
              value: restingFov - OUTRO_ZOOM_FOV_NARROW,
              duration: CAPSULE_TIMING.outroZoom,
              ease: 'power2.inOut',
              onUpdate: () => {
                perspCamera.fov = fovState.value;
                perspCamera.updateProjectionMatrix();
              }
            });
          }
        },
        (CAPSULE_TIMING.impact + CAPSULE_TIMING.settle + CAPSULE_TIMING.holdAfterSettle) * 1000
      )
    );

    timers.push(
      window.setTimeout(
        () => {
          // Sparisce ADESSO, a metà dello zoom (vedi `OUTRO_CUT_FRACTION`),
          // già coperta dal blur CSS partito con lo zoom — non alla fine,
          // a schermo di nuovo nitido, dove il pop si vedrebbe. `onSequenceComplete`
          // accende subito dopo il whiteout globale, che finisce di coprire
          // il taglio mentre il dolly/FOV proseguono (invisibili) sotto.
          setVisible(false);
          onSequenceComplete();
        },
        (CAPSULE_TIMING.impact +
          CAPSULE_TIMING.settle +
          CAPSULE_TIMING.holdAfterSettle +
          CAPSULE_TIMING.outroZoom * OUTRO_CUT_FRACTION) *
          1000
      )
    );

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      cameraLockedRef.current = false;
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
