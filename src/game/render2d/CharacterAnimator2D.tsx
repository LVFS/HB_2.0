import { useEffect, useRef, useState } from 'react';
import type { Group, MeshBasicMaterial } from 'three';
import gsap from 'gsap';
import { Character2D } from './Character2D';
import type { CharacterPose, CharacterVariant } from './characterSprites';
import {
  CHARACTER_DEFAULT_HEIGHT,
  HIT_FLASH_BRIGHTNESS,
  HIT_FLASH_DURATION,
  PARRY_FLASH_COLOR,
  PARRY_FLASH_DURATION,
  STAGGER_ANGLE,
  STAGGER_DURATION,
  TRANSFORM_CROSSFADE_DURATION,
  WALK_STEP_DURATION,
  WALK_SWAY_ANGLE,
  WALK_SWAY_DURATION
} from './characterAnimConfig';

/** Nomi indicativi (Fase 3a del piano, vedi docs/PIANO_LIVELLO1_2D.md): la
 *  macchina a stati VERA del livello (dialoghi/boss/QTE) arriva in Fase 4 e
 *  scriverà su questo stato "di animazione", più basso livello. */
export type CharacterAnimState =
  | 'idle'
  | 'walk'
  | 'attack'
  | 'hit'
  | 'parry'
  | 'stagger'
  | 'transformToD1';

interface CharacterAnimator2DProps {
  variant: CharacterVariant;
  state: CharacterAnimState;
  facing: 1 | -1;
  height?: number;
  /** Quota dei PIEDI, stessa convenzione di `Character2D`/`Player2D`. */
  position?: [number, number, number];
}

/**
 * Livello di animazione sopra `Character2D` (Fase 3a del piano): traduce
 * uno stato semantico (idle/walk/attack/hit/transformToD1) nella posa +
 * animazione GSAP corretta per ogni variante. GSAP guida tutto qui (stesso
 * principio "un oggetto ha un solo padrone" di CLAUDE.md): anima gli
 * oggetti Three via ref, mai passando da uno state React ad ogni frame.
 */
export function CharacterAnimator2D({
  variant,
  state,
  facing,
  height = CHARACTER_DEFAULT_HEIGHT,
  position = [0, 0, 0]
}: CharacterAnimator2DProps) {
  const groupRef = useRef<Group>(null);
  const materialRef = useRef<MeshBasicMaterial | null>(null);

  // Solo D0 ha una posa a metà passo (`action`) utilizzabile per un vero
  // ciclo cammino a 2 fotogrammi — D1/Eve restano su `front` e si affidano
  // al dondolio procedurale sotto (nessuna posa a metà passo per loro,
  // vedi il piano).
  const [walkFrame, setWalkFrame] = useState<'front' | 'action'>('front');
  const walking = state === 'walk';
  const isD0 = variant === 'D0';

  // Ciclo cammino a 2 pose (solo D0): un timeline GSAP che alterna
  // front/action a ritmo fisso, coerente col resto del progetto (GSAP
  // come direttore di ogni timeline scriptata) invece di un
  // `setInterval` a mano.
  useEffect(() => {
    if (!walking || !isD0) {
      setWalkFrame('front');
      return;
    }
    const timeline = gsap.timeline({ repeat: -1 });
    timeline
      .call(() => setWalkFrame('action'))
      .to({}, { duration: WALK_STEP_DURATION })
      .call(() => setWalkFrame('front'))
      .to({}, { duration: WALK_STEP_DURATION });
    return () => {
      timeline.kill();
    };
  }, [walking, isD0]);

  // Dondolio procedurale per D1/Eve in cammino: nessuna posa a metà passo
  // disponibile per loro, quindi si inclina il gruppo avanti/indietro
  // invece di alternare due texture. Simmetrico attorno a 0: lo scambio
  // `facing` avviene via `scale.x` sulla mesh INTERNA di `Character2D`, non
  // tocca la rotazione di questo gruppo, quindi non serve compensarla.
  useEffect(() => {
    if (!walking || isD0 || !groupRef.current) return;
    const target = groupRef.current;
    const tween = gsap.fromTo(
      target.rotation,
      { z: -WALK_SWAY_ANGLE },
      { z: WALK_SWAY_ANGLE, duration: WALK_SWAY_DURATION, yoyo: true, repeat: -1, ease: 'sine.inOut' }
    );
    return () => {
      tween.kill();
      target.rotation.z = 0;
    };
  }, [walking, isD0]);

  // Flash bianco veloce alla reazione a un colpo: tint via materiale
  // (`color` portato sopra 1, compresso verso il bianco dal tone mapping
  // ACES di default del renderer R3F), non una texture dedicata — vedi
  // characterAnimConfig.ts.
  useEffect(() => {
    if (state !== 'hit' || !materialRef.current) return;
    const material = materialRef.current;
    const tween = gsap.to(material.color, {
      r: HIT_FLASH_BRIGHTNESS,
      g: HIT_FLASH_BRIGHTNESS,
      b: HIT_FLASH_BRIGHTNESS,
      duration: HIT_FLASH_DURATION,
      yoyo: true,
      repeat: 1,
      ease: 'power1.out'
    });
    return () => {
      tween.kill();
      material.color.setScalar(1);
    };
  }, [state]);

  // Parata riuscita: stesso mixin di colore del flash da colpo, terna dorata
  // (vedi `PARRY_FLASH_COLOR`) — la posa è la stessa di `hit`.
  useEffect(() => {
    if (state !== 'parry' || !materialRef.current) return;
    const material = materialRef.current;
    const tween = gsap.to(material.color, {
      ...PARRY_FLASH_COLOR,
      duration: PARRY_FLASH_DURATION,
      yoyo: true,
      repeat: 1,
      ease: 'power1.out'
    });
    return () => {
      tween.kill();
      material.color.setScalar(1);
    };
  }, [state]);

  // Barcollamento: un solo colpo di rotazione che si assesta (yoyo una volta,
  // niente `repeat: -1`), all'indietro rispetto alla direzione in cui guarda.
  useEffect(() => {
    if (state !== 'stagger' || !groupRef.current) return;
    const target = groupRef.current;
    const tween = gsap.to(target.rotation, {
      z: -facing * STAGGER_ANGLE,
      duration: STAGGER_DURATION,
      yoyo: true,
      repeat: 1,
      ease: 'power2.out'
    });
    return () => {
      tween.kill();
      target.rotation.z = 0;
    };
  }, [state, facing]);

  return (
    <group ref={groupRef} position={position}>
      {state === 'transformToD1' ? (
        <TransformCrossfade facing={facing} height={height} />
      ) : (
        <Character2D
          variant={variant}
          pose={resolvePose(variant, state, walkFrame)}
          facing={facing}
          height={height}
          materialRef={materialRef}
        />
      )}
    </group>
  );
}

