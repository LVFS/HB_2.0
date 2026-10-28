// Punteggio di fine livello (FASE 12): tutti i numeri qui, mai nei componenti né in `computeScore`.
// Niente import con alias: i test (`tests/`) caricano questi file direttamente con Node.

export type ScoreComponentId = 'time' | 'qte' | 'hits' | 'curiosities' | 'activities';

/** Pesi (somma 100). Una componente senza dati (es. nessuna attività definita) cede il suo peso alle altre. */
export const SCORE_WEIGHTS: Record<ScoreComponentId, number> = {
  time: 20,
  qte: 30,
  hits: 25,
  curiosities: 15,
  activities: 10
};

/** Tempo totale (leggere i dialoghi conta): fino a `TIME_PAR_SECONDS` punteggio pieno, poi scende fino a zero a `TIME_ZERO_SECONDS`. */
export const TIME_PAR_SECONDS = 18 * 60;
export const TIME_ZERO_SECONDS = 45 * 60;

/** Colpi subiti: zero colpi = punteggio pieno, `HITS_ZERO_AT` o più = zero. */
export const HITS_ZERO_AT = 30;

/** Cose curiose trovate che bastano per il punteggio pieno. */
export const CURIOSITY_FULL_AT = 6;

/** Schermata del riepilogo: pausa prima della prima riga, tra una riga e l'altra, e durata del conteggio animato di ognuna (secondi). */
export const SUMMARY_FIRST_DELAY = 0.8;
export const SUMMARY_ROW_STEP = 0.9;
export const SUMMARY_COUNT_SECONDS = 0.9;
/** Titoli di coda: quanto dura lo scorrimento (secondi). */
export const CREDITS_SCROLL_SECONDS = 24;

export type ScoreGrade = 'S' | 'A' | 'B' | 'C';

/** Soglie dei voti (totale 0-100), dal più alto; sotto l'ultima è `C`. */
export const GRADE_THRESHOLDS: ReadonlyArray<{ grade: Exclude<ScoreGrade, 'C'>; min: number }> = [
  { grade: 'S', min: 90 },
  { grade: 'A', min: 75 },
  { grade: 'B', min: 55 }
];

export interface ActivityDefinition {
  id: string;
  label: string;
}

/**
 * Attività secondarie nel cinema che contano per il punteggio. Vuoto finché non ce ne sono nel gioco (biglietti e
 * popcorn di `docs/FASE4b_ATTIVITA_E_PREBOSS.md` non sono ancora implementati). Per aggiungerne una: la definizione
 * qui + `completeActivity('id')` dove si conclude. La riga «Attività» della schermata compare solo se c'è almeno una definizione.
 */
export const ACTIVITY_DEFINITIONS: readonly ActivityDefinition[] = [];

/** Commento di Eve per voto (schermata del punteggio). */
export const GRADE_COMMENTS: Record<ScoreGrade, string> = {
  S: 'Valutazione finale: S. Non l’avevo previsto. Annotato con sospetto.',
  A: 'Valutazione finale: A. Collaborazione… tollerabile.',
  B: 'Valutazione finale: B. Annotato.',
  C: 'Valutazione finale: C. Il rapporto dice “imprevisti: tutti”.'
};
