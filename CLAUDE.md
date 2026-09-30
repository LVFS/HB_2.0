# Epic Birthday Quest (HB_2.0)

Mini-videogioco 3D nel browser (10-15 min di avventura) come regalo di compleanno.
React + Vite + React Three Fiber (Three.js) + Rapier (fisica) + GSAP (timeline/animazioni)
+ Howler (audio) + Zustand (stato) + TypeScript strict. Deploy previsto su GitHub Pages
(`base: '/HB_2.0/'` già configurato in `vite.config.ts`).

## Vincoli di versione — non toccare senza motivo

Le versioni in `package.json` sono bloccate da un problema di compatibilità già risolto,
non aggiornarle "alla cieca":

- **React 18.3.1**, non 19.
- **@react-three/fiber ^8.16.0**, non 9.x (fiber 9 richiede React 19).
- **@react-three/rapier ^1.5.0**, non 2.x (rapier 2.x richiede fiber 9).
- Se in futuro serve fiber 9 / rapier 2, è una migrazione unica di tutto lo stack
  (React 19 + fiber 9 + rapier 2 insieme), non un upgrade incrementale.

## Setup su Windows

- Se `npm install`/`npm run dev` falliscono in PowerShell con "running scripts is
  disabled", usare `npm.cmd` oppure `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- Se compaiono errori strani dopo un aggiornamento di Node, spesso è `node_modules`
  corrotto: cancellare `node_modules` + `package-lock.json` e rilanciare `npm install`.

## Struttura del progetto

```
src/
  App.tsx, main.tsx        App tiene anche il whiteout di chiusura menu (vedi sotto) e
                            App.module.css; main.tsx è il bootstrap React
  game/
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
    levels/
      Level1/  2D a scorrimento laterale (vedi "Livello 1 — 2D" più sotto e
               docs/PIANO_LIVELLO1_2D.md) — SceneManager2D.tsx (macchina a stati, Fase 4),
               Player2D.tsx, EveCompanion.tsx (IA di compagnia, Fase 4),
               DemoObstacle.tsx (segnaposto), level1Config.ts
    render2d/            fondamenta 2D condivise, riusabili da livelli futuri:
                         Sprite2D.tsx, ParallaxLayer.tsx, useFollowCameraX.ts,
                         collision.ts + useOverlap.ts (AABB scritte a mano, niente Rapier),
                         useXTrigger.ts (trigger 1D "supera questa X", Fase 4),
                         Character2D.tsx + CharacterAnimator2D.tsx (personaggi D0/D1/Eve a
                         swap di pose, vedi "Livello 1 — 2D" più sotto), characterSprites.ts,
                         characterAnimConfig.ts
  components/            DialogueBox.tsx (overlay HTML di dialogo, Fase 4 — vedi "Livello 1 —
                         2D" più sotto), SettingsBar.tsx (icona + pannellino musica/SFX/
                         volume, riusabile in più schermate — non conosce `MenuPhase` o
                         altro stato di scena, solo `settingsStore`)
  data/                 levels.ts (luoghi reali + coordinate + ordine di sblocco,
                         isLevelUnlocked), level1/triggers.ts (trigger segnaposto
                         `TODO_LDTK`, Fase 4), dialogues/level1_intro.ts (dialogo vero
                         della scena di apertura) — contenuto statico, NON nello store
  store/                gameStore.ts (fase/schermata), levelStore.ts (macchina a stati DEL
                         LIVELLO in corso, Fase 4 — vedi "Livello 1 — 2D" più sotto),
                         settingsStore.ts (persistito),
                         progressStore.ts (persistito: completedLevelIds, "Set di id,
                         mai un contatore" — stesso pattern di `completedLevelIds`)
  hooks/                useBackgroundMusic.ts, useSfx.ts, useAnyInput.ts (unifica
                         tastiera/mouse-touch/gamepad in un'unica callback "premi
                         qualcosa" — vedi "Regole architetturali"), useDialogue.ts
                         (avanza un dialogo per pressione via useAnyInput, generico
                         sulla forma di una riga — Fase 4, vedi "Livello 1 — 2D" più sotto)
  styles/               tokens.css (custom properties: colori/spazi/font/tempi — nessun
                         colore letterale nei module) + global.css (reset/layout) +
                         ui.module.css (primitivi condivisi) + *.module.css per componente
public/
  audio/theme.mp3        musica di sottofondo (deve stare in public/, non in src/)
  models/
    ingresso-oristano.glb    ambientazione completa: strada, cartello, case, distributore
                              ESSO, binari, muro AoT + portone (~1.8 MB, ~800+ mesh)
    personaggio-base.glb, personaggio-jab.glb   personaggio "Saitama", mesh STATICHE
                              cotte (niente skin/scheletro — vedi "Pipeline Blender" sul perché).
                              Solo questi due: lo scatto finale verso il muro non usa un
                              terzo modello dedicato, vedi "sequenza cinematica" sotto.
assets/blender/
  ingresso_oristano.blend    sorgente Blender dell'ambientazione, versionato nel repo
docs/
  APP_EXPLAINER.md      spiegazione generale dell'app
  MENU_INTRO.md         architettura dettagliata scena menu, sequenza personaggio,
                         pipeline Blender (Cell Fracture), insidie note
```

`game/scene/` nelle chat più vecchie è stato rinominato in `game/levels/Level1/` per
supportare più livelli in futuro — se una fonte esterna cita `scene/`, è superata.

