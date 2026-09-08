import { levels, type LevelInfo } from '@/data/levels';
import { getMapGeometry } from './mapGeometry';

/** Margine extra (unità mondo) tenuto tra il bordo di due isole vicine,
 * oltre alla somma dei loro raggi — tarato a vista, non calcolato:
 * abbastanza largo perché il volo tra due isole attraversi davvero uno
 * spazio vuoto, non un saltare da un bordo roccioso all'altro. Alzato da
 * 40 a 140 su richiesta esplicita ("più distanti l'una dall'altra"): un
 * volo più lungo si sente anche più giustificato dal blur di movimento
 * aggiunto insieme a questo cambio (vedi `onFlightChange` in
 * `LevelMapScene.tsx`/`LevelSelectScene.tsx`) — le due cose si rinforzano
 * a vicenda, non ha senso l'una senza l'altra. */
const ISLAND_GAP = 140;

/** Raggio massimo del contorno frastagliato di un'isola, come proxy del suo
 * "ingombro" — usa la stessa base di `ISLAND_BASE_RADIUS_RATIO`/armoniche di
 * `LevelMapScene.tsx` (picco moltiplicatore ~1.32 su `baseRadius = planeSize
 * * 0.34`, quindi ~0.45 * planeSize): planeSize/2 resta un margine
 * leggermente più ampio del picco reale, prudente per non far mai toccare
 * due isole (non serve il profilo/PRNG esatto qui, solo un ingombro
 * sufficiente). */
function footprintRadius(planeSize: number): number {
  return planeSize / 2;
}

/** Metri per grado di latitudine — costante entro l'approssimazione
 * equirettangolare usata qui, che serve solo a stabilire una DIREZIONE
 * relativa tra due punti (non una vera distanza geodetica): stesso
 * compromesso "buono abbastanza per mostrare, non per navigare" già
 * accettato altrove nel progetto (`mapProjection.ts` usa Web Mercator per
 * lo stesso motivo, proiettare non misurare). */
const METERS_PER_DEG_LAT = 111_320;

/**
 * Direzione reale (km) di `to` rispetto a `from`, sugli assi EST
 * (positivo) e SUD (positivo) — la STESSA convenzione già in uso per il
 * marker di ogni isola sul proprio piano (`mapProjection.ts`:
 * `imageOffsetToPlanePosition` restituisce Z = offset.y, sud-positivo,
 * perché l'immagine statica ha il nord in alto senza rotazioni e Web
 * Mercator cresce verso sud). Riusare la stessa convenzione qui — invece
 * di inventarne una nuova per il posizionamento reciproco delle isole — è
 * quello che fa sì che "sud" ovunque nel codice sia sempre lo stesso asse
 * di mondo, non due sistemi scollegati per coincidenza.
 */
function realBearingKm(from: LevelInfo, to: LevelInfo): { east: number; south: number } {
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((from.coordinates.lat * Math.PI) / 180);
  const south = (from.coordinates.lat - to.coordinates.lat) * (METERS_PER_DEG_LAT / 1000);
  const east = (to.coordinates.lng - from.coordinates.lng) * (metersPerDegLng / 1000);
  return { east, south };
}

/**
 * Posizione `[x, z]` di ogni isola — analoga alla posizione REALE rispetto
 * a Oristano (`order === 1`, sempre all'origine), non più una fila in
 * profondità: Silì risulta a est (con una leggera componente nord, ~3km
 * reali), Cagliari a sud (con una componente est, ~91km reali) — coerente
 * con le coordinate vere in `data/levels.ts`. La DIREZIONE viene da lì
 * (`realBearingKm`), la DISTANZA resta stilizzata — non i km reali, che
 * per Cagliari (quasi 30 volte più lontana di Silì) renderebbero il volo
 * verso di lei assurdamente più lungo dell'altro, stessa scelta stilistica
 * già presa per il contorno procedurale delle isole (deterministico ma non
 * cartograficamente fedele) — proporzionata solo all'ingombro reciproco
 * delle isole coinvolte (`ISLAND_GAP` + i due raggi), come nella
 * disposizione precedente.
 *
 * Non più una CATENA (ogni isola posizionata rispetto alla precedente per
 * `order`) ma una STELLA centrata sul riferimento: le coordinate reali
 * sono comunque assolute (lat/lng), non relative in sequenza, quindi
 * questa è la lettura più diretta — funziona pulita con 3 isole a
 * direzioni ben distinte fra loro; andrebbe rivista se in futuro se ne
 * aggiungessero altre nella stessa direzione della prima (rischio di
 * sovrapposizione lungo lo stesso raggio, non gestito qui).
 */
export const islandOffsets: Record<string, readonly [number, number]> = (() => {
  const reference = levels.find((level) => level.order === 1) ?? levels[0];
  const referenceRadius = footprintRadius(getMapGeometry(reference).planeSize);
  const offsets: Record<string, readonly [number, number]> = { [reference.id]: [0, 0] };

  levels
    .filter((level) => level.id !== reference.id)
    .forEach((level) => {
      const bearing = realBearingKm(reference, level);
      const magnitude = Math.hypot(bearing.east, bearing.south) || 1;
      const radius = footprintRadius(getMapGeometry(level).planeSize);
      const distance = referenceRadius + ISLAND_GAP + radius;
      offsets[level.id] = [(bearing.east / magnitude) * distance, (bearing.south / magnitude) * distance];
    });

  return offsets;
})();

export function getIslandOffset(levelId: string): readonly [number, number] {
  return islandOffsets[levelId] ?? [0, 0];
}
