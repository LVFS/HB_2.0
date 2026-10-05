<!-- Riferimento di dettaglio spostato da CLAUDE.md, sezione "Stato del progetto" (FASE 7): copia fedele. -->

Il menu iniziale è stato completamente ricostruito, dal MVP a cubi procedurali a
un'ambientazione Blender vera e propria ("Ingresso a Oristano"):

- **Ambientazione** (`ingresso-oristano.glb`, ~1.8 MB): strada a due corsie con corsia
  ciclabile e marciapiede bicolore (fascia rossa con buche alberate + fascia rosa "zona
  ciclabile"), cartello di ingresso città a 3 pannelli, case digradanti verso il muro,
  distributore ESSO con pensilina e piazzale asfaltato, binari del treno sulla sinistra,
  cielo procedurale con sole e nuvole (`<Sky>`/`<Cloud>` di drei).
- **Muro**: stile Attack on Titan (pannelli scanalati + contrafforti + portone a due ante
  in una cornice/torre), esteso a ±202 unità (i pannelli oltre ±115 sono scenografia pura,
  mai rompibili — prefisso `WallFiller_`). L'intero muro (portone, 34 pannelli, 8
  contrafforti, ~218 frammenti Cell Fracture con forme irregolari, non blocchi a griglia)
  è geometricamente rompibile, ma solo i frammenti entro `AFFECT_RADIUS` dall'origine
  dell'impatto diventano fisici a ogni rottura (`wall/environmentModel.ts`,
  `wall/wallConfig.ts`). A muro intatto le crepe dei frammenti sono nascoste da coperture
  solide dedicate (`Solid_*`), rivelate solo quando la rottura è in corso.