Il sorgente Blender del personaggio (`saitama.blend`, collezioni `Personaggio_Base`/`_Jab`)
**non è nel repo**: vive in `Documents/Blender projects/saitama.blend` sulla macchina
di sviluppo. Se serve ri-esportare i modelli, è lì — vedi `docs/MENU_INTRO.md` per le
impostazioni di export corrette (fondamentale: `export_apply=True`, `export_skins=False`).
`Personaggio_Salto` (terzo modello, a bassa poligonazione) non è più usato dal codice —
vedi "sequenza cinematica" sotto sul perché — anche se dovesse essere ancora presente nel
file sorgente.

## Regole architetturali

- **Flusso dati a senso unico**: `data/ → store/ → game/ e components/`. Mai il contrario
  (un componente UI/DOM non deve importare da un componente 3D, e viceversa).
- **"Un oggetto ha un solo padrone"**: GSAP guida ciò che deve muoversi a comando (camera,
  dissolvenze, cue audio); Rapier guida ciò che deve sembrare fisico e non scriptato (i
  detriti: si dà un impulso e non si tocca più); Howler viene chiamato dalla timeline, non
  guida nulla lui stesso. Eccezione: la camera nel menu — GSAP anima un oggetto `base`,
  `useFrame` ricostruisce `camera.position` sommando eventuali offset (mai far possedere a
  GSAP direttamente `camera.position`, o un offset sommato andrebbe alla deriva).
