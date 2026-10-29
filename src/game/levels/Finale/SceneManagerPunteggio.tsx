import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionGlyph } from '@/components/ActionGlyph';
import { SkipCutscene } from '@/components/SkipCutscene';
import { CREDITS, DEDICATION_MESSAGE_PLACEHOLDER, DEDICATION_PLACEHOLDER } from '@/data/credits';
import { levels } from '@/data/levels';
import { computeScore, type ScoreInput } from '@/game/score/computeScore';
import {
  ACTIVITY_DEFINITIONS,
  CREDITS_SCROLL_SECONDS,
  GRADE_COMMENTS,
  SUMMARY_COUNT_SECONDS,
  SUMMARY_FIRST_DELAY,
  SUMMARY_ROW_STEP,
  type ScoreComponentId
} from '@/game/score/scoreConfig';
import { useAnyInput } from '@/hooks/useAnyInput';
import { useGameStore } from '@/store/gameStore';
import { useProgressStore } from '@/store/progressStore';
import { useRunStatsStore } from '@/store/runStatsStore';
import styles from './SceneManagerPunteggio.module.css';

/** Il livello che questa schermata chiude (id da `data/levels.ts`). */
const LEVEL_ID = 'oristano-ariston';

/** Pausa dopo l'ultima riga prima che compaia il voto, e prima che si accetti il tasto «continua» (chi sta ancora premendo non salta tutto). */
const GRADE_DELAY = 0.7;
const CONTINUE_DELAY = 1.2;

function formatTime(seconds: number | null): string {
  if (seconds === null) return '—';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

/** Numero che sale da 0 a `to` in `SUMMARY_COUNT_SECONDS`, dal momento in cui `active` diventa vero. */
function useCountUp(to: number, active: boolean): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const u = Math.min(1, (now - start) / (SUMMARY_COUNT_SECONDS * 1000));
      setValue(to * (1 - Math.pow(1 - u, 3)));
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, active]);
  return active ? value : 0;
}

interface SummaryRowProps {
  label: string;
  shown: boolean;
  /** Il numero che conta, e come scriverlo mentre sale. */
  count: number;
  format: (value: number) => string;
  points: number;
  max: number;
  detail?: string;
}

