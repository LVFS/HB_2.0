import { Suspense, lazy, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Text } from '@react-three/drei';
import gsap from 'gsap';
import type { MeshBasicMaterial } from 'three';
import { useSfx } from '@/hooks/useSfx';
import { Wall } from './wall/Wall';
import { VARIANT_IMPACT_DELAY, WALL, WALL_FRONT_Z, type BreakVariant } from './wall/wallConfig';
import type { MenuPhase } from './menuPhase';

// Rapier (~2 MB) vive solo qui dentro: finché il muro è intatto non serve.
// Viene precaricato appena l'intro finisce, così al click è già in memoria.
const WallShatter = lazy(() =>
  import('./wall/WallShatter').then((module) => ({ default: module.WallShatter }))
);

/** Inquadrature della camera, in coordinate mondo. */
const SHOTS = {
  // Si parte in basso e lontano: la camera "alza lo sguardo" salendo, ed è
  // quello che fa leggere l'altezza del muro.
  introStart: { x: 0, y: 1.5, z: 68 },
  introEnd: { x: 0, y: 11, z: 30 },
  break: { x: 0, y: 13, z: 42 }
};
const LOOK = {
  introStart: { x: 0, y: 2, z: WALL.center[2] },
  introEnd: { x: 0, y: 13, z: WALL.center[2] },
  break: { x: 0, y: 11, z: WALL.center[2] }
};

const INTRO_DURATION = 4.2;
const BREAK_DURATION = 3;
/** Quanto si resta sulla scena dopo che i detriti sono per aria. */
const BREAK_TAIL = 0.5;

interface DirectorProps {
  phase: MenuPhase;
  variant: BreakVariant;
  onIntroComplete: () => void;
  onBreakComplete: () => void;
}

/**
 * Il regista della sequenza: possiede la camera e la timeline GSAP.
 *
 * Divisione dei ruoli, ed è la parte che conta:
 *   - GSAP guida ciò che ha una durata decisa da noi (camera, scossone, cue
 *     audio, in futuro il personaggio);
 *   - Rapier guida ciò che deve sembrare non scritto (i detriti);
 *   - React decide solo QUALE fase è attiva, non i fotogrammi.
 * Se si mescolano, si finisce a combattere contro uno dei tre.
 */
function CameraDirector({ phase, variant, onIntroComplete, onBreakComplete }: DirectorProps) {
  const { camera } = useThree();
  const playSfx = useSfx();

  // GSAP anima questi oggetti semplici, NON direttamente camera.position.
  // Motivo: allo scossone sommiamo un offset alla posizione; se GSAP possedesse
  // camera.position, l'offset verrebbe inglobato nel tween e la camera
  // andrebbe alla deriva. Qui invece la posizione finale la ricostruiamo noi
  // a ogni fotogramma, e la sorgente resta pulita.
  const base = useRef({ ...SHOTS.introStart }).current;
  const look = useRef({ ...LOOK.introStart }).current;
  const shake = useRef({ value: 0 }).current;

  useEffect(() => {
    if (phase !== 'intro') return;

    Object.assign(base, SHOTS.introStart);
    Object.assign(look, LOOK.introStart);

    const timeline = gsap.timeline({ onComplete: onIntroComplete });
    timeline
      .to(base, { ...SHOTS.introEnd, duration: INTRO_DURATION, ease: 'power2.out' }, 0)
      .to(look, { ...LOOK.introEnd, duration: INTRO_DURATION, ease: 'power1.inOut' }, 0);

    // Senza kill(), tornando al menu la vecchia timeline continuerebbe a
    // scrivere sugli stessi oggetti insieme a quella nuova.
    return () => {
      timeline.kill();
    };
  }, [phase, base, look, onIntroComplete]);

  useEffect(() => {
    if (phase !== 'breaking') return;

    // Il momento esatto in cui il muro incassa il colpo. Per la variante
    // "pugno" è più tardi: è il tempo di caricare il colpo.
    const impactAt = VARIANT_IMPACT_DELAY[variant];

    const timeline = gsap.timeline({ onComplete: onBreakComplete });
    timeline
      .to(base, { ...SHOTS.break, duration: BREAK_DURATION, ease: 'power2.out' }, 0)
      .to(look, { ...LOOK.break, duration: BREAK_DURATION, ease: 'power2.out' }, 0)
      // Cue audio: GSAP li piazza sulla linea del tempo come i tween.
      .call(() => playSfx('impact'), undefined, impactAt)
      .call(() => playSfx('rubble', { volume: 0.65 }), undefined, impactAt + 0.35)
      // Scossone: sale in un lampo e si spegne lentamente.
      .to(shake, { value: 1, duration: 0.05 }, impactAt)
      .to(shake, { value: 0, duration: 1.5, ease: 'power2.out' }, impactAt + 0.05)
      // Segmento vuoto: allunga la timeline così onComplete non scatta
      // mentre i detriti sono ancora in volo.
      .to({}, { duration: BREAK_TAIL }, BREAK_DURATION);

    return () => {
      timeline.kill();
    };
  }, [phase, variant, base, look, shake, playSfx, onBreakComplete]);

  useFrame(() => {
    const amount = shake.value;
    camera.position.set(
      base.x + (Math.random() - 0.5) * amount * 1.6,
      base.y + (Math.random() - 0.5) * amount * 1.2,
      base.z + (Math.random() - 0.5) * amount * 0.8
    );
    camera.lookAt(look.x, look.y, look.z);
  });

  return null;
}

