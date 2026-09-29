import { create } from 'zustand';
import { resetLevel } from './levelStore';

export type ScreenState = 'menu' | 'levelSelect' | 'game';

interface GameState {
  screen: ScreenState;
  selectedLevel: string | null;
  setScreen: (screen: ScreenState) => void;
  setSelectedLevel: (levelId: string | null) => void;
  /** Azzera lo stato di avanzamento specifico di un livello prima di
   * (ri)iniziarlo — chiamato da `LevelSelectScene` al lancio. Riporta
   * `levelStore` a `intro_dialogo` (Fase 4 del piano, vedi
   * docs/PIANO_LIVELLO1_2D.md): senza, rigiocare un livello già iniziato
   * ripartirebbe dall'ultima fase raggiunta invece che dall'inizio. */
  resetProgress: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  screen: 'menu',
  selectedLevel: null,
  setScreen: (screen) => set({ screen }),
  setSelectedLevel: (levelId) => set({ selectedLevel: levelId }),
  resetProgress: () => resetLevel()
}));
