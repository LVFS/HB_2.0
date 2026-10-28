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

## Quando leggere cosa

CLAUDE.md contiene regole e mappe; il dettaglio di ogni area sta in `docs/`. Prima di
toccare un'area, leggi il suo documento:

| Tocchi… | Leggi |
|---|---|
| l'arena del boss (`game/levels/BossArena/`, `components/ArenaHud`, store dell'arena) | `docs/BOSS_ARENA_RIFERIMENTO.md` (design originale: `docs/FASE6_ARENA_BOSS_COMBATTIMENTO.md`, `docs/FASE6b_ARENA_DIFFICOLTA_ABILITA_FINALE.md`) |
| il Livello 1 2D, `render2d/`, la macchina a stati del livello, i dialoghi | `docs/LIVELLO1_RIFERIMENTO.md` (+ `docs/PIANO_LIVELLO1_2D.md`, `docs/FASE4_MACCHINA_STATI.md`) |
| l'interno isometrico dell'Ariston (LDtk) | `docs/FASE5_INTERNO_ISOMETRICO.md`, `docs/FASE4b_ATTIVITA_E_PREBOSS.md` |
| il menu iniziale o la selezione livelli | `docs/MENU_E_SELEZIONE_LIVELLI_RIFERIMENTO.md`, `docs/MENU_INTRO.md` |
| sprite/animazione dei personaggi | `docs/FASE3_RIG_PERSONAGGI.md` |
| il tunnel dell'inseguimento (`game/levels/Tunnel/`), `SkipCutscene` | `docs/FASE8_TUNNEL_INSEGUIMENTO.md` (in fondo: stato di esecuzione e scostamenti) |
| Slancio, bonus, eventi e finestra sulla marionetta del tunnel | `docs/FASE9_TUNNEL_POTENZIAMENTI.md` |
| distanza fisica, casella bonus, inquadratura fissa, tempo limite, tre vie, onde di Checco e modalità, desideri di Shenron | `docs/FASE10_TUNNEL_DISTANZA_VIE_EVENTI.md` |
| le cutscene da storyboard (pre-boss `dialogo_pre_boss`, intermezzo del finale dell'arena, `game/cutscenes/`, `data/cutscenes/`) | `docs/FASE11_CUTSCENE_STORYBOARD.md` |
| il refactor dell'arena e le primitive condivise | `docs/FASE7_PULIZIA_REFACTOR.md` |
| una panoramica dell'app | `docs/APP_EXPLAINER.md` |

## Struttura del progetto

```
src/
  App.tsx, main.tsx       routing delle schermate/fasi + whiteout (vedi "Regole architetturali")
  game/
    menu/                 schermata iniziale 3D: MenuScene.tsx (macchina a stati), muro distruttibile
                          (wall/, Rapier), sequenza del personaggio (character/, GSAP)
      levelSelect/        selezione livelli su mappa reale: UNA scena Three.js (isola fluttuante,
                          marker, camera GSAP/MapControls, transizione a nuvole)
    levels/
      Level1/             2D a scorrimento laterale fuori dall'Ariston (SceneManager2D, Player2D,
                          EveCompanion)
      Level1Interior/     interno isometrico dell'Ariston da LDtk (`attivita_stupide`)
      BossArena/          arena del boss (`boss_fase1`): BossChecco.tsx (orchestratore) + moduli
                          boss*.ts senza React, PlayerArena, EveArena, ArenaThreats, finale.ts,
                          finisher.ts, qte.ts, combat.ts, arenaConfig.ts, arenaState.ts
      Sotterraneo/        scena scriptata dopo il finale del boss (`transizione_seconda_spada`)
      Tunnel/             inseguimento (`boss_fase2_tunnel` → `combo_doppia_spada_qte` → `fuga_checco`):
                          UNA scena (SceneManagerTunnel) + moduli `tunnel*.ts` senza React
    render2d/             fondamenta 2D riusabili: Sprite2D, ParallaxLayer, useFollowCameraX,
                          collision.ts + useOverlap.ts (AABB a mano), useXTrigger, Character2D +
                          CharacterAnimator2D (D0/D1/Eve a swap di pose)
    shared/               primitive condivise per i modi di gioco con giocatore in tempo reale:
                          usePlayerActions.ts (input a azioni), jump.ts (stepJump)
  components/             HUD/overlay HTML: DialogueBox, SettingsBar, ArenaHud, QteChallenge,
                          PowerUpChoice, PowerUpIntro, SkipCutscene, LoadingScreen…
  data/                   contenuto statico, NON nello store: levels.ts, level1/triggers.ts,
                          dialogues/ (level1_intro, level1_sotterraneo)
  store/                  gameStore (fase/schermata), levelStore (macchina a stati DEL livello),
                          arenaStore (copie per la HUD dell'arena), settingsStore e progressStore
                          (persistiti; completedLevelIds è un Set di id, mai un contatore)
  hooks/                  useBackgroundMusic, useSfx, useAnyInput ("premi qualcosa" unificato),
                          useDialogue, useCutsceneSkip, useDevBossShortcut (solo dev)…
  styles/                 tokens.css (colori/spazi/font/tempi — nessun colore letterale nei module)
                          + global.css + ui.module.css (primitivi) + *.module.css per componente
public/                   audio/, models/ (GLB), sprites/, maps/ (immagini statiche generate),
                          ldtk/ (copia runtime di assets/ldtk/ — da ricopiare dopo ogni modifica LDtk)
assets/                   sorgenti versionati: blender/ (.blend), ldtk/
docs/                     riferimenti e piani (vedi "Quando leggere cosa")
```

`game/scene/` nelle chat più vecchie è stato rinominato in `game/levels/Level1/` per
supportare più livelli in futuro — se una fonte esterna cita `scene/`, è superata.

Il sorgente Blender del personaggio (`saitama.blend`, collezioni `Personaggio_Base`/`_Jab`)
**non è nel repo**: vive in `Documents/Blender projects/saitama.blend` sulla macchina
di sviluppo. Se serve ri-esportare i modelli, è lì — vedi `docs/MENU_INTRO.md` per le
impostazioni di export corrette (fondamentale: `export_apply=True`, `export_skins=False`).
`Personaggio_Salto` (terzo modello, a bassa poligonazione) non è più usato dal codice.

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

## Livello 1 — 2D a scorrimento laterale (riassunto)

Il Livello 1 è un vero 2D laterale (stesso `<Canvas>` R3F con `OrthographicCamera`, mesh
`meshBasicMaterial`, niente Rapier) — dettaglio completo, con tutte le insidie scoperte
guardando a schermo, in **`docs/LIVELLO1_RIFERIMENTO.md`**: leggerlo prima di toccare
`game/levels/Level1/`, `game/render2d/`, la macchina a stati del livello o il dialogo.
Regole che non vanno violate:

- Coordinate: X = cammino, Y = salto (0 = piedi a terra), Z = parallasse (più negativo = più lontano).
- Collisioni a mano in `render2d/` (`collision.ts` + `useOverlap.ts`); niente Rapier nei livelli.
- `Sprite2D`: mai mutare la texture in cache, sempre `texture.clone()` per istanza.
- Un layer di parallasse opaco va alto solo quanto la propria fascia, mai l'intero frustum.
- I personaggi (D0/D1/Eve) sono pose intere (`Character2D` + `CharacterAnimator2D`), la `width` si
  deriva dalla texture; i valori che cambiano ogni frame stanno in `useRef`, mai in stato React.
- La macchina a stati del livello è `store/levelStore.ts` (`LevelPhase`, 14 fasi): ogni scena
  monta SOLO ciò che serve alla sua fase; le fasi senza contenuto montano un placeholder onesto.
- I dialoghi sono dati statici in `data/dialogues/` letti da `useDialogue` (chiamato FUORI dal
  `<Canvas>`, `DialogueBox` è HTML).

## Boss arena (`boss_fase1`) (riassunto)

Combattimento a scorrimento laterale con Checco Zalone (`game/levels/BossArena/`), camera che
segue il punto medio giocatore/boss, in due round con evento "Avvia il film", potenziamento
Bloodborne (pistola, abilità, berserk), torrette, totem, contrasto, finale con QTE cooperativo e
cutscene verso il Sotterraneo. Dettaglio completo di ogni meccanica, costante e insidia in
**`docs/BOSS_ARENA_RIFERIMENTO.md`**: leggerlo prima di toccare l'arena.

Mappa del codice (dopo il refactor FASE 7):

- `BossChecco.tsx` è solo l'**orchestratore**: l'ordine delle sezioni del frame (potenziamento →
  hit-stop → fine → contrasto → finale → carica con falce → stato passivo → evento/mossa → resa).
  La logica sta in moduli SENZA React che ricevono un `BossContext`: `bossSpecial` (evento + scelta),
  `bossClash`, `bossSequences`, `bossStatus`, `bossMoveRunner`, `bossSpawns`, `bossRender` (+
  `BossVisuals.tsx`), `bossRuntime`, `bossMessages`, `bossWarnings`. Non cambiare l'ORDINE nel
  frame: l'hit-stop lo fa scendere solo il frame del boss.
- `PlayerArena.tsx` usa le primitive condivise `game/shared/usePlayerActions.ts` (input a azioni) e
  `game/shared/jump.ts` (`stepJump`), pensate anche per il tunnel.
- Tutti i numeri di bilanciamento stanno in `arenaConfig.ts` (mai letterali nei componenti); lo
  stato per-frame è un solo `ArenaWorld` (`arenaState.ts`), lo store riceve solo copie agli eventi.
- Regole di danno in `combat.ts`; sequenze scriptate in `finale.ts` (finale), `finisher.ts` (carica
  con falce), `qte.ts` (QTE, puro e riusabile).
- Solo in sviluppo: `window.__arenaWorld` / `__arenaStore`, `forceMove`, `moveLog`, `F9`/`F8`
  (salta all'arena / ne esce, `hooks/useDevBossShortcut.ts`) e la mappa dei tasti in
  "Due entrate PROVVISORIE" del documento di riferimento (da rimuovere quando ci sarà la selezione dei boss).

## Cutscene da storyboard (riassunto)

Il pre-boss (`dialogo_pre_boss`) e l'intermezzo del finale dell'arena sono «motion comic»: i disegni di `docs/storyboard/` (convertiti in
`public/cutscenes/` da `scripts/prepare-cutscene-frames.mjs`) a tutto schermo con camera GSAP, effetti e battute. Dettaglio in
**`docs/FASE11_CUTSCENE_STORYBOARD.md`**. Regole:

- Sono dati: `data/cutscenes/` (beat, battute, camere, registro); le fasi montano `CutscenePlayer` (punto di sostituzione con il video), mai
  `StoryboardCutscene` direttamente. HTML/CSS, non Canvas.
- `applyFinalState()` idempotente + `SkipCutscene`, precarico con tempo massimo e nessun soft-lock, percorsi con `BASE_URL`, immagini scaricate
  solo a cutscene avviata.
- L'intermezzo è la fase `intermezzo` di `finale.ts` (fra `land` e `transform`): il mondo aspetta `intermezzoDone`, che scrive
  `SceneManagerBossArena` a fine o salto. I test automatici che attraversano il finale devono saltarlo (Esc tenuto).
- Solo in sviluppo: `F6` salta alla cutscene pre-boss.

## Tunnel dell'inseguimento (`boss_fase2_tunnel` e seguenti) (riassunto)

Corsa laterale semi-automatica sotto il Cinema (`game/levels/Tunnel/`, design in
`docs/FASE8_TUNNEL_INSEGUIMENTO.md`): D corre da solo a `TUNNEL_RUN_SPEED`, il giocatore salta
(anche doppio), schiva con i-frame (`Shift`), para (`K`: rimanda i colpi PARABILI contro la
marionetta e recupera terreno), attacca (`J`: rompe le casse; in aria, con lo stile del Dio del tuono, è un fulmine ad area) e si sposta di poco
(`A`/`D` avanti e indietro, `W`/`S` cambiano via). `App.tsx` monta `SceneManagerTunnel` per le tre fasi (`TUNNEL_PHASES`) SENZA
rimontarlo; dentro, la corsa e la raffica vivono nel mondo (`TunnelWorld`) e `SceneManagerTunnel`
collega i passaggi alle fasi di `levelStore` (`tunnelResult`). Regole da non violare:

- Un solo `useFrame` di simulazione (`tunnelDriver.updateTunnel`): l'ordine è deciso lì (hit-stop →
  tempo → distanza → giocatore → minacce → marionetta/proiettili → direttore). Niente numeri
  magici fuori da `tunnelConfig.ts`; il copione (`tunnelDirector.TUNNEL_SCRIPT`) è dati puri,
  controllato da `validateScript()` (leggibilità ≥ 0.7 s, spaziatura).
- Le minacce sono definite dal secondo in cui D ci ARRIVA: la corsa è a velocità costante, quindi
  `x = startX + t·velocità` e telegrafi/raggi si sincronizzano sul tempo. Dash e parata hanno
  finestre più larghe di quelle dell'arena (`TUNNEL_DASH_DURATION`, `TUNNEL_PARRY`): a 9 u/s il
  contatto dura ~0.14 s.
- Il tunnel riusa `createArenaWorld()` per giocatore/proiettili/numeri di danno e le regole di
  `combat.ts` (`hitPlayer`, parata), `qte.ts`/`QteChallenge`, `ArenaHud` (`mode="tunnel"`) e
  `arenaStore`; la distanza dalla marionetta è `world.gap` (0 = raggiunta, 100 = sfuggita; a 100
  si perde e si riparte dall'INIZIO DELLA SEZIONE). Il gap iniziale dipende da
  `levelStore.finalQteSuccess` (35/45/55).
- Convenzione degli avvisi del tunnel: ROSSO "PARA" = parabile (arancio, si rimanda), GIALLO
  "SALTA" = non parabile e basso — la stessa dell'arena (il documento FASE 8 la scriveva al contrario).
- Cutscene saltabili: `components/SkipCutscene` + `hooks/useCutsceneSkip` (tenere premuto Esc/Invio
  o il bottone ~0.6 s, mai un tap). Ogni cutscene ha un `applyFinalState()` IDEMPOTENTE e saltare =
  timeline alla fine + `applyFinalState()` (esempi: `EscapeCutscene`, `SceneManagerSotterraneo`).
- **FASE 9 (`docs/FASE9_TUNNEL_POTENZIAMENTI.md`)**: lo **Slancio** (`tunnelSlancio.ts`) accelera il tempo
  del MONDO (`world.tempo`, 1 → 1.3) ogni 8 s senza danni; salto/dash/parata/timer del giocatore restano
  in tempo REALE (quindi nel driver si usa `worldDt` per minacce e proiettili, `delta` per il giocatore).
  Gli **eventi** (`tunnelEvents.ts`: «Checco si stacca» con guardie e finestra `PuppetWindow`, «Il masso»)
  sono dati in `tunnelConfig.ts`; un evento sta dentro UNA sezione (il checkpoint lo ripropone intero);
  `validateScript()` lo controlla anche al tempo massimo.
- **FASE 10 (`docs/FASE10_TUNNEL_DISTANZA_VIE_EVENTI.md`, tappe 1-5 eseguite)**: la **distanza è fisica**:
  `world.gap` è in METRI e la marionetta sta a `TUNNEL_PUPPET_DIST_MIN + gap` unità davanti a D (fuori
  schermo finché è lontana; la HUD mostra un indicatore con i metri). `addGap()` NON modifica `gap`: accumula
  in `gapPending`, che `updateGap` versa con `TUNNEL_GAP_SMOOTH` (mai scatti). I lanci sono sincronizzati
  sull'ARRIVO (`launch = arrivo − distanza/avvicinamento`). L'inquadratura è fissa in altezza
  (`TUNNEL_VIEW_HEIGHT`, zoom derivato dalla finestra) e le minacce nascono oltre il bordo destro REALE
  (`world.view.ahead`, scritto dal rig della camera). Gli oggetti sono Sfere, freccia gialla e **scatola**
  che riempie la **casella** (`world.slot`, `tunnelItems.ts`, uso con `E`; contenuto in base alla distanza);
  i colpi su Checco hanno valori fissi in metri, anche fuori schermo (Zoltraak lo prende sempre). Tempo
  limite 5 min reali: scaduto o con Checco oltre 100 m si rifà tutto da capo, a vita zero si riparte
  dalla sezione; il copione ripete l'ultimo tratto (`TUNNEL_LOOP_*`) finché non lo raggiungi.
  **Tre vie**: ogni minaccia/oggetto/proiettile ha una `lane` (0 = lontana); D la cambia con W/S (`world.lane.pos` continuo; il salto nel tunnel è
  solo Spazio) e le collisioni passano da `inPlayerLane`. La camera è ortografica ma INCLINATA (`TUNNEL_CAMERA_PITCH`): le quote dello sfondo si
  danno come altezza-schermo e si convertono con `worldY`. **Checco altera la realtà** (`tunnelReality.ts`): onda a contatore in metri, esiti preso →
  Buen Camino (torrette volanti) / deviato → shonen (Frieren, Kamehameha) / schivato; corsa a 200 s in 6 sezioni. **Desideri di Shenron** (`tunnelWishes.ts`, 7 Sfere →
  scelta di tre: permanente / a usi / a tempo): solo quel modulo legge i desideri, e `tryInstinct` va chiamata prima di OGNI `hitPlayer` del tunnel. **Tappa 5**: avvisi per via sul bordo destro (`TunnelAlerts`, uno per via, onda > schiva > para); bonus **Nuvola Speedy** e **gatto** (`tunnelCat.ts`, `CatMount`); **ospite** unico della modalità shonen (un personaggio o una squadra) che esce da un portale e aiuta a modo suo (`help`: lane / wide / lost / shield; `src/data/tunnelCameos.ts`, `CameoCast`, voci `todo` con battute generiche da sostituire; Eve nella seconda onda); eventi bivio, paparazzi, Botafumeiro, karaoke (note ♪) e buio. **Tappa 7**: onda unica su TUTTE le vie; stili permanenti lasciati dall'ospite dopo la parata (`tunnelPerks.ts`: Super Saiyan con volo, Dio del tuono con fulmine in caduta, smoking «Vai uomo» e immunità ai colpi a distanza a velocità massima, Gear 5 + Zoro in scorta, ecc.; `resetPerks` PRIMA di `jumpToTime(0)`); Eve resta per tutta la corsa; masso a distanza fissa che finisce schiantandosi su un muro; niente cure con R; ombre sul binario (`LaneShadows`). **Tappa 6**: nemici del Cammino (`tunnelEnemies.ts`: pellegrino fanatico a contatto, balestriere a distanza i cui dardi parati tornano a lui), resti che rallentano, malus (frenato/rallentato, tolti dalla modalità shonen e dal Senzu), fagiolo curativo e difficoltà alzata (`TUNNEL_GAP_DRIFT_PER_SEC`, penalità e danni). Nei test automatici la scelta del desiderio blocca il gioco (`hitStop = Infinity`): il bot deve scegliere.
- Solo in sviluppo: `F7` salta al tunnel, `window.__tunnelWorld`, `tunnelDirector.jumpToTime(world, t)`.

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

## Stato del progetto

**Punto sicuro**: il tag `v0.9-tunnel` è il segnalibro prima di completare il Livello 1 (intro, interno Ariston,
arena del boss completa, Sotterraneo e tunnel dell'inseguimento fino alla fuga di Checco). Gli altri livelli sono in
pausa (nella selezione si metterà «prossimamente»). Per tornarci: `git switch --detach v0.9-tunnel`; cosa è cambiato
dopo: `git diff v0.9-tunnel..HEAD --stat`. Un tag pubblicato non si sposta mai: se serve un nuovo punto sicuro se ne fa un altro.

**Fatto**: scaffolding, menu, selezione livelli, fondamenta 2D del Livello 1 + sprite/animazione
di D0/D1/Eve + macchina a stati con la prima scena giocabile per intero (Fasi 1, 3a e 4 del
piano), interno isometrico dell'Ariston da LDtk (Fase 5), **arena del boss completa**
(FASE 6/6b: mosse, torrette, totem, contrasto, potenziamento Bloodborne con pistola/abilità/
berserk, finale con QTE cooperativo, marionetta e Sotterraneo), **FASE 7 (pulizia e refactor):**
costanti in `arenaConfig.ts`, `BossChecco.tsx` spezzato in moduli, primitive condivise per il
tunnel (`game/shared/`), CLAUDE.md snellito con i riferimenti in `docs/`; audio manager
(`useBackgroundMusic`, `useSfx`), impostazioni persistenti, CSS Modules, code splitting,
ESLint configurato, alias `@/`, base path GitHub Pages.

**FASE 8 eseguita**: tunnel dell'inseguimento (corsa a 4 sezioni con distanza dalla marionetta,
raffica a doppia spada con QTE, cutscene di fuga), `SkipCutscene` e continuità del "crollo" nel
finale dell'arena. **FASE 9**: Slancio (velocità reale), bonus a tema anime/videogiochi, eventi
(Checco si stacca + guardie, il masso) e finestra sulla marionetta nel tunnel. **FASE 10 (tappe 1-7)**: distanza
fisica in metri, oggetti che entrano da fuori schermo, inquadratura fissa, casella bonus, tempo limite,
tre vie, attacchi di Checco a contatore con modalità Buen Camino/shonen e desideri di Shenron
(prossime: battute vere per i cameo, taratura giocando). **FASE 11**: cutscene da storyboard (pre-boss `dialogo_pre_boss` e intermezzo del finale dell'arena). Prossimo: `inseguimento_spaziale_cutscene` e le fasi successive,
la variante D2 (doppia spada) e il finale nello spazio (FASE 12).

Il **menu iniziale** (`game/menu/`) è un'ambientazione Blender vera ("Ingresso a Oristano": strada,
cartello, case, distributore ESSO, binari, muro stile Attack on Titan con portone) con muro
distruttibile (Cell Fracture; solo i frammenti entro `AFFECT_RADIUS` diventano `RigidBody`) e una
sequenza cinematica del personaggio stile Saitama (`character/`): piede → volto → battuta → cambio
modello → anticipazione → taglio al video del salto (`<video>` in `MenuScene.tsx`, mai dentro il
`<Canvas>`) → impatto che rompe il muro → ingresso nel varco → whiteout (vive in `App.tsx`). Mesh
statiche cotte, niente scheletro, nessuna corsa in 3D (tentativo scartato).

La **selezione livelli** (`game/menu/levelSelect/`) è UNA scena Three.js sempre visibile su tre luoghi
reali (Cinema Ariston a Oristano, Silì, un luogo a Cagliari): immagini statiche di Maps Static API
generate UNA TANTUM con `scripts/generate-map-images.mjs` e salvate in `public/maps/` (mai widget
live né 3D Tiles), isola frastagliata fluttuante costruita da una sola `Shape`, marker che passa da
pin a modello in base alla distanza della camera, camera con due padroni che si alternano
(GSAP durante il dolly, `MapControls` il resto), pan limitato dal contorno dell'isola, sblocco
progressivo via `progressStore`. `LevelMapScene` non crasha se manca la texture
(`IslandCapErrorBoundary`). La scritta Google di ogni tile è obbligatoria, non va tolta.

Tutto il dettaglio (sequenza del personaggio, griglia di tile per livello, geometria dell'isola e i
QUATTRO BUG scovati a schermo su `ExtrudeGeometry`/luci/pianeta/bevel, limite di pan radiale, immagini
generate) è in **`docs/MENU_E_SELEZIONE_LIVELLI_RIFERIMENTO.md`** — leggerlo prima di toccare il menu
o la selezione livelli (insieme a `docs/MENU_INTRO.md`).

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

**Da fare**: le fasi della macchina a stati oltre arena e Sotterraneo — tunnel infinito
(`boss_fase2_tunnel`, FASE 8), combo a doppia spada QTE, fuga/inseguimento/cannone, dialogo
finale, punteggio — oggi solo placeholder; la selezione dei boss (poi si
tolgono le due entrate provvisorie all'arena); pipeline LDtk anche per il livello laterale
(sostituirà i trigger `TODO_LDTK` di `data/level1/triggers.ts`); un vero rig a pezzi dei
personaggi (richiede arte prodotta apposta; la Fase 3a a swap di pose basta per ora, e per
`transformToD1` servirebbe una posa d'attacco di D0); asset veri al posto dei segnaposto
dell'arena (Checco, pistola/asta/lama, sfondi, video del potenziamento); un modello Blender per
Cagliari; puzzle, achievement, finale celebrativo; il deploy su GitHub Pages (`npm run deploy`
già pronto — occhio al PATH di `git` su Windows se `gh-pages` fallisce con `spawn git ENOENT`,
vedi `README.md`).

Per il dettaglio di architettura scena-menu, sequenza personaggio e pipeline Blender vedi
`docs/MENU_INTRO.md`; per la spiegazione generale dell'app vedi `docs/APP_EXPLAINER.md`; per
il piano di riscrittura 2D del Livello 1 vedi `docs/PIANO_LIVELLO1_2D.md`, per il dettaglio
degli sprite/animazione dei personaggi (Fase 3a) `docs/FASE3_RIG_PERSONAGGI.md`, e per lo
scheletro della macchina a stati e il dialogo di apertura (Fase 4)
`docs/FASE4_MACCHINA_STATI.md`.
