import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Icone dei comandi: `auto` segue l'ultimo dispositivo usato; gli altri valori le forzano. */
export type GlyphSetting = 'auto' | 'xbox' | 'playstation' | 'switch' | 'keyboard';
export const GLYPH_SETTINGS: readonly GlyphSetting[] = ['auto', 'xbox', 'playstation', 'switch', 'keyboard'];

interface SettingsState {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  volume: number;
  glyphs: GlyphSetting;
  /** Vibrazione del controller (solo dove il browser la supporta). */
  rumble: boolean;
  toggleMusic: () => void;
  toggleSfx: () => void;
  setVolume: (value: number) => void;
  setGlyphs: (value: GlyphSetting) => void;
  toggleRumble: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      musicEnabled: true,
      sfxEnabled: true,
      volume: 0.7,
      toggleMusic: () => set((state) => ({ musicEnabled: !state.musicEnabled })),
      toggleSfx: () => set((state) => ({ sfxEnabled: !state.sfxEnabled })),
      setVolume: (value) => set({ volume: value }),
      glyphs: 'auto',
      rumble: true,
      setGlyphs: (value) => set({ glyphs: value }),
      toggleRumble: () => set((state) => ({ rumble: !state.rumble }))
    }),
    {
      name: 'epic-birthday-settings',
      partialize: (state) => ({
        musicEnabled: state.musicEnabled,
        sfxEnabled: state.sfxEnabled,
        volume: state.volume,
        glyphs: state.glyphs,
        rumble: state.rumble
      })
    }
  )
);
