# Boss fight — Fase 1: l'arena di combattimento (Checco Zalone, round 1 e 2)

Come richiesto, questo documento si concentra SOLO sulla parte che vuoi costruire ora: il
combattimento vero e proprio nell'arena davanti allo schermo del cinema, in stile
Hollow Knight/Sekiro con innesti Bloodborne/Lies of P (scorrimento laterale, parry,
danno alla postura). Tunnel-inseguimento e sequenze spaziali restano quello che erano
già in `FASE_BOSS_CHECCO_ZALONE.md` — non li ritocco qui, li riprendiamo quando ci
arriviamo.

Ho controllato il codice reale prima di scrivere (non solo i piani precedenti): qui sotto
trovi diversi punti in cui la base è già più pronta di quanto sembri, e un paio di scelte
che vanno prese ora prima che VS Code inizi a scrivere.

---

## 0. Come si incastra con la struttura già esistente

Nessuna fase nuova nell'enum `LevelPhase`: quello che descrivi (round 1 semplice, evento
del film, round 2 potenziato) è tutto contenuto internamente dentro `boss_fase1`. La
tabella di mappatura del documento precedente resta valida — sto solo riempiendo la riga
`boss_fase1` con una struttura vera invece del placeholder "attacchi semplici". Alla fine
del round 2, Checco fugge esattamente come da narrazione originale → `transizione_seconda_spada`
→ `boss_fase2_tunnel`, invariato.

`dialogo_pre_boss` (già scritto in `FASE4b_ATTIVITA_E_PREBOSS.md`) finisce con: *"Lo
schermo si spacca. Checco ne esce, decisamente più grande del previsto."* — quindi Checco
è già pensato come boss FISICAMENTE più grande di D, non un NPC in scala normale. Da
tenere a mente per la taratura dell'altezza del suo sprite/modello.

---

## 1. Il salto architetturale vero: l'arena è laterale, non isometrica

`Sala_boss` esiste già in LDtk come stanza isometrica (`PlayerSpawn` + `Door_vertical_2pz`
verso `Primo_piano`, vedi la sync `assets/ldtk/` → `public/ldtk/`) — perfetta per
camminarci dentro e per la cutscene di `dialogo_pre_boss`. Ma un combattimento con parry e
letture di raggio d'attacco funziona in scorrimento laterale (esattamente il modo di
`SceneManager2D`/`Player2D` dell'esterno), non nella vista isometrica a camera fissa
usata per l'interno.

Quindi propongo lo stesso tipo di bivio che `App.tsx` fa già oggi tra
`SceneManager2D`/`SceneManager2DIso` in base a `levelPhase`, solo con un terzo ramo:

- entri in `Sala_boss` camminando → resti in modalità isometrica (`SceneManager2DIso`) fino
  alla fine di `dialogo_pre_boss` (schermo che si rompe, Checco esce);
- appena la fase diventa `boss_fase1` → smonti l'isometrico e monti un nuovo
  `SceneManagerBossArena.tsx`, fratello di `SceneManager2D.tsx`, camera laterale
  ortografica come l'esterno ma su un palco molto più piccolo e chiuso (niente
  `WORLD_HALF_WIDTH = 36` da strada: un'arena da boss è tipicamente 8-12 unità di
  larghezza totale, giocatore e boss ai due capi con margine per manovrare).

