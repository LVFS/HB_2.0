import { create } from 'zustand';
import { LEVEL1_TRIGGERS_PLACEHOLDER } from '@/data/level1/triggers';

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
  setLateralSpawnX: (x) => set({ lateralSpawnX: x })
}));

/**
 * Riporta il livello al suo inizio — richiamato da `gameStore.resetProgress`
 * al lancio/rilancio di un livello da `LevelSelectScene` (vedi il commento
 * lì): senza, rigiocare un livello già completato ripartirebbe dall'ultima
 * fase raggiunta invece che da `intro_dialogo`.
 */
export function resetLevel(): void {
  useLevelStore.setState({ phase: INITIAL_PHASE, lateralSpawnX: INITIAL_LATERAL_SPAWN_X });
}
