import type { LevelInfo } from '@/data/levels';

/** Unità mondo per lato di UNA tile della griglia con cui è generata
 * l'immagine statica (vedi `scripts/generate-map-images.mjs`): il piano
 * (quadrato) su cui è mappata la texture è `PLANE_SIZE_PER_TILE *
 * level.mapGrid` unità, l'immagine finale `TILE_SIZE_PX * level.mapGrid`
 * pixel — griglie diverse per livello (Silì resta a 3, Oristano/Cagliari a
 * 5) danno mappe di dimensioni diverse, vedi `getMapGeometry`. Il piano
 * resta un concetto "quadrato" solo per la matematica di UV/proiezione —
 * la geometria VISIBILE è l'isola frastagliata sotto (`buildIslandGeometry`
 * in `LevelMapScene.tsx`), un ritaglio di quel quadrato, non il quadrato
 * stesso.
 *
 * Estratto da `LevelMapScene.tsx` (era definito solo lì) perché
 * `islandLayout.ts` ha bisogno della STESSA `getMapGeometry` per calcolare
 * dove piazzare ogni isola nello spazio — duplicare la formula in un
 * secondo file sarebbe esattamente la classe di bug che i commenti di
 * questo modulo segnalano già più volte più sotto: dimenticare di
 * riscalare due punti che dipendono da `planeSize` insieme. */
export const PLANE_SIZE_PER_TILE = 12;
export const TILE_SIZE_PX = 640;

// Rapporti tarati a vista sul livello di riferimento (Silì, mapGrid=3,
// PLANE_SIZE=36: 27/36, 21/36, 38/36≈1.05) e poi tenuti come FORMULA invece
// che numeri fissi — bug reale già preso tre volte in questa sessione
// dimenticando di riscalare camera/nebbia insieme a PLANE_SIZE quando
// cambiava; ora che PLANE_SIZE varia per livello (mapGrid diverso), la
// formula previene la quarta ricorrenza.
const CAMERA_FAR_Y_RATIO = 27 / 36;
const CAMERA_FAR_Z_RATIO = 21 / 36;
const MAX_DISTANCE_RATIO = 1.05;

/** Margine (unità mondo) tenuto tra il bordo frastagliato dell'isola e il
 * punto più lontano a cui il pan può portare `controls.target` — vedi il
 * clamp radiale in `CameraRig`. Più largo di quando il limite era un
 * quadrato pieno: un'inquadratura storta vicino a una punta frastagliata
 * mostrerebbe più facilmente il "bordo grezzo" della roccia. */
export const PAN_MARGIN = 5;

export const CAMERA_FAR_TARGET = [0, 0, 0] as const;
// Target abbassato da 1 a 0.7 su richiesta esplicita ("la visuale verso il
// modello un po' più in basso"): condiviso da tutti i modelli ravvicinati
// (Cinema Ariston, scorcio di Silì, placeholder di Cagliari), quindi non
// a terra (y=0) — con un target a y=0 e la camera a soli 2-3 unità di
// distanza, l'angolo era troppo ripido dall'alto e si vedeva perlopiù il
// piano sotto invece del modello (bug reale scovato a schermo, non un
// dettaglio) — ma abbastanza più basso di prima da inquadrare più il piano
// terra/ingresso e meno il tetto. Non dipende da `level`/`PLANE_SIZE`
// apposta: il modello/pin restano a dimensione reale fissa, questa è
// l'inquadratura ravvicinata su di loro, non sul piano.
export const CAMERA_NEAR = { position: [0, 1.1, 4.6] as const, target: [0, 1, 0] as const };

/**
 * Angolo polare (dall'asse verticale) implicito in `CAMERA_NEAR`: con
 * `position=[0,2.1,4.6]` e `target=[0,1,0]`, l'offset è `[0,1.1,4.6]` —
 * `acos(1.1/|offset|) ≈ 76.55°`, qualche grado SOPRA il vecchio
 * `maxPolarAngle` di `MapControls` (75°, `Math.PI/2.4`). Bug reale scovato a
 * schermo (non solo teorico): `MapControls.update()` ri-clampa SEMPRE
 * l'angolo polare della camera dalla sua posizione attuale, a prescindere
 * da `enableRotate`/`enabled` (che bloccano solo l'input utente, non
 * `update()` stesso — vedi il commento su `CameraRig` in `LevelMapScene.tsx`
 * per lo stesso principio) — ogni fotogramma in cui il volo GSAP verso
 * `CAMERA_NEAR` era concluso e `controls.update()` girava di nuovo, la
 * camera veniva silenziosamente ritirata dentro il limite di 75°,
 * allontanandola dall'inquadratura voluta (a vista: mappa visibile dietro
 * l'edificio invece dell'inquadratura stretta, nei casi peggiori una deriva
 * abbastanza ampia da mostrare quasi solo il piano). `MAX_POLAR_ANGLE` tiene
 * i due valori coerenti tra loro invece di lasciarli scollegati come prima —
 * margine di ~3° oltre l'angolo di `CAMERA_NEAR`, non esatto: un margine
 * risicato ririschierebbe lo stesso bug alla prossima modifica di uno dei
 * due senza l'altro.
 */
const CAMERA_NEAR_POLAR_ANGLE = Math.acos(
  (CAMERA_NEAR.position[1] - CAMERA_NEAR.target[1]) /
    Math.hypot(
      CAMERA_NEAR.position[1] - CAMERA_NEAR.target[1],
      CAMERA_NEAR.position[2] - CAMERA_NEAR.target[2]
    )
);
export const MAX_POLAR_ANGLE = CAMERA_NEAR_POLAR_ANGLE + (3 * Math.PI) / 180;

export interface MapGeometry {
  planeSize: number;
  imageSize: number;
  cameraFarPosition: readonly [number, number, number];
  maxDistance: number;
}

/** Tutte le grandezze che dipendono dalla dimensione del piano-mappa di
 * QUESTO livello, derivate da `level.mapGrid` — un solo posto dove
 * PLANE_SIZE e tutto ciò che ne dipende (immagine, camera, limite di pan)
 * restano coerenti tra loro, invece di costanti sparse da ricordarsi di
 * aggiornare insieme. */
export function getMapGeometry(level: LevelInfo): MapGeometry {
  const planeSize = PLANE_SIZE_PER_TILE * level.mapGrid;
  return {
    planeSize,
    imageSize: TILE_SIZE_PX * level.mapGrid,
    cameraFarPosition: [0, planeSize * CAMERA_FAR_Y_RATIO, planeSize * CAMERA_FAR_Z_RATIO],
    maxDistance: planeSize * MAX_DISTANCE_RATIO
  };
}
