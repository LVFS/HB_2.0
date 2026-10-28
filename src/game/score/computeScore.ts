import {
  ACTIVITY_DEFINITIONS,
  CURIOSITY_FULL_AT,
  GRADE_THRESHOLDS,
  HITS_ZERO_AT,
  SCORE_WEIGHTS,
  TIME_PAR_SECONDS,
  TIME_ZERO_SECONDS,
  type ActivityDefinition,
  type ScoreComponentId,
  type ScoreGrade
} from './scoreConfig.ts';

/** Ciò che serve al punteggio (una copia dei dati di `runStatsStore`, con il tempo già in secondi). */
export interface ScoreInput {
  /** Secondi totali della run, o null se non misurabile. */
  elapsedSeconds: number | null;
  hitsTaken: number;
  qte: { bossCoop: boolean | null; barrage: number | null; support: number | null; cannon: number | null };
  curiosities: readonly string[];
  activities: readonly string[];
}

export interface ScoreComponent {
  /** Quota 0-1, o null se manca il dato (la componente non conta e il suo peso va alle altre). */
  ratio: number | null;
  /** Peso nominale; `max` e `points` sono i punti realmente pesati (la somma dei `max` è 100 se c'è almeno un dato). */
  weight: number;
  max: number;
  points: number;
}

export interface ScoreResult {
  /** 0-100, intero. */
  total: number;
  grade: ScoreGrade;
  parts: Record<ScoreComponentId, ScoreComponent>;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function timeRatio(elapsed: number | null): number | null {
  if (elapsed === null || !Number.isFinite(elapsed)) return null;
  return clamp01((TIME_ZERO_SECONDS - elapsed) / (TIME_ZERO_SECONDS - TIME_PAR_SECONDS));
}

/** Media dei QTE giocati (riuscito = 1, mancato = 0); null se nessuno è stato giocato. */
function qteRatio(qte: ScoreInput['qte']): number | null {
  const values: number[] = [];
  if (qte.bossCoop !== null) values.push(qte.bossCoop ? 1 : 0);
  for (const value of [qte.barrage, qte.support, qte.cannon]) if (value !== null) values.push(clamp01(value));
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function activitiesRatio(done: readonly string[], definitions: readonly ActivityDefinition[]): number | null {
  if (definitions.length === 0) return null;
  const doneIds = new Set(done);
  return definitions.filter((definition) => doneIds.has(definition.id)).length / definitions.length;
}

export function gradeFor(total: number): ScoreGrade {
  return GRADE_THRESHOLDS.find((entry) => total >= entry.min)?.grade ?? 'C';
}

/**
 * Punteggio 0-100 e voto (S/A/B/C). Funzione PURA: stessa entrata, stessa uscita. Le componenti senza dato
 * (nessun QTE giocato, nessuna attività definita, tempo ignoto) non pesano: il loro peso si ridistribuisce sulle altre.
 * `definitions` si passa solo nei test.
 */
export function computeScore(input: ScoreInput, definitions: readonly ActivityDefinition[] = ACTIVITY_DEFINITIONS): ScoreResult {
  const ratios: Record<ScoreComponentId, number | null> = {
    time: timeRatio(input.elapsedSeconds),
    qte: qteRatio(input.qte),
    hits: clamp01(1 - Math.max(0, input.hitsTaken) / HITS_ZERO_AT),
    curiosities: clamp01(new Set(input.curiosities).size / CURIOSITY_FULL_AT),
    activities: activitiesRatio(input.activities, definitions)
  };
  const ids = Object.keys(SCORE_WEIGHTS) as ScoreComponentId[];
  const activeWeight = ids.reduce((sum, id) => sum + (ratios[id] === null ? 0 : SCORE_WEIGHTS[id]), 0);

  let total = 0;
  const parts = {} as Record<ScoreComponentId, ScoreComponent>;
  for (const id of ids) {
    const ratio = ratios[id];
    const max = ratio === null || activeWeight === 0 ? 0 : (SCORE_WEIGHTS[id] / activeWeight) * 100;
    const points = ratio === null ? 0 : ratio * max;
    total += points;
    parts[id] = { ratio, weight: SCORE_WEIGHTS[id], max, points };
  }
  const rounded = Math.round(total);
  return { total: rounded, grade: gradeFor(rounded), parts };
}
