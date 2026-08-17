import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProgressState {
  /** Id dei livelli completati: mai un contatore, evita di contare due volte
   * lo stesso completamento (stessa regola di `collectedFragmentIds` in
   * `gameStore.ts`). Persistito: a differenza di `gameStore`, questo deve
   * sopravvivere alla chiusura del browser. */
  completedLevelIds: string[];
  completeLevel: (levelId: string) => void;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      completedLevelIds: [],
      completeLevel: (levelId) =>
        set((state) =>
          state.completedLevelIds.includes(levelId)
            ? state
            : { completedLevelIds: [...state.completedLevelIds, levelId] }
        )
    }),
    { name: 'epic-birthday-progress' }
  )
);
