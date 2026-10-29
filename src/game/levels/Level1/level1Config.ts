// Costanti di gameplay/rendering per il modo 2D del Livello 1 (vedi
// docs/PIANO_LIVELLO1_2D.md). Valori "da vista", segnaposto finché non
// arrivano gli asset veri (turnaround D0/D1/Eve, sfondo Ariston ritagliato
// in layer) — stesso spirito delle costanti tarate a occhio già presenti
// altrove nel progetto (es. `wallConfig.ts`).

/** Quota del pavimento calpestabile (posizione "piedi" del personaggio). */
export const GROUND_Y = 0;

// ---- Sfondo dell'esterno (public/sprites/backgrounds/ariston_ingresso.webp, 3002x703, pixel art) ----
// Una sola immagine statica, mai ridimensionata nel file: 54 px dell'immagine = 1 unità di mondo, quindi D (1.9 u = ~103 px) è un po' più basso
// delle porte interne dell'Ariston (~120 px). L'origine X del mondo è il bordo sinistro dell'immagine (X = px/54); la quota dei piedi è la linea
// del marciapiede (GROUND_Y).

/** Pixel dell'immagine per unità di mondo. */
export const BACKDROP_PX_PER_UNIT = 54;
export const BACKDROP_WIDTH_PX = 3002;
export const BACKDROP_HEIGHT_PX = 703;
/** Riga (dall'alto) dell'immagine su cui poggiano i piedi: il marciapiede davanti alle porte dell'Ariston. */
export const BACKDROP_GROUND_ROW_PX = 589;
export const BACKDROP_WIDTH = BACKDROP_WIDTH_PX / BACKDROP_PX_PER_UNIT;
export const BACKDROP_HEIGHT = BACKDROP_HEIGHT_PX / BACKDROP_PX_PER_UNIT;
/** Quota Y del bordo inferiore dell'immagine (il resto si ricava da GROUND_Y). */
export const BACKDROP_BOTTOM_Y = GROUND_Y - (BACKDROP_HEIGHT_PX - BACKDROP_GROUND_ROW_PX) / BACKDROP_PX_PER_UNIT;

/** Quota Z fissa della camera (profondità di ripresa laterale). */
export const CAMERA_Z = 20;
/** Altezza di mondo sempre visibile (zoom = altezza schermo / questa): dal fondo dell'immagine in su, il cielo in cima resta fuori campo. */
export const CAMERA_VIEW_HEIGHT = 10;
/** Quota Y a cui la camera inquadra la scena: il centro della fascia visibile, con il bordo inferiore dell'immagine in basso. */
export const CAMERA_EYE_Y = BACKDROP_BOTTOM_Y + CAMERA_VIEW_HEIGHT / 2;
/** Smorzamento dell'inseguimento camera→giocatore sull'asse X. */
export const CAMERA_FOLLOW_SMOOTHING = 0.12;

// ---- Luoghi dell'esterno (X di mondo, da px/80 dell'immagine) ----

/** Porta CENTRALE dell'Ariston (quella sotto l'insegna): centro X e mezza larghezza della zona d'interazione (porta ~135 px dell'immagine + un po' di margine). */
export const ARISTON_DOOR_X = 1047 / BACKDROP_PX_PER_UNIT;
export const ARISTON_DOOR_HALF_WIDTH = 75 / BACKDROP_PX_PER_UNIT;
/** Altezza (dal basso dell'immagine) a cui sta il suggerimento «Entra»: sopra l'insegna, sul muro. */
export const ARISTON_DOOR_PROMPT_ROW_PX = 335;

/** Navicella schiantata in mezzo all'incrocio: X del punto d'impatto (punta nell'asfalto) e quota Y sulla carreggiata; altezza della sagoma (D è 1.9 u). */
export const SHIP_X = 2100 / BACKDROP_PX_PER_UNIT;
export const SHIP_BASE_Y = BACKDROP_BOTTOM_Y + (BACKDROP_HEIGHT_PX - 625) / BACKDROP_PX_PER_UNIT;
export const SHIP_HEIGHT = 4.6;

/** Limiti del cammino: a sinistra i garage, a destra il bordo del marciapiede (dove iniziano le strisce, le colonnine). */
export const SIDEWALK_MIN_X = 60 / BACKDROP_PX_PER_UNIT;
export const SIDEWALK_MAX_X = 1985 / BACKDROP_PX_PER_UNIT;

export const PLAYER_WIDTH = 0.9;
export const PLAYER_HEIGHT = 1.9;
export const PLAYER_SPEED = 5.2;
export const PLAYER_JUMP_SPEED = 8.5;
export const GRAVITY = -22;
