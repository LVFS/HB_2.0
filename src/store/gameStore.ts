import { create } from 'zustand';

export type ScreenState = 'menu' | 'levelSelect' | 'game';

export interface LevelInfo {
  id: string;
  name: string;
  description: string;
  position: [number, number, number];
  color: string;
}

interface GameState {
  screen: ScreenState;
  fragmentsFound: number;
  selectedLevel: string | null;
  levels: LevelInfo[];
  setScreen: (screen: ScreenState) => void;
  setSelectedLevel: (levelId: string | null) => void;
  addFragment: () => void;
  resetProgress: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  screen: 'menu',
  fragmentsFound: 0,
  selectedLevel: null,
  levels: [
    {
      id: 'forest',
      name: 'Bosco delle Luci',
      description: 'Una valle incantata tra alberi luminescenti e antiche rovine.',
      position: [-6, 0, -3],
      color: '#86efac'
    },
    {
      id: 'cliff',
      name: 'Falesia Ventosa',
      description: 'Un altopiano battuto dal vento con punti panoramici e segreti.',
      position: [3, 0, -5],
      color: '#7dd3fc'
    },
    {
      id: 'flame',
      name: 'Pianura Fiammeggiante',
      description: 'Una distesa bruciata dove il fuoco guida il percorso.',
      position: [6, 0, 4],
      color: '#fb7185'
    }
  ],
  setScreen: (screen) => set({ screen }),
  setSelectedLevel: (levelId) => set({ selectedLevel: levelId }),
  addFragment: () => set((state) => ({ fragmentsFound: Math.min(5, state.fragmentsFound + 1) })),
  resetProgress: () => set({ fragmentsFound: 0 }),
  resetGame: () => set({ fragmentsFound: 0, screen: 'menu', selectedLevel: null })
}));
