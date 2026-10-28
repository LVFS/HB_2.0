import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import gsap from 'gsap';
import type { OrthographicCamera as OrthographicCameraImpl } from 'three';
import { DialogueBox } from '@/components/DialogueBox';
import { QteChallenge } from '@/components/QteChallenge';
import { SkipCutscene } from '@/components/SkipCutscene';
import type { DialogueLine } from '@/data/dialogues/level1_intro';
import { SPACE_AFTER_SUPPORT, SPACE_DESTRUCTION_CUES, SPACE_OPENING_CUES, type CaptionCue } from '@/data/dialogues/level1_spazio';
import { useDialogue } from '@/hooks/useDialogue';
import { useArenaStore } from '@/store/arenaStore';
import { useLevelStore } from '@/store/levelStore';
import { useRunStatsStore } from '@/store/runStatsStore';
import { SpaceBackdrop } from './SpaceBackdrop';
import { CannonBeam, CheccoRocket, EveShip, MotherShip, SpaceFx } from './SpaceShips';
import styles from './SceneManagerSpazio.module.css';
import {
  CANNON_FORCED_MIN,
  CANNON_KEYS,
  CANNON_TIME_LIMIT,
  SPACE_BEAM_WIDTH_MAX,
  SPACE_BEAM_WIDTH_MIN,
  SPACE_CAMERA_Z,
  SPACE_DESTRUCTION_DURATION,
  SPACE_DIALOGUE_DELAY_MS,
  SPACE_EVE_HOME,
  SPACE_MOTHER_POS,
  SPACE_OPENING_DURATION,
  SPACE_ROCKET_DOCK,
  SPACE_VIEW_HEIGHT,
  SPACE_VIEW_WIDTH,
  SPACE_WHITEOUT_LEAD,
  SPACE_WHITEOUT_TO_PHASE_MS,
  SUPPORT_QTE_KEYS
} from './spazioConfig';
import { addRing, startCannon, startSupport, supportScore, updateCannon, updateEffects, updateSupport, type SpazioHooks } from './spazioDriver';
import { createSpazioWorld, type SpazioStage, type SpazioWorld } from './spazioState';

interface SceneManagerSpazioProps {
  /** Accende il whiteout globale (`App.tsx`) prima di lasciare la scena. */
  onWhiteout: (active: boolean) => void;
}

/** La camera: ortografica fissa sul palcoscenico 16×9 (contenuto per intero a qualunque finestra), con il tremolio di `world.shake`. */
function SpaceCameraRig({ world }: { world: SpazioWorld }) {
  const camera = useThree((state) => state.camera) as OrthographicCameraImpl;
  const size = useThree((state) => state.size);
  useFrame(() => {
    const zoom = Math.min(size.height / SPACE_VIEW_HEIGHT, size.width / SPACE_VIEW_WIDTH);
    if (camera.zoom !== zoom) {
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    }
    const amount = world.shake;
    camera.position.set(amount > 0 ? (Math.random() - 0.5) * 2 * amount : 0, amount > 0 ? (Math.random() - 0.5) * 2 * amount : 0, SPACE_CAMERA_Z);
  });
  return null;
}

/** L'unico `useFrame` di simulazione: effetti sempre, QTE di supporto e cannone nella loro tappa. */
function SpaceDriver({ world, hooks, onSupportDone, onCannonDone }: { world: SpazioWorld; hooks: SpazioHooks; onSupportDone: () => void; onCannonDone: () => void }) {
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    world.time += delta;
    updateEffects(world, delta);
    if (world.stage === 'support' && updateSupport(world, delta, hooks) === 'done') onSupportDone();
    else if (world.stage === 'cannon' && updateCannon(world, delta) === 'done') onCannonDone();
  });
  return null;
}

