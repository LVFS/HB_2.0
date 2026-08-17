// Dati statici dei livelli: contenuto di gioco, non stato mutabile.
// Nello store resta solo il livello attualmente selezionato (`gameStore`) e
// quali sono già stati completati (`progressStore`).

export interface LevelInfo {
  id: string;
  name: string;
  description: string;
  /**
   * Ordine di sblocco: il livello è giocabile se `order === 1`, oppure se il
   * livello con `order` immediatamente precedente è in
   * `progressStore.completedLevelIds`. Un livello già completato resta
   * sempre rigiocabile, a prescindere dall'ordine.
   */
  order: number;
  /**
   * Coordinate reali del luogo — sono anche il `center` con cui è stata
   * generata l'immagine statica della mappa (vedi `getLevelMapImageUrl`):
   * cambiarle qui senza rigenerare l'immagine disallinea il marker dalla
   * mappa che ha sotto.
   */
  coordinates: { lat: number; lng: number };
  /**
   * Zoom con cui è stata generata l'immagine statica — serve sia per
   * rigenerarla (`scripts/generate-map-images.mjs`) sia per proiettare
   * lat/lng di eventuali altri punti sulla stessa immagine (vedi
   * `mapProjection.ts`). Stessa regola delle coordinate: cambiarlo qui
   * richiede rigenerare l'immagine.
   */
  zoom: number;
  /**
   * Lato della griglia di tile (dispari) con cui è generata l'immagine
   * statica — vedi `scripts/generate-map-images.mjs`. Più alto copre
   * un'area più ampia allo stesso zoom (più tile allo stesso livello di
   * dettaglio, non più zoom-out). Cambiarlo qui richiede rigenerare
   * l'immagine, stessa regola di coordinate/zoom sopra.
   */
  mapGrid: number;
  color: string;
}

/**
 * Percorso dell'immagine statica della mappa per questo livello — un asset
 * locale in `public/maps/`, generato una tantum (vedi
 * `scripts/generate-map-images.mjs`), non una chiamata a runtime: il gioco
 * pubblicato non contatta mai Google per le mappe.
 */
export function getLevelMapImageUrl(level: LevelInfo): string {
  return `${import.meta.env.BASE_URL}maps/${level.id}.png`;
}

export const levels: LevelInfo[] = [
  {
    id: 'oristano-ariston',
    name: 'Cinema Ariston',
    description: 'Viale Armando Diaz, Oristano — dove tutto è cominciato.',
    order: 1,
    coordinates: { lat: 39.9079, lng: 8.5881 },
    zoom: 18,
    mapGrid: 5,
    color: '#86efac'
  },
  {
    id: 'sili',
    name: 'Silì',
    description: 'La frazione sul Tirso, a due passi da Oristano.',
    order: 2,
    coordinates: { lat: 39.9194, lng: 8.6231 },
    zoom: 16,
    mapGrid: 3,
    color: '#7dd3fc'
  },
  {
    // TODO: nome/descrizione da confermare — non sono riuscito a
    // identificare con certezza cosa c'è esattamente a queste coordinate
    // (ricerche inconcludenti), meglio un placeholder onesto che un nome
    // sbagliato per un posto che probabilmente ha un significato preciso.
    id: 'cagliari-bastione',
    name: 'Cagliari',
    description: 'Un luogo speciale a Cagliari — nome da confermare.',
    order: 3,
    coordinates: { lat: 39.204583, lng: 9.131139 },
    zoom: 17,
    mapGrid: 5,
    color: '#fb7185'
  }
];

/**
 * Un livello è giocabile se è il primo, o se quello immediatamente
 * precedente (per `order`) è tra i completati. Resta comunque vero per un
 * livello già completato, indipendentemente dall'ordine: si può sempre
 * rigiocare. Vive qui (non nello store) perché combina dati statici
 * (`levels`) con `completedLevelIds` passato dal chiamante — non importa lo
 * store, rispetta "flusso dati a senso unico".
 */
export function isLevelUnlocked(level: LevelInfo, completedLevelIds: string[]): boolean {
  if (completedLevelIds.includes(level.id)) return true;
  if (level.order === 1) return true;
  const previous = levels.find((candidate) => candidate.order === level.order - 1);
  return previous ? completedLevelIds.includes(previous.id) : true;
}
