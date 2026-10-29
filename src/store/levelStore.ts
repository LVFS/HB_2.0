import { create } from 'zustand';
import type { CutsceneId } from '@/data/cutscenes/types';
import { LEVEL1_TRIGGERS_PLACEHOLDER } from '@/data/level1/triggers';
import { useRunStatsStore } from './runStatsStore';

// Macchina a stati del Livello 1 (Fase 4 del piano, vedi
// docs/PIANO_LIVELLO1_2D.md) — stessa lista già concordata nel piano
// originale. Molte fasi non hanno ancora contenuto vero (vedi
// `PlaceholderPhase` in `SceneManager2D.tsx`): esistono già nel tipo perché
// il compilatore blocchi se `SceneManager2D` dimentica di gestirne una,
// stesso principio di `BreakVariant` in `wallConfig.ts`.
export type LevelPhase =
  | 'intro_dialogo'
  | 'cammino_libero_ariston'
  | 'attivita_stupide'
  | 'dialogo_pre_boss'
  | 'boss_fase1'
  | 'transizione_seconda_spada'
  | 'boss_fase2_tunnel'
  | 'combo_doppia_spada_qte'
  | 'fuga_checco'
  | 'inseguimento_spaziale_cutscene'
  | 'qte_supporto_eve'
  | 'carica_cannone_qte'
  | 'dialogo_finale'
  | 'schermata_punteggio';

const INITIAL_PHASE: LevelPhase = 'intro_dialogo';

/** Esito del tunnel (`boss_fase2_tunnel` + `combo_doppia_spada_qte`): letto dalle fasi successive. */
export interface TunnelResult {
  /** Distanza da Checco a fine corsa (0 = raggiunto, 100 = sparito). */
  gapEnd: number;
  /** Quanto è riuscita la raffica a doppia spada, da 0 a 1. */
  barrageScore: number;
}

/** Esito dello spazio (`qte_supporto_eve` + `carica_cannone_qte`), entrambi da 0 a 1: cambia due righe del dialogo finale. */
export interface SpaceResult {
  /** Quanti tasti del supporto a Eve sono riusciti. */
  support: number;
  /** Carica del cannone raggiunta (a tempo scaduto sale comunque al minimo, ma qui resta il valore vero). */
  cannon: number;
}

interface LevelState {
  phase: LevelPhase;
  setPhase: (next: LevelPhase) => void;
  /** Dove riappare D in `SceneManager2D` (modo laterale) la prossima volta
   *  che monta — necessario perché quel componente SMONTA del tutto mentre
   *  `SceneManager2DIso` (interno isometrico) è attivo: il suo
   *  `playerPositionRef` è un `useRef` locale, che al remount ripartirebbe
   *  sempre da `eveArrivalX` senza un valore che sopravviva fuori da lui.
   *  Aggiornato da `SceneManager2DIso` appena prima di uscire dall'edificio
   *  (vedi `aristonExitX` in `data/level1/triggers.ts`). */
  lateralSpawnX: number;
  setLateralSpawnX: (x: number) => void;
  /** Esito del QTE cooperativo del finale del boss (null = non ancora giocato):
   *  cambia una riga del dialogo nel Sotterraneo e, quando esisterà
   *  `boss_fase2_tunnel`, un piccolo bonus/malus di partenza. */
  finalQteSuccess: boolean | null;
  setFinalQteSuccess: (success: boolean | null) => void;
  /** Esito del tunnel (distanza finale dalla marionetta e punteggio della raffica), o null. */
  tunnelResult: TunnelResult | null;
  setTunnelResult: (result: TunnelResult | null) => void;
  /** Cutscene già viste in QUESTA partita (una volta sola a partita; azzerato da `resetLevel()`). */
  seenCutscenes: CutsceneId[];
  markCutsceneSeen: (id: CutsceneId) => void;
  /** Esito dello spazio (supporto a Eve e cannone), o null. */
  spaceResult: SpaceResult | null;
  setSpaceResult: (result: SpaceResult | null) => void;
}

const INITIAL_LATERAL_SPAWN_X: number = LEVEL1_TRIGGERS_PLACEHOLDER.eveArrivalX;

/**
 * Stato del livello IN CORSO — separato da `gameStore.ts` (fase/schermata
 * GLOBALE, valida anche nel menu/selezione livelli): questo esiste solo
 * mentre si gioca un livello, stesso principio di `MenuPhase` per il menu.
 * `SceneManager2D` legge `phase` per decidere cosa montare; i componenti di
 * fase lo cambiano solo chiamando `setPhase`, mai scrivendolo a mano.
 */
export const useLevelStore = create<LevelState>((set) => ({
  phase: INITIAL_PHASE,
  setPhase: (next) => set({ phase: next }),
  lateralSpawnX: INITIAL_LATERAL_SPAWN_X,
  setLateralSpawnX: (x) => set({ lateralSpawnX: x }),
  finalQteSuccess: null,
  setFinalQteSuccess: (success) => set({ finalQteSuccess: success }),
  tunnelResult: null,
  setTunnelResult: (result) => set({ tunnelResult: result }),
  seenCutscenes: [],
  markCutsceneSeen: (id) => set((state) => (state.seenCutscenes.includes(id) ? state : { seenCutscenes: [...state.seenCutscenes, id] })),
  spaceResult: null,
  setSpaceResult: (result) => set({ spaceResult: result })
}));

/**
 * Riporta il livello al suo inizio — richiamato da `gameStore.resetProgress`
 * al lancio/rilancio di un livello da `LevelSelectScene` (vedi il commento
 * lì): senza, rigiocare un livello già completato ripartirebbe dall'ultima
 * fase raggiunta invece che da `intro_dialogo`.
 */
export function resetLevel(): void {
  useLevelStore.setState({
    phase: INITIAL_PHASE,
    lateralSpawnX: INITIAL_LATERAL_SPAWN_X,
    finalQteSuccess: null,
    tunnelResult: null,
    seenCutscenes: [],
    spaceResult: null
  });
  // Nuova run: statistiche del punteggio azzerate e cronometro riavviato.
  useRunStatsStore.getState().reset();
}
