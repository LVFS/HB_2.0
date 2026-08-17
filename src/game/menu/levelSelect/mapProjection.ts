// Proiezione di Web Mercator — la stessa che usano Google Maps e la Maps
// Static API internamente per trasformare lat/lng in pixel. Serve qui per
// piazzare un marker nel punto GIUSTO su un'immagine statica generata con
// un certo center/zoom: senza, il marker starebbe a un punto arbitrario
// invece che sul luogo vero mostrato dalla mappa sotto.

const TILE_SIZE = 256;

/** Lat/lng -> pixel "di mondo" a zoom 0 (l'intero mondo è 256x256 px). */
function projectToWorldPixels(lat: number, lng: number): { x: number; y: number } {
  const sinLat = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: TILE_SIZE * (0.5 + lng / 360),
    y: TILE_SIZE * (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI))
  };
}

/**
 * Offset in pixel (a un certo zoom) di un punto rispetto al centro di
 * un'immagine statica generata con quel center/zoom — esattamente
 * l'offset a cui quel punto apparirebbe nell'immagine, in pixel "logici"
 * (quelli del parametro `size` passato alla Maps Static API, non i pixel
 * fisici se è stato usato `scale=2`).
 */
export function projectToImageOffset(
  point: { lat: number; lng: number },
  center: { lat: number; lng: number },
  zoom: number
): { x: number; y: number } {
  const scale = 2 ** zoom;
  const centerPixels = projectToWorldPixels(center.lat, center.lng);
  const pointPixels = projectToWorldPixels(point.lat, point.lng);
  return {
    x: (pointPixels.x - centerPixels.x) * scale,
    y: (pointPixels.y - centerPixels.y) * scale
  };
}

/**
 * Converte l'offset in pixel (vedi sopra) in coordinate locali X/Z su un
 * piano Three.js disteso in orizzontale (`rotation={[-Math.PI/2,0,0]}`,
 * quindi X-Y dell'immagine diventano X-Z del piano, non X-Y): `planeSize`
 * è quanti UNITÀ MONDO misura il lato del piano, `imageSize` quanti pixel
 * logici misura il lato dell'immagine che ci sta sopra come texture.
 */
export function imageOffsetToPlanePosition(
  offset: { x: number; y: number },
  planeSize: number,
  imageSize: number
): [number, number, number] {
  const unitsPerPixel = planeSize / imageSize;
  return [offset.x * unitsPerPixel, 0, offset.y * unitsPerPixel];
}
