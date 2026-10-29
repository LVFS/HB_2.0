import { create } from 'zustand';

interface UiState {
  /** Pannello delle impostazioni aperto (menu e selezione livelli: lo si apre anche col pad, con Options). */
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open })
}));