/** La barra di carica del cannone: legge il metro dal mondo a ogni frame di schermo (ref, mai stato React a 60 Hz). */
function CannonHud({ world }: { world: SpazioWorld }) {
  const fill = useRef<HTMLDivElement>(null);
  const clock = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const meter = world.cannon.meter;
      if (meter && fill.current) {
        fill.current.style.width = `${Math.round(meter.charge * 100)}%`;
        fill.current.className = `${styles.fill} ${meter.state === 'full' ? styles.fillFull : ''}`;
      }
      if (meter && clock.current) {
        const left = Math.max(0, CANNON_TIME_LIMIT - meter.elapsed);
        clock.current.textContent = world.cannon.phase === 'ready' ? 'Pronti…' : `${left.toFixed(1)} s`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [world]);

  return (
    <div className={styles.cannon} role="status" aria-label="Carica del cannone">
      <div className={styles.cannonTitle}>Carica il cannone!</div>
      <div className={styles.cannonHint}>Martella J, K o Spazio (o clicca): alternare J e K carica un po’ di più</div>
      <div className={styles.track}>
        <div ref={fill} className={styles.fill} />
        <div className={styles.threshold} style={{ left: `${CANNON_FORCED_MIN * 100}%` }} />
      </div>
      <div ref={clock} className={styles.clock} />
    </div>
  );
}

/** Il dialogo dopo il QTE: un tasto per riga, con una pausa iniziale (chi ha appena finito il QTE sta ancora premendo tasti). */
function AfterSupportDialogue({ onDone }: { onDone: () => void }) {
  const [listening, setListening] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setListening(true), SPACE_DIALOGUE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);
  const { currentLine, isDone } = useDialogue(SPACE_AFTER_SUPPORT, { enabled: listening });
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (isDone) done.current();
  }, [isDone]);
  return currentLine ? <DialogueBox line={currentLine} /> : null;
}

/**
 * Lo spazio (FASE 12): UNA scena per `inseguimento_spaziale_cutscene`, `qte_supporto_eve` e `carica_cannone_qte`, con una
 * piccola macchina a stati interna (apertura → supporto → dialogo → cannone → distruzione) così il passaggio fra fasi non
 * rimonta il `<Canvas>` (stesso schema del tunnel). Apertura e distruzione sono cutscene a timeline GSAP con
 * `applyFinalState()` IDEMPOTENTE e `SkipCutscene`; i due QTE NON sono saltabili e NON sono fallibili: l'esito cambia solo
 * punteggio e una riga del dialogo finale. Segnaposto a tinte unite. A fine, `setPhase('dialogo_finale')`.
 */
