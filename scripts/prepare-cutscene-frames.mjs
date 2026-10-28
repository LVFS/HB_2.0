// Prepara i frame dello storyboard per le cutscene (FASE 11): legge gli originali in
// docs/storyboard/Frame/ (restano lì), li ridimensiona a ~1280 px di larghezza e li salva
// come .webp in public/cutscenes/<set>/NN.webp. Si lancia UNA TANTUM (e quando cambia un frame):
//   node scripts/prepare-cutscene-frames.mjs
// Le varianti B di 13/14 della scena pre-boss si scartano: si usano 13_A e 14_A come 13 e 14.

import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WIDTH = 1280;
const QUALITY = 80;

/** Quale file originale diventa quale numero, per ogni set. */
const SETS = [
  {
    id: 'preboss',
    from: 'docs/storyboard/Frame/Scena pre-boss',
    // numero finale -> nome del file (senza estensione)
    files: { 13: 'frame_13_A', 14: 'frame_14_A' },
    count: 14,
    defaultName: (n) => `frame_${n}`
  },
  {
    id: 'postboss',
    from: 'docs/storyboard/Frame/Scena post-boss 1',
    files: {},
    count: 8,
    defaultName: (n) => `frame_${n}`
  }
];

let totalBytes = 0;
for (const set of SETS) {
  const sourceDir = join(ROOT, set.from);
  const targetDir = join(ROOT, 'public', 'cutscenes', set.id);
  mkdirSync(targetDir, { recursive: true });
  const available = readdirSync(sourceDir);
  for (let n = 1; n <= set.count; n += 1) {
    const base = set.files[n] ?? set.defaultName(n);
    const name = available.find((file) => file.replace(/\.[^.]+$/, '') === base);
    if (!name) {
      console.error(`MANCA: ${set.id} ${base}.* in ${set.from}`);
      process.exitCode = 1;
      continue;
    }
    const target = join(targetDir, `${String(n).padStart(2, '0')}.webp`);
    await sharp(join(sourceDir, name)).resize({ width: WIDTH, withoutEnlargement: false }).webp({ quality: QUALITY }).toFile(target);
    const size = statSync(target).size;
    totalBytes += size;
    console.log(`${set.id}/${String(n).padStart(2, '0')}.webp  ${(size / 1024).toFixed(0)} KB  (da ${name})`);
  }
}
console.log(`Totale: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
