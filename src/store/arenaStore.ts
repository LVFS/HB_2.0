import { create } from 'zustand';

/** Sfondi dell'arena: lo schermo del cinema mostra il film "in corso". */
export type ArenaBackdropId = 'sala' | 'buen_camino' | 'altro_film' | 'bloodborne';

/** Cosa mostra `QteChallenge`: la sequenza di tasti e a che punto è. */
export interface QteView {
  keys: string[];
  /** Prompt corrente (== keys.length quando finita). */
  index: number;
  results: ('hit' | 'miss' | null)[];
  /** Finestra, in secondi, del prompt corrente (dura l'animazione della barra). */
  windowSeconds: number;
  /** In pausa fra un prompt e l'altro: nessun prompt attivo. */
  waiting: boolean;
  /** Etichetta in testa (es. "Colpite insieme!"). */
  title: string;
}

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

/** Un bonus del tunnel con un timer: `pct` = quanto ne resta (0-100). */
export interface TunnelHudBuff {
  id: string;
  label: string;
  pct: number;
  /** Un malus (frenato, rallentato): la HUD lo mostra in rosso. */
  bad?: boolean;
}

/** Il bonus nella casella del tunnel (si usa con `E`). `icon` è un'immagine già pronta (data URL). */
export interface TunnelHudSlot {
  id: string;
  label: string;
  icon: string;
}

/** Cosa mostra la HUD del tunnel oltre alla distanza: Slancio, Sfere del Drago, casella bonus, bonus attivi, tempo. */
export interface TunnelHudStatus {
  slancio: number;
  slancioMax: number;
  /** Velocità in più rispetto alla base per il livello di Slancio attuale (%). */
  speedPct: number;
  spheres: number;
  spheresMax: number;
  slot: TunnelHudSlot | null;
  buffs: TunnelHudBuff[];
  /** Secondi rimasti al tempo limite. */
  timeLeft: number;
  /** La marionetta è fuori dallo schermo: la HUD mostra l'indicatore con i metri. */
  offscreen: boolean;
  /** Buio (0-100, a passi del 10%) e dove sta D sullo schermo in orizzontale (%), per il cerchio di luce; abbagliamenti dei paparazzi (contatore). */
  dark: number;
  darkX: number;
  blind: number;
  /** L'onda di Checco in arrivo: quanti metri mancano e in quali vie (indici da 0 = la più lontana). Null = nessuna. */
  threat: { meters: number; lanes: number[] } | null;
  /** Stili permanenti avuti (etichette) e, se si può volare, la carica del volo (%, a passi del 10%). */
  perks: string[];
  flight: number | null;
  /** In sella al gatto: affetto e fame (%, a passi del 5%). Null = niente gatto. */
  cat: { affection: number; hunger: number } | null;
  /** Desideri di Shenron: i permanenti avuti (nome breve), gli Istinti rimasti e gli Zoltraak di riserva (Q). */
  wishes: { owned: string[]; instinct: number; reserve: number };
  /** Modalità in corso (Buen Camino / shonen): quanto ne resta (%) e se è il finale. */
  mode: { id: 'camino' | 'anime'; pct: number; finale: boolean } | null;
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
  /** Titolo della schermata di scelta (null = quello di default). Nel tunnel serve ai desideri di Shenron. */
  powerUpChoiceTitle: string | null;
  /** QTE in corso (null = nessuno). */
  qte: QteView | null;
  /** Tunnel: distanza dalla marionetta 0-100 (null = fuori dal tunnel). */
  tunnelGap: number | null;
  /** Tunnel: Slancio, Sfere, bonus attivi (null = fuori dal tunnel). */
  tunnelStatus: TunnelHudStatus | null;
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
  powerUpChoiceTitle: null,
  qte: null,
  tunnelGap: null,
  tunnelStatus: null,
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
      powerUpIntro: null,
      powerUpChoiceTitle: null,
      qte: null,
      tunnelGap: null,
      tunnelStatus: null
    })
}));