Serve un `arenaConfig.ts` a fianco di `level1Config.ts` con le sue costanti (bounds
dell'arena, velocità, timing) — stessa filosofia "valori tarati a vista" già usata
ovunque nel progetto, non calcoli fisici veri.

---

## 2. Sistemi di combattimento — cosa costruire, con cosa già esiste

### 2.1 Input
`Player2D.tsx` gestisce input con un `Set<string>` a livello di modulo, aggiornato da
`keydown`/`keyup`, letto dentro `useFrame` — mai `setState` a 60fps. Stesso pattern,
nuovi tasti: attacco, parry, schivata (dash). Propongo (da confermare/cambiare a gusto):

- attacco: `j` (o click sinistro)
- parry/parata: `k` (o click destro) — un tasto dedicato, non lo stesso dell'attacco:
  in Sekiro/Lies of P il parry è un'azione DIFENSIVA a timing preciso, confonderlo con
  l'attacco rovinerebbe la lettura
- schivata/dash: `shift` — spostamento orizzontale rapido con un pugno di fotogrammi di
  invulnerabilità ("i-frames"), stessa integrazione manuale di salto/gravità già in
  `Player2D.tsx`, nessuna libreria nuova

Per la modalità arena serve probabilmente un `PlayerArena.tsx` dedicato (variante di
combattimento di `Player2D`, non lo stesso file: fuori dall'arena il giocatore non deve
poter attaccare/parare) che riusa la stessa struttura ma aggiunge questi input.

### 2.2 Hitbox/hurtbox — non serve inventare nulla
`src/game/render2d/collision.ts` (`aabbOverlap`, `circleOverlap`, `circleAabbOverlap`) e
`useOverlap.ts` (semantica enter/stay/exit) sono funzioni pure già pensate esplicitamente
per questo — il commento in `collision.ts` dice letteralmente *"riusabili anche fuori da
un componente (pattern di attacco boss...)"*. Bastano per: colpo giocatore→boss,
colpo boss→giocatore, finestra di parry attiva. La sola cosa da aggiungere è un
timer-ref per rendere ogni hitbox attiva solo durante N fotogrammi dell'animazione
d'attacco (windup → finestra attiva → recovery), pattern identico a come già gestite le
GSAP timeline altrove.

### 2.3 Nuovi stati di animazione — buona notizia, la macchina era già pronta
`CharacterAnimState` in `CharacterAnimator2D.tsx` include già `'attack' | 'hit'`, mappati
a pose ESISTENTI (`attack` → posa `action`, `hit` → posa `front` + flash bianco via
`HIT_FLASH_*`). Nessuna nuova posa disegnata è servita per queste due — è già la stessa
filosofia "poche pose reali + moto procedurale GSAP" vista nel dondolio di cammino.

Propongo di aggiungere due stati sullo stesso principio, senza nuovi fotogrammi:

- `'parry'`: stessa posa di `hit` ma un lampo di colore DIVERSO (oro/azzurro invece del
  bianco di `HIT_FLASH_BRIGHTNESS`) così il giocatore distingue a colpo d'occhio "ho
  subito un colpo" da "ho parato" — stesso mixin `material.color` di GSAP, solo un'altra
  terna RGB.
- `'stagger'`: un tilt/rotazione temporaneo sul gruppo (stesso approccio dell'attuale
  `WALK_SWAY_ANGLE`, ma non periodico: un singolo colpo di rotazione che si assesta) per
  il barcollamento quando la postura si rompe — niente `yoyo`/`repeat: -1`, solo un
  `gsap.to` una tantum con `ease` che dà l'idea di persona sbilanciata.

### 2.4 HP bar — componente nuovo, non esiste ancora
Controllato `src/components/`: oggi c'è solo `DialogueBox`, `HomeButton`, `LoadingScreen`,
`SettingsBar` — nessuna UI di vita. Serve un `BossHealthBar.tsx` (overlay DOM sopra il
Canvas, come gli altri) e probabilmente anche una piccola `PlayerHealthBar.tsx` — anche
minimale (una barra + un'etichetta) va benissimo per iniziare.

### 2.5 Postura (stance) — solo sul boss, per restare "facile e fattibile"
Un secondo valore 0-100 su Checco: sale quando il giocatore lo colpisce o lo para con
successo, scende lentamente se non subisce nulla per un po' (decay), e a soglia massima
scatta `stagger` (finestra di vulnerabilità/danno critico maggiorato — l'equivalente del
"deathblow" di Sekiro, qui probabilmente senza uccisione istantanea, solo un danno pesante
extra). La postura del GIOCATORE (il pezzo che in Sekiro rende il parry rischioso anche
per chi lo subisce) la lascerei per dopo: aggiunge un intero secondo sistema di UI e
bilanciamento che non è necessario per far funzionare il ciclo di gioco base.

### 2.6 Due aggiunte a costo quasi zero (se ti interessano)
Visto che hai chiesto "qualche cosina se fattibile":
- **Hit-stop**: un brevissimo freeze (50-90ms) del `useFrame` di gameplay al momento di
  un colpo pesante o di un parry riuscito — sensazione di "peso" tipica di questi giochi,
  costa solo un controllo su un ref-timer, nessun asset nuovo.
- **Contraccolpo dopo parry riuscito**: una finestra breve (es. 0.4s) dopo un parry in cui
  i danni del giocatore sono aumentati — incentiva il ritmo "para poi colpisci" invece di
  spammare attacco, di nuovo solo un timer, zero asset.

---

## 3. Checco Zalone — round 1 e round 2 nella stessa arena

### Round 1 (base)
2-3 attacchi semplici "a suon di buen camino" (battute/gesti del film richiamati e
rilanciati addosso al giocatore), ognuno con telegraph chiaro (posa di carica +
eventualmente un colore/segnale) poi finestra attiva poi recupero. Propongo di tenerli in
un array dati (`CHECCO_MOVES_ROUND1`), non hardcoded nel componente — stesso spirito
data-driven già usato per dialoghi/trigger nel progetto, e rende facile aggiungere mosse
dopo senza toccare la logica.

### L'evento speciale: "Avvia il film"
Un attacco/azione con windup MOLTO più lungo dei tre normali — il segnale inequivocabile
("questo è pericoloso, reagisci ORA") equivalente all'attacco rosso di Sekiro. Due esiti:

- **Interrotto** (il giocatore para con successo dentro la finestra dedicata, o infligge
  danno/postura sufficiente durante il windup): il film che parte è un riferimento
  DIVERSO da Buen Camino (placeholder, lo scegliamo insieme dopo) → buff al giocatore,
  malus a Checco.
- **Non interrotto**: parte "Buen Camino" (il primo, quello che hai già in mente) → buff a
  Checco (rigenera vita/postura o guadagna una mossa nuova, decidiamo il numero dopo),
  malus al giocatore (es. velocità ridotta per la durata del round, o un effetto
  ambientale fastidioso).

Struttura dati proposta, un solo evento per ora ma pensata per scalare a più
riferimenti in futuro senza riscriverla:

```ts
interface CheccoSpecialMove {
  id: string;
  onCompleted: { backdropId: string; buff: 'checco' | 'nessuno'; malus: 'giocatore' | 'nessuno' };
  onInterrupted: { backdropId: string; buff: 'giocatore' | 'nessuno'; malus: 'checco' | 'nessuno' };
}
```

### Cambio di sfondo — la tecnica esiste già, non serve arte pesante nuova
`CharacterAnimator2D.tsx` ha già la tecnica giusta nel crossfade D0→D1
(`TransformCrossfade`): due piani sovrapposti, GSAP porta l'opacità dell'uno a 0 e
dell'altro a 1 in ~0.4s. Stessa idea applicata a un nuovo `ArenaBackdrop.tsx`: due varianti
di `ParallaxLayer` (oggi tinta unita, già pensato per accettare una texture in futuro, vedi
il commento nel file) invece che sovrapposte a un personaggio, sovrapposte come sfondo
dell'arena. Al risolversi dell'evento, crossfade ~0.5-0.8s + eventualmente un flash bianco
breve (stesso `HIT_FLASH_BRIGHTNESS`) per dare peso al cambio.

Ho scartato deliberatamente `WallShatter.tsx`/`breakPatterns/` per questo: guardando il
codice per bene, non è un sistema generico di "detriti/rottura", è cablato in modo
specifico sul modello Blender del portone di Ingresso Oristano (nomi di mesh, fisica
Rapier, `GATE_ORIGIN`) — riusarlo per il cambio scena costerebbe più che scrivere il
crossfade sopra da zero, ed è anche l'unico punto del progetto che usa Rapier (il resto è
tutto moto scriptato a mano, coerente con la filosofia generale).

### Round 2 (dopo la trasformazione, qualunque esito)
Moveset ampliato con 1-2 mosse nuove coerenti col buff ottenuto, sfondo ora quello nuovo,
prosegue fino alla soglia che fa scattare la fuga di Checco (fine di `boss_fase1`,
invariato rispetto al piano narrativo originale).

---

## 4. Eve tramortita + assist a richiesta

- Eve entra nell'arena già a terra, in una posa statica (riuso semplice, es. `hit` fermo
  invece di uno stato animato) in un punto fisso della scena.
