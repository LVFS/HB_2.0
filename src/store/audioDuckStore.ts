import { create } from 'zustand';

interface AudioDuckState {
  /** Moltiplicatore applicato al volume della musica, 0-1. `1` = nessun
   * abbassamento. Non persistito: è uno stato di sessione, azzerato a ogni
   * ricarica come `collectedFragmentIds` in `gameStore`. */
  duck: number;
  setDuck: (value: number) => void;
}

/**
 * Canale condiviso per il "ducking" della musica: un quadro può chiedere
 * di abbassarla temporaneamente quando un suo sfx deve sentirsi sopra lo
 * stinger di sottofondo (`useBirthdayMusic` legge `duck` e lo applica),
 * senza che il quadro debba conoscere l'istanza Howler della musica — che
 * vive in `BirthdayScene`, un albero di componenti più in alto. Nato per
 * `ExpeditionTableau` (il "colpo" di `simon_erase.mp3` è già al volume
 * massimo possibile, sia lato Howler sia lato file: l'unico margine
 * rimasto è abbassare la musica, non alzare ulteriormente l'sfx), ma
 * riutilizzabile da qualunque altro quadro abbia lo stesso problema.
 */
export const useAudioDuckStore = create<AudioDuckState>((set) => ({
  duck: 1,
  setDuck: (value) => set({ duck: value })
}));
