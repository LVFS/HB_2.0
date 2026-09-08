# Proposta: migliorare grafica e usabilità della selezione mappa/livello (HB_2.0)

Questo è un documento di PROPOSTE da discutere, non un piano già approvato — leggi le
opzioni, scegli cosa ti convince (anche a pezzi, non serve prendere un blocco intero) e
poi lo trasformiamo in un piano di esecuzione vero.

## Stato attuale (letto nel codice, non a memoria)

- Un'unica isola fluttuante 3D alla volta (`LevelMapScene.tsx`): cambiare "mondo" non
  sposta la camera tra isole diverse, sostituisce interamente geometria/texture
  dell'isola sotto una copertura di nuvole (`CloudTransition.tsx`) — le tre città non
  esistono mai insieme nella stessa scena.
- Il marker di ogni livello è un cristallo/beacon (ottaedro che ruota e fluttua) da
  lontano, e il modello vero da vicino (`LevelMarker.tsx`) — ma oggi SOLO il Cinema
  Ariston ha un modello vero: Silì e Cagliari mostrano ancora il cilindro colorato
  placeholder con il nome in testo sopra. Il salto di qualità tra un marker e l'altro si
  vede.
- L'elenco livelli (`LevelListOverlay.tsx`) è un pannello 2D piatto sovrapposto alla
  scena 3D: una fila di bottoni "mondo" (Oristano/Silì/Cagliari, testo semplice) sopra
  una griglia di card livello (testo su sfondo scuro). Funziona, ma non usa il
  linguaggio visivo particolare che il resto del progetto già ha (`tokens.css` dichiara
  esplicitamente una direzione artistica "HUD militare/anime" con tagli diagonali sui
  pannelli, font Chakra Petch maiuscolo, ambra come unico accento d'azione) — qui invece
  sono bottoni piuttosto generici.
- Le tre città sono luoghi REALI in Sardegna con una loro relazione geografica (Oristano
  → Silì → Cagliari, vedi `data/levels.ts`), ma nell'interfaccia sono tre pulsanti
  intercambiabili senza alcun senso di percorso/viaggio tra loro.
- Il sistema di feedback su hover/conferma è già curato SUL MARKER 3D (bagliore che
  cresce, anello a terra, scatto di conferma prima dello zoom) — è la UI 2D sopra che è
  rimasta più semplice in confronto.

## Ispirazione da altri giochi (per orientare le scelte, non da copiare 1:1)

- **[Spiritfarer](https://spiritfarer.fandom.com/wiki/Islands)** — il parallelo più
  diretto concettualmente: un piccolo mondo fatto di isole distinte raggiunte viaggiando
  con una barca attraverso mare/cielo aperto. Il viaggio TRA le isole è parte
  dell'esperienza quanto le isole stesse, non un taglio secco. È l'esempio più forte per
  l'idea "volare fisicamente da un'isola all'altra" più sotto.
- **Slay the Spire e i "path map" a nodi** (mappa a percorso ramificato, il giocatore
  vede l'intero cammino e dove si trova su di esso) — utile per l'idea di mostrare
  Oristano→Silì→Cagliari come tappe di un percorso invece che tre pulsanti equivalenti.
- **Super Mario 3D World / Kirby and the Forgotten Land** — mappa mondo con un percorso
  visibile tra i livelli, l'icona del personaggio che si sposta lungo il percorso quando
  si sceglie la tappa successiva invece di teletrasportarsi.
- **[Game UI Database](https://www.gameuidatabase.com/index.php?scrn=6)** — raccolta di
  centinaia di screenshot reali di "Level Select: World Map" da giochi pubblicati, utile
  come riferimento diretto per lo stile dei marker/card quando si passa alla fase
  visiva vera e propria.

## Proposte

### A. Dare ai marker placeholder un aspetto meno "programmatore" (impatto alto, sforzo medio)

*Sei un esperto di art direction per interfacce di gioco 3D.*

Il cilindro colorato con etichetta di testo per Silì e Cagliari stona ora che l'Ariston
ha un modello curato (insegna al neon, animazione di crescita, hover con stagger sulle
lettere). Due strade, non a vicenda esclusive:

1. **Soluzione ponte, veloce**: sostituire il cilindro con una forma più curata ma
   ancora procedurale/economica da fare in Blender — es. un piccolo obelisco/cristallo
   sfaccettato con lo stesso linguaggio del pin (ottaedro, bagliore), invece di un
   cilindro pieno "da placeholder". Costa poco, alza subito la qualità percepita ovunque
   manchi ancora un modello vero.
2. **Soluzione definitiva**: un modellino Blender rappresentativo per Silì e Cagliari
   (come già fatto per l'Ariston), riusando lo stesso schema `Grow_Landing` +
   `onCloseupEnterRef` già pronto in `LevelMarker.tsx` — è un pattern già rodato, "solo"
   servono i modelli.

### B. Rendere il viaggio tra mondi più "epico" (impatto alto, sforzo variabile a seconda dell'ambizione)

*Sei un esperto di camera work e transizioni di scena in giochi 3D.*

Due livelli di ambizione, dal più semplice al più ambizioso:

1. **Piccolo passo**: arricchire la transizione a nuvole esistente invece di
   sostituirla — aggiungere una parallasse di stelle/particelle che sfrecciano (dando
   sensazione di velocità/salto nello spazio, coerente con l'ambientazione already
   presente in `LevelMapScene` con `<Stars>`/`<DistantPlanet>`) dietro il velo di nuvole,
   invece di un semplice fade. Tocca solo `CloudTransition.tsx`, rischio basso.
2. **Passo grande**: cambiare architettura — invece di UN'isola sostituita sotto copertura,
   posizionare le tre isole in punti diversi della stessa scena 3D (come le isole di
   Spiritfarer) e portare la camera a VOLARE fisicamente da un'isola all'altra quando si
   cambia mondo, invece di nasconderle dietro nuvole. Molto più d'impatto e coerente con
   "viaggio attraverso luoghi reali", ma è un cambiamento di architettura vero (le città
   oggi condividono la stessa origine locale `[0,0,0]`, servirebbe un vero posizionamento
   relativo, più gestione di quali asset restano caricati mentre si vola) — da considerare
   solo se l'idea ti piace abbastanza da giustificare il lavoro, e comunque dopo aver
   finito il piano di caricamento asset di cui abbiamo già parlato (altrimenti tre isole
   texturizzate contemporaneamente aggravano proprio il problema degli scatti).

### C. Avvicinare la UI 2D al linguaggio visivo del resto del gioco (impatto medio, sforzo basso)

*Sei un esperto di design system e coerenza visiva in interfacce di gioco.*

`LevelListOverlay` oggi usa componenti piuttosto neutri. I token esistono già
(`--cut`/`--clip-panel` per i tagli diagonali, `--accent` ambra per l'azione, `--steel`
per l'informazione) — si tratta soprattutto di applicarli con più decisione qui:

- Le card livello potrebbero prendere il taglio diagonale (`--clip-panel`) già usato
  altrove invece di angoli semplici, per leggersi come "pannello HUD" e non "card web".
- La fila mondi potrebbe diventare qualcosa di più simile a un selettore di "tappe di
  viaggio" (icona/miniatura per città + stato completato/bloccato/attivo con lo stesso
  linguaggio ambra/steel già in uso altrove) invece di semplici pulsanti testuali.
- Aggiungere una piccola anteprima visiva per card (uno screenshot/render in miniatura
  del luogo, non solo testo) — il gioco ha già le mappe satellitari, un ritaglio
  piccolo della stessa immagine costerebbe pochissimo in più da generare.

### D. Comunicare il percorso/la relazione tra i tre mondi (impatto medio, sforzo medio)

*Sei un esperto di UX per la progressione e l'orientamento del giocatore.*

Oggi "mondo" è già pensato per reggere più livelli in futuro (`worlds.ts`), ma
visivamente Oristano/Silì/Cagliari sono tre bottoni equivalenti, senza percorso. Con
`order`/sblocco progressivo già esistente in `data/levels.ts`, ha senso REALIZZARE quel
percorso a schermo:

- Una piccola mappa regionale/percorso a nodi (ispirato a Slay the Spire/Mario 3D World)
  dentro `LevelListOverlay`, con una linea che collega le tre tappe nell'ordine vero e
  un indicatore "sei qui" — anche solo come SVG/illustrazione 2D leggera, non serve sia
  3D per essere efficace.
- In alternativa più leggera: mantenere la fila di bottoni ma aggiungere una linea di
  connessione + icone di stato (bloccato/completato/attivo) invece di solo colore.

### E. Coerenza del feedback d'interazione (impatto basso, sforzo basso)

*Sei un esperto di micro-interazioni e feedback in tempo reale.*

Il marker 3D ha già un ottimo linguaggio (bagliore crescente, anello a terra, scatto
prima della conferma). Proposta minima: portare lo stesso linguaggio (bagliore ambra,
piccolo "kick" di scala alla conferma) sui bottoni 2D di `LevelListOverlay`, così i due
livelli di interazione (pin 3D / lista 2D) si sentono parte dello stesso sistema invece
di due stili diversi.

## Cosa NON toccherei (per ora)

Il meccanismo di swap pin↔modello per distanza, il ciclo da controller
(`useGamepadCycleSelect`), e la logica di sblocco progressivo (`isLevelUnlocked`) sono
già solidi e ben ragionati (commenti nel codice spiegano bug reali già risolti) — le
proposte sopra sono pensate per aggiungersi sopra, non per riscriverli.

## Come procedere

Dimmi quali proposte ti convincono (anche solo una lettera, tipo "A e C sì, B piccolo
passo, D non ora") e trasformo quelle in un piano di esecuzione con gli stessi dettagli
concreti (file, righe, snippet) degli altri due piani che ti ho già dato per questo
progetto.

Sources:
- [Islands | Spiritfarer Wiki](https://spiritfarer.fandom.com/wiki/Islands)
- [Game UI Database — Level Select: World Map](https://www.gameuidatabase.com/index.php?scrn=6)
- [Slay the Spire (Wikipedia)](https://en.wikipedia.org/wiki/Slay_the_Spire)
