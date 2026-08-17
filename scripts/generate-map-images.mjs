// Script una tantum (non parte del gioco): genera le immagini statiche
// della mappa per ogni livello via la Maps Static API di Google, componendo
// una griglia di tile invece di scaricare un'unica immagine — l'API si
// ferma a 640x640 px per richiesta, per coprire un'area più ampia (tutto il
// quartiere/paese, non solo poche vie) servono più tile allineate e
// incollate insieme. Le salva in public/maps/. Da rilanciare SOLO se
// cambiano le coordinate/lo zoom/il mapGrid di un livello in
// src/data/levels.ts, o TILE_SIZE qui sotto — quella è la fonte di verità,
// questa lista va tenuta manualmente allineata (niente import diretto di un
// modulo .ts da uno script Node semplice come questo: sono solo 3 voci, la
// duplicazione controllata è più semplice di un loader TS in più solo per
// questo).
//
// IMAGE_SIZE in src/game/menu/levelSelect/LevelMapScene.tsx è calcolato per
// livello come TILE_SIZE*level.mapGrid — se cambia TILE_SIZE qui, resta
// in sincrono automaticamente lì (stessa costante, nessuna duplicazione).
// Cambiare mapGrid in levels.ts invece richiede sempre rigenerare
// l'immagine di quel livello.
//
// Uso: GOOGLE_MAPS_API_KEY nel file .env (vedi .env.example), poi:
//   node scripts/generate-map-images.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import https from 'node:https';
import { PNG } from 'pngjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'maps');

// Deve restare allineata a src/data/levels.ts (id, coordinates, zoom, mapGrid).
const LEVELS = [
  { id: 'oristano-ariston', coordinates: { lat: 39.9079, lng: 8.5881 }, zoom: 18, mapGrid: 5 },
  { id: 'sili', coordinates: { lat: 39.9194, lng: 8.6231 }, zoom: 16, mapGrid: 3 },
  { id: 'cagliari-bastione', coordinates: { lat: 39.204583, lng: 9.131139 }, zoom: 17, mapGrid: 5 }
];

/** Pixel logici per tile (scale=1: teniamo l'immagine finale a una
 * dimensione ragionevole per una texture di gioco, non serve la nitidezza
 * "retina" di scale=2 su uno sfondo visto a distanza). */
const TILE_SIZE = 640;
const MAP_TYPE = 'hybrid';
// Nasconde le icone/etichette dei punti di interesse (locali, negozi...) e
// dei trasporti (fermate bus...): solo strade e nomi restano, niente
// pittogrammi sparsi sulla mappa.
const STYLES = ['feature:poi|visibility:off', 'feature:transit|visibility:off'];

function readApiKey() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) {
    throw new Error('.env non trovato — copia .env.example in .env e incolla la chiave.');
  }
  const content = readFileSync(envPath, 'utf8');
  const match = content.match(/^GOOGLE_MAPS_API_KEY=(.*)$/m);
  const key = match ? match[1].trim() : '';
  if (!key) throw new Error('GOOGLE_MAPS_API_KEY vuota in .env.');
  return key;
}

// Web Mercator — stessa matematica di mapProjection.ts nel gioco: serve a
// calcolare il centro esatto di OGNI tile della griglia, non solo quello
// centrale, così le tile si allineano bordo a bordo senza cuciture visibili.
const WORLD_TILE = 256;

function project(lat, lng) {
  const sinLat = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: WORLD_TILE * (0.5 + lng / 360),
    y: WORLD_TILE * (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI))
  };
}

function unproject(x, y) {
  const lng = (x / WORLD_TILE - 0.5) * 360;
  const n = Math.PI - (2 * Math.PI * y) / WORLD_TILE;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

/** Centro (lat/lng) della tile a `dxTiles`/`dyTiles` di distanza (in tile
 * intere) dal centro del livello, allo stesso zoom. */
function tileCenter(centerLat, centerLng, zoom, dxTiles, dyTiles) {
  const scale = 2 ** zoom;
  const center = project(centerLat, centerLng);
  const worldPxAtZoom = {
    x: center.x * scale + dxTiles * TILE_SIZE,
    y: center.y * scale + dyTiles * TILE_SIZE
  };
  return unproject(worldPxAtZoom.x / scale, worldPxAtZoom.y / scale);
}

function fetchPng(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          if (res.headers['content-type']?.includes('image')) {
            resolve(body);
          } else {
            reject(new Error(body.toString('utf8').slice(0, 500)));
          }
        });
      })
      .on('error', reject);
  });
}

async function generateLevel(level, apiKey) {
  const grid = level.mapGrid;
  const half = Math.floor(grid / 2);
  const compositeSize = TILE_SIZE * grid;
  const composite = new PNG({ width: compositeSize, height: compositeSize });

  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const dxTiles = col - half;
      const dyTiles = row - half;
      const { lat, lng } = tileCenter(level.coordinates.lat, level.coordinates.lng, level.zoom, dxTiles, dyTiles);

      const params = new URLSearchParams({
        center: `${lat},${lng}`,
        zoom: String(level.zoom),
        size: `${TILE_SIZE}x${TILE_SIZE}`,
        maptype: MAP_TYPE,
        key: apiKey
      });
      for (const style of STYLES) params.append('style', style);
      const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;

      process.stdout.write(`  tile [${row},${col}]... `);
      const buf = await fetchPng(url);
      const tile = PNG.sync.read(buf);
      PNG.bitblt(tile, composite, 0, 0, TILE_SIZE, TILE_SIZE, col * TILE_SIZE, row * TILE_SIZE);
      console.log('ok');
    }
  }

  const dest = join(OUTPUT_DIR, `${level.id}.png`);
  writeFileSync(dest, PNG.sync.write(composite));
  return dest;
}

async function main() {
  const apiKey = readApiKey();
  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const level of LEVELS) {
    const grid = level.mapGrid;
    console.log(`${level.id} (griglia ${grid}x${grid}, ${TILE_SIZE * grid}x${TILE_SIZE * grid}px):`);
    try {
      const dest = await generateLevel(level, apiKey);
      console.log(`  salvato in ${dest}`);
    } catch (err) {
      console.log('  FALLITO');
      console.error(`  ${level.id}: ${err.message}`);
      process.exitCode = 1;
    }
  }
}

main();
