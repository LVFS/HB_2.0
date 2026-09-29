// Costanti di animazione per i personaggi 2D (Fase 3 del piano, vedi
// docs/PIANO_LIVELLO1_2D.md) — valori "da vista", come le altre costanti
// tarate a occhio nel progetto (es. `wallConfig.ts`, `level1Config.ts`).

/** Altezza di default di un personaggio in unità di mondo, se il chiamante
 *  non ne passa una propria (es. Eve più bassa di D). */
export const CHARACTER_DEFAULT_HEIGHT = 1.9;

/** Durata di UNA metà del ciclo cammino a 2 pose di D0 (front↔action, l'unica
 *  variante con una posa a metà passo già disponibile — vedi il piano). */
export const WALK_STEP_DURATION = 0.28;

/** Dondolio procedurale per D1/Eve in cammino: nessuna posa a metà passo
 *  disponibile per loro, quindi si inclina la posa `front` avanti/indietro
 *  invece di alternare due texture. */
export const WALK_SWAY_ANGLE = 0.05; // radianti
export const WALK_SWAY_DURATION = 0.32;

/** Flash bianco veloce per la reazione a un colpo: tint via materiale
 *  (`material.color` portato sopra 1, compresso verso il bianco dal tone
 *  mapping ACES del renderer — vedi CharacterAnimator2D), non una texture
 *  dedicata. */
export const HIT_FLASH_DURATION = 0.08;
export const HIT_FLASH_BRIGHTNESS = 6;

/** Dissolvenza D0→D1 quando il personaggio riceve la lama di Eve: un taglio
 *  onesto (poco più di mezzo respiro), non una finta transizione fluida che
 *  non abbiamo i fotogrammi per fare davvero. */
export const TRANSFORM_CROSSFADE_DURATION = 0.4;