- **Sequenza cinematica del personaggio** (`game/menu/character/`): al posto del vecchio
  click-e-rottura-immediata, una pressione qualsiasi a `'ready'` (vedi "Nessun bottone
  Gioca" più sopra) avvia una fase `punching` che mette in scena un
  personaggio stile Saitama/One Punch Man — piede in primo piano, rivelazione del volto,
  battuta con leggera rotazione del corpo, cambio di modello (Base "scema" → Jab "seria"),
  anticipazione (durante la quale si gira anche verso il muro: `charYaw`, un mezzo giro),
  poi taglio diretto al video del salto, impatto che aggancia la rottura del muro esistente
  (variante forzata a "pugno", punto d'impatto casuale sull'asse Y a ogni partita), il
  personaggio prosegue nel varco. Solo due modelli (`personaggio-base/jab.glb`), mesh
  **statiche cotte**, senza scheletro — vedi "Pipeline Blender" sul perché (l'export con
  skin era rotto). **Nessuno scatto/corsa in 3D**: un tentativo precedente vendeva la corsa
  con una raffica cinematica (camera in scia sul volto, FOV kick, smear-cut Base/Jab,
  polvere ai piedi) invece di un vero ciclo di corsa (impossibile senza scheletro), ma anche
  così la traduzione restava percepita come un pattinare sul ghiaccio — scartata del tutto,
  non solo ritarata: dall'anticipazione si taglia dritti al video, che racconta lui il
  "come" del salto. Il video (`LEAP_VIDEO_URL` in `characterConfig.ts`,
  `public/video/saitama-run-punch.mp4`) copre lo schermo al posto della scena 3D per
  `SAITAMA_TIMING.leapVideo` secondi — l'elemento `<video>` vive in `MenuScene.tsx`, non in
  `CharacterIntro.tsx`, perché è HTML puro e non può stare dentro `<Canvas>` (R3F non sa
  montarlo); `CharacterIntro` si limita a chiamare `onLeapVideo(true/false)` sulla sua
  timeline, stesso pattern del whiteout, e a teleportare il personaggio (nascosto, `.set()`
  non `.to()`) davanti al muro mentre il video copre lo schermo, così quando riappare è già
  nel posto giusto per l'impatto. Se il file manca, l'overlay resta invisibile e la
  sequenza prosegue comunque (stesso trattamento tollerante di `useSfx` per gli MP3
  assenti). L'impatto arriva SUBITO alla fine del video, non dopo un'attesa:
  `VARIANT_IMPACT_DELAY.punch` in `wallConfig.ts` è stato abbassato da 0.55 (il tempo di
  "caricare il colpo" quando quel caricamento avveniva ancora in 3D) a 0.05, perché quel
  caricamento ora lo mostra il video, non la fisica del muro. Un terzo modello dedicato
  allo scatto (`Personaggio_Salto`) era già stato scartato in precedenza: anche essendo una
  posa "in corsa", tradotto rigidamente sul terreno sembrava comunque scivolare, e
  risolvere l'export con skin per un'animazione vera si è rivelato un problema profondo
  (vedi "Pipeline Blender" e `docs/MENU_INTRO.md`) non riaperto per questa iterazione.
- **Finale**: dal fotogramma dell'impatto la camera passa da `CharacterIntro` a
  `CameraDirector` (vedi "Regole architetturali" sopra), che porta a termine `breaking` con
  il pull-back consueto e poi un ultimo tratto — attraverso il varco appena aperto, in
  quota — mentre lo schermo sfuma a bianco (overlay vive in `App.tsx`, non nella
  schermata: vedi "Regole architetturali") prima del taglio a "Seleziona livello", che
  sfuma a sua volta DAL bianco invece di apparire di colpo.

La selezione livelli (`game/menu/levelSelect/`) è un'UNICA scena Three.js sempre visibile
(`LevelMapScene.tsx`, montata subito con la mappa del primo livello — mai uno schermo nero
in attesa di un click) su tre luoghi REALI (Cinema Ariston a Oristano, Silì, un luogo a
Cagliari — coordinate vere in `data/levels.ts`; il nome/descrizione di Cagliari sono oggi un
placeholder onesto, "da confermare", dopo un cambio di coordinate — vedi più sotto). **Niente
widget di mappa live nel gioco pubblicato**: le tre mappe sono immagini statiche (Maps Static
API, generate UNA TANTUM in sviluppo con `scripts/generate-map-images.mjs` e salvate come
asset locali in `public/maps/`, stessa logica dei modelli Blender/audio) applicate come
texture su un piano Three.js — non le Photorealistic 3D Tiles (Enterprise a fatturazione
ricorrente, copertura incerta su Silì, vietano cache/uso offline: valutate e scartate) né un
widget Google Maps JS live (avrebbe richiesto una chiave esposta e attiva per sempre nel
gioco pubblicato, oltre a due livelli di rendering — DOM + Canvas — da tenere sincronizzati).
Il marker di ogni livello (`LevelMarker.tsx`) è un pin quando la camera è lontana, il modello
3D quando ci si avvicina — il Cinema Ariston per Oristano, lo scorcio d'ingresso (una fila di
case viste di fronte, non un singolo edificio: `assets/blender/sili_ingresso.blend`) per
Silì, per Cagliari un placeholder "ponte" nello stesso linguaggio del pin (ottaedro
sfaccettato, bagliore, anello a terra, idle continuo) invece del vecchio cilindro pieno
generico, in attesa di un modello Blender vero — scambio automatico legato alla DISTANZA
camera↔marker (letta ogni
fotogramma), non a un bottone: uno zoom continuo, non un taglio tra "mappa" e "vicino". La
camera ha due
padroni che si alternano come ovunque nel progetto (mai insieme): GSAP durante il dolly
avanti/indietro (click su un livello / "Elenco livelli"), `MapControls` di drei il resto del
tempo (pan/zoom liberi dell'utente, rotazione bloccata) — l'handoff è esplicito via un flag
`isAnimating` che spegne `controls.enabled` durante il dolly, altrimenti un drag a metà
animazione la romperebbe. La posizione del marker sul piano viene da una proiezione Web
Mercator pura (`mapProjection.ts`, la stessa matematica di Google Maps: lat/lng → pixel →
posizione locale sul piano), non hardcoded — oggi il marker cade sempre vicino al centro
(la mappa è generata centrata proprio sul luogo), ma la funzione resta generale. Sblocco
progressivo via `progressStore` (`completedLevelIds`, persistito): un livello è giocabile se
il precedente per `order` è completato, resta sempre rigiocabile una volta fatto — `completeLevel`
non è ancora agganciato a nulla nel nuovo Livello 1 2D (il vecchio aggancio "raccogli tutti i
frammenti" è stato rimosso con la riscrittura, vedi "Livello 1 — 2D"): la Fase 4 del piano
(`docs/PIANO_LIVELLO1_2D.md`) dovrà richiamarlo dalla macchina a stati del livello quando la
storia è completata. Cambiare città fa passare lo
schermo da una transizione a nuvole (`CloudTransition.tsx`, GSAP, stesso pattern del
contatore-trigger di `skipIntroToken`) invece di uno scatto secco. `SettingsBar` (già
esistente) è montata anche qui.

**Copertura per livello: una griglia di tile, non un'unica immagine — e non più la stessa
per tutti i livelli.** La Maps Static API si ferma a 640x640px per richiesta — per vedere più
del proprio isolato, `scripts/generate-map-images.mjs` scarica una griglia `mapGrid x mapGrid`
di tile da 640px (`TILE_SIZE`) allo stesso zoom e le incolla in un'unica immagine (`pngjs`,
devDependency: decodifica/codifica PNG in Node, mai nel bundle del gioco) — il centro di ogni
tile viene dalla stessa proiezione Web Mercator di `mapProjection.ts`, non spostato a mano,
altrimenti le tile non si allineerebbero bordo a bordo. `mapGrid` è un campo di `LevelInfo`
(`data/levels.ts`), non più una costante `GRID` fissa nello script: Silì resta a 3 (1920×1920
finali), Oristano e Cagliari sono a 5 (3200×3200) per coprire un'area cittadina più ampia.
Cambiarlo per un livello richiede sempre rigenerare la sua immagine (`node
scripts/generate-map-images.mjs` rigenera tutti e tre). In `LevelMapScene.tsx`,
`PLANE_SIZE`/`IMAGE_SIZE` **non sono più costanti di modulo**: `getMapGeometry(level)` le
deriva da `level.mapGrid` (`PLANE_SIZE = 12 * mapGrid`, `IMAGE_SIZE = 640 * mapGrid`) insieme
a tutto ciò che ne dipende — `CAMERA_FAR`, `maxDistance` di `MapControls` — come RAPPORTI
fissati sul livello di riferimento (Silì, invariato) invece che numeri per-livello scritti a
mano. Lo style `feature:poi|visibility:off` + `feature:transit|visibility:off` toglie le icone
dei locali/negozi/fermate — strade ed etichette restano. **Non rimovibile**: ogni tile porta
con sé la scritta "Google"/copyright richiesta dai termini di servizio, quindi compare
ripetuta a ogni giunzione della griglia — non è un difetto da correggere, è obbligatoria per
mostrare contenuto Google Maps.

**Isola frastagliata fluttuante nello spazio**, non più un piano quadrato piatto: il piano
"quadrato" (`PLANE_SIZE`/`IMAGE_SIZE`) resta solo la matematica di riferimento per UV e
proiezione del marker — la geometria VISIBILE è un ritaglio irregolare di quel quadrato,
calcolato (non un asset), sommando 3 sinusoidi di frequenza/fase diversa al raggio attorno al
centro (rumore a bassa frequenza: spuntoni indipendenti punto-per-punto darebbero una stella,
non un'isola). La fase di ogni armonica è seminata sull'`id` del livello (PRNG mulberry32),
quindi il contorno è deterministico per livello — stesso livello, stesso contorno identico a
ogni render, diverso da un livello all'altro — e "stellato" rispetto all'origine per
costruzione (raggio sempre positivo), quindi non può mai autointersecarsi. Tre mesh dalla
STESSA `Shape` (mai duplicata a mano, garantisce che il bordo combaci sempre esattamente),
impilate lungo la verticale: `ShapeGeometry` per il coperchio (texturizzato con la mappa, UV
rimappate a mano sul quadrato PIENO invece che sul bounding box della shape — altrimenti
mappa/marker si disallineano non appena il contorno smette di essere un quadrato),
`ExtrudeGeometry` per una sottile "gonna" di transizione terra→roccia appena sotto (texture a
gradiente verticale via canvas — maschera il cambio di stile visivo tra la foto satellitare
sopra e la roccia procedurale sotto, che anche a bordo geometrico perfetto leggeva come due
dischi scollegati) e un'altra `ExtrudeGeometry` per la pancia rocciosa vera e propria (texture
procedurale via canvas, nessun asset scaricato). Il "vuoto" oltre il bordo frastagliato è oggi
voluto — è lo spazio stesso (`<Stars>` di drei, procedurali, nessun HDR esterno, più un
pianeta/luna decorativo con gradiente via canvas) — quindi la vecchia `<fog>` e il piano di
contorno a tinta neutra che copriva il vuoto oltre il piano quadrato sono stati rimossi del
tutto: non servono più, coprivano un bordo che ora non esiste (l'isola sfuma naturalmente
nello spazio).

**Quattro bug reali scovati verificando a schermo, non ovvi dal codice**: primo, `ExtrudeGeometry`
estrude sempre lungo +Z LOCALE, che con la rotazione del gruppo (-90° su X: locale (x,y,z) →
mondo (x,z,-y)) mappa a +Y di MONDO — cioè verso l'ALTO, l'opposto di quanto serve per una
pancia che deve pendere SOTTO il coperchio. Con `depth` positivo la pancia finiva sopra la
mappa invece che sotto, bloccando la vista dall'alto (si vedeva solo roccia scura); un primo
tentativo di correzione con una scala negativa a livello di mesh (`scale={[1,1,-1]}`) NON ha
funzionato (Three.js reinterpreta winding/normali per un oggetto specchiato in modo meno
prevedibile di quanto sembri) — la correzione che ha funzionato è passare direttamente un
`depth` NEGATIVO a `ExtrudeGeometry`: stesso algoritmo, endpoint diverso, winding/normali
corretti fin dalla costruzione, senza alcuna riflessione da ragionare a parte. Diagnosticato
disattivando temporaneamente la pancia (`{false && <IslandBelly .../>}`) per isolare che il
coperchio da solo renderizzava già correttamente — tecnica di bisezione utile da riproporre
per bug di occlusione simili. Secondo, il primo pianeta/luna decorativo aveva raggio/distanza
scelti senza calcolare l'angolo sotteso: riempiva quasi tutto il frame invece di leggersi come
un dettaglio di sfondo — fissato calcolando esplicitamente il diametro angolare (raggio/
distanza ≈ tangente del semi-angolo) e tenendolo sotto i ~6°, con posizione/raggio FISSI (non
proporzionali a `PLANE_SIZE`, a differenza di camera/piano: il pianeta è sfondo cosmico, non
parte della scala reale del luogo). Terzo, il bevel di `ExtrudeGeometry` sulla pancia (e sulla
gonna) rientrava rispetto al contorno esatto nei tratti CONCAVI del profilo — "stellato" (mai
autointersecante, garantito dalla costruzione) non vuol dire "convesso": il contorno può
comunque scendere e risalire lungo l'angolo. Il bevel sposta il bordo di una quantità fissa
perpendicolare ad esso, quindi nei tratti concavi il bordo superiore della pancia finiva più
all'interno di quello esatto del coperchio sopra — da lato/dal basso la mappa sembrava
"staccata" dalla roccia. Fix: `bevelEnabled: false` su entrambe le estrusioni (pancia e gonna
di transizione) — il contorno di ogni strato combacia così ESATTAMENTE con quello del
coperchio, nessun inset. Non è un limite specifico di questo progetto: è un limite noto di
`ExtrudeGeometry` con bevel su contorni non convessi, utile da ricordare se in futuro serve
un bordo smussato su una shape generata proceduralmente (va costruito a mano, non con
l'opzione automatica). Quarto (scovato DOPO aver risolto il terzo: il bordo combaciava già
alla perfezione, ma la pancia restava una macchia scura pressoché uniforme vista da un
angolo basso/laterale — sintomo diverso, causa diversa): un'unica `directionalLight`
dall'alto lascia le superfici della pancia/gonna rivolte verso il basso con la sola
`ambientLight` su una texture già scura di base (`#39332c`) — leggevano come nero piatto
invece che come roccia texturizzata, lo stesso problema che hanno quasi sempre le isole
fluttuanti nei videogiochi illuminate da una sola fonte dall'alto. Fix: una seconda
`directionalLight` di riempimento, debole (`intensity=0.45`) e fredda (`#5b7fbd`, come un
riflesso dello spazio), posizionata da sotto/di lato, senza ombre proprie (non ne vale il
costo per un riempimento così debole). Sospetto collaterale confermato per lo stesso
sintomo: `depth` negativo su `ExtrudeGeometry` (usato apposta, vedi sopra) è un caso meno
comune nella libreria — le normali delle pareti laterali potevano risultare invertite,
facendo sì che Three.js culli proprio le facce rivolte verso la camera; `side: THREE.DoubleSide`
sui materiali di pancia e gonna elimina il rischio a costo trascurabile (poche mesh a bassa
risoluzione). Infine, gli anelli sottili visibili sulla pancia in alcuni screenshot sono
riflessi dei due `Lightformer form="ring"` (il bagliore da nebulosa dell'`Environment`
procedurale) — proporzionalmente molto più visibili su un materiale scuro/opaco che su una
texture chiara come la mappa sopra: smorzati con `envMapIntensity={0.2}` sugli stessi due
materiali, invece di toccare i Lightformer (che restano validi per il resto della scena).

**Limite di pan RADIALE**, non più un quadrato: `MapControls` non lascia uscire
`controls.target` dal contorno frastagliato dell'isola — stessa formula (`islandRadiusAt`)
usata per costruire la geometria, non una copia separata che potrebbe disallinearsi. Applicato
in `CameraRig` SOLO quando `!isAnimating` (mai durante il dolly GSAP); il delta di clamp va
applicato a `controls.target` E a `camera.position` insieme (stessa traslazione rigida), non
solo al target, altrimenti al giro di `update()` successivo `MapControls` ricalcolerebbe una
posizione diversa da quella attesa. Verificato con due screenshot dopo un pan volutamente
eccessivo (10 vs 25 trascinamenti): identici byte per byte — ma solo dopo aver notato che
`<Stars speed={0.4}>` (lo scintillio) rompe di per sé questo confronto anche a camera ferma,
quindi il test va fatto con `speed={0}` temporaneo per isolare la sola posizione della camera.

Le tre immagini di `public/maps/` sono generate e nel repository (`oristano-ariston.png`
3200×3200, `sili.png` 1920×1920, `cagliari-bastione.png` 3200×3200 — nessun `scale=2`, i
pixel sono quelli logici di `TILE_SIZE * mapGrid`) — il blocco che le teneva ferme la prima
volta era la restrizione per referrer HTTP sulla chiave (impostata per il widget Google Maps
JS, poi rimosso): una richiesta da Node non manda un header `Referer`, quindi una chiave con
quella restrizione la rifiuta sempre, a prescindere dalle API abilitate — la chiave usata per
generarle è una seconda chiave senza restrizioni, dedicata solo a questo. **`LevelMapScene`
non dipende comunque più da una texture presente per non schiantarsi**: `IslandCapErrorBoundary`
(classe React, serve una classe perché l'errore arriva da un loader Suspense) intercetta un
caricamento fallito e mostra il coperchio dell'isola a tinta unita (il colore del livello)
invece di mandare in crash l'intero `<Canvas>` — verificato rimuovendo apposta i file generati
e controllando
che l'app restasse comunque usabile prima di rigenerarli. Utile ricordarlo se in futuro cambia
`data/levels.ts` senza rigenerare le immagini in tempo, o per chiunque clona il repository e
non lancia subito lo script.

---

## Albero dei file di menu e selezione livelli (spostato da "Struttura del progetto" di CLAUDE.md)

```
src/game/
    menu/               schermata iniziale (macchina a stati in MenuScene.tsx)
      MainMenuSceneAnimation.tsx   <Canvas> del menu: CameraDirector (GSAP, fasi intro/ready/
                                    breaking, con lo skip dell'intro su "premi qualcosa") +
                                    CharacterIntro (fasi punching/breaking)
      MainMenuOverlay.tsx          UI HTML minimale: solo "Premi un tasto per iniziare"
                                    (fase `ready`) + link "Seleziona livello" in un angolo
      menuPhase.ts                 fasi: intro → ready → punching → breaking
      MenuScene.module.css         solo lo stile del `<video>` del salto (il whiteout è
                                    salito in App.tsx, vedi "Regole architetturali")
      wall/                        ambientazione + muro distruttibile (vedi sotto)
        wallConfig.ts               URL modello, GATE_ORIGIN, IMPULSE, AFFECT_RADIUS,
                                     randomImpactY(), getVariantOrigin()
        environmentModel.ts         useGLTF sull'ambientazione completa; useBreakableShards()
                                     scopre i frammenti per prefisso nome (SHARD_PREFIXES)
        Wall.tsx (ambientazione intatta), WallShatter.tsx (lazy: Physics + un RigidBody
                                     `colliders="hull"` per frammento — non InstancedRigidBodies,
                                     i frammenti hanno geometrie tutte diverse)
        breakPatterns/{types,radial,collapse,punch,index}.ts
      character/                   sequenza cinematica del personaggio (vedi sotto)
        characterConfig.ts          IntroVariant (pool a la BreakVariant, oggi solo "saitama"),
                                     SAITAMA_TIMING (durate di ogni fase, in secondi),
                                     LEAP_VIDEO_URL
        characterModel.ts           useGLTF sui 2 modelli del personaggio
        CharacterIntro.tsx           timeline GSAP unica: piede → volto → battuta → cambio
                                     personaggio → si gira verso il muro → video del salto →
                                     impatto (aggancia `breaking`) → ingresso nel varco
    levelSelect/                 selezione livelli su mappa reale (vedi sotto)
      LevelSelectScene.tsx        orchestratore: `displayedLevelId` + `focused` (bool),
                                     non tre fasi separate — vedi sotto
      LevelMapScene.tsx             UNA scena Three.js: isola frastagliata fluttuante nello
                                     spazio (coperchio texturizzato con l'immagine statica +
                                     pancia rocciosa, stesso contorno, vedi sotto) + stelle +
                                     marker + camera GSAP/MapControls
      LevelMarker.tsx                pin quando la camera è lontana, modello da vicino
                                     (Cinema Ariston per Oristano, scorcio d'ingresso per Silì,
                                     placeholder nello stesso linguaggio del pin — ottaedro/
                                     anello — per Cagliari) — scambio automatico per distanza,
                                     non un bottone
      mapProjection.ts               proiezione Web Mercator: lat/lng → posizione sul piano
      CloudTransition.tsx           scia di stelle che accompagna il volo della camera tra
                                     un mondo e l'altro (GSAP, stesso pattern di
                                     skipIntroToken per il trigger) — vedi più sotto
      LevelListOverlay.tsx          card dei livelli, quelli bloccati disabilitati
                                     (isLevelUnlocked in data/levels.ts)
```