- **Più registi della camera, mai insieme**: `CameraDirector` possiede la camera nelle fasi
  `intro`/`ready`, `CharacterIntro` la possiede in `punching` e per la primissima parte di
  `breaking` (fino al fotogramma dell'impatto, per finire lo scatto verso il muro), poi la
  cede a `CameraDirector` per il resto di `breaking` (pull-back, attraversamento del varco,
  finale). Il cambio non è implicito nell'ordine di montaggio (R3F non lo garantisce): è un
  guard esplicito su entrambi i lati — `CameraDirector` con `if (phase === 'punching')
  return;` nel suo `useFrame`, `CharacterIntro` con un ref `ownsCamera` che passa a `false`
  nello stesso `.call()` GSAP che invoca `onImpact()`, e il suo `useFrame` smette di scrivere
  su `camera.position`/`.lookAt`/`.fov` da quel fotogramma in poi (continua però ad animare
  la posizione del personaggio: quello non è mai stato conteso).
- **Il fade to white finale vive in `App.tsx`, non nella schermata che lo accende**: quando
  `useGameStore.screen` cambia, la schermata attuale (`MenuScene`, dentro `<Suspense>`)
  sparisce di colpo — nessun cross-fade tra componenti React. Un overlay bianco che vivesse
  dentro `MenuScene` sparirebbe insieme a lei nel fotogramma esatto del taglio, lasciando
  scoperto proprio il momento che doveva coprire. `App` tiene lo stato del whiteout, lo
  passa giù come callback (`onWhiteout`, oggi acceso da `CameraDirector` nel finale
  "attraverso il varco"), e lo rispegne da solo un istante dopo che `screen` cambia (fade-in
  dal bianco sulla schermata nuova) — chi accende il bianco decide QUANDO cambiare
  schermata, non se riportarlo giù: quello è generico e sta in `App` una volta sola.
- **Nessun bottone "Gioca": il menu si avvia con "premi qualcosa"**. `MenuScene` usa
  `useAnyInput` (`src/hooks/`) per ascoltare tastiera/mouse-touch/gamepad come un unico
  input generico, con effetti diversi a seconda della fase: durante `'intro'` fa scattare
  `skipIntroToken` (un contatore, non un booleano — ogni pressione deve poter far scattare
  di nuovo l'effetto in `CameraDirector` anche se il valore "logico" non cambia), che
  porta la timeline dell'intro al suo stato finale via `introTimelineRef.current
  .progress(1)` invece di continuare il volo; durante `'ready'` avvia la sequenza vera. La
  PRIMA pressione durante l'intro fa solo da skip, non conta anche come "avvia" — ne serve
  una seconda una volta a `'ready'` (scelta esplicita, non un bug: l'utente deve vedere il
  prompt prima di agire). Elementi UI interattivi sopra la scena (`SettingsBar`, il link
  "Seleziona livello") fermano `pointerdown`/`keydown` con `stopPropagation` per non far
  scattare l'input generico insieme al proprio click — e per la stessa ragione il bottone
  di `SettingsBar` si sfoca (`blur()`) subito dopo il click: un fuoco lasciato lì sopra
  intercetterebbe (silenziosamente) anche una pressione successiva che non ha più niente a
  che fare con le impostazioni, dato che `stopPropagation` agisce su TUTTO ciò che
  attraversa quel contenitore, fuoco residuo incluso.
- **GSAP `lagSmoothing`**: attivo di default, ammortizza gli scatti quando un fotogramma
  tarda oltre 500ms rallentando la timeline invece di farla saltare avanti. Su una timeline
  one-shot (intro, sequenza del personaggio) è la scelta sbagliata: durante il caricamento
  di asset pesanti o su hardware lento la sequenza rallenta invece di recuperare il tempo
  perso. `CharacterIntro.tsx` lo disattiva globalmente con `gsap.ticker.lagSmoothing(0)`.
- **Stato**: in Zustand solo ciò che deve sopravvivere al cambio schermata o persistere
  (impostazioni). Fase/variante locali a una schermata → `useState` nel componente. Valori
  che cambiano ogni frame (posizione camera, "chi è esploso") → `useRef`/oggetti Three, mai
  `useState` dentro `useFrame` (causerebbe 60 render al secondo).
- **Varianti di rottura del muro**: ognuna è una funzione pura
  `(context: BreakContext) => ChunkKick[]`, senza dipendenze da React/Three/Rapier/camera/
  audio. Per aggiungerne una: nuovo file in `breakPatterns/`, aggiungere il nome al tipo
  `BreakVariant`, registrarla nel `Record` — il compilatore blocca se si dimentica
  l'ultimo passo. La scena non va toccata.
- **Timeline GSAP**: tutto è ancorato al terzo argomento (posizione assoluta) di `.to()`/
  `.call()`, sincronizzato su `VARIANT_IMPACT_DELAY[variant]`. Gli impulsi fisici NON sono
  nella timeline GSAP: girano su un cursore in `useFrame` su una lista pre-ordinata per
  ritardo — il timing della fisica sta nel codice della fisica, GSAP resta il direttore.

## Convenzioni di codice

- Named export ovunque (niente default export incoerenti).
- Alias `@/` → `src/` (configurato in `vite.config.ts` e `tsconfig.json`).
- `<Suspense>` attorno a contenuti async R3F (es. `<Environment>` di drei sospende).
- CSS Modules per componente + `styles/global.css` (reset/layout) + `styles/ui.module.css`
  (primitivi condivisi, riusati con `composes: ... from ui.module.css`).
- ESLint configurato (`@typescript-eslint` + `react-hooks`), ma **`eslint-plugin-react` è
  disattivo di proposito** — `react/no-unknown-property` segnalerebbe come errore ogni prop
  R3F (`<mesh position>`, `<boxGeometry args>`). Non riattivarlo senza escludere quella regola.
- Niente `useRef<any>`: nasconde bug (è già successo con `setLinvel` a cui mancava `wakeUp`).
- `RigidBodyType` va importato con `import type`, mai come valore — altrimenti Rapier finisce
  duplicato nel bundle (~2MB in più, già successo una volta).

## Fisica (Rapier) — insidie note

Rapier oggi serve SOLO al muro del menu (`game/menu/wall/`, vedi sotto) — il Livello 1 è 2D
e non lo usa più (vedi "Livello 1 — 2D"), quindi queste insidie restano valide per il menu
ma non per i livelli.

- Un `RigidBody` emette `onIntersectionEnter` solo se ha la prop `sensor`.
- Frammenti/oggetti raccolti: tenere un `collectedIds: string[]`/Set, mai un contatore
  numerico (altrimenti si può raccogliere due volte lo stesso oggetto).
- I chunk del muro nascono `type="fixed"` e diventano dinamici uno alla volta all'impatto.
  Non usare `<Physics paused>`: appena tolta la pausa, la pila si assesta da sola e il muro
  trema prima di essere colpito.
- Un impulso è massa × Δv, non una velocità diretta — un blocco pesa ~10kg, per ~15 m/s
  serve un impulso ~150, non 5.
- `InstancedRigidBodies` è la scelta giusta SOLO per tanti corpi con geometria identica
  (istanze vere). I frammenti del muro (Cell Fracture da Blender) hanno ognuno una forma
  diversa: lì si usa un `<RigidBody colliders="hull">` per frammento (vedi
  `WallShatter.tsx`) — l'instancing non si applica.
- Il muro intero (portone + pannelli + contrafforti, ~218 frammenti) è frantumato in
  Blender, ma solo quelli entro `AFFECT_RADIUS` dall'origine dell'impatto diventano
  `RigidBody` a ogni rottura — il resto resta scenografia statica. Senza questo filtro,
  ogni rottura instanzierebbe centinaia di corpi fisici indipendentemente da quanto è
  esteso il muro.

## Livello 1 — 2D a scorrimento laterale

Riscrittura completa da MVP 3D (cubi/coni procedurali, Rapier, `OrbitControls`) a un vero
2D laterale, coerente con gli artwork del gioco (turnaround D0/D1/Eve, concept strada
Ariston) — piano completo in `docs/PIANO_LIVELLO1_2D.md`, Fase 1 (fondamenta) implementata.
Menu e selezione livelli restano 3D, invariati.

- **Ancora React Three Fiber, non un secondo motore**: stesso `<Canvas>`, ma
  `OrthographicCamera` di drei invece che prospettica, e mesh 2D (`meshBasicMaterial`, non
  illuminate) invece di mesh 3D. Niente Pixi.js: avrebbe richiesto un secondo canvas/loader
  asset/ponte verso Zustand per un beneficio che oggi non serve.
- **Niente Rapier in questo livello**: camminare/saltare/schivare/colpire sono eventi
  scriptati da rilevare, non simulazioni fisiche vere (a differenza dei detriti del muro,
  che restano fisici). Collisioni a mano in `src/game/render2d/`: `collision.ts` (funzioni
  pure `aabbOverlap`/`circleOverlap`/`circleAabbOverlap`, zero dipendenze React/Three — 
  riusabili anche per pattern di attacco/QTE futuri) + `useOverlap.ts` (hook `useFrame` con
  semantica `onEnter`/`onStay`/`onExit`, stessa forma di `onIntersectionEnter` di Rapier ma
  senza fisica sotto).
- **Convenzione di coordinate**: X = orizzontale (cammino), Y = verticale (salto, 0 = piedi
  a terra), Z = profondità per il parallasse (più negativo = più lontano dalla camera).
- **Parallasse (`ParallaxLayer.tsx`)**: legge `camera.position.x` direttamente via
  `useThree` dentro il proprio `useFrame` (mai una prop che cambia ogni frame da un
  genitore). Bug scoperto verificando a schermo: un layer opaco che copre l'INTERO frustum
  occlude per sempre quelli dietro, anche se il colore è "giusto" — un layer va alto solo
  quanto la propria fascia (cielo in alto, edifici a mezza altezza, marciapiede in basso),
  non quanto l'intero schermo. Oggi bande a tinta unita segnaposto in `SceneManager2D.tsx`,
  da sostituire col concept art Ariston ritagliato in layer (Fase 2/3 del piano) estendendo
  il componente, non riscrivendolo.
- **Sprite/sprite-sheet (`Sprite2D.tsx`)**: `useTexture` mette la texture in cache per URL —
  due sprite con lo stesso URL (es. due nemici con la stessa sagoma) condividerebbero
  l'identico oggetto `Texture`, quindi mutare `offset`/`repeat` su uno sposterebbe anche il
  fotogramma dell'altro. Sempre `texture.clone()` per istanza, mai mutare la texture in
  cache direttamente.
- **Camera**: nessun altro regista in questo livello (a differenza del menu), quindi
  `useFollowCameraX` può scrivere `camera.position` direttamente — insegue la X del
  giocatore con uno smorzamento lineare, letta da un ref (`PlayerPosition`), mai da uno
  state React (cambia ogni frame).
- **Oggetto raccoglibile ex-MVP rimosso**: il vecchio "raccogli 5 frammenti" (`Fragments.tsx`,
  `data/fragments.ts`, `GameOverlay.tsx`, `collectedFragmentIds` in `gameStore.ts`) non
  aveva equivalente nel nuovo design narrativo (dialoghi/boss/QTE, vedi il piano) ed è stato
  cancellato invece di essere adattato — era codice morto una volta tolta la scena 3D che lo
  usava. `resetProgress` in `gameStore.ts` resta come punto d'aggancio (oggi no-op) per lo
  stato che la Fase 4 del piano dovrà reimpostare a ogni (ri)avvio di un livello.
- `DemoObstacle.tsx` è un placeholder che dimostra `useOverlap` end-to-end (il rettangolo
  diventa verde mentre il giocatore ci cammina sopra) — da rimuovere quando arriva il primo
  trigger/pickup vero (Fase 2 del piano).
- **Sprite/animazione dei personaggi (Fase 3a)**: 12 PNG con trasparenza in
  `public/sprites/characters/{D0,D1,Eve}/{variant}_{front,back,side,action}.png` (ritagliati
  dalle turnaround sheet, sfondo tolto con alpha sfumata sui bordi). Sono POSE INTERE, non un
  rig a pezzi separati (torso/braccio/gamba indipendenti) — le pose sono illustrazioni
  composite, segmentarle in automatico non è affidabile senza rifare l'arte a pezzi isolati
  (Fase 3b, richiede nuova arte prodotta apposta, non estraibile da queste). `Character2D.tsx`
  (`render2d/`) carica la posa giusta con `Sprite2D` — la `width` non è mai fissata a mano:
  si deriva dalla proporzione naturale di CIASCUNA texture (`baseTexture.image.width/height`
  in `Sprite2D.tsx`), perché le 4 pose per personaggio hanno proporzioni diverse tra loro
  (es. `D0_side` è uno stretto 0.24, `D1_action` un largo 0.87) — una larghezza fissa le
  avrebbe schiacciate o stirate. `CharacterAnimator2D.tsx` traduce uno stato semantico
  (`idle`/`walk`/`attack`/`hit`/`transformToD1` — nomi indicativi, la vera macchina a stati
  del livello arriva in Fase 4) in posa + animazione GSAP: per `D0` il cammino è un vero
  ciclo a 2 fotogrammi (`front`↔`action`, la 4ª posa di D0 è già una posa a metà passo, non
  un'azione di combattimento — scoperta guardando gli export); `D1`/`Eve` non hanno una posa
  a metà passo, quindi camminano con un dondolio procedurale (`rotation.z` simmetrico, GSAP
  `fromTo`/yoyo) sulla posa `front`. Il flash da colpo (`hit`) è un tint via materiale, non
  una texture dedicata: `material.color` portato sopra 1 con GSAP, compresso verso il bianco
  dal tone mapping ACES di default del renderer R3F — per questo `Sprite2D` espone un
  `materialRef` opzionale (mai animare un valore così via stato React: un tween tocca
  l'oggetto Three ad ogni fotogramma). La trasformazione D0→D1 (l'unica della storia) è un
  crossfade di ~0.4s tra due `Character2D` sovrapposti (`TransformCrossfade`, interno a
  `CharacterAnimator2D.tsx`) — un taglio onesto, non una finta transizione fluida che non
  abbiamo i fotogrammi per fare davvero. `Player2D.tsx` usa già `CharacterAnimator2D` per
  `D0` (stato `walk`/`idle` derivato dal movimento reale) al posto del vecchio rettangolo
  segnaposto; nessun trigger vero ancora per `attack`/`hit`/`transformToD1` (arrivano col
  combattimento vero, non ancora costruito). Verificato a schermo (Playwright headless, non
  solo compilato): pose/varianti visivamente distinte e coerenti con la trama (D0 disarmato,
  D1/Eve con la lama), mirroring corretto, crossfade che si assesta su D1.
- **Macchina a stati del livello (Fase 4)**: `levelStore.ts` (`phase: LevelPhase` con le 14
  fasi dello storyboard, `setPhase`) — separato da `gameStore.ts` (fase/schermata GLOBALE,
  valida anche nel menu), stesso principio di `MenuPhase`. `SceneManager2D` legge `phase` e
  monta ESATTAMENTE i componenti che servono, mai un unico componente con `if` a cascata.
  Solo `intro_dialogo` (dialogo vero, sotto) e `cammino_libero_ariston` (Player2D + IA di
  Eve) hanno contenuto reale oggi — le altre 12 fasi montano un placeholder onesto (il nome
  della fase, "non ancora implementata"): esistono già nel tipo perché il compilatore
  blocchi se `SceneManager2D` ne dimentica una (stesso principio di `BreakVariant`), non
  perché abbiano gameplay. `gameStore.resetProgress` (chiamato da `LevelSelectScene` al
  lancio, vedi sopra) ora riporta `levelStore` a `intro_dialogo` — il punto d'aggancio che
  era stato lasciato vuoto in Fase 1 è quello.
- **Trigger segnaposto**: `data/level1/triggers.ts`, marcati `TODO_LDTK` — coordinate X
  scritte a mano ("onestamente a caso", da tarare a vista), ma il codice che le legge è già
  quello definitivo: quando arriveranno le zone vere lette da LDtk (Fase 2), cambia solo
  questo file di dati, zero logica da riscrivere. `useXTrigger` (`render2d/`, stesso
  principio one-shot di `useOverlap`: richiama `onReach` una volta sola, mai più anche
  tornando indietro) collega `aristonEntranceX` alla transizione `cammino_libero_ariston` →
  `attivita_stupide`. `eveArrivalX` invece NON è un trigger di cammino: è la posizione di
  MESSA IN SCENA di D/Eve durante `intro_dialogo` (i due stanno fermi lì per tutta la
  cutscene) — la distinzione conta: un dialogo occupa l'INTERA fase (vedi sotto), non c'è
  "cammino verso Eve" da intercettare a metà fase. `sala1EntranceX` è definito ma non ancora
  consumato da nessun codice (la fase `attivita_stupide` che dovrebbe leggerlo è lei stessa
  solo un placeholder oggi).
- **Dialogo** (`data/dialogues/level1_intro.ts`, contenuto vero — la scena di apertura,
  tono "D scoglionato, Eve seria/burocratica per contrasto"): `useDialogue<T>` (`hooks/`,
  generico sulla forma di una riga, non importa `DialogueLine` da nessun file di dati
  specifico) avanza un indice per pressione via `useAnyInput`. `DialogueBox.tsx`
  (`components/`) è l'overlay HTML che lo disegna — vive FUORI dal `<Canvas>` (stesso motivo
  del video di salto nel menu: R3F non sa montare un `<div>`), quindi `useDialogue` va
  chiamato nel componente ESTERNO al Canvas (`SceneManager2D`), mai dentro l'albero R3F.
  Chiamato incondizionatamente (regola delle hook: niente hook dietro un `if`) ma con
  `enabled: phase === 'intro_dialogo'`, così un tasto premuto in un'altra fase non fa
  avanzare in sordina un indice che nessuno mostra. Quando il dialogo finisce
  (`isDone`), `SceneManager2D` chiama `setPhase('cammino_libero_ariston')` da un
  `useEffect` — non da dentro il render.
- **IA di compagnia di Eve** (`EveCompanion.tsx`): segui-dietro con un offset smorzato
  (`position.x += (target - position.x) * smoothing`, stesso pattern non normalizzato per
  `delta` già usato in `useFollowCameraX` — coerenza con lo stile esistente, non
  un'imprecisione dimenticata), target = `D.x - FOLLOW_DISTANCE` fisso (il livello è
  lineare, nessun pathfinding, nessuna logica legata alla direzione in cui D guarda). Lo
  stato "sta camminando?" di Eve NON si legge da quello di `Player2D` (che non lo espone):
  si deriva dal proprio spostamento per fotogramma sopra una soglia (`MOVEMENT_EPSILON`) —
  altrimenti un lerp che non arriva mai esattamente a 0 (decadimento esponenziale) la
  lascerebbe "in cammino" all'infinito anche da ferma. Effetto collaterale onesto: Eve resta
  in posa `walk` per circa 1-1.5s dopo che D si è fermato, prima di passare a `idle` — un
  v1 accettabile, non un bug da correggere alla cieca.
  Verificato a schermo (Playwright headless): l'intera catena
  `intro_dialogo` (dialogo reale, 13 battute) → `cammino_libero_ariston` (D comandabile, Eve
  che segue) → `attivita_stupide` (placeholder) gioca per intero senza errori console.

## Boss arena (`boss_fase1`) — in costruzione

Combattimento a scorrimento laterale su un palco chiuso, camera fissa
(`game/levels/BossArena/`: `arenaConfig.ts`, `arenaState.ts`, `PlayerArena.tsx`,
`SceneManagerBossArena.tsx`) — piano completo nel documento di handoff del boss
fight. `App.tsx` monta l'arena quando `levelPhase === 'boss_fase1'`, mai insieme a
`SceneManager2D`/`SceneManager2DIso`. Il giocatore è `D1` (`ARENA_PLAYER_VARIANT`).
Fatto (tutto il piano, passi 1-10):
- Giocatore: attacco `J`/click sx, parata `K`/click dx, dash `Shift` (i-frames),
  salto `Spazio`; stati `parry`/`stagger` in `CharacterAnimator2D`.
- Checco (`BossChecco.tsx`): mosse in DATI (`checcoMoves.ts`, round 1 e round 2),
  postura (colpi e parate la alzano, decade da sola, a 100 barcolla e prende danni
  doppi), evento "Avvia il film" a `SPECIAL_TRIGGER_HP` (windup lungo; interrotto se
  si para negli ultimi secondi o si infligge `SPECIAL_INTERRUPT_DAMAGE`; completato
  altrimenti) con buff/malus, cambio sfondo in crossfade (`ArenaBackdrop.tsx`, film
  segnaposto generati via canvas) e round 2. A vita 0 Checco fugge →
  `transizione_seconda_spada`; se muore il giocatore l'arena riparte da zero.
- Eve (`EveArena.tsx`): a terra all'inizio, `F` la richiama, poi supporto marginale.
- HUD (`components/ArenaHud.tsx`, dati da `store/arenaStore.ts`), hit-stop e
  contraccolpo dopo parata riuscita.
Difficoltà aggiunta (piano "arena più ostica", passi 1-6): arena lunga 22 unità con
camera che segue il punto medio giocatore/boss (`ArenaCameraRig`, clamp ai bordi);
corpo solido di Checco (`BOSS_BLOCK_*`: il giocatore non lo attraversa, lo scavalca
saltando — per questo `ARENA_JUMP_SPEED` è 9.5; vale in un solo senso); Checco ha un
asse Y (`boss.y`) con le mosse `balzo` (gap closer, parabile) e `schianto`/
`schianto_ampio` (sale, pausa in aria, onda d'urto dai due lati NON parabile: `leap`,
`bothSides`, `unparryable` in `checcoMoves.ts`); 3 cure (`R`, canalizzazione 0.8s
interrompibile, nessun i-frame) e barra abilità 0-100 (`E`: due soglie a 50/100, una
sola tasto esegue la più forte disponibile; si carica con colpi a segno, parate e
barcollamenti INFLITTI, mai subiti). Le due mosse d'abilità sono segnaposto
(`SKILL_TIERS`). L'evento "Avvia il film" scatta ora a una FRAZIONE della vita massima
(`SPECIAL_TRIGGER_HP_FRACTION`), non a un numero fisso. Non ancora fatto (passi 7-10
del piano): finale sotto il 10% di vita con Eve che si rialza, QTE cooperativo,
trasformazione in marionetta, `Sotterraneo`.

Stato per-frame condiviso in un solo oggetto `ArenaWorld` (`arenaState.ts`, ref),
regole di danno in `combat.ts`; lo store Zustand riceve solo copie agli eventi.
Checco è ancora un segnaposto a tinte unite: rosso = carica il colpo, bianco =
colpo attivo, azzurro = barcolla, oro lampeggiante = evento speciale. Tutti i
numeri in `arenaConfig.ts`, da tarare giocando. In sviluppo `window.__arenaWorld`
espone il mondo per provare esiti/round da console (es. `__arenaWorld.boss.hp = 60`).

**Due entrate PROVVISORIE all'arena, da rimuovere quando non servono più a testare o
quando ci sarà una selezione dei boss** (i due punti da togliere):
1. Camminare dentro `Sala_boss` nell'interno isometrico: `SceneManager2DIso.tsx`
   (`BOSS_ROOM_LEVEL`) avvia `boss_fase1` invece di caricare la stanza. Il dialogo
   `dialogo_pre_boss`, quando esisterà, va inserito davanti a questo passaggio.
2. Solo in sviluppo (`import.meta.env.DEV`): `F9` salta all'arena da qualunque
   schermata, `F8` torna fuori dall'Ariston — `hooks/useDevBossShortcut.ts`, montato
   in `App.tsx`. In sviluppo si vedono anche le hitbox (gialla = attacco, azzurra =
   finestra di parata) e `1`/`2`/`3` mostrano le anteprime colpo/barcollo/parata.

## Bundle/performance

- Code splitting via `rolldownOptions.output.codeSplitting` in `vite.config.ts`: un solo
  gruppo `vendor` con **`entriesAware: true`**. Senza `entriesAware`, il raggruppamento
  risucchia le dipendenze in base a chi le importa transitivamente e Rapier finisce
  precaricato anche nel menu. Non spezzare in più gruppi manuali senza capire bene
  `includeDependenciesRecursively`.
- `cssCodeSplit: false`: altrimenti `ui.module.css` viene duplicato in ogni chunk.
- Il chunk Rapier (~2MB, WASM) resta grande di proposito: è il motore fisico, si carica solo
  quando serve (non al primo load del menu). Non alzare `chunkSizeWarningLimit` per
  nascondere il warning.
- **Niente asset drei scaricati da CDN esterni a runtime**: `<Cloud>` usato standalone (senza
  un `<Clouds texture=...>` che lo avvolga) e `<Environment preset="...">` vanno di default a
  scaricare rispettivamente una texture da `githack.com` e un `.hdr` da
  `raw.githubusercontent.com/pmndrs/drei-assets` — CDN gratuiti, non garantiti, e già visto
  in pratica rispondere 429 (rate limit) — su **due preset diversi** (`sunset` nel menu,
  `dawn` in "Seleziona livello": ogni preset è un `.hdr` diverso sullo stesso CDN, quindi il
  bug si ripresenta scena per scena, non è bastato sistemarne una): l'errore non gestito
  risale fino all'`ErrorBoundary` di R3F e manda in crash l'intero `<Canvas>` (`WebGLRenderer:
  Context Lost`). Fix adottato in `MainMenuSceneAnimation.tsx` e `LevelSelectScene.tsx`:
  nuvole con una texture generata al volo via `<canvas>` (`CLOUD_TEXTURE`, un cerchio
  sfumato, passata esplicitamente a `<Clouds texture=...>`), ambient/riflessi con una
  cubemap procedurale da un paio di `<Lightformer>` colorati (`<Environment
  resolution={64}>...</Environment>`, nessun file da scaricare) invece del preset HDR — se
  si aggiunge un `<Environment preset="...">` altrove (es. `Level1`), stesso trattamento.
  Stessa cautela se in futuro si aggiungono altri componenti drei con default remoti
  (`useTexture`/`useGLTF` su URL esterni, non solo su `public/`).

## Pipeline Blender — insidie note (imparate sul campo, non in teoria)

- **Cell Fracture**: `use_remove_original=True` nell'operatore NON cancella davvero
  l'oggetto sorgente — resta come mesh solida invisibile-di-nome sovrapposta ai frammenti.
  Va cancellato a mano dopo la frantumazione, sempre (successo due volte, sia sul muro sia
  sul telaio del portone).
- Frammenti Cell Fracture: `Object ▸ Set Origin ▸ Origin to Center of Mass` altrimenti
  ruotano attorno all'origine dell'oggetto intero e l'esplosione sembra un frullatore.
  Collider `hull` per i frammenti convessi, mai `trimesh` su corpi dinamici.
- **Crepe visibili a muro intatto**: i frammenti Cell Fracture hanno micro-fessure sempre
  visibili, anche da fermi. Soluzione adottata: una "copertura solida" (`Solid_*`) per
  ogni unità frantumata, cioè un box pieno alle stesse dimensioni, mostrato SOLO
  nell'ambientazione intatta (`Wall.tsx` nasconde i frammenti, mostra i `Solid_*`);
  `WallShatter.tsx` fa l'esatto contrario. Attenzione: se l'unità originale aveva un
  buco (es. il telaio del portone attorno all'apertura), la copertura solida deve essere
  una vera cornice con lo stesso buco, non un box pieno — altrimenti si "chiude" il varco
  con un blocco intero e nasconde ciò che dovrebbe restare visibile.
- **Personaggi rigged con parent a scala anomala** (es. un Empty con `scale=100` che
  Blender compensa "gratis" in viewport perché l'armatura in bind pose deforma la mesh
  *sopra* quella scala): l'export `.glb` **non porta con sé quella correzione**. In
  Three.js/glTF il risultato è una mesh mostruosamente grande o, peggio, **stirata in
  modo non uniforme per-osso** (skin/inverse-bind-matrix export non affidabile con questo
  tipo di gerarchia) — non basta una correzione di scala a livello di gruppo nel codice
  React, perché la distorsione è interna alla skin, non solo di scala/posizione globale.
  **Fix che funziona davvero**: ri-esportare con `export_apply=True` (bake della
  deformazione dell'armatura in mesh statica) e `export_skins=False` — si perde la
  possibilità di animare i singoli ossi via codice, ma si guadagna un modello integro.
  Se serve muovere una singola parte (es. la testa), l'alternativa è ruotare l'intero
  oggetto o isolare quella parte come mesh separata in Blender PRIMA dell'export.
  **Tentativo di fix "vero" (riprovato e abbandonato una seconda volta)**: `transform_apply`
  sull'Empty radice non elimina lo scale=100, lo sposta nel `matrix_parent_inverse` del
  figlio (Blender lo usa per mantenere invariato l'aspetto in world-space quando un
  genitore cambia) — i bounds via vertice restano identici prima/dopo, quindi non è un
  fix. Anche sganciare armatura+mesh dalla gerarchia con "Clear Parent and Keep
  Transform" (per portare la scala nei dati veri, non in una matrice nascosta) non
  converge in modo affidabile: le misure numeriche (bounds dei vertici via
  `matrix_world`) e l'aspetto nel viewport hanno smesso di coincidere, segno che la
  combinazione Armature modifier + questa gerarchia particolare deforma i vertici in uno
  spazio che non si lascia separare con operazioni di trasformazione a livello di
  oggetto. Non riprovare senza una ragione nuova (es. uno strumento di retargeting
  dedicato) — vedi anche più sotto, sequenza cinematica del personaggio: lo scatto verso
  il muro ora aggira il problema con tecniche cinematiche invece di un vero rig.
- Personaggio con animazione "pugno" (se in futuro si userà un vero mixer di animazioni,
  non lo schema statico attuale): misurare in Blender il frame dell'impatto, convertirlo
  in secondi e usarlo come `VARIANT_IMPACT_DELAY.punch` — tutto il resto (camera, audio,
  scossone) si riallinea da solo.
- **`bpy.ops.object.select_all`** può fallire con "context is incorrect" se il contesto
  Blender non ha un'area valida attiva (capita spesso via MCP dopo aver manipolato il
  viewport per screenshot). Preferire la deselezione diretta via API
  (`for o in bpy.data.objects: o.select_set(False)`) invece dell'operatore.
- **Dopo un crash/recovery di Blender**, `obj.location`/`.matrix_world` possono restare
  "vecchi" (leggere `(0,0,0)` anche su oggetti posizionati correttamente) finché non si
  forza `bpy.context.view_layer.update()`. Fidarsi sempre dei bounds calcolati dai vertici
  (`matrix_world @ v.co`), mai di `.location` da solo, dopo un evento del genere.
- Dettagli operativi completi, incluso il flusso di conversione assi Blender→Three
  (`export_yup=True`: `x3=xB`, `y3=zB`, `z3=-yB`), in `docs/MENU_INTRO.md`.

## Piccola cosa da pulire

`src/audio/theme.mp3` è un duplicato non più referenziato dal codice (l'hook
`useBackgroundMusic.ts` usa `public/audio/theme.mp3` tramite `import.meta.env.BASE_URL`) —
può essere cancellato.

## Stato del progetto

**Fatto**: scaffolding, selezione livelli, fondamenta 2D del Livello 1 + sprite/animazione
di D0/D1/Eve + scheletro della macchina a stati con la prima scena giocabile per intero
(Fasi 1, 3a e 4 del piano, vedi "Livello 1 — 2D" più sopra), audio manager
(`useBackgroundMusic`, `useSfx`), impostazioni persistenti, CSS Modules, code splitting,
ESLint configurato, alias `@/`,
base path GitHub Pages.

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

**In corso**: taratura fine delle inquadrature della sequenza del personaggio e dei tempi
della raffica cinematica dello scatto e del finale (verificata funzionante end-to-end, ma
il posizionamento di camera/personaggio/beat resta "da rifinire a vista" come il resto
della coreografia GSAP); il file `LEAP_VIDEO_URL` (`public/video/saitama-run-punch.mp4`) è
nel repository, `SAITAMA_TIMING.leapVideo` (1.3s) è già tarato sulla sua durata reale ma va
riverificato se il file cambia; SFX del muro collegati nel codice (`useSfx`) ma mancano
ancora i file `public/audio/sfx/wall-impact.mp3` e `rubble.mp3`; il livello `cagliari-bastione`
in `data/levels.ts` ha coordinate reali aggiornate (39.204583, 9.131139 — zona costiera vicino
allo stadio, non più il Bastione di Saint Remy) ma `name`/`description` sono un placeholder
onesto ("Cagliari" / "nome da confermare") in attesa di sapere cosa rappresenta esattamente
quel punto per l'utente — non blocca nient'altro (mappa/marker/gioco funzionano comunque),
ma va sistemato prima che il livello sia "finito".

**Da fare**: Fasi 2, 3b, 5 del Livello 1 2D + il resto della Fase 4
(`docs/PIANO_LIVELLO1_2D.md`, dettaglio Fase 3 in `docs/FASE3_RIG_PERSONAGGI.md`, dettaglio
Fase 4 in `docs/FASE4_MACCHINA_STATI.md`) — pipeline LDtk per la disposizione dei livelli
(sostituirà i trigger `TODO_LDTK` di `data/level1/triggers.ts`), un vero rig a pezzi
(richiede arte prodotta apposta, non prevista finché non serve davvero — la Fase 3a a swap
di pose intere basta per lo storyboard attuale), le 12 fasi della macchina a stati oltre
`intro_dialogo`/`cammino_libero_ariston` (attività stupide, boss in due fasi, combo doppia
spada QTE, fuga/inseguimento/cannone, dialogo finale, punteggio — oggi solo placeholder,
vedi "Livello 1 — 2D"), verifica/playtest. Fatte: Fase 1 (fondamenta — parallasse/
collisioni/camera, segnaposto a rettangoli colorati), Fase 3a (sprite/animazione D0/D1/Eve a
swap di pose) e lo scheletro della Fase 4 (macchina a stati, dialogo vero della scena di
apertura, IA di compagnia di Eve — vedi "Livello 1 — 2D" più sopra); eventuale
vera animazione scheletrica per il personaggio del MENU se in futuro si deciderà di riaprire
il problema dell'export con skin (oggi tutto il movimento è camera/GSAP su mesh statiche,
nessun mixer); un modello Blender vero anche per Cagliari (Oristano e Silì ce l'hanno già) al
posto del placeholder "ponte"; puzzle, sistema achievement, finale celebrativo; esecuzione
effettiva del deploy su GitHub Pages (script `npm run deploy` già pronto — occhio al PATH di
`git` su Windows se `gh-pages` fallisce con `spawn git ENOENT`, vedi `README.md`).

Per il dettaglio di architettura scena-menu, sequenza personaggio e pipeline Blender vedi
`docs/MENU_INTRO.md`; per la spiegazione generale dell'app vedi `docs/APP_EXPLAINER.md`; per
il piano di riscrittura 2D del Livello 1 vedi `docs/PIANO_LIVELLO1_2D.md`, per il dettaglio
degli sprite/animazione dei personaggi (Fase 3a) `docs/FASE3_RIG_PERSONAGGI.md`, e per lo
scheletro della macchina a stati e il dialogo di apertura (Fase 4)
`docs/FASE4_MACCHINA_STATI.md`.
