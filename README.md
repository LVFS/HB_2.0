# Epic Birthday Quest

Mini-videogioco 3D per browser costruito con React, Vite e Three.js.
Disponibile a questo link: https://lvfs.github.io/HB_2.0/

## Funzionalità iniziali

- Menu principale cinematografico in 3D: un muro che si abbatte con la fisica
  ([docs/MENU_INTRO.md](docs/MENU_INTRO.md))
- Selezione livelli
- Scene manager
- Musica di sottofondo con Howler (`useBackgroundMusic`)
- Settings persistenti con localStorage
- Prima scena 3D con movimento e raccolta frammenti
- Stili in CSS Modules, schermate caricate a richiesta (code splitting)

## Avvio

1. `npm install`
2. `npm run dev`

## Script

- `npm run dev` — server di sviluppo su http://localhost:4173
- `npm run build` — typecheck + build di produzione in `dist/`
- `npm run preview` — anteprima della build
- `npm run lint` — ESLint su `src/`

## Build e deploy

1. `npm run build`
2. Deploy su GitHub Pages con le impostazioni di `gh-pages` o con GitHub Actions

## Prossimi passi

- aggiungere asset Blender / Mixamo
- animazioni del personaggio
- puzzle e portale finale
- schermata celebrazione con foto, video e messaggi
