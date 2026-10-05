# Boss fight — arena più ostica, cure/abilità, QTE cooperativo e finale con separazione

Estende `FASE6_ARENA_BOSS_COMBATTIMENTO.md` (già implementato quasi per intero da VS Code,
vedi il check che ti ho fatto) con tutto quello che hai appena descritto. Parto dalle tue
risposte alle domande che ti ho fatto:

- **Barra abilità**: due soglie, due mosse — a ~metà carica una mossa, a barra piena
  un'altra (più forte). Sotto propongo come farla caricare e come attivarla, le mosse
  vere le scriviamo insieme quando ci si arriva.
- **QTE finale**: ci provo fallibile con un impatto leggero (non un branch narrativo
  pesante); se in corso d'opera si rivela troppo complicato, si passa all'esito fisso
  (Checco va comunque a terra, il QTE conta solo per un punteggio) — te lo segnalo come
  rete di sicurezza nel punto giusto, non come ripiego nascosto.
- **Eve al finale**: si rialza sempre, anche se non l'hai mai richiamata in combattimento.

---

## 1. Le leve di difficoltà, una per una

### 1.1 Corpo solido — non attraversabile, superabile solo saltando
Oggi il giocatore può camminare dentro Checco senza conseguenze (nessuna collisione fisica
fra i due corpi, solo le hitbox di combattimento). Serve una seconda AABB, più larga della
hurtbox da combattimento (`bossHurtbox` in `combat.ts`, `BOSS_HALF_WIDTH = 0.75`) — chiamiamola
`bossBodyBlock` — che blocca il movimento orizzontale del giocatore quando è a terra o basso,
ma NON quando `player.y` supera una soglia di "sopra la testa" (es. metà dell'altezza del
boss): in quel caso il giocatore sta saltando sopra e passa. Per restare semplice propongo
che valga solo in un senso: il giocatore è bloccato dal corpo di Checco, Checco non è
bloccato dal giocatore (può comunque affondare/lunge attraverso la sua posizione) — evita
casi limite di due corpi solidi che si spingono a vicenda, e in un boss fight è normale che
il boss "passi" mentre il giocatore no.

### 1.2 Attacchi in salto — Checco guadagna un asse verticale
Oggi `BossChecco.tsx` si muove solo su X (`boss.x`), mai su Y — serve aggiungere `boss.y` e
una piccola integrazione gravità/salto (stessa integrazione manuale già usata ovunque nel
2D, niente di nuovo concettualmente). Propongo due mosse nuove, per varietà:

- **Balzo d'assalto** (gap closer): windup a terra, poi un arco che lo porta addosso al
  giocatore da media/lunga distanza, atterra con una hitbox orizzontale ampia — un
  sostituto più minaccioso di "passo_falso", pariabile come le altre mosse a terra.
- **Schianto verticale** (novità vera): sale dritto, una breve pausa in aria (il vero
  "tell": il giocatore capisce che sta per scendere), poi atterra sul posto con un'onda
  d'urto orizzontale che si espande dai due lati. Questa la farei apposta **non parabile**
  — va schivata (dash fuori raggio) o saltata al momento giusto: la prima mossa del boss
  che non risponde al ritmo "para e basta", buona varietà da souls-like vero.

Round 2: versione dello schianto più ampia e/o più rapida, coerente con l'escalation già
prevista per le altre mosse.

### 1.3 Numeri più ostici (punto di partenza, si tara a vista come sempre)
Solo direzione, non valori definitivi:

| Costante | Oggi | Proposta | Perché |
|---|---|---|---|
| `POSTURE_DECAY_PER_SECOND` | 8 | ~12 | la postura del boss si svuota più in fretta: più difficile forzare il barcollamento a piccoli colpi, premia la parata pulita più del pressing |
| `POSTURE_DECAY_DELAY` | 2.5 | ~1.6 | il decadimento riparte prima dopo l'ultimo colpo |
| `PLAYER_IFRAMES_AFTER_HIT` | 0.7 | ~0.45 | meno margine "gratis" dopo un colpo subito |
| `BOSS_MOVE_COOLDOWN_ROUND1/2` | 0.9 / 0.55 | ~0.7 / 0.4 | meno respiro fra una mossa e l'altra |
| `BOSS_MAX_HP` | 100 | ~140 | combattimento più lungo, coerente con un'arena più lunga |