export function SceneManagerSpazio({ onWhiteout }: SceneManagerSpazioProps) {
  const world = useMemo(createSpazioWorld, []);
  const [stage, setStage] = useState<SpazioStage>('opening');
  const [caption, setCaption] = useState<DialogueLine | null>(null);

  const captionTimer = useRef<number | undefined>(undefined);
  const phaseTimer = useRef<number | undefined>(undefined);
  const openingTl = useRef<gsap.core.Timeline | null>(null);
  const destructionTl = useRef<gsap.core.Timeline | null>(null);
  const done = useRef({ opening: false, support: false, cannon: false, destruction: false });

  const clearCaption = useCallback(() => {
    window.clearTimeout(captionTimer.current);
    setCaption(null);
  }, []);
  const showCaption = useCallback((line: DialogueLine, seconds: number) => {
    window.clearTimeout(captionTimer.current);
    setCaption(line);
    captionTimer.current = window.setTimeout(() => setCaption(null), seconds * 1000);
  }, []);
  const hooks = useMemo<SpazioHooks>(() => ({ caption: showCaption }), [showCaption]);

  // ---------- Passaggi fra le tappe (ognuno scatta UNA volta) ----------

  const goSupport = useCallback(() => {
    startSupport(world);
    setStage('support');
    useLevelStore.getState().setPhase('qte_supporto_eve');
  }, [world]);

  const finishSupport = useCallback(() => {
    if (done.current.support) return;
    done.current.support = true;
    const score = supportScore(world);
    useRunStatsStore.getState().setQte({ support: score });
    useLevelStore.getState().setSpaceResult({ support: score, cannon: 0 });
    useArenaStore.getState().set({ qte: null });
    // Lo scafo è compromesso comunque, qualunque sia l'esito: la storia è fissa.
    world.eve.smoke = Math.max(world.eve.smoke, 0.8);
    world.stage = 'supportAfter';
    setStage('supportAfter');
    clearCaption();
    useLevelStore.getState().setPhase('carica_cannone_qte');
  }, [world, clearCaption]);

  const goCannon = useCallback(() => {
    startCannon(world);
    setStage('cannon');
  }, [world]);

  const finishCannon = useCallback(() => {
    if (done.current.cannon) return;
    done.current.cannon = true;
    const score = world.cannon.score;
    useRunStatsStore.getState().setQte({ cannon: score });
    useLevelStore.getState().setSpaceResult({ support: useLevelStore.getState().spaceResult?.support ?? 0, cannon: score });
    world.stage = 'destruction';
    setStage('destruction');
  }, [world]);

  // ---------- Apertura: l'inseguimento (~20 s, saltabile) ----------

  /** Stato finale dell'apertura, IDEMPOTENTE: vale a timeline finita e saltando. */
  const applyOpeningFinal = useCallback(() => {
    if (done.current.opening) return;
    done.current.opening = true;
    gsap.killTweensOf([world, world.rocket, world.eve, world.mother]);
    world.scroll = 1;
    world.rocket.visible = false;
    world.eve.visible = true;
    world.eve.x = SPACE_EVE_HOME.x;
    world.eve.y = SPACE_EVE_HOME.y;
    world.mother.glow = 0;
    clearCaption();
    goSupport();
  }, [world, clearCaption, goSupport]);

  useEffect(() => {
    const dock = SPACE_ROCKET_DOCK;
    const tl = gsap.timeline({ onComplete: applyOpeningFinal });
    openingTl.current = tl;
    // Il razzo di Checco sale verso la nave madre e ci entra; le stelle schizzano all'inizio e poi si calmano.
    tl.to(world, { scroll: 2.6, duration: 2.5, ease: 'power2.out' }, 0);
    tl.to(world, { scroll: 1.2, duration: 5, ease: 'power1.inOut' }, 4);
    tl.to(world.rocket, { x: dock.x, y: dock.y, duration: 9, ease: 'power1.inOut' }, 0.2);
    tl.call(
      () => {
        addRing(world, dock.x, dock.y, 1.8, 0.7, '#fde68a');
        world.mother.glow = 1;
      },
      [],
      9.2
    );
    tl.set(world.rocket, { visible: false }, 9.2);
    tl.to(world.mother, { glow: 0, duration: 0.8 }, 9.4);
    // Eve parte senza D e si porta in scorta.
    tl.set(world.eve, { visible: true }, 5.0);
    tl.to(world.eve, { x: SPACE_EVE_HOME.x, y: SPACE_EVE_HOME.y, duration: 5, ease: 'power2.out' }, 5.0);
    SPACE_OPENING_CUES.forEach((cue: CaptionCue) => tl.call(() => showCaption(cue.line, cue.hold), [], cue.at));
    tl.to({}, { duration: SPACE_OPENING_DURATION }, 0);
    return () => {
      tl.kill();
    };
  }, [world, applyOpeningFinal, showCaption]);

  // ---------- Distruzione: il raggio, la nave madre in due, la caduta di Eve (~12 s, saltabile) ----------

  /** Stato finale della distruzione, IDEMPOTENTE: bianco e poi `dialogo_finale`. */
  const applyDestructionFinal = useCallback(() => {
    if (done.current.destruction) return;
    done.current.destruction = true;
    gsap.killTweensOf([world, world.beam, world.eve, world.mother]);
    world.beam.power = 0;
    world.mother.visible = false;
    world.eve.visible = false;
    world.shake = 0;
    world.flash = 0;
    clearCaption();
    onWhiteout(true);
    phaseTimer.current = window.setTimeout(() => useLevelStore.getState().setPhase('dialogo_finale'), SPACE_WHITEOUT_TO_PHASE_MS);
  }, [world, clearCaption, onWhiteout]);

  useEffect(() => {
    if (stage !== 'destruction') return;
    // Il raggio è tanto più largo quanto più il cannone era carico (da quella forzata alla piena).
    const fired = world.cannon.fired;
    const beamWidth = SPACE_BEAM_WIDTH_MIN + (SPACE_BEAM_WIDTH_MAX - SPACE_BEAM_WIDTH_MIN) * Math.max(0, (fired - CANNON_FORCED_MIN) / (1 - CANNON_FORCED_MIN));
    const mother = SPACE_MOTHER_POS;
    const hit = (size: number, color = '#fde68a') => addRing(world, mother.x + (Math.random() - 0.5) * 3, mother.y + (Math.random() - 0.5), size, 0.7, color);

    const tl = gsap.timeline({ onComplete: applyDestructionFinal });
    destructionTl.current = tl;
    // Il raggio parte e colpisce; la nave madre si crepa, si apre in due ed esplode.
    tl.to(world.beam, { power: 1, width: beamWidth, duration: 0.3, ease: 'power2.out' }, 0.6);
    tl.call(() => {
      world.flash = 0.8;
      world.shake = 0.3;
      hit(2.4, '#ffffff');
    }, [], 1.0);
    tl.to(world.mother, { burn: 1, duration: 2.2 }, 1.2);
    tl.call(() => {
      world.shake = 0.25;
      hit(1.6);
    }, [], 2.2);
    tl.to(world.mother, { split: 1, duration: 3, ease: 'power2.in' }, 3.2);
    tl.to(world.beam, { power: 0, duration: 0.5 }, 3.4);
    tl.call(() => {
      world.flash = 1;
      world.shake = 0.4;
      hit(3.4, '#ffffff');
      hit(2.6);
    }, [], 4.6);
    tl.call(() => hit(2.2, '#fb923c'), [], 5.4);
    tl.set(world.mother, { visible: false }, 7.2);
    // Senza più spinta, la navicella di Eve cade.
    tl.to(world.eve, { thrust: 0, duration: 0.6 }, 5.0);
    tl.set(world.eve, { smoke: 1 }, 5.0);
    tl.to(world.eve, { x: SPACE_EVE_HOME.x - 1.5, y: -7.5, rot: -1.1, duration: 4.5, ease: 'power2.in' }, 5.6);
    SPACE_DESTRUCTION_CUES.forEach((cue: CaptionCue) => tl.call(() => showCaption(cue.line, cue.hold), [], cue.at));
    tl.call(() => onWhiteout(true), [], SPACE_DESTRUCTION_DURATION - SPACE_WHITEOUT_LEAD);
    tl.to({}, { duration: SPACE_DESTRUCTION_DURATION }, 0);
    return () => {
      tl.kill();
    };
  }, [stage, world, applyDestructionFinal, showCaption, onWhiteout]);

  // ---------- Input dei QTE: stessa via del tunnel (`keydown` sulla finestra), più click/tap per il cannone ----------

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key === ' ' ? 'space' : event.key.toLowerCase();
      if (world.stage === 'support' && world.support.phase === 'qte') {
        if ((SUPPORT_QTE_KEYS as readonly string[]).includes(key)) {
          world.pressed.push(key);
          if (key === 'space') event.preventDefault();
        }
      } else if (world.stage === 'cannon') {
        if ((CANNON_KEYS as readonly string[]).includes(key)) {
          world.cannon.taps.push(key);
          if (key === 'space') event.preventDefault();
        }
      }
    };
    const onPointerDown = () => {
      if (world.stage === 'cannon') world.cannon.taps.push('pointer');
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [world]);

  // Smontaggio: via QTE a schermo, timer e timeline rimasti.
  useEffect(
    () => () => {
      window.clearTimeout(captionTimer.current);
      window.clearTimeout(phaseTimer.current);
      openingTl.current?.kill();
      destructionTl.current?.kill();
      useArenaStore.getState().set({ qte: null });
    },
    []
  );

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __spazioWorld?: unknown }).__spazioWorld = world;
  }, [world]);

  return (
    <div className="scene-shell">
      <Canvas>
        <Suspense fallback={null}>
          <OrthographicCamera makeDefault position={[0, 0, SPACE_CAMERA_Z]} />
          <SpaceCameraRig world={world} />
          <SpaceDriver world={world} hooks={hooks} onSupportDone={finishSupport} onCannonDone={finishCannon} />
          <SpaceBackdrop world={world} />
          <MotherShip world={world} />
          <CheccoRocket world={world} />
          <EveShip world={world} />
          <CannonBeam world={world} />
          <SpaceFx world={world} />
        </Suspense>
      </Canvas>

      {stage === 'support' && <QteChallenge />}
      {stage === 'cannon' && <CannonHud world={world} />}
      {stage === 'supportAfter' && <AfterSupportDialogue onDone={goCannon} />}
      {caption && <DialogueBox line={caption} showHint={false} />}

      {/* Le due cutscene sono saltabili (tenere premuto Esc/Invio o il bottone); due istanze distinte, perché ognuna scatta una volta. */}
      {stage === 'opening' && <SkipCutscene key="skip-opening" onSkip={() => { openingTl.current?.progress(1); applyOpeningFinal(); }} />}
      {stage === 'destruction' && <SkipCutscene key="skip-destruction" onSkip={() => { destructionTl.current?.progress(1); applyDestructionFinal(); }} />}
    </div>
  );
}
