import type { DialogueLine } from '@/data/dialogues/level1_intro';

/**
 * Cutscene da storyboard (FASE 11, «motion comic»): una sequenza di BEAT, ognuno è un disegno a tutto schermo con un movimento di
 * camera (pan/zoom), effetti e, se serve, battute in sovrimpressione. Sono SOLO DATI: cambiare una battuta, un tempo o una
 * camera non richiede di toccare il componente. I tipi stanno in `data/` (e non in `game/`) perché il flusso è `data/ → game/`.
 */

/** Un'inquadratura: spostamento dell'immagine in % delle dimensioni dello schermo (x>0 = a destra, y>0 = in basso) e ingrandimento (≥ 1). */
export interface CutsceneView {
  x: number;
  y: number;
  scale: number;
}

/**
 * Effetti: `shake` (scossa), `flash` (lampo bianco), `whiteout` (si sfuma al bianco e ci si resta), `dim` (scurisce il disegno per tutto il beat).
 * Con `fx` partono all'inizio del beat; con `fxEnd` alla fine (dopo le battute), prima di passare al successivo.
 */
export type CutsceneFx = 'shake' | 'flash' | 'whiteout' | 'dim';

export interface CutsceneBeat {
  /** Nome del file in `public/cutscenes/<cartella>/`. */
  image: string;
  /** Secondi di permanenza se non ci sono battute (predefinito 2.5). */
  hold?: number;
  /** Movimento di camera: da → a, in `duration` secondi (predefinito: quanto dura il beat) con l'ease GSAP indicato. */
  camera?: { from: CutsceneView; to: CutsceneView; duration?: number; ease?: string };
  /** Se presenti, il beat aspetta che finiscano (un tasto per riga). */
  lines?: DialogueLine[];
  fx?: CutsceneFx[];
  fxEnd?: CutsceneFx[];
  /** Id di un effetto sonoro (`useSfx`): se il file manca, silenzio e nessun errore. */
  sfx?: string;
  /** Taglio secco invece della dissolvenza breve dal beat precedente. */
  cut?: boolean;
  /** `cover` (predefinito, riempie lo schermo) o `contain` (mostra il disegno intero, con bande nere). */
  fit?: 'cover' | 'contain';
  /** Con `cover`, quale parte del disegno resta in vista quando viene ritagliato (% da sinistra e dall'alto; predefinito 50/50): per i disegni quasi quadrati. */
  focus?: { x?: number; y?: number };
}

export interface CutsceneSet {
  id: string;
  /** Cartella dentro `public/cutscenes/`. */
  folder: string;
  beats: CutsceneBeat[];
}

/** `intro_level1` e `preboss_sala1` sono video; `postboss` è uno storyboard (`preboss` non esiste più: lo ha sostituito il video). */
export type CutsceneId = 'intro_level1' | 'preboss_sala1' | 'postboss';

/** Una cinematica video: file in `public/` (percorsi relativi a `BASE_URL`) e sottotitoli WebVTT. */
export interface CutsceneVideo {
  src: string;
  /** File `.vtt` dei sottotitoli italiani. */
  subtitles?: string;
}

/** Una cutscene nel registro: un video OPPURE uno storyboard (`CutscenePlayer` sceglie in base a cosa c'è). */
export interface CutsceneEntry {
  storyboard?: CutsceneSet;
  video?: CutsceneVideo;
}
