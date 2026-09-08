# Piano: eliminare gli scatti da caricamento asset (HB_2.0)

Diagnosi fatta leggendo il repo (non solo ipotesi): il progetto ha già una buona base
(code-splitting per schermata in `App.tsx`, chunk vendor separato per Rapier in
`vite.config.ts`), ma tre cose concrete causano lo scatto quando compare un asset non
ancora caricato.

## Cosa ho trovato (misurato, non stimato)

1. **Le mappe statiche sono enormi.** `public/maps/oristano-ariston.png` = 22,9 MB,
   `cagliari-bastione.png` = 19,6 MB, `sili.png` = 6,7 MB. Vengono caricate come texture
   WebGL grezze via `useTexture(getLevelMapImageUrl(level))` dentro `IslandCapTexture`
   (`LevelMapScene.tsx`, riga 255) — decodificare e caricare in GPU un PNG da 20+ MB è di
   gran lunga il costo più pesante di tutta la scena, e succede esattamente nel fotogramma
   in cui la mappa deve apparire. Questa è la causa più probabile dello scatto che descrivi.
2. **Tutto è "pigro" per costruzione, non solo le schermate.** `useGLTF.preload()` e
   `useTexture(...)` nei vari `*Model.ts` partono solo quando il MODULO che li contiene
   viene eseguito — e quel modulo arriva solo quando React monta il componente che lo
   importa, cioè quando lo `screen` cambia in uno dei tre `lazy()` di `App.tsx`. Non c'è
   oggi nessun prefetch della schermata successiva mentre l'utente guarda ancora quella
   attuale: il download del JS *e* degli asset iniziano nello stesso istante.
3. **I modelli GLB non usano compressione.** `ingresso-oristano.glb` (2,1 MB),
   `cinema-ariston.glb` (1,1 MB), `personaggio-base/jab.glb` (~0,9 MB l'uno),
   `capsula-stellar.glb` (155 KB) — pesi ragionevoli ma esportati senza Draco/Meshopt
   (l'exporter Blender li supporta, l'ho verificato mentre esportavo `capsula-stellar.glb`
   nella sessione precedente, semplicemente non erano attivi).
4. **Anche con tutto precaricato, resta un costo "invisibile".** La prima volta che
   Three.js disegna una geometria/texture nuova, il driver WebGL deve comunque compilare
   gli shader e caricare i buffer in GPU — un micro-hitch che càpita al primo render, non
   al download. Se quel primo render coincide con "l'oggetto diventa visibile" (oggi è
   sempre così), lo scatto si vede; se coincide con un momento già coperto (nuvola, fade),
   non si vede.

## Fase 1 — comprimere le mappe statiche (il fix a maggior impatto, a basso rischio)

*Sei un esperto di ottimizzazione immagini per il web e pipeline asset per giochi 3D
browser-based.*

Le mappe sono screenshot satellitari statici, rigenerati una tantum da
`scripts/generate-map-images.mjs` (serve una chiave Google Maps Platform, vedi README) e
committati in `public/maps/`. Non hanno bisogno di essere PNG lossless a piena
risoluzione — sono texture di sfondo, non asset da ispezionare da vicino.

- Convertire l'output dello script da PNG a **JPEG qualità ~82-88** (niente trasparenza da
  preservare) o WebP: tipicamente un taglio del 90%+ senza perdita percepibile su una
  texture applicata a un piano.
- Ricontrollare `level.mapGrid`/`level.zoom` in `src/data/levels.ts`: se il grid genera più
  tile di quanto la superficie renderizzata a schermo possa mai mostrare a piena
  risoluzione, si può ridurre il lato output (es. cap a 2048-3072 px) senza perdita
  visibile — verificare a occhio dopo la modifica, non a priori.
- Aggiornare `scripts/generate-map-images.mjs` per scrivere `.jpg`/`.webp` invece di
  `.png`, e `getLevelMapImageUrl` in `src/data/levels.ts` per l'estensione giusta.
