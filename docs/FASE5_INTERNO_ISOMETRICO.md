# Interno isometrico dell'Ariston — specifica tecnica + guida alla piantina LDtk

Decisione presa (non più in discussione, come richiesto): l'esterno resta lo scorrimento
laterale già costruito e verificato. Dalla porta centrale in poi — corridoio, scale,
primo piano, sala boss dietro l'unica porta — è un secondo "modo" isometrico. Questo
documento specifica come costruirlo e come strutturare la piantina LDtk che serve prima
di scrivere qualunque contenuto lì dentro.

## Perché è più semplice di quanto sembri

L'isometrico "classico" (Diablo 1, i vecchi RPG a tile) è complicato perché lì lo schermo
È i dati: si compongono a mano tile disegnate già in prospettiva a rombo, e serve la
matematica per convertire riga/colonna in pixel sullo schermo. Noi non siamo in quella
situazione: siamo dentro un motore 3D vero (React Three Fiber), quindi la prospettiva
isometrica la crea la CAMERA, non i dati. Il livello si costruisce su un piano X/Z
normale — esattamente come una piantina vista dall'alto, gli stessi numeri che avete già
sketchato a mano — e si guarda con una camera inclinata invece che dritta dall'alto o di
lato. Zero trasformazioni a rombo da scrivere.

## Camera

`OrthographicCamera` (stessa già in uso per l'esterno, solo un preset diverso), inclinata
a circa 30-40° di elevazione sul piano orizzontale, ruotata di 45° in azimuth — l'angolo
standard "isometrico" di generi come Hades o i vecchi Fallout isometrici (non serve
inseguire il vero isometrico matematico a 35.264°, quell'angolo serve solo per tile pixel
disegnate a mano; qui è puro gusto visivo, tarabile a occhio). Segue il giocatore in X/Z
con lo stesso principio di `useFollowCameraX` già scritto per l'esterno, solo su due assi
invece di uno.

## Architettura (muri/pavimento/scale)

Geometria 3D semplice generata da codice a partire dai dati LDtk, non modelli Blender:
box estrusi per i muri (altezza fissa, es. 3 unità), un piano per il pavimento, gradini
come una serie di box bassi degradanti per le scale. Materiale piatto/tinta unica (o al
massimo un gradiente/ombreggiatura semplice), coerente con lo stile cartoon dei concept
già visti (niente PBR fotorealistico qui — è un'altra area del gioco, resta la scelta già
presa di tenere il fotorealistico solo fuori dal gameplay vero e proprio). Vantaggio
concreto: si genera e si itera in secondi ogni volta che la piantina LDtk cambia, senza
mai aprire Blender per un blockout.

## Personaggi

Stessi 12 sprite `D0`/`D1`/`Eve` già tagliati, stesso componente `Character2D`/
`CharacterAnimator2D` di Fase 3 — nessuna modifica, nessuna arte nuova per partire.
Billboard: lo sprite ruota sempre verso la camera (`useFrame` con `lookAt` limitato
all'asse Y, o più semplice: dato che la camera isometrica ha un angolo FISSO, basta
orientare lo sprite a un angolo fisso pari a quello della camera, non un vero
billboard-per-frame). Il movimento resta un vettore su X/Z (WASD/frecce), letto
direttamente — è la camera inclinata a produrre l'aspetto isometrico sullo schermo, il
codice di movimento non deve "sapere" che è isometrico.

## Transizione esterno → interno

Riuso di un pattern già esistente nel progetto invece di inventarne uno nuovo: un
whiteout/dissolvenza come quello già in `App.tsx` per i cambi schermata, o le nuvole di
`CloudTransition.tsx` per i cambi città — stessa idea, cambia solo il trigger (varcare la
porta centrale invece di un cambio schermata). Durante il buio si smonta
`SceneManager2D` (modo laterale) e si monta il nuovo `SceneManager2DIso` (modo
isometrico), mai i due insieme.

## Guida alla piantina — cosa disegnare in LDtk

Struttura consigliata, un World con questi Level (uno per "stanza" logica, non uno per
piano — se il primo piano ha più stanze si aggiungono più Level):

- **Level `piano_terra`**: l'ingresso, il corridoio, la base delle scale. Layer
  `IntGrid` per i muri (dentro/fuori camminabile), layer Entità per: punto di spawn di
  D/Eve entrando dalla porta, punto "inizio scale", eventuali trigger delle attività
  stupide se le spostate qui dentro.
- **Level `primo_piano`**: la sommità delle scale, il corridoio, **l'unica porta** verso
  la sala boss — un'entità `Door` con un campo `targetLevel: 'sala_boss'` così il loader
  sa dove portare il giocatore.
- **Level `sala_boss`**: la stanza vera (già bozzata a mano) — qui serviranno anche
  entità per la posizione di Checco Zalone e per eventuali punti di copertura/pattern
  d'attacco, ma quello è contenuto della Fase boss, non di questa.

Ogni Level LDtk mappa 1:1 a un world X/Z in game: basta moltiplicare riga/colonna della
griglia LDtk per una dimensione di tile fissa (es. 1 unità di gioco per cella) — non serve
nessuna proiezione, è già il piano orizzontale che la camera isometrica guarderà da sopra.

## Cosa NON fare ora

Non scrivere `boss_fase1` (pattern d'attacco, hitbox) finché `sala_boss` non esiste
davvero in LDtk — dipende dalla forma reale della stanza (dove ci si può muovere, dove sta
Checco). Non aggiungere altre attività/dialoghi per l'esterno oltre a quelli già fatti:
priorità assoluta è la piantina, poi il modo isometrico che la legge, poi si riprende il
contenuto.
