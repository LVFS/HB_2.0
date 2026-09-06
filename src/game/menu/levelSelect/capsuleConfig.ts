/**
 * Timing della sequenza capsula (Parte E del piano "Stellar Blade"), in
 * secondi dall'avvio. Non ci si affida al tempo assoluto codificato nei
 * singoli clip esportati da Blender per la sincronia tra `Capsule_Descent`,
 * `Shockwave_Pulse` e `ImpactDust_*_Puff` (ognuno è la propria action, con
 * la propria origine dei tempi): il codice fa partire onda d'urto/polvere/
 * flash/shake esplicitamente a `impact` secondi dall'inizio, stesso
 * approccio di `SAITAMA_TIMING` in `characterConfig.ts`. Il moto della
 * capsula stessa (discesa + schiacciamento) resta invece internamente
 * sincronizzato per costruzione, perché fa parte di un'unica action.
 */
export const CAPSULE_TIMING = {
  /** Istante dell'impatto — quando la capsula tocca terra, misurato sul
   * fotogramma 22 di `Capsule_Descent` a 24fps (frame Blender di default). */
  impact: 0.9,
  /** Durata dello schiacciamento/rimbalzo dopo l'impatto, prima che la
   * capsula sia del tutto assestata (fotogramma 30). */
  settle: 0.45,
  /** Pausa dopo l'assestamento prima di accendere il whiteout e tagliare
   * alla schermata di gioco — lascia respirare onda d'urto/polvere. */
  holdAfterSettle: 0.9,
  /** Durata dello scatto di camera-shake all'impatto. */
  shakeDuration: 0.35,
  /** Durata del flash bianco all'impatto. */
  flashDuration: 0.18
} as const;

export const CAPSULE_TOTAL_DURATION =
  CAPSULE_TIMING.impact + CAPSULE_TIMING.settle + CAPSULE_TIMING.holdAfterSettle;