### 1.4 Arena più lunga — serve anche una camera che segue
Oggi `ARENA_HALF_WIDTH = 6` con camera FISSA (mai seguito nessuno, l'intera arena piccola
entra a schermo). Allungarla (propongo ~10-12) senza toccare la camera la farebbe sembrare
uno zoom-out fisso su un palco troppo largo — serve una camera che segua il punto medio tra
giocatore e boss (con un clamp ai bordi dell'arena, così non "esce" mai a vedere il vuoto
fuori dal fondale). Stessa idea di `useFollowCameraX` già usata per l'esterno, ma con
bersaglio "punto medio fra due posizioni" invece di "segui il giocatore" — una piccola
variante nuova, non una riscrittura.

---

## 2. Le 3 cure
Una risorsa a 3 cariche (fisse per tentativo, si azzerano/ricaricano a ogni nuovo `runId`
come vita e postura oggi in `arenaStore.reset`) — stile flasca Souls, non oggetti raccolti
nel mondo. Un tasto dedicato (libero: propongo **R**) avvia una breve canalizzazione
(~0.8s) durante cui il giocatore NON ha i-frames: si può essere colpiti e interrotti a
metà cura, sprecando la carica senza guarire — coerente con "più ostico", e con lo stesso
principio di rischio/rendimento del parry. HUD: 3 icone in basso (piene/vuote), vicino alla
barra vita del giocatore in `ArenaHud.tsx`.

## 3. Barra di abilità — due soglie, due mosse
Si carica (percentuale 0-100) per ogni azione che "funziona": un attacco che va a segno su
Checco, una parata riuscita, e ogni volta che INFLIGGI un barcollamento (non quando lo
SUBISCI tu — altrimenti premierebbe il giocatore per essere stato colpito, il contrario di
quello che vuoi). A ~50% si sblocca una prima mossa speciale, a 100% una seconda più forte
(consuma tutta la barra); sotto il 50% il tasto dedicato non fa nulla. Un solo tasto
(propongo **E**) esegue automaticamente la mossa più forte disponibile in quel momento —
più semplice da spiegare a schermo che due tasti separati. Le due mosse vere (danno,
animazione, se hanno postura extra) le progettiamo insieme quando arriviamo a costruirla:
qui definisco solo il contenitore/la regola di carica.

---

## 4. Il finale: QTE cooperativo + trasformazione + separazione

### Trigger
Quando `boss.hp` scende sotto il 10% di `boss.hpMax` (percentuale, non un numero fisso —
così regge anche se cambi `BOSS_MAX_HP`), il combattimento normale si ferma: Checco diventa
bersaglio fisso (niente più IA/mosse), **Eve si rialza sempre** — se era `down` si alza
sul posto, se era `active`/`staggered` smette quello che stava facendo e si riporta verso
Checco — per la cutscene che segue.

### Il QTE cooperativo
Prima vera occasione di usare il `QteChallenge` che era già previsto (ma mai costruito) nel
piano madre `FASE_BOSS_CHECCO_ZALONE.md` — una sequenza di prompt a tempo ("D e Eve
colpiscono insieme"), 4-6 pressioni, qualche centesimo di margine per ognuna.

**Esito**: qui provo a tenere insieme "fallibile" e "non troppo complicato" come hai detto
tu. Propongo che il risultato NARRATIVO resti identico in entrambi i casi (Checco va
sempre a terra, si trasforma sempre) — quello che cambia con un QTE riuscito/fallito è
qualcosa di leggero e a basso costo, per esempio: una riga di dialogo diversa subito dopo
("bel colpo di squadra" vs "ce l'abbiamo fatta lo stesso, ma quanto siamo scoordinati"), più
magari un piccolo bonus/malus di partenza per la fase successiva (es. qualche punto vita in
più/meno per D quando si scende nel sotterraneo). Nessun nuovo ramo di contenuto pesante,
solo un `finalQteSuccess: boolean` che pesca fra due micro-varianti già scritte. Se anche
questo, costruendolo, risultasse più complicato del previsto, la rete di sicurezza è
l'esito fisso puro (il QTE conta solo per un punteggio, come gli altri QTE del piano
madre) — tienilo a mente come piano B, non serve deciderlo oggi.

### La cutscene
Dopo il QTE, sequenza scriptata (non più giocata):
1. Checco atterra, breve pausa.
2. Si trasforma — visivamente diventa una marionetta (riferimento Arlecchino di Lies of P):
   propongo, per restare negli stessi costi di oggi, un nuovo stato visivo segnaposto a
   tinta unita ma con un dettaglio che si legga come "giunture"/"snodi" (poche linee scure
   sovrapposte) invece del colore pieno attuale — stessa filosofia "tinte unite finché non
   c'è arte vera" già usata per il boss.
3. La marionetta scansa i due eroi: un tween GSAP di scaraventamento su ENTRAMBI i gruppi
   (D ed Eve), che cadono.
