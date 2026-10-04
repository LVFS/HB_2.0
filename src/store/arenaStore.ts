import { create } from 'zustand';

/** Sfondi dell'arena: lo schermo del cinema mostra il film "in corso". */
export type ArenaBackdropId = 'sala' | 'buen_camino' | 'altro_film' | 'bloodborne';

/** Una carta della schermata di scelta del potenziamento. */
export interface PowerUpOption {
  id: string;
  label: string;
  description: string;
}

/** Scritta (poi video) mostrata a tutto schermo dopo la scelta. */
export interface PowerUpIntro {
  title: string;
  subtitle: string;
  /** Se presente, al posto della scritta parte questo video (tollerante se manca). */
  videoSrc?: string;
}

interface ArenaHudState {
  playerHp: number;
  playerHpMax: number;
  bossHp: number;
  bossHpMax: number;
  bossPosture: number;
  bossPostureMax: number;
  healsLeft: number;
  /** Barra abilità 0-100. */
  skill: number;
  /** Oggetti del Buen Camino ancora in piedi (> 0 = Checco invulnerabile). */
  totemsLeft: number;
  /** Progresso del braccio di ferro del contrasto (0-1), o null se non in corso. */
  clash: number | null;
  round: 1 | 2;
  backdrop: ArenaBackdropId;
  /** Contatore, non booleano: ogni incremento fa scattare un flash bianco. */
  flash: number;
  /** Testo grande al centro ("Round 2", "AVVIA IL FILM!"), o null. */
  message: string | null;
  /** Sotto-riga di aiuto sotto il messaggio, o null. */
  hint: string | null;
  evePromptVisible: boolean;
  /** Nome del potenziamento attivo (null = equipaggiamento base). */
  powerUp: string | null;
  /** Furia 0-100 (loadout con berserk), berserk in corso e moltiplicatore a catena. */
  rage: number;
  berserk: boolean;
  combo: number;
  /** Schermata di scelta: opzioni offerte (null = nessuna scelta in corso) e scelta fatta. */
  powerUpChoice: PowerUpOption[] | null;
  powerUpPicked: string | null;
  powerUpIntro: PowerUpIntro | null;
  set: (patch: Partial<Omit<ArenaHudState, 'set' | 'reset' | 'triggerFlash'>>) => void;
  triggerFlash: () => void;
  reset: (playerHpMax: number, bossHpMax: number, bossPostureMax: number) => void;
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
  bossPostureMax: 100,
  healsLeft: 3,
  skill: 0,
  totemsLeft: 0,
  clash: null,
  round: 1,
  backdrop: 'sala',
  flash: 0,
  message: null,
  hint: null,
  evePromptVisible: false,
  powerUp: null,
  rage: 0,
  berserk: false,
  combo: 1,
  powerUpChoice: null,
  powerUpPicked: null,
  powerUpIntro: null,
  set: (patch) => set(patch),
  triggerFlash: () => set((state) => ({ flash: state.flash + 1 })),
  reset: (playerHpMax, bossHpMax, bossPostureMax) =>
    set({
      playerHp: playerHpMax,
      playerHpMax,
      bossHp: bossHpMax,
      bossHpMax,
      bossPosture: 0,
      bossPostureMax,
      healsLeft: 3,
      skill: 0,
      totemsLeft: 0,
      clash: null,
      round: 1,
      backdrop: 'sala',
      message: null,
      hint: null,
      evePromptVisible: true,
      powerUp: null,
      rage: 0,
      berserk: false,
      combo: 1,
      powerUpChoice: null,
      powerUpPicked: null,
      powerUpIntro: null
    })
}));
