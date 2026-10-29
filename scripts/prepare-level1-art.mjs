// Prepara gli sfondi/oggetti del Livello 1 (esterno dell'Ariston): legge gli originali dalla cartella degli artwork (NON sono nel
// repo) e li salva come WebP LOSSLESS, senza ridimensionamenti, in public/sprites/. Si lancia UNA TANTUM (e quando cambia un file):
//   node scripts/prepare-level1-art.mjs [cartella-artwork]
// Pixel art: nessun filtro di scala qui, il rendering usa NearestFilter (vedi Level1Backdrop.tsx).

import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = process.argv[2] ?? 'C:/Users/Angelo Vacca/Pictures/prove artwork gioco/Ariston';

const JOBS = [
  { from: 'ingresso_full.png', to: 'public/sprites/backgrounds/ariston_ingresso.webp' },
  { from: 'navicella_scontornata.png', to: 'public/sprites/props/navicella.webp' }
];

for (const job of JOBS) {
  const out = join(ROOT, job.to);
  mkdirSync(dirname(out), { recursive: true });
  const info = await sharp(join(SOURCE, job.from)).webp({ lossless: true, effort: 6 }).toFile(out);
  console.log(`${job.to}: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
}
