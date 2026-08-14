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
  /** Volo di camera iniziale: il pulsante Gioca è ancora disabilitato. */
  | 'intro'
  /** Muro intatto, in attesa del click. */
  | 'ready'
  /** Timeline in corso: camera, audio e fisica dei detriti. */
  | 'breaking';