- Un prompt UI ("premi F per richiamare Eve") disponibile da subito (o dopo un piccolo
  beat narrativo, a scelta) — alla pressione Eve si rialza (una breve transizione, stesso
  tipo di crossfade) e diventa una AI di supporto con azioni marginali: qualche colpo
  occasionale, aggro sporadico. Stessa FORMA di codice di `EveCompanion.tsx` (un
  companion ref-driven guidato in `useFrame`), ma logica nuova — quello attuale sa solo
  "segui e basta", qui serve "avvicinati e ogni tanto colpisci", non è un riuso 1:1 del
  file ma dello stesso schema.
- Se il giocatore non la richiama mai, resta a terra per tutto il round — il combattimento
  deve restare completabile in solitaria (hai detto esplicitamente "o affrontarlo da
  solo").
- Alla fine (fuga di Checco, e più avanti la combo finale con QTE), Eve rientra comunque
  in scena via script/cutscene — questo è FISSO, non condizionato da cosa è successo nel
  combattimento: è già così che l'avevi descritta tu ("alla fine comunque la combo finale
  con qte verrà fatta con entrambi"), quindi zero logica condizionale lì, solo narrazione.

---

## 5. Cosa resta fuori apposta (per restare facile e fattibile ora)

- Numeri di bilanciamento (vita, danni, durata esatta delle finestre di parry/i-frames) —
  a occhio in gioco, come da abitudine del progetto.
- Il riferimento film/anime/videogioco per l'esito "interrotto" — placeholder finché non
  decidi.
- Postura del giocatore (solo quella del boss per ora).
- Round oltre il secondo — la struttura a round scala facilmente se in futuro vorrai un
  terzo, ma non serve prevederlo ora.

---

## 6. Checklist consigliata, in ordine

1. `arenaConfig.ts` + `SceneManagerBossArena.tsx` — scheletro, arena vuota, camera
   laterale, nessun combattimento ancora.
2. Aggancio in `App.tsx`/`SceneManager2DIso`: quando `boss_fase1` inizia, smonta
   l'isometrico e monta l'arena (stesso pattern del fork già esistente).
3. `PlayerArena.tsx` — input attacco/parry/dash sopra la base di `Player2D.tsx`.
4. Nuovi `CharacterAnimState` `'parry'`/`'stagger'` + mixin GSAP colore/tilt.
5. `BossHealthBar.tsx` (+ barra postura) e `PlayerHealthBar.tsx`.
6. `CHECCO_MOVES_ROUND1` (dati) + hitbox/timer sulle 2-3 mosse base.
7. Evento "Avvia il film": branching + `ArenaBackdrop.tsx` col crossfade.
8. Moveset round 2 + trigger di fine round (fuga di Checco → fase successiva, invariata).
9. Eve KO + prompt di richiamo + AI di supporto marginale.
10. (opzionali, a costo basso) hit-stop e finestra di contraccolpo post-parry.