function SummaryRow({ label, shown, count, format, points, max, detail }: SummaryRowProps) {
  const value = useCountUp(count, shown);
  const earned = useCountUp(points, shown);
  return (
    <div className={`${styles.row} ${shown ? styles.rowShown : ''}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{format(value)}</span>
      <span className={styles.points}>
        {Math.round(earned)} / {Math.round(max)}
      </span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </div>
  );
}

/** Una riga dei titoli: la dedica non ancora scritta si vede subito come tale. */
function CreditLine({ text }: { text: string }) {
  const isPlaceholder = text === DEDICATION_PLACEHOLDER || text === DEDICATION_MESSAGE_PLACEHOLDER;
  return <div className={isPlaceholder ? styles.placeholder : styles.creditLine}>{text}</div>;
}

/**
 * Fine del livello (`schermata_punteggio`, FASE 12): schermata nera col riepilogo (tempo, QTE, colpi subiti, curiosità, attività se
 * ce ne sono) e conteggio animato, voto con il commento di Eve, un tasto per continuare; poi i titoli di coda (saltabili).
 * Alla fine il livello risulta completato (`completedLevelIds`) e si torna al menu. Il punteggio NON si salva: è una schermata di
 * fine run. I dati vengono da `runStatsStore`, letti una volta sola all'ingresso.
 */
export function SceneManagerPunteggio() {
  const [stage, setStage] = useState<'summary' | 'credits'>('summary');
  const [step, setStep] = useState(0);
  const [canContinue, setCanContinue] = useState(false);

  // Lo snapshot delle statistiche si prende UNA volta, all'ingresso; il cronometro si ferma qui.
  const input = useMemo<ScoreInput>(() => {
    useRunStatsStore.getState().finish();
    const stats = useRunStatsStore.getState();
    const elapsedSeconds = stats.startedAt !== null && stats.finishedAt !== null ? (stats.finishedAt - stats.startedAt) / 1000 : null;
    return { elapsedSeconds, hitsTaken: stats.hitsTaken, qte: { ...stats.qte }, curiosities: [...stats.curiosities], activities: [...stats.activities] };
  }, []);
  const result = useMemo(() => computeScore(input), [input]);
  const hasActivities = ACTIVITY_DEFINITIONS.length > 0;

  const rowIds = useMemo<ScoreComponentId[]>(() => (hasActivities ? ['time', 'qte', 'hits', 'curiosities', 'activities'] : ['time', 'qte', 'hits', 'curiosities']), [hasActivities]);

  // Le righe compaiono una dopo l'altra, poi il voto, poi l'invito a continuare.
  useEffect(() => {
    const timers: number[] = [];
    rowIds.forEach((_, index) => {
      timers.push(window.setTimeout(() => setStep(index + 1), (SUMMARY_FIRST_DELAY + index * SUMMARY_ROW_STEP) * 1000));
    });
    const gradeAt = SUMMARY_FIRST_DELAY + rowIds.length * SUMMARY_ROW_STEP + GRADE_DELAY;
    timers.push(window.setTimeout(() => setStep(rowIds.length + 1), gradeAt * 1000));
    timers.push(window.setTimeout(() => setCanContinue(true), (gradeAt + CONTINUE_DELAY) * 1000));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [rowIds]);

  useAnyInput(() => setStage('credits'), { enabled: stage === 'summary' && canContinue });

  /** Fine: il livello è completato e si torna al menu. IDEMPOTENTE (titoli finiti o saltati). */
  const finished = useRef(false);
  const applyFinalState = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    useProgressStore.getState().completeLevel(LEVEL_ID);
    useGameStore.getState().setScreen('menu');
  }, []);

  const levelName = levels.find((level) => level.id === LEVEL_ID)?.name ?? '';
  const detailQte = `Squadra ${input.qte.bossCoop === null ? '—' : input.qte.bossCoop ? '✓' : '✗'} · Raffica ${percent(input.qte.barrage)} · Supporto ${percent(input.qte.support)} · Cannone ${percent(input.qte.cannon)}`;

  const rowContent: Record<ScoreComponentId, Omit<SummaryRowProps, 'shown'>> = {
    time: { label: 'Tempo', count: input.elapsedSeconds ?? 0, format: (v) => (input.elapsedSeconds === null ? '—' : formatTime(v)), points: result.parts.time.points, max: result.parts.time.max },
    qte: { label: 'Prove a tempo', count: (result.parts.qte.ratio ?? 0) * 100, format: (v) => (result.parts.qte.ratio === null ? '—' : `${Math.round(v)}%`), points: result.parts.qte.points, max: result.parts.qte.max, detail: detailQte },
    hits: { label: 'Colpi subiti', count: input.hitsTaken, format: (v) => String(Math.round(v)), points: result.parts.hits.points, max: result.parts.hits.max },
    curiosities: { label: 'Cose curiose', count: new Set(input.curiosities).size, format: (v) => String(Math.round(v)), points: result.parts.curiosities.points, max: result.parts.curiosities.max },
    activities: { label: 'Attività', count: input.activities.length, format: (v) => `${Math.round(v)} / ${ACTIVITY_DEFINITIONS.length}`, points: result.parts.activities.points, max: result.parts.activities.max }
  };

  return (
    <div className={styles.root}>
      {stage === 'summary' && (
        <div className={styles.summary}>
          <div className={styles.title}>{levelName ? `${levelName} — completato` : 'Livello completato'}</div>
          <div className={styles.subtitle}>Rapporto di fine missione</div>
          <div className={styles.rows}>
            {rowIds.map((id, index) => (
              <SummaryRow key={id} shown={step > index} {...rowContent[id]} />
            ))}
          </div>
          <div className={`${styles.result} ${step > rowIds.length ? styles.resultShown : ''}`}>
            <div className={styles.total}>Punteggio {result.total} / 100</div>
            <div className={styles.grade}>{result.grade}</div>
            <div className={styles.comment}>{GRADE_COMMENTS[result.grade]}</div>
          </div>
          <div className={`${styles.prompt} ${canContinue ? styles.promptShown : ''}`}>
            premi <ActionGlyph action="confirm" /> o un tasto qualsiasi per continuare
          </div>
        </div>
      )}

      {stage === 'credits' && (
        <div className={styles.credits}>
          <div className={styles.creditsScroll} style={{ animationDuration: `${CREDITS_SCROLL_SECONDS}s` }} onAnimationEnd={applyFinalState}>
            {CREDITS.map((block, index) => (
              <div key={index} className={styles.block}>
                {block.heading && <div className={styles.heading}>{block.heading}</div>}
                {block.lines.map((line) => (
                  <CreditLine key={line} text={line} />
                ))}
              </div>
            ))}
          </div>
          <SkipCutscene onSkip={applyFinalState} />
        </div>
      )}
    </div>
  );
}
