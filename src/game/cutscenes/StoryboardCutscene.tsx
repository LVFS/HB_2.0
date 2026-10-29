import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import gsap from 'gsap';
import { DialogueBox } from '@/components/DialogueBox';
import { SkipCutscene } from '@/components/SkipCutscene';
import type { DialogueLine } from '@/data/dialogues/level1_intro';
import type { CutsceneBeat, CutsceneFx, CutsceneSet } from '@/data/cutscenes/types';
import { useDialogue } from '@/hooks/useDialogue';
import { isSfxName, useSfx } from '@/hooks/useSfx';
import { isPaused } from '@/store/pauseStore';
import styles from './StoryboardCutscene.module.css';

/** Secondi di permanenza di un beat senza battute, se non dice altro. */
const DEFAULT_HOLD = 2.5;
/** Secondi per riga di battuta, per il movimento di camera quando non ha una durata sua. */
const SECONDS_PER_LINE = 2.6;
/** Il precarico non può bloccare la scena: dopo questo tempo si parte comunque. */
const PRELOAD_TIMEOUT_MS = 8000;
/** Pausa prima che le battute di un beat ascoltino l'input: chi sta ancora premendo un tasto non salta la prima riga. */
const DIALOGUE_LISTEN_DELAY_MS = 350;
const WHITEOUT_SECONDS = 0.7;
const FLASH_SECONDS = 0.5;

interface BeatDialogueProps {
  lines: DialogueLine[];
  onDone: () => void;
}

/** Le battute di UN beat (montato con `key`: ogni beat riparte da zero). Un tasto per riga, poi `onDone`. */
function BeatDialogue({ lines, onDone }: BeatDialogueProps) {
  const [listening, setListening] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setListening(true), DIALOGUE_LISTEN_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);
  const { currentLine, isDone } = useDialogue(lines, { enabled: listening });
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (isDone) done.current();
  }, [isDone]);
  return currentLine ? <DialogueBox line={currentLine} /> : null;
}

/** Quanto dura il movimento di camera di un beat (se non lo dice lui: quanto il beat). */
function cameraDuration(beat: CutsceneBeat): number {
  if (beat.camera?.duration !== undefined) return beat.camera.duration;
  return beat.lines ? 3 + SECONDS_PER_LINE * beat.lines.length : (beat.hold ?? DEFAULT_HOLD);
}

/** Quale parte del disegno resta in vista quando `cover` lo ritaglia (di solito il centro). */
function framePosition(beat: CutsceneBeat | undefined): CSSProperties | undefined {
  return beat?.focus ? { objectPosition: `${beat.focus.x ?? 50}% ${beat.focus.y ?? 50}%` } : undefined;
}

interface StoryboardCutsceneProps {
  set: CutsceneSet;
  /** Chiamata UNA volta sola, a fine o saltando. */
  onFinished: () => void;
  enabled?: boolean;
}

/**
 * Cutscene da storyboard (FASE 11, «motion comic»): i disegni a matita a tutto schermo con movimento di camera, tagli, scosse,
 * lampi e battute in sovrimpressione. HTML/CSS, non Canvas. Regole delle cutscene del progetto: `applyFinalState()` è
 * IDEMPOTENTE (scatta una volta, vale a fine sequenza e saltando con `SkipCutscene`), timeline e timer si ripuliscono allo
 * smontaggio, e NESSUN SOFT-LOCK: i disegni si precaricano con un tempo massimo e, se uno non si carica, quel beat resta
 * sul nero con le sue battute (se ne ha) invece di fermare la scena. Percorsi con `BASE_URL` (il deploy è su `/HB_2.0/`).
 */
