/**
 * Percorsi dei due modelli del personaggio, esportati da Blender con +Y Up
 * (stessa convenzione di `wallConfig.ts`): `x3 = xB`, `y3 = zB` (altezza),
 * `z3 = -yB` (profondità).
 *
 * Entrambi sono mesh statiche cotte (niente skin/scheletro — vedi
 * "Pipeline Blender" in CLAUDE.md sul perché): tutto il moto della sequenza
 * è camera/GSAP su questi due, non un mixer di animazioni.
 */
export const BASE_MODEL_URL = `${import.meta.env.BASE_URL}models/personaggio-base.glb`;
export const JAB_MODEL_URL = `${import.meta.env.BASE_URL}models/personaggio-jab.glb`;

/**
 * Video del salto finale (clip live-action/anime), mostrato a schermo intero
 * al posto della scena 3D per `SAITAMA_TIMING.leapVideo` secondi — vedi
 * `CharacterIntro.tsx` (`onLeapVideo`) e `MenuScene.tsx` (l'elemento
 * `<video>` vero e proprio: non può stare dentro `<Canvas>`).
 *
 * Il file NON è ancora nel repository: finché non lo aggiungi qui
 * (`public/video/saitama-run-punch.mp4`), l'overlay resta invisibile e la
 * sequenza prosegue senza interruzioni — stesso trattamento tollerante di
 * `useSfx` per gli MP3 assenti.
 */
export const LEAP_VIDEO_URL = `${import.meta.env.BASE_URL}video/saitama-run-punch.mp4`;

/**
 * Una "intro variant" è l'equivalente di `BreakVariant` (`wallConfig.ts`) ma
 * per la sequenza cinematica che precede la rottura: quale personaggio/
 * coreografia usare. Per ora il pool ha una sola voce ("saitama"), ma la
 * selezione è già strutturata come scelta casuale da un pool — aggiungerne
 * una nuova in futuro è aggiungere una voce a `INTRO_VARIANTS`, non
 * ristrutturare la logica.
 */
export type IntroVariant = 'saitama';

export const INTRO_VARIANTS: readonly IntroVariant[] = ['saitama'] as const;

export function randomIntroVariant(): IntroVariant {
  const index = Math.floor(Math.random() * INTRO_VARIANTS.length);
  return INTRO_VARIANTS[index];
}

/**
 * Timing della sequenza "saitama", in secondi dall'inizio della timeline.
 * Ogni fase della timeline GSAP legge da qui, così cambiare un numero non
 * richiede toccare il codice che orchestra le fasi.
 */
export const SAITAMA_TIMING = {
  /** Stacco basso e stretto sul piede. */
  footHold: 1.1,
  /** La camera sale/si allontana per rivelare il volto (faccia "scema"). */
  faceReveal: 1.6,
  /** Il personaggio gira leggermente la testa: momento della battuta. */
  headTurn: 1.4,
  /** Swap di texture: da faccia "scema" a faccia "seria". */
  expressionSwap: 0.35,
  /** Anticipazione: breve caricamento del colpo prima del taglio al video. */
  windUp: 0.3,
  /**
   * Il salto: quanto resta a schermo il video (`LEAP_VIDEO_URL`) se esiste,
   * o quanto tempo passa comunque prima dell'impatto se manca — misura la
   * durata reale della clip e aggiorna questo numero quando il file
   * cambia, stesso approccio di `VARIANT_IMPACT_DELAY.punch`. Sostituisce
   * per intero lo scatto in 3D verso il muro: con solo due pose statiche
   * (niente scheletro/mixer) una traslazione si legge sempre come un
   * pattinare sul ghiaccio, qualunque trucco di camera ci si metta sopra —
   * il "come" il personaggio arriva al muro lo racconta il video, non la
   * scena 3D. Vedi `CharacterIntro.tsx`.
   */
  leapVideo: 1.3,
  /**
   * Istante dell'impatto — stesso ruolo di `VARIANT_IMPACT_DELAY.punch` in
   * `wallConfig.ts`, ma qui è quando il PUGNO tocca il muro, non quando la
   * fisica dei detriti parte: i due si sincronizzano nel punto di aggancio
   * (vedi `CharacterIntro.tsx`), non sono lo stesso numero per caso.
   */
  impact: 0.15,
  /** Il personaggio entra nel varco appena aperto. */
  enterGap: 0.6
} as const;

/** Durata totale della sequenza, utile per dimensionare la timeline GSAP. */
export const SAITAMA_TOTAL_DURATION = Object.values(SAITAMA_TIMING).reduce(
  (sum, value) => sum + value,
  0
);
