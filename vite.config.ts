import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/HB_2.0/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    // Il CSS totale è di pochi kB: un file unico caricato subito evita che le
    // regole condivise (ui.module.css) finiscano duplicate in ogni chunk e
    // toglie di mezzo qualsiasi sfarfallio quando una schermata viene caricata.
    cssCodeSplit: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor',
              test: /node_modules/,
              // entriesAware raggruppa le librerie in base a QUALI schermate le
              // usano davvero: quelle comuni finiscono in un chunk condiviso,
              // il motore fisico resta nel chunk della sola scena di gioco.
              // Senza questa opzione un solo gruppo "vendor" costringerebbe
              // anche il menu a scaricare i 3 MB di Rapier.
              entriesAware: true
            }
          ]
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 4173
  }
});
