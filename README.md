# Epic Birthday Quest

Mini-videogioco 3D per browser costruito con React, Vite e Three.js.
Disponibile a questo link: https://lvfs.github.io/HB_2.0/

## Funzionalità iniziali

- Menu principale cinematografico in 3D: un'ambientazione completa (strada,
  cartello di ingresso città, case, distributore, binari, muro stile Attack on
  Titan) con una sequenza cinematica del personaggio che sfonda il muro a
  pugno prima che la fisica prenda il sopravvento
  ([docs/MENU_INTRO.md](docs/MENU_INTRO.md))
- Selezione livelli su luoghi reali (mappe satellitari come texture 3D) con
  sblocco progressivo
- Scene manager
- Musica di sottofondo ed effetti con Howler (`useBackgroundMusic`, `useSfx`)
- Settings persistenti con localStorage
- Prima scena 3D con movimento e raccolta frammenti
- Stili in CSS Modules, schermate caricate a richiesta (code splitting)

## Avvio

1. `npm install`
2. `npm run dev`

Le immagini delle mappe (`public/maps/*.png`) sono asset statici già nel
repository — il gioco non contatta mai Google in produzione. Per rigenerarle
(solo se cambiano le coordinate dei livelli in `src/data/levels.ts`): copia
`.env.example` in `.env`, incolla una chiave Google Maps Platform con "Maps
Static API" abilitata (`GOOGLE_MAPS_API_KEY`), poi
`node scripts/generate-map-images.mjs`.

## Script

- `npm run dev` — server di sviluppo su http://localhost:4173
- `npm run build` — typecheck + build di produzione in `dist/`
- `npm run preview` — anteprima della build
- `npm run lint` — ESLint su `src/`

## Build e deploy

1. `npm run build`
2. Deploy su GitHub Pages con le impostazioni di `gh-pages` o con GitHub Actions

## Prossimi passi

- rifinire a vista la sequenza cinematica del personaggio (inquadrature, timing)
- eventuali animazioni vere per il personaggio (oggi è tutto camera/GSAP, niente mixer)
- puzzle e portale finale
- schermata celebrazione con foto, video e messaggi
- eseguire il deploy vero su GitHub Pages (`npm run deploy`; su Windows, se fallisce
  con `spawn git ENOENT`, controllare il PATH di `git`)
