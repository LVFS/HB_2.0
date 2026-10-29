import gsap from 'gsap';
import { create } from 'zustand';
import { inputManager } from '@/input/inputManager';

interface PauseState {
  paused: boolean;
  setPaused: (paused: boolean) => void;
}

/**
 * Pausa del gioco (solo mentre `screen === 'game'`). Fermare il gioco vuol dire tre cose, tutte qui: il tempo di GSAP (camere,
 * cutscene, effetti), l'input (il gestore smette di dare le pressioni al gioco) e i `<Canvas>` (`GameCanvas` legge `paused` e
 * passa a `frameloop="never"`: nessun `useFrame` gira). I timer `setTimeout` delle scene non si fermano: sono pochi e brevi.
 */
export const usePauseStore = create<PauseState>((set, get) => ({
  paused: false,
  setPaused: (paused) => {
    if (get().paused === paused) return;
    gsap.globalTimeline.paused(paused);
    inputManager.setSuspended(paused);
    set({ paused });
  }
}));

export const isPaused = (): boolean => usePauseStore.getState().paused;
