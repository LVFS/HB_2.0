import React from 'react';
import ReactDOM from 'react-dom/client';
import { useGLTF } from '@react-three/drei';

// Font self-hostati: niente richiesta a fonts.googleapis.com, niente dipendenza
// da un servizio esterno, e i file vengono serviti con hash dalla nostra build
// (quindi cache eterna). I sottoinsiemi `latin-*` scaricano solo l'alfabeto che
// ci serve: ~10-24 kB a peso, invece dei ~220 kB che servirebbero a coprire
// anche cirillico, greco e vietnamita (file che nessuno scaricherebbe mai, ma
// che finirebbero comunque nel deploy).
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/chakra-petch/latin-600.css';
import '@fontsource/chakra-petch/latin-700.css';

import App from '@/App';
// L'ordine conta: i token definiscono le variabili che global.css usa.
import '@/styles/tokens.css';
import '@/styles/global.css';

// I modelli `.glb` sono compressi con Draco (vedi `public/models/`): il
// decoder di drei punta di default a un CDN esterno (gstatic.com) — vietato
// dal progetto (vedi CLAUDE.md, "Bundle/performance"), quindi il decoder
// vive self-hosted in `public/draco/` (copiato da
// `node_modules/three/examples/jsm/libs/draco/gltf/`). Un solo punto di
// configurazione globale invece di passarlo a ogni `useGLTF`/`.preload`.
useGLTF.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
