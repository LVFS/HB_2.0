# Piano: Livello 1 in 2D ("Fuori/dentro l'Ariston") — HB_2.0

Diagnosi fatta guardando sia il codice sia gli artwork veri: ho letto `CLAUDE.md`, la
struttura di `Level1/` (oggi 3D: `SceneManager.tsx`, `Player.tsx` con movimento WASD,
Rapier), e ho aperto tutti i file in `Pictures/prove artwork gioco/` (turnaround sheet di
D ed Eve, concept della strada Ariston, foto+redraw della sala boss, e soprattutto il
mock-up `first_level_ingresso_con_ui_e_altro.png` con HUD e piantina Piano Terra/Primo
Piano). Deciso insieme: i menu e la selezione livelli restano 3D così come sono oggi
(nessuna modifica), il Livello 1 (e i livelli futuri, in base a cosa serve di volta in
volta) passa a un vero **2D a scorrimento laterale**, coerente con tutto ciò che è stato
disegnato finora. Protagonista: `D0` (civile, trench, nessuna arma) come look di base,
swap a `D1` (tattico, con la lama di Eve) nel momento in cui la riceve nella trama.

## Scelte tecniche chiuse, e perché

**Niente secondo motore di rendering (no Pixi.js) — resta React Three Fiber, con una
camera ortografica invece che prospettica per i livelli 2D.** Three.js/R3F fa sprite 2D
benissimo (piani texturizzati, UV offset per i frame, `OrthographicCamera`) ed è una
tecnica collaudata in tanti giochi web — non serve un motore dedicato. Il vantaggio
concreto per voi: zero dipendenze nuove, si riusa TUTTO l'impianto già rodato (stesso
`<Canvas>`/R3F, stesso GSAP che dirige le timeline — vedi `CharacterIntro.tsx`, stesso
Zustand per lo stato, stesso Howler per l'audio, stesso code-splitting via Vite). L'unica
vera novità è "che forma hanno gli oggetti in scena" (piani invece di mesh 3D), non "come
funziona la scena". Ho scartato Pixi.js apposta: avrebbe richiesto un secondo `<canvas>`
montato/smontato insieme alla scena del livello, un secondo sistema di caricamento asset,
un ponte separato verso lo stesso store Zustand — complessità reale per un beneficio che
oggi non serve (Pixi conviene solo se si sceglie DragonBones per l'animazione, vedi Fase 3).

**Niente Rapier per la fisica di questo livello.** Rapier è pensato per simulazione fisica
vera (i detriti del muro nel menu, che "si dà un impulso e non si toccano più" — vedi
`CLAUDE.md`). Camminare, schivare, colpire con la spada, attivare un QTE non sono eventi
fisici da simulare: sono eventi scriptati da rilevare. Basta un test di sovrapposizione
rettangolo/cerchio scritto a mano, controllato ogni frame in `useFrame` — molto più
leggero (niente WASM aggiuntivo caricato per il livello) e molto più prevedibile da tarare
per un combattimento/inseguimento con QTE, dove serve controllo millimetrico sul momento
esatto in cui un colpo "conta".

**Editor esterno solo per la disposizione spaziale dei livelli, non per tutto.** Rispondo
alla domanda specifica: sì, conviene, ma è uno strumento con uno scopo preciso — dire dove
sono i muri/il pavimento calpestabile, dove parte un dialogo, dove spawna un nemico/ostacolo,
dove finisce una stanza e comincia la prossima. Per battute di dialogo, pattern d'attacco,
sequenze QTE, tempi di spawno — cioè tutto ciò che ha bisogno di un po' di LOGICA, non solo
di coordinate — restano file TypeScript nel repo, stesso pattern già collaudato di
`data/levels.ts` e di `breakPatterns/` (funzioni pure, tipizzate, senza dipendenze da
React/Three). Un JSON scritto a mano per queste cose sarebbe solo meno sicuro (nessun
controllo di tipo) senza nessun vantaggio in cambio.

Per la parte spaziale, due editor gratuiti validi, stesso principio di Godot che avevi in
mente (disegni, esporti dati, il codice li legge):

| | LDtk (consigliato) | Tiled |
|---|---|---|
| Modello dati | Un "World" fatto di più "Level" distinti, ognuno con i suoi layer di entità/trigger — ricalca esattamente la vostra piantina Piano Terra/Primo Piano | Una mappa unica a tile, meno naturale per "stanze" nettamente separate |
| Maturità | Più giovane ma stabile e ancora attivamente aggiornato (fatto dal creatore di Dead Cells) | Più maturo, standard de facto da anni, più tutorial/esempi in giro |
| Export | JSON, formato pensato per essere letto facilmente da codice custom | JSON (o altri formati), stesso principio |
| Licenza | Gratuito | Gratuito, open source |

Userei LDtk: la corrispondenza 1:1 con "Piano Terra"/"Primo Piano" che avete già sketchato
a mano vale più della maggiore popolarità di Tiled.

## Fase 1 — Fondamenta del "modo 2D" (prima di tutto il resto)

*Sei un esperto di rendering 2D in Three.js/React Three Fiber.*

- Nuova scena `Level1/SceneManager2D.tsx` (o rinominare l'esistente quando si decide di
  sostituirlo) con `OrthographicCamera` di drei, inquadratura laterale fissa (coerente col
  mock-up: D ed Eve visti di profilo).
- Un piccolo helper `sprite2D` per piani texturizzati con UV offset da uno sprite-sheet
  (per animazioni a fotogrammi) o texture singola ritagliata (per i pezzi di un rig
  cutout).
- Parallax: 2-3 livelli di sfondo a profondità Z diverse e velocità di scroll diverse
  (il concept art della strada Ariston può diventare, con un minimo di lavoro — ritaglio in
  layer separati: cielo/edifici lontani/marciapiede vicino — direttamente uno di questi
  sfondi, non va rifatto da zero).
- Collisione: `useFrame` con test rettangolo/cerchio scritti a mano (nessuna libreria),
  un hook riusabile tipo `useOverlap(boxA, boxB)`.
- Verifica: un blocco vuoto (un rettangolo che cammina su uno sfondo statico) prima di
  aggiungere qualunque contenuto vero — stesso principio già usato con successo per il
  menu (scaffolding prima, asset dopo).

## Fase 2 — Pipeline dati per i livelli (LDtk + moduli TS)

*Sei un esperto di pipeline di contenuto per giochi 2D basati su editor esterni.*

- Installare LDtk (gratuito, desktop), disegnare la prima stanza (l'esterno dell'Ariston)
  come un singolo Level LDtk: pavimento calpestabile, zone trigger (inizio dialogo, entra
  nell'edificio), punti di spawn per D/Eve.
- Un loader `levelData/loadLdtk.ts`: legge il JSON esportato, lo traduce in dati di gioco
  tipizzati (bounding box del pavimento, elenco di trigger con `{id, tipo, box}`) — un
  piccolo strato di conversione, scritto una volta, riusato per ogni stanza futura (piano
  terra, primo piano, tunnel, stanza boss).
- Dialoghi: `data/dialogues/ariston_intro.ts` ecc. — array ordinato di battute
  `{speaker, text, cameraCue?}`, avanzamento con `useAnyInput` (già esistente) — stesso
  principio di semplicità di `data/levels.ts`, nessun motore di dialogo esterno (Yarn
  Spinner/ink) perché la storia è lineare, senza rami.
- Pattern d'attacco/spawn ostacoli/sequenze QTE: `bossPatterns/phase1.ts`,
  `tunnelPatterns/chase.ts`, `qteSequences/doubleSword.ts` — stesso schema di
  `breakPatterns/`: funzione pura `(context) => TimedEvent[]`, zero dipendenze da
  React/Three/camera.

## Fase 3 — Personaggi e animazione 2D

*Sei un esperto di animazione 2D "cutout" per personaggi illustrati (non pixel art puro).*

- Scelta di base (consigliata, zero dipendenze nuove): rig cutout costruito a mano in R3F
  — una gerarchia di piani texturizzati (torso/braccio superiore/braccio
  inferiore/gamba/testa/spada), ognuno ritagliato dalle turnaround sheet già fatte
  (front/back/side/action pose di `D0`/`D1`/`Eve`), animato con GSAP esattamente come
  `CharacterIntro.tsx` fa già oggi — solo che invece di UNA timeline unica per una
  cutscene, si scrivono tante timeline corte richiamabili on-demand (`playIdle()`,
  `playWalk()`, `playAttackCombo()`, `playDodge()`, `playHit()`). Stesso strumento, stesso
  pattern, solo riorganizzato per essere invocabile a runtime invece che una tantum.
- Alternativa se il numero di animazioni cresce troppo per essere comodo a mano:
  **DragonBones** (editor gratuito di rig 2D, pensato apposta per illustrazioni dipinte
  come le vostre) — ma il suo runtime ufficiale (`pixi-dragonbones-runtime`) è scritto per
  Pixi.js, non per Three.js: usarlo davvero significherebbe introdurre Pixi come secondo
  motore SOLO per i personaggi dei livelli 2D (in un canvas separato, caricato in lazy
  loading, mai nel menu). Va tenuto in tasca come piano B, non come scelta di partenza —
  è più impegnativo da integrare di quanto sembri a prima vista.
- Sistema QTE riusabile (`useQte(sequence, onSuccess, onFail)`), riusato per tutte e tre
  le occasioni della trama (combo doppia spada, supporto a Eve nell'inseguimento, carica
  del cannone) invece di scriverlo tre volte.

## Fase 4 — I sistemi di gameplay (mappare lo storyboard)

*Sei un esperto di game design per avventure narrative lineari con combattimento.*

Una macchina a stati esplicita per il livello (stesso principio di `MenuPhase`), che
decide cosa è montato:

```
intro_dialogo → cammino_libero_ariston → attivita_stupide → dialogo_pre_boss →
boss_fase1 → transizione (macerie, seconda spada) → boss_fase2_tunnel →
combo_doppia_spada_qte → fuga_checco → inseguimento_spaziale_cutscene →
qte_supporto_eve → carica_cannone_qte → dialogo_finale → schermata_punteggio
```

- IA di compagnia per Eve: segui-dietro con offset smorzato (lerp verso una posizione
  target dietro D), niente pathfinding — il livello è lineare.
- Boss fase 1: pattern dati (Fase 2) + hitbox rettangolari (Fase 1).
- Tunnel fase 2: scroll automatico in avanti, ostacoli generati da lista temporizzata,
  schivata su corsie o asse libero.
- Inseguimento spaziale/cannone finale: cutscene diretta da GSAP (stesso pattern di
  `CameraDirector`) con QTE sovrapposti — non volo giocabile vero, per contenere il costo
  di sviluppo (stessa scelta già fatta per lo scatto verso il muro nel menu: cutscene
  invece di un ciclo di corsa vero).

## Fase 5 — Verifica

*Sei un esperto di playtesting e performance web.*

- Scheletro completo giocabile con segnaposto (rettangoli colorati, testo grezzo, nessun
  asset vero) PRIMA di rifinire qualunque pezzo — per sentire il ritmo dell'intero livello
  presto, non alla fine.
- Controllo bundle: il nuovo layer 2D (loader LDtk, eventuale Pixi/DragonBones se si
  sceglie quella strada) deve restare in un chunk separato, caricato solo quando il
  livello 2D monta — stesso principio già applicato a Rapier nel menu.
- Playtest dei tempi dei QTE su hardware/reattività diversi prima di considerarli tarati.

## Ordine consigliato

Fase 1 prima di tutto (senza fondamenta 2D il resto non ha dove appoggiarsi). Fase 2 e
Fase 3 possono procedere in parallelo (l'editor livelli e il rig dei personaggi non
dipendono l'uno dall'altro). Fase 4 usa entrambe, quindi viene dopo. Fase 5 è continua ma
merita un primo giro completo subito dopo lo scheletro di Fase 4, prima di investire in
arte/animazioni rifinite.
