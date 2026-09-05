// Un "mondo" è la CITTÀ mostrata sulla mappa 3D (l'isola fluttuante in
// `LevelMapScene`), distinto da un "livello" (una missione con la sua
// progressione — vedi `LevelInfo.order` in `data/levels.ts`). Oggi
// coincidono 1:1 (un mondo ha un solo livello), ma tenerli separati fin
// d'ora regge senza rifare la struttura il giorno in cui un mondo avrà più
// di un livello al suo interno.

export interface WorldInfo {
  id: string;
  name: string;
}

export const worlds: WorldInfo[] = [
  { id: 'oristano', name: 'Oristano' },
  { id: 'sili', name: 'Silì' },
  { id: 'cagliari', name: 'Cagliari' }
];

/** Nome del mondo per l'etichetta sulle righe dell'elenco livelli — se un
 * `worldId` non trova corrispondenza (dato scollegato), mostra l'id grezzo
 * invece di sparire silenziosamente: un errore di dati resta visibile. */
export function getWorldName(worldId: string): string {
  return worlds.find((world) => world.id === worldId)?.name ?? worldId;
}