export function StoryboardCutscene({ set, onFinished, enabled = true }: StoryboardCutsceneProps) {
  const play = useSfx();
  const [ready, setReady] = useState(false);
  const [view, setView] = useState({ index: 0, prev: -1 });
  const failed = useRef(new Set<string>());
  const finished = useRef(false);
  const advancing = useRef(false);
  const viewRef = useRef(view);
  viewRef.current = view;

  const shakeRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);

  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const imageUrl = useCallback((name: string) => `${import.meta.env.BASE_URL}cutscenes/${set.folder}/${name}`, [set.folder]);

  /** Stato finale: la cutscene è finita (o saltata). IDEMPOTENTE. */
  const applyFinalState = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    gsap.killTweensOf([shakeRef.current, cameraRef.current, flashRef.current, curtainRef.current]);
    onFinishedRef.current();
  }, []);

  // Precarico di tutti i disegni (con tempo massimo): chi non si carica finisce in `failed` e si salta il disegno.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const names = Array.from(new Set(set.beats.map((beat) => beat.image)));
    const loads = names.map(async (name) => {
      try {
        const img = new Image();
        img.src = imageUrl(name);
        await img.decode();
      } catch {
        failed.current.add(name);
      }
    });
    const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, PRELOAD_TIMEOUT_MS));
    void Promise.race([Promise.all(loads), timeout]).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, set, imageUrl]);

  // Dal nero: appena i disegni sono pronti il sipario si alza.
  useEffect(() => {
    if (!ready || !curtainRef.current) return;
    gsap.to(curtainRef.current, { opacity: 0, duration: 0.6, ease: 'power1.out' });
  }, [ready]);

  const runFx = useCallback((fx: CutsceneFx[] | undefined) => {
    if (!fx) return;
    if (fx.includes('shake') && shakeRef.current) {
      const target = shakeRef.current;
      const timeline = gsap.timeline({ onComplete: () => void gsap.set(target, { x: 0, y: 0 }) });
      for (let i = 0; i < 9; i += 1) {
        timeline.to(target, { x: (Math.random() - 0.5) * 36, y: (Math.random() - 0.5) * 26, duration: 0.05, ease: 'none' });
      }
      timeline.to(target, { x: 0, y: 0, duration: 0.08 });
    }
    if (fx.includes('flash') && flashRef.current) {
      gsap.fromTo(flashRef.current, { opacity: 0.95 }, { opacity: 0, duration: FLASH_SECONDS, ease: 'power2.out' });
    }
  }, []);

  /** Passa al beat successivo (o chiude), dopo gli effetti di fine beat. Una volta per beat. */
  const advance = useCallback(() => {
    if (finished.current || advancing.current) return;
    const { index } = viewRef.current;
    const beat = set.beats[index];
    const isLast = index >= set.beats.length - 1;
    const goOn = () => {
      advancing.current = false;
      if (isLast) applyFinalState();
      else setView({ index: index + 1, prev: index });
    };
    advancing.current = true;
    const endFx = beat?.fxEnd ?? [];
    if (endFx.includes('whiteout') && flashRef.current) {
      // Si sfuma al bianco: se è l'ultimo beat si chiude da lì; altrimenti il bianco si ritira sul beat dopo.
      gsap.to(flashRef.current, {
        opacity: 1,
        duration: WHITEOUT_SECONDS,
        ease: 'power1.in',
        onComplete: () => {
          goOn();
          if (!isLast && flashRef.current) gsap.to(flashRef.current, { opacity: 0, duration: 0.6, delay: 0.1 });
        }
      });
      return;
    }
    runFx(endFx);
    goOn();
  }, [set, applyFinalState, runFx]);

  // Un beat: camera, effetti, suono; senza battute passa da solo dopo `hold`.
  useEffect(() => {
    if (!ready || finished.current) return;
    const beat = set.beats[view.index];
    if (!beat) {
      applyFinalState();
      return;
    }
    advancing.current = false;
    const camera = cameraRef.current;
    let tween: gsap.core.Tween | undefined;
    if (camera) {
      const { from, to, ease } = beat.camera ?? { from: { x: 0, y: 0, scale: 1 }, to: { x: 0, y: 0, scale: 1 }, ease: 'none' };
      tween = gsap.fromTo(
        camera,
        { xPercent: from.x, yPercent: from.y, scale: from.scale },
        { xPercent: to.x, yPercent: to.y, scale: to.scale, duration: Math.max(0.05, cameraDuration(beat)), ease: ease ?? 'power1.inOut' }
      );
    }
    runFx(beat.fx);
    if (beat.sfx && isSfxName(beat.sfx)) play(beat.sfx);
    let timer: number | undefined;
    // In pausa il beat non avanza da solo: il timer ricontrolla finché il gioco non riprende.
    const holdThenAdvance = () => {
      if (isPaused()) timer = window.setTimeout(holdThenAdvance, 250);
      else advance();
    };
    if (!beat.lines || beat.lines.length === 0) timer = window.setTimeout(holdThenAdvance, (beat.hold ?? DEFAULT_HOLD) * 1000);
    return () => {
      tween?.kill();
      if (timer !== undefined) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- si reagisce solo al cambio di beat (e alla fine del precarico)
  }, [ready, view.index]);

  // Smontaggio: via ogni animazione rimasta.
  useEffect(
    () => () => {
      gsap.killTweensOf([shakeRef.current, cameraRef.current, flashRef.current, curtainRef.current]);
    },
    []
  );

  const beat = set.beats[view.index];
  const previous = view.prev >= 0 ? set.beats[view.prev] : undefined;
  const showImage = (name: string | undefined) => (name && !failed.current.has(name) ? imageUrl(name) : null);
  const currentSrc = ready && beat ? showImage(beat.image) : null;
  const previousSrc = ready && previous ? showImage(previous.image) : null;
  const dimmed = ready && (beat?.fx?.includes('dim') ?? false);

  return (
    <div className={styles.root}>
      <div ref={shakeRef} className={styles.shake}>
        <div ref={cameraRef} className={styles.camera}>
          {previousSrc && (
            <img
              className={`${styles.frame} ${previous?.fit === 'contain' ? styles.contain : ''}`}
              style={framePosition(previous)}
              src={previousSrc}
              alt=""
              draggable={false}
            />
          )}
          {currentSrc && (
            <img
              key={view.index}
              className={`${styles.frame} ${beat?.fit === 'contain' ? styles.contain : ''} ${beat?.cut || view.prev < 0 ? '' : styles.fadeIn}`}
              style={framePosition(beat)}
              src={currentSrc}
              alt=""
              draggable={false}
            />
          )}
        </div>
        <div className={`${styles.dim} ${dimmed ? styles.dimOn : ''}`} />
      </div>
      <div ref={flashRef} className={styles.flash} />
      <div ref={curtainRef} className={styles.curtain} />

      {ready && enabled && beat?.lines && beat.lines.length > 0 && <BeatDialogue key={view.index} lines={beat.lines} onDone={advance} />}
      {/* Tenere premuto Esc/Invio (o il bottone) salta tutto: vedi `applyFinalState`. */}
      <SkipCutscene onSkip={applyFinalState} enabled={enabled} />
    </div>
  );
}
