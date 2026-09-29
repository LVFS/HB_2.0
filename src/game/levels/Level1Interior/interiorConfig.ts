// Costanti di rendering/gameplay per il modo isometrico dell'interno (vedi
// docs/FASE5_INTERNO_ISOMETRICO.md). Geometria generata da codice a partire
// dai dati LDtk, non modelli Blender — vedi quel documento sul perché.

/** Unità di mondo Three.js per cella LDtk (1 cella = 1 unità, mappatura 1:1). */
export const WORLD_UNIT_PER_CELL = 1;

/** Muro bicromo (vedi FASE5): zoccolo basso chiaro + fascia alta bordeaux. */
export const WALL_HEIGHT_LOWER = 0.4;
export const WALL_HEIGHT_UPPER = 1.2;
export const WALL_COLOR_LOWER = '#C9C4B8';
export const WALL_COLOR_UPPER = '#7A2E2E';

/** Texture del pavimento, seamless: un tile per cella (nessun `RepeatWrapping`
 *  necessario, ogni cella è già una singola mesh con UV 0..1 proprie). */
export const FLOOR_TEXTURE_URL = `${import.meta.env.BASE_URL}textures/pavimento_tile_seamless.png`;

/**
 * Camera isometrica (vedi FASE5): elevazione ~30-40° sul piano, azimuth 45°
 * (l'angolo standard "isometrico" di generi come Hades/Fallout, non il vero
 * 35.264° matematico — qui è puro gusto visivo). Gli sprite di
 * personaggi/prop non ruotano per-frame verso la camera (la camera ha un
 * angolo FISSO): si orientano una volta sola con `rotation.y =
 * ISO_CAMERA_AZIMUTH`, così il loro piano frontale punta sempre verso di
 * essa senza bisogno di un vero billboard.
 */
export const ISO_CAMERA_AZIMUTH = Math.PI / -12;
export const ISO_CAMERA_ELEVATION = (35 * Math.PI) / 180;
export const ISO_CAMERA_DISTANCE = 16;
export const ISO_CAMERA_ZOOM = 180;
export const ISO_CAMERA_FOLLOW_SMOOTHING = 0.15;

export const ISO_PLAYER_SPEED = 3.2;
/** Metà lato dell'AABB del giocatore per i trigger delle porte (vedi
 *  `useOverlap`/`collision.ts`, riusati qui su X/Z invece che X/Y). */
export const ISO_PLAYER_HALF_SIZE = 0.35;

/** Altezza-bersaglio per categoria di `Prop` (decisione presa: si scala ogni
 *  sprite mantenendo la sua proporzione sorgente verso questa altezza in
 *  unità di mondo, MAI 1px-sorgente = 1 unità — i file hanno risoluzioni
 *  sorgente troppo eterogenee, vedi il piano di handoff). Chiave = `spriteId`
 *  esatto del marker LDtk. */
export const PROP_TARGET_HEIGHTS: Record<string, number> = {
  bancone_biglietteria: 1.3,
  bancone_snack: 1.1,
  panca: 0.6,
  parete_locandine: 1.8,
  porte_ingresso: 2.2,
  scale: 1.0,
  'model:porta-ingresso': 2.2,
  // Altezze reali dei modelli Blender (assets/blender/*.blend): `scale` in
  // LDtk le moltiplica per ritoccare a occhio.
  'model:bancone-biglietteria': 1.5,
  'model:bancone-snack': 1.88,
  'model:panca': 0.9,
  'model:scale': 2.6
};
/** Altezza di scorta per uno `spriteId` non ancora presente nella mappa qui
 *  sopra — meglio uno sprite visibile ma mal dimensionato che nessuno. */
export const PROP_DEFAULT_HEIGHT = 1.2;