4. Whiteout, taglio.

### La separazione
D scende sotto il piano terra, Eve resta di sopra. Serve un nuovo `Level` LDtk per questo
spazio — propongo il nome `Sotterraneo` (dimmi se ne preferisci un altro, è solo una
stringa). Concettualmente è la STESSA idea di "macerie che separano Eve e D" del piano
narrativo originale — qui raccontata meglio (il corpo della marionetta al posto di un
crollo generico) — non contraddice nulla di quanto deciso prima, lo specifica.

Subito dopo: dialogo a distanza fra i due (Eve dice di continuare senza di lei, che lo
raggiungerà a breve, e gli dà "un'altra spada") — è ESATTAMENTE il contenuto già abbozzato
come `LEVEL1_SECOND_SWORD_DIALOGUE` nel piano madre per `transizione_seconda_spada`, ora
con un aggancio scenico preciso (la separazione per la marionetta) invece che generico
("macerie varie o altro"). Lo riuso praticamente parola per parola.

### Perché questo risolve anche un dubbio rimasto dall'ultimo check
Ti avevo segnalato che l'arena usa oggi lo sprite `D1` (quello con "la lama di Eve",
`transformToD1`) fin dall'inizio del round 1 — narrativamente in anticipo, perché quella
trasformazione nel progetto significa "D dopo aver ricevuto la seconda spada". Con questo
piano, il momento "Eve gli dà un'altra spada" ha finalmente un aggancio scenico preciso
(qui, dopo la separazione): la transizione pulita sarebbe usare **D0** per tutto il round 1
e 2 dell'arena, e far scattare `transformToD1` esattamente qui. Il problema tecnico
originale resta (la posa `action` di D0 è un passo, non un fendente, quindi D0 non ha
un'animazione d'attacco convincente) — se vuoi risolverlo per bene serve una posa
d'attacco vera per D0 prima di fare questo cambio; altrimenti si può accettare la stessa
piccola forzatura di prima (D1 già dall'inizio) e considerare questo solo un discorso di
coerenza da rimandare. Non blocca il resto del piano, la segnalo di nuovo solo perché ora
il "perché" narrativo di D1 diventa concreto e visibile nella stessa scena.

Poi: `boss_fase2_tunnel`, ora collocato fisicamente "sotto il piano terra" (la posizione
del `Sotterraneo`) invece che generico — la prima informazione di level-design concreta
che abbiamo su quella fase, utile per quando la costruiremo.

---

## 5. Cosa NON cambia

- Round 1 e Round 2 esistenti restano la base: le mosse in salto si aggiungono al pool
  (`CHECCO_MOVES_ROUND1/2`), non sostituiscono le mosse a terra.
- L'evento "Avvia il film" (metà vita, buff/malus, cambio sfondo) resta identico.
- La mappatura generale delle fasi in `FASE_BOSS_CHECCO_ZALONE.md` resta valida — questo
  documento riempie solo la coda di `boss_fase1` e l'inizio di `transizione_seconda_spada`
  con dettagli veri.

## 6. Cose ancora aperte (dimmi se hai preferenze, altrimenti procedo con la proposta)

- Nome del nuovo `Level` sotterraneo (`Sotterraneo` è solo la mia proposta).
- Le due mosse vere della barra abilità — cosa fanno esattamente, le progettiamo quando ci
  arriviamo.
- Tasti `R` (cura) ed `E` (abilità) — liberi oggi, cambiali se preferisci altro.
- Se il QTE finale ibrido si rivela troppo da costruire, passa all'esito fisso (vedi §4) —
  non serve deciderlo ora, solo saperlo.

## 7. Checklist consigliata, in ordine

1. Corpo solido di Checco (blocco orizzontale + eccezione da salto).
2. Asse verticale per Checco + le due mosse in salto (round 1, poi round 2).
3. Numeri più ostici (tabella §1.3) — tarare giocando.
4. Arena più lunga + camera che segue il punto medio giocatore/boss.
5. Le 3 cure (risorsa, tasto, canalizzazione interrompibile, HUD).
6. Barra di abilità (carica su colpo/parata/barcollamento infitto, tasto, contenitore —
   le due mosse vere dopo).
7. Trigger del finale a <10% vita + Eve che si rialza sempre.
8. `QteChallenge` (prima costruzione reale) + QTE cooperativo D/Eve.
9. Cutscene: trasformazione in marionetta + scaraventamento di entrambi.
10. Nuovo `Level` `Sotterraneo` + dialogo a distanza (riuso di `LEVEL1_SECOND_SWORD_DIALOGUE`)
    + `transformToD1` + `setPhase('boss_fase2_tunnel')`.
