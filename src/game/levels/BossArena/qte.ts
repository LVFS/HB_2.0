/**
 * Logica pura di una sequenza di prompt a tempo (QTE): una serie di tasti da
 * premere ciascuno entro la sua finestra. Nessuna dipendenza da React/Three/
 * store — chi la usa la fa avanzare con `updateQte` ogni frame e disegna lo
 * stato dove preferisce (qui: `components/QteChallenge.tsx` via `arenaStore`).
 * Riusabile per i QTE futuri del livello (combo a doppia spada, supporto a
 * Eve, carica del cannone).
 */

export type QteResult = 'hit' | 'miss';

export interface QteState {
  keys: string[];
  windows: number[];
  /** Pausa (secondi) fra la fine di un prompt e l'inizio del successivo. */
  gap: number;
  /** Prompt corrente (== keys.length quando la sequenza è finita). */
  index: number;
  /** Secondi trascorsi sul prompt corrente. */
  t: number;
  /** Secondi residui di pausa prima del prossimo prompt (0 = prompt attivo). */
  gapLeft: number;
  results: (QteResult | null)[];
}

export type QteEvent = { index: number; result: QteResult };

/** Sceglie `count` tasti a caso dall'insieme, senza ripetere due volte di fila. */
export function pickQteKeys(pool: readonly string[], count: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const candidates = pool.filter((key) => key !== keys[i - 1]);
    keys.push(candidates[Math.floor(Math.random() * candidates.length)]);
  }
  return keys;
}

export function createQte(keys: string[], windows: number[], gap: number): QteState {
  return {
    keys,
    windows,
    gap,
    index: 0,
    t: 0,
    // Un primo istante di respiro, perché il prompt non compaia "a sorpresa".
    gapLeft: gap,
    results: keys.map(() => null)
  };
}

export function isQteFinished(qte: QteState): boolean {
  return qte.index >= qte.keys.length;
}

/**
 * Fa avanzare la sequenza di `delta` secondi con i tasti premuti in questo
 * frame. Restituisce l'esito del prompt appena risolto, se ce n'è uno.
 * Tasto giusto nella finestra = `hit`; tasto sbagliato o finestra scaduta = `miss`.
 */
export function updateQte(qte: QteState, delta: number, pressed: string[]): QteEvent | null {
  if (isQteFinished(qte)) return null;

  if (qte.gapLeft > 0) {
    qte.gapLeft = Math.max(0, qte.gapLeft - delta);
    // Le pressioni durante la pausa non contano (né come errore).
    return null;
  }

  qte.t += delta;
  let result: QteResult | null = null;
  if (pressed.length > 0) result = pressed.includes(qte.keys[qte.index]) ? 'hit' : 'miss';
  else if (qte.t >= qte.windows[qte.index]) result = 'miss';
  if (!result) return null;

  const event: QteEvent = { index: qte.index, result };
  qte.results[qte.index] = result;
  qte.index += 1;
  qte.t = 0;
  qte.gapLeft = qte.gap;
  return event;
}

export function countMisses(qte: QteState): number {
  return qte.results.filter((result) => result === 'miss').length;
}
