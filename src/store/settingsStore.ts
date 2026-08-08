import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  volume: number;
  toggleMusic: () => void;
  toggleSfx: () => void;
  setVolume: (value: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      musicEnabled: true,
      sfxEnabled: true,
      volume: 0.7,
      toggleMusic: () => set((state) => ({ musicEnabled: !state.musicEnabled })),
      toggleSfx: () => set((state) => ({ sfxEnabled: !state.sfxEnabled })),
      setVolume: (value) => set({ volume: value })
    }),
    {
      name: 'epic-birthday-settings',
      partialize: (state) => ({ musicEnabled: state.musicEnabled, sfxEnabled: state.sfxEnabled, volume: state.volume })
    }
  )
);