- Rigenerare le tre mappe e verificare visivamente (i marker/proiezioni in
  `mapProjection.ts` dipendono dalle stesse dimensioni immagine, ricontrollare che
  l'allineamento marker↔mappa non si sia spostato).

Risultato atteso: le tre mappe passano da 6-23 MB a poche centinaia di KB l'una — da sole
valgono la stragrande maggioranza dello scatto percepito.

## Fase 2 — comprimere i modelli GLB (Draco/Meshopt)

*Sei un esperto di pipeline Blender→glTF e ottimizzazione asset 3D per Three.js.*

- In Blender, export glTF con `export_draco_mesh_compression_enable=True` (o Meshopt,
  già disponibile nell'installazione — visto nei log dell'ultimo export) per tutti i
  `.glb` in `public/models/`.
- Lato client, configurare il decoder Draco **self-hosted** (coerente con la scelta già
  fatta nel progetto di non dipendere da CDN esterni, vedi `CLAUDE.md`): copiare i file
  del decoder da `node_modules/three/examples/jsm/libs/draco/` in `public/draco/` e
  puntarci `useGLTF` (drei espone un secondo argomento per il path del decoder, oppure
  `useGLTF.preload(url, '/HB_2.0/draco/')`).
- Testare che i modelli con azioni multiple sugli oggetti (`capsula-stellar.glb`, con le
  sue tante action separate per lame/scintille/detriti) sopravvivano alla compressione —
  Draco comprime solo la geometria, le animazioni non sono toccate, ma vale la pena
  ricontrollare visivamente dopo l'export.

Guadagno più contenuto della Fase 1 in valore assoluto (i GLB pesano già poco rispetto
alle mappe), ma quasi gratuito da attivare e utile quando si aggiungeranno altri modelli.

## Fase 3 — precaricare la schermata successiva durante i tempi morti

*Sei un esperto di React, code-splitting e performance percepita in applicazioni web.*

Oggi il download di codice+asset di una schermata parte solo quando ci si entra. L'idea:
avviarlo mentre l'utente sta ancora guardando la schermata precedente, in un momento in
cui la CPU/rete non è impegnata in altro.

- In `App.tsx`, non appena `screen === 'menu'` è montato e il menu è "a riposo" (es. dopo
  la sequenza cinematica d'ingresso, o semplicemente con un piccolo ritardo), lanciare
  `import('@/game/menu/levelSelect/LevelSelectScene')` — questo basta a far scaricare il
  chunk JS e a far partire tutti gli `useGLTF.preload`/eventuali preload texture che quel
  modulo innesca al caricamento, PRIMA che l'utente clicchi "Avvia livello"/navighi lì.
  Stessa idea per prefetchare `SceneManager` (Level1 + Rapier) non appena si entra nella
  selezione livelli, invece che al click su "Avvia livello".
- Usare `requestIdleCallback` (con fallback a `setTimeout` per Safari, che non lo
  supporta) per non competere con lavoro più urgente (animazioni GSAP, rendering).
- Per le mappe delle ALTRE due città (quelle non mostrate all'ingresso in
  `LevelSelectScene`), applicare lo stesso principio: prefetchare le texture non
  visualizzate mentre l'utente guarda la prima, così anche il cambio città via
  `CloudTransition` non scatta la prima volta.
- Aggiungere un modulo `assetPreload.ts` (o simile) con una funzione tipo
  `prefetchLevelSelectAssets()` da richiamare nei punti sopra, per non sparpagliare la
  logica di prefetch dentro ai componenti schermata.

## Fase 4 — "riscaldare" la GPU sotto una copertura già esistente

*Sei un esperto di rendering realtime e WebGL/Three.js.*

Anche con tutto precaricato in RAM, il PRIMO render di una geometria/texture nuova forza
comunque il driver a compilare shader e caricare i buffer in GPU — un costo che oggi
coincide sempre con "l'oggetto diventa visibile". Il gioco ha già momenti di copertura
naturale pensati apposta per nascondere tagli (`CloudTransition`, il whiteout in
`App.tsx`): vale la pena sfruttarli anche per questo.

- Quando un modello nuovo (mappa, capsula/kraken, Ariston) è pronto ma non ancora
  visibile, forzare un render "a vuoto" mentre la copertura (nuvola/bianco) è ancora
  attiva — in Three.js/R3F questo si fa tipicamente con `gl.compile(scene, camera)`
  (via `useThree`) su un frame dedicato, oppure montando l'oggetto con opacità/scale a
  zero un istante prima di renderlo davvero visibile.
- Questo è l'intervento più delicato dei quattro (tocca il render loop, va provato con
  calma sulle tre schermate) — va bene farlo per ultimo, dopo che Fasi 1-3 hanno già
  eliminato la maggior parte dello scatto percepito.

## Fase 5 — un indicatore di caricamento vero, per quello che resta

*Sei un esperto di UX per stati di caricamento in applicazioni interattive.*

Il fallback di `Suspense` in `App.tsx` oggi è un `<div>Caricamento...</div>` fisso, senza
percentuale. Anche con Fasi 1-4 fatte, la primissima visita (cache fredda, connessione
lenta) avrà comunque un caricamento visibile — meglio mostrarlo che nasconderlo male.

- Sostituire il fallback con `useProgress` di `@react-three/drei` (già una dipendenza del
  progetto) per una barra/percentuale reale invece del testo fisso.
- Tenerlo semplice e coerente con lo stile esistente (`ui.module.css`), niente libreria
  aggiuntiva.

## Come verificare i miglioramenti

1. **Prima di tutto**: Chrome DevTools → Network → throttling "Fast 3G" + cache
   disabilitata, registrare dove scatta oggi (menu→selezione livelli, selezione
   livelli→zoom sul marker, cambio città) come base di confronto.
2. Dopo la Fase 1: stesso test, controllare che il peso totale delle mappe scaricate sia
   sceso da ~20 MB a poche centinaia di KB e che lo scatto principale sia sparito.
3. Dopo la Fase 3: controllare nel pannello Network che il download della schermata
   successiva parta PRIMA del click su "Avvia livello"/selezione città, non dopo.
4. `npm run build && npm run preview` per misurare anche in condizioni di build reale
   (non dev server) prima di pubblicare su GitHub Pages.

## Ordine consigliato

Fase 1 da sola vale la maggior parte del guadagno ed è la più sicura (tocca solo lo
script di generazione mappe e un'estensione file) — falla per prima e riverifica prima di
passare alle altre. Fase 2 e 3 si possono fare in parallelo, sono indipendenti tra loro.
Fase 4 per ultima, è la più delicata. Fase 5 è indipendente e si può fare in qualunque
momento, anche subito.
