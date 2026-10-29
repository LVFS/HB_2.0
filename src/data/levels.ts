// Dati statici dei livelli: contenuto di gioco, non stato mutabile.
// Nello store resta solo il livello attualmente selezionato (`gameStore`) e
// quali sono già stati completati (`progressStore`).

/**
 * `playable`: il livello ha una scena e si può avviare. `soon`: resta visibile nella mappa (isola, marker, elenco) ma non
 * si avvia — mostra «Prossimamente». Riattivarlo = cambiare lo stato e collegare la scena del livello in `App.tsx`.
 */
export type LevelStatus = 'playable' | 'soon';

export interface LevelInfo {
  id: string;
  status: LevelStatus;
  /** Id del mondo (città) a cui appartiene — vedi `data/worlds.ts`. Oggi
   * ogni mondo ha un solo livello, ma il campo esiste già per reggere un
   * mondo con più livelli in futuro senza bisogno di ristrutturare. */
  worldId: string;
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
  return `${import.meta.env.BASE_URL}maps/${level.id}.webp`;
}

export const levels: LevelInfo[] = [
  {
    id: 'oristano-ariston',
    status: 'playable',
    worldId: 'oristano',
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
    status: 'soon',
    worldId: 'sili',
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
    status: 'soon',
    worldId: 'cagliari',
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

/**
 * Un livello si può AVVIARE solo se ha una scena (`status === 'playable'`) ed è sbloccato. La selezione livelli lo
 * controlla in un solo punto (`handleStartLevel`) e `App.tsx` ha una difesa in più: nessun percorso deve aggirarlo.
 */
export function isLevelPlayable(level: LevelInfo, completedLevelIds: string[]): boolean {
  return level.status === 'playable' && isLevelUnlocked(level, completedLevelIds);
}

/**
 * Livello "rappresentativo" di un mondo — oggi l'unico che ha quel
 * `worldId` (un mondo = un livello, per ora). Il giorno in cui un mondo
 * avrà più livelli, qui si deciderà quale mostrare per primo (es. il primo
 * per `order`, o il primo non completato) senza che chi la chiama debba
 * cambiare.
 */
export function getWorldLevel(worldId: string): LevelInfo | undefined {
  return levels.find((level) => level.worldId === worldId);
}
