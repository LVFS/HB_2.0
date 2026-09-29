// Costanti di gameplay/rendering per il modo 2D del Livello 1 (vedi
// docs/PIANO_LIVELLO1_2D.md). Valori "da vista", segnaposto finché non
// arrivano gli asset veri (turnaround D0/D1/Eve, sfondo Ariston ritagliato
// in layer) — stesso spirito delle costanti tarate a occhio già presenti
// altrove nel progetto (es. `wallConfig.ts`).

/** Pixel per unità di mondo alla camera ortografica (R3F mappa 1 unità di
 *  frustum = 1 pixel di canvas a zoom 1). */
export const CAMERA_ZOOM = 80;
/** Quota Z fissa della camera (profondità di ripresa laterale). */
export const CAMERA_Z = 20;
/** Quota Y a cui la camera inquadra la scena. */
export const CAMERA_EYE_Y = 1.2;
/** Smorzamento dell'inseguimento camera→giocatore sull'asse X. */
export const CAMERA_FOLLOW_SMOOTHING = 0.12;

/** Quota del pavimento calpestabile (posizione "piedi" del personaggio). */
export const GROUND_Y = 0;
/** Estensione orizzontale calpestabile: il giocatore non può uscirne.
 *  Deve restare oltre il trigger segnaposto più lontano di
 *  `data/level1/triggers.ts` (oggi `sala1EntranceX = 30`, vedi Fase 4 del
 *  piano) — altrimenti quel punto non sarebbe mai raggiungibile a piedi. */
export const WORLD_HALF_WIDTH = 36;

export const PLAYER_WIDTH = 0.9;
export const PLAYER_HEIGHT = 1.9;
export const PLAYER_SPEED = 5.2;
export const PLAYER_JUMP_SPEED = 8.5;
export const GRAVITY = -22;
