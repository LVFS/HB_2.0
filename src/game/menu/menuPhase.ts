/**
 * Le fasi della schermata iniziale.
 *
 * Vive in un file suo, e non dentro MenuScene, perché lo condividono la scena
 * 3D e l'overlay HTML: metterlo in uno dei due creerebbe una dipendenza
 * fittizia dell'altro.
 *
 * Perché NON sta in Zustand: questo stato non sopravvive alla schermata.
 * Uscendo dal menu non deve restare niente. La regola che seguiamo è
 * "in Zustand solo ciò che più componenti lontani devono condividere, o che
 * deve durare oltre lo schermo corrente"; qui i componenti sono due e sono
 * fratelli, quindi lo stato sta nel loro genitore e scende come prop.
 */
export type MenuPhase =
  /** Volo di camera iniziale: una pressione qualsiasi lo salta (vedi `useAnyInput`). */
  | 'intro'
  /** Muro intatto, "Premi un tasto per iniziare" a schermo. */
  | 'ready'
  /**
   * Sequenza cinematica del personaggio (piede, volto, battuta, si gira verso
   * il muro, video del salto): precede `breaking`, che parte da qui
   * esattamente nel fotogramma dell'impatto — vedi `CharacterIntro.tsx` e
   * `characterConfig.ts`.
   */
  | 'punching'
  /** Timeline in corso: camera, audio e fisica dei detriti. */
  | 'breaking';
