<!-- Riferimento di dettaglio spostato da CLAUDE.md (FASE 7): copia fedele della sezione. -->

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
- `DemoObstacle.tsx` (placeholder di `useOverlap`) è stato rimosso: vedi «Esterno dell'Ariston» in fondo. `useOverlap`/`collision.ts` restano.
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

## Esterno dell'Ariston: sfondo, navicella, ingresso con tasto

Il livello inizia davanti al cinema, D ed Eve già sul marciapiede accanto alla navicella schiantata; si entra premendo «interagisci» sulla porta centrale (non più a una X).

- **Sfondo** (`Level1Backdrop.tsx`): UNA immagine (`public/sprites/backgrounds/ariston_ingresso.webp`, 3002×703, WebP lossless da `scripts/prepare-level1-art.mjs`, sorgenti fuori dal repo), `NearestFilter`, ferma nel mondo (niente `ParallaxLayer`, ora inutilizzato). **54 px dell'immagine = 1 unità** (D ~103 px, le porte interne ~120), X = px/54 con l'origine sul bordo sinistro; i piedi poggiano sulla riga `BACKDROP_GROUND_ROW_PX` (= `GROUND_Y`). Lo zoom è `altezza schermo / CAMERA_VIEW_HEIGHT` (10 u dal fondo dell'immagine in su: il cielo in cima resta fuori campo; scala uniforme, niente stretching) e la camera non esce dai bordi (`clampCameraX`). Il canvas è `flat` (niente tone mapping: i colori sono quelli del file).
- **Posizioni** (`level1Config.ts`): `ARISTON_DOOR_X` (+`_HALF_WIDTH`, la zona), `SHIP_X`/`SHIP_BASE_Y`/`SHIP_HEIGHT` (la navicella sta in mezzo all'incrocio, oltre il limite del cammino), `SIDEWALK_MIN_X`/`_MAX_X` (i limiti del cammino: a destra dove finiscono le colonnine, prima delle strisce). Le partenze stanno in `data/level1/triggers.ts` (`startX`, `eveStartX`, `aristonExitX`, fuori dalla zona della porta: lo verifica `tests/level1Exterior.test.mjs`).
- **Navicella** (`Spaceship.tsx`): sprite dietro ai personaggi (z −0.5), non è un ostacolo. Il fumo è in codice (6 sbuffi con una texture a cerchio sfumato, un solo `useFrame`). La PNG ha già qualche filo di fumo disegnato.
- **Ingresso**: `DoorPromptDriver` (nel Canvas) calcola ogni frame se D è nella zona (`interactZone.ts`, puro) e posiziona il suggerimento HTML `DoorPrompt` («Entra» + `ActionGlyph action="interact"`) sopra l'insegna, scrivendo su ref/`dataset` (niente `setState` a 60 fps). La pressione è `useActionPress` in `SceneManager2D`: vale solo in `cammino_libero_ariston`, con D nella zona e una volta sola (`enteringRef`); in pausa il gestore non consegna le pressioni. Poi whiteout e `attivita_stupide`, come prima.
- **Inizio**: il video chiude col nero, la scena ne esce con una dissolvenza (`fadeIn`, solo dopo il video). D parte rivolto a sinistra (`Player2D.initialFacing`); uscendo dall'interno riappare a `aristonExitX` rivolto a destra.
- **Eve se ne va**: entrando nell'Ariston `SceneManager2D` mette `levelStore.eveWithParty = false` (sotto il whiteout; per storia va da Checco), e l'esterno non la monta più, nemmeno quando D riesce. Si azzera con `resetLevel()`.
- **Eve** (`EveCompanion`, finché c'è) sta «dietro» rispetto alla direzione di D (cambia lato dopo 0,8 u nel nuovo verso), non più sempre a sinistra: ora si cammina nei due versi.

