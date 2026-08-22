// Script una tantum (non parte del gioco, non a runtime): comprime gli
// artwork reali della sequenza di auguri nei file `{quadro}-bg.jpg` che
// `tableaux/*.module.css` già referenziano (stesso pattern di
// `scripts/generate-map-images.mjs` per le mappe: uno script Node, non un
// passo di build, lanciato a mano quando serve).
//
// Le fonti sono artwork trovati con nomi/dimensioni non uniformi e pesanti
// (fino a 6+ MB) — non adatti a una schermata che deve sentirsi istantanea.
//
// I sorgenti grezzi vivono in `assets/birthday-images/` (stesso principio di
// `assets/blender/`: versionati nel repo ma FUORI da `public/`, che Vite
// copia per intero nella build — lasciarli in `public/` avrebbe spedito
// 13+ MB di artwork non compressi nel gioco pubblicato, vanificando la
// compressione). Per un primo giro, un file nuovo può stare anche
// direttamente in `public/images/birthday/`: lo script lo trova comunque e
// lo sposta in `assets/birthday-images/` da solo prima di comprimerlo.
//
// Uso: node scripts/compress-birthday-images.mjs

import { renameSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public', 'images', 'birthday');
const SOURCES_DIR = join(__dirname, '..', 'assets', 'birthday-images');

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 82;

// Fonte → output, stesso nome ovunque referenziato da .module.css: cambiarli
// qui richiede aggiornare anche i `background-image: url(...)` nei CSS.
const SOURCES = {
  'Bloodborne_lady_maria_artwork.png': 'bloodborne-bg.jpg',
  'god_of_war_kratos_artwork.jpeg': 'godofwar-bg.jpg',
  'hollow_knight_artwork.jpg': 'hollowknight-bg.jpg',
  'expedition_33_simon_artwork.png': 'expedition-bg.jpg',
  'Resident_Evil_Requiem_artwork.png': 'residentevil-bg.jpg',
  'gta6-background-artwork.png': 'gta-bg.jpg'
};

async function compressOne(sourceName, outputName) {
  mkdirSync(SOURCES_DIR, { recursive: true });

  let sourcePath = join(SOURCES_DIR, sourceName);
  if (!existsSync(sourcePath)) {
    // Non ancora spostato in assets/: magari è un file nuovo appena
    // scaricato direttamente in public/images/birthday/.
    const freshPath = join(PUBLIC_DIR, sourceName);
    if (!existsSync(freshPath)) {
      console.log(`  ${sourceName}: FALLITO — file non trovato (né in assets/birthday-images/ né in public/images/birthday/)`);
      return false;
    }
    renameSync(freshPath, sourcePath);
  }

  const outputPath = join(PUBLIC_DIR, outputName);
  const beforeSize = statSync(sourcePath).size;

  await sharp(sourcePath)
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toFile(outputPath);

  const afterSize = statSync(outputPath).size;
  console.log(
    `  ${sourceName} -> ${outputName}: ${(beforeSize / 1024 / 1024).toFixed(1)}MB -> ${(afterSize / 1024).toFixed(0)}KB`
  );

  return true;
}

async function main() {
  console.log('Compressione artwork sequenza di auguri:');
  mkdirSync(PUBLIC_DIR, { recursive: true });

  let failures = 0;
  for (const [sourceName, outputName] of Object.entries(SOURCES)) {
    const ok = await compressOne(sourceName, outputName);
    if (!ok) failures++;
  }

  if (failures > 0) {
    console.log(`\n${failures} file non trovati — vedi sopra.`);
    process.exitCode = 1;
  } else {
    console.log('\nFatto. Sorgenti in assets/birthday-images/, output compressi in public/images/birthday/.');
  }
}

main();