function resolvePose(
  variant: CharacterVariant,
  state: CharacterAnimState,
  walkFrame: 'front' | 'action'
): CharacterPose {
  switch (state) {
    case 'attack':
      return 'action';
    case 'hit':
    case 'parry':
    case 'stagger':
      return 'front';
    case 'walk':
      return variant === 'D0' ? walkFrame : 'front';
    case 'idle':
    default:
      return 'front';
  }
}

/**
 * La sola dissolvenza D0→D1 (l'unica trasformazione della storia, vedi il
 * piano — non generica ad altre varianti apposta, non ce ne sono altre da
 * fare): un `Character2D` D1 sovrapposto che entra in opacità mentre quello
 * D0 sotto esce, ~0.4s, poi resta acceso. Sostituisce interamente il ramo
 * "singolo personaggio" del chiamante mentre lo stato è attivo (mai due
 * copie della stessa variante sovrapposte per errore).
 */
function TransformCrossfade({ facing, height }: { facing: 1 | -1; height: number }) {
  const outgoingRef = useRef<MeshBasicMaterial | null>(null);
  const incomingRef = useRef<MeshBasicMaterial | null>(null);

  useEffect(() => {
    if (!outgoingRef.current || !incomingRef.current) return;
    const outgoing = outgoingRef.current;
    const incoming = incomingRef.current;
    incoming.opacity = 0;
    const tween = gsap.to(incoming, {
      opacity: 1,
      duration: TRANSFORM_CROSSFADE_DURATION,
      ease: 'power1.inOut'
    });
    gsap.to(outgoing, {
      opacity: 0,
      duration: TRANSFORM_CROSSFADE_DURATION,
      ease: 'power1.inOut'
    });
    return () => {
      tween.kill();
      outgoing.opacity = 1;
      incoming.opacity = 1;
    };
  }, []);

  return (
    <>
      <Character2D variant="D0" pose="front" facing={facing} height={height} materialRef={outgoingRef} />
      <Character2D variant="D1" pose="front" facing={facing} height={height} materialRef={incomingRef} />
    </>
  );
}
