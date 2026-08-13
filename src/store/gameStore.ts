import { create } from 'zustand';

export type ScreenState = 'menu' | 'levelSelect' | 'game';

interface GameState {
  screen: ScreenState;
  /** Id dei frammenti già raccolti: evita di contare due volte lo stesso. */
  collectedFragmentIds: string[];
  selectedLevel: string | null;
  setScreen: (screen: ScreenState) => void;
  setSelectedLevel: (levelId: string | null) => void;
  collectFragment: (fragmentId: string) => void;
  resetProgress: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  screen: 'menu',
  collectedFragmentIds: [],
  selectedLevel: null,
  setScreen: (screen) => set({ screen }),
  setSelectedLevel: (levelId) => set({ selectedLevel: levelId }),
  collectFragment: (fragmentId) =>
    set((state) =>
      state.collectedFragmentIds.includes(fragmentId)
        ? state
        : { collectedFragmentIds: [...state.collectedFragmentIds, fragmentId] }
    ),
  resetProgress: () => set({ collectedFragmentIds: [] })
}));
