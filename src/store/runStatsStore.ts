import { create } from 'zustand';

/** Esiti dei QTE di tutto il livello: `null` = non ancora giocato (o saltato in sviluppo), mai contato come zero. */
export interface RunQteStats {
  /** QTE cooperativo del finale del boss: riuscito o no. */
  bossCoop: boolean | null;
  /** Raffica a doppia spada nel tunnel, da 0 a 1. */
  barrage: number | null;
  /** QTE di supporto a Eve nello spazio, da 0 a 1. */
  support: number | null;
  /** Carica del cannone raggiunta, da 0 a 1. */
  cannon: number | null;
}

interface RunStatsState {
  /** `Date.now()` dell'inizio della run, o null se non è partita (scorciatoie dev). */
  startedAt: number | null;
  finishedAt: number | null;
  /** Colpi che hanno fatto danno a D (arena e tunnel): il punto unico è `hitPlayer` in `combat.ts`. */
  hitsTaken: number;
  qte: RunQteStats;
  /** Cose curiose trovate, per id univoco (mai un contatore: la stessa cosa non conta due volte). */
  curiosities: string[];
  /** Attività secondarie nel cinema completate, per id univoco (vedi `ACTIVITY_DEFINITIONS`). */
  activities: string[];
  finish: () => void;
  addHit: () => void;
  setQte: (patch: Partial<RunQteStats>) => void;
  addCuriosity: (id: string) => void;
  completeActivity: (id: string) => void;
  reset: () => void;
}

const EMPTY_QTE: RunQteStats = { bossCoop: null, barrage: null, support: null, cannon: null };

/**
 * Statistiche della run in corso (alimentano `computeScore`). NON persistite: sono di una partita sola e si
 * azzerano da `resetLevel()` a ogni lancio del livello. Stesso principio di `levelStore`: lo scrive chi ha visto
 * accadere la cosa, lo legge la schermata del punteggio.
 */
export const useRunStatsStore = create<RunStatsState>((set) => ({
  startedAt: null,
  finishedAt: null,
  hitsTaken: 0,
  qte: { ...EMPTY_QTE },
  curiosities: [],
  activities: [],
  finish: () => set((state) => (state.finishedAt === null ? { finishedAt: Date.now() } : state)),
  addHit: () => set((state) => ({ hitsTaken: state.hitsTaken + 1 })),
  setQte: (patch) => set((state) => ({ qte: { ...state.qte, ...patch } })),
  addCuriosity: (id) => set((state) => (state.curiosities.includes(id) ? state : { curiosities: [...state.curiosities, id] })),
  completeActivity: (id) => set((state) => (state.activities.includes(id) ? state : { activities: [...state.activities, id] })),
  reset: () =>
    set({
      startedAt: Date.now(),
      finishedAt: null,
      hitsTaken: 0,
      qte: { ...EMPTY_QTE },
      curiosities: [],
      activities: []
    })
}));

/** Scorciatoie di scrittura per chi non sta in un componente (moduli di simulazione senza React). */
export const recordHit = (): void => useRunStatsStore.getState().addHit();
export const addCuriosity = (id: string): void => useRunStatsStore.getState().addCuriosity(id);
export const completeActivity = (id: string): void => useRunStatsStore.getState().completeActivity(id);
