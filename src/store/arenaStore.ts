import { create } from 'zustand';

/** Sfondi dell'arena: lo schermo del cinema mostra il film "in corso". */
export type ArenaBackdropId = 'sala' | 'buen_camino' | 'altro_film';

interface ArenaHudState {
  playerHp: number;
  playerHpMax: number;
  bossHp: number;
  bossHpMax: number;
  bossPosture: number;
  healsLeft: number;
  /** Barra abilità 0-100. */
  skill: number;
  round: 1 | 2;
  backdrop: ArenaBackdropId;
  /** Contatore, non booleano: ogni incremento fa scattare un flash bianco. */
  flash: number;
  /** Testo grande al centro ("Round 2", "AVVIA IL FILM!"), o null. */
  message: string | null;
  /** Sotto-riga di aiuto sotto il messaggio, o null. */
  hint: string | null;
  evePromptVisible: boolean;
  set: (patch: Partial<Omit<ArenaHudState, 'set' | 'reset' | 'triggerFlash'>>) => void;
  triggerFlash: () => void;
  reset: (playerHpMax: number, bossHpMax: number) => void;
}

/**
 * Stato dell'arena che la UI HTML deve mostrare (barre vita/postura, messaggi,
 * sfondo): cambia solo agli EVENTI (un colpo, un cambio round), mai a ogni
 * frame — i valori per-frame vivono nell'`ArenaWorld` (ref) e questo store ne
 * riceve una copia arrotondata. Vive in `store/` perché `components/` non deve
 * importare da `game/` (flusso dati `data/ → store/ → game/ e components/`).
 */
export const useArenaStore = create<ArenaHudState>((set) => ({
  playerHp: 100,
  playerHpMax: 100,
  bossHp: 100,
  bossHpMax: 100,
  bossPosture: 0,
  healsLeft: 3,
  skill: 0,
  round: 1,
  backdrop: 'sala',
  flash: 0,
  message: null,
  hint: null,
  evePromptVisible: false,
  set: (patch) => set(patch),
  triggerFlash: () => set((state) => ({ flash: state.flash + 1 })),
  reset: (playerHpMax, bossHpMax) =>
    set({
      playerHp: playerHpMax,
      playerHpMax,
      bossHp: bossHpMax,
      bossHpMax,
      bossPosture: 0,
      healsLeft: 3,
      skill: 0,
      round: 1,
      backdrop: 'sala',
      message: null,
      hint: null,
      evePromptVisible: true
    })
}));