/**
 * Il titolo inciso sul muro, che svanisce quando il muro cede.
 *
 * Mostra il terzo tipo di bersaglio che una timeline GSAP può pilotare, dopo
 * la camera e i cue audio: una proprietà di un materiale. Il punto è che
 * l'opacità NON passa da uno stato React — un setState per fotogramma
 * ridisegnerebbe l'albero 60 volte al secondo. GSAP scrive dritto
 * sull'oggetto Three, e React non se ne accorge nemmeno.
 */
function WallTitle({ phase, y }: { phase: MenuPhase; y: number }) {
  const materialRef = useRef<MeshBasicMaterial>(null);

  useEffect(() => {
    if (phase !== 'breaking' || !materialRef.current) return;

    const material = materialRef.current;
    const tween = gsap.to(material, {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.in',
      delay: VARIANT_IMPACT_DELAY.radial
    });

    return () => {
      tween.kill();
      material.opacity = 1;
    };
  }, [phase]);

  return (
    <Text
      position={[0, y, WALL_FRONT_Z + 0.06]}
      fontSize={2.1}
      letterSpacing={0.08}
      color="#e8eef8"
      outlineWidth={0.03}
      outlineColor="#0b1220"
      anchorX="center"
      anchorY="middle"
    >
      EPIC BIRTHDAY QUEST
      <meshBasicMaterial ref={materialRef} transparent color="#e8eef8" toneMapped={false} />
    </Text>
  );
}

interface MainMenuSceneAnimationProps {
  phase: MenuPhase;
  variant: BreakVariant;
  onIntroComplete: () => void;
  onBreakComplete: () => void;
}

export function MainMenuSceneAnimation({
  phase,
  variant,
  onIntroComplete,
  onBreakComplete
}: MainMenuSceneAnimationProps) {
  // Appena l'intro finisce scarichiamo il codice della fisica in background:
  // quando l'utente clicca è già pronto e lo scambio è istantaneo.
  useEffect(() => {
    if (phase === 'ready') void import('./wall/WallShatter');
  }, [phase]);

  const titleY = useMemo(() => WALL.center[1] + WALL.height * 0.62, []);

  return (
    <Canvas shadows camera={{ position: [0, 1.5, 52], fov: 55 }} dpr={[1, 1.75]}>
      <fog attach="fog" args={['#070b13', 30, 130]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[22, 40, 26]}
        intensity={1.5}
        castShadow
        // Il tronco d'ombra predefinito copre appena 10 unità: su un muro
        // largo 40 le ombre sparirebbero quasi ovunque.
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-25}
        shadow-camera-far={140}
      />

      <CameraDirector
        phase={phase}
        variant={variant}
        onIntroComplete={onIntroComplete}
        onBreakComplete={onBreakComplete}
      />

      {/* Il terreno VISIBILE sta qui, fuori dalla fisica, così è presente in
          ogni fase. WallShatter aggiunge solo il collider invisibile: se il
          terreno nascesse insieme alla fisica, lo si vedrebbe comparire di
          colpo nell'istante in cui il muro si rompe. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color="#141d2e" roughness={1} />
      </mesh>

      <Suspense fallback={null}>
        <Environment preset="sunset" />
        <WallTitle phase={phase} y={titleY} />
      </Suspense>

      {phase === 'breaking' ? (
        // Fallback = il muro intatto: se per qualsiasi motivo il codice della
        // fisica non fosse ancora pronto, non si vede un buco ma il muro fermo.
        <Suspense fallback={<Wall />}>
          <WallShatter variant={variant} />
        </Suspense>
      ) : (
        <Wall />
      )}
    </Canvas>
  );
}
