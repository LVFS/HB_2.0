// URL del progetto LDtk servito da `public/` (stesso pattern di
// `MODEL_URL`/`THEME_SRC` altrove nel progetto: il file sorgente vive in
// `assets/ldtk/`, versionato e modificabile con l'editor LDtk; la copia in
// `public/ldtk/` è quella che il gioco scarica a runtime — va rigenerata a
// mano copiando il file ogni volta che la piantina cambia, come i modelli
// Blender esportati in .glb).
export const LDTK_PROJECT_URL = `${import.meta.env.BASE_URL}ldtk/ariston_interno.ldtk`;

/** Identificatori dei valori IntGrid del layer `Walls`, come definiti in LDtk. */
export const LDTK_WALL_VALUE = 1;
export const LDTK_FLOOR_VALUE = 2;

/** Pixel per cella in LDtk (`__gridSize`, uguale su tutti i layer di questo
 *  progetto) — serve per convertire `width`/`height` in pixel delle entità
 *  in celle. */
export const LDTK_GRID_SIZE = 16;
