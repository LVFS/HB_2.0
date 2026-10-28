# FASE 10 — Tunnel: distanza fisica, tre vie, eventi a metri, desideri

Seguito della FASE 9 (`docs/FASE9_TUNNEL_POTENZIAMENTI.md`), nato dal playtest: Checco compariva e
spariva, gli oggetti spuntavano sullo schermo, i bonus erano troppi e poco utili. Tono invariato:
epico + demenziale, riferimenti anime/videogiochi/film (Buen Camino).

## Decisioni prese con l'utente
- **Distanza fisica** in metri, continua: ogni colpo/rimbalzo/evento è una spinta che si smorza in ~1 s.
- **Camera fissa**; Checco si vede solo quando è vicino (< ~10 m) o in finestre di evento. Fuori
  schermo lo segue un indicatore a destra (silhouette + metri).
- **Inquadratura uguale a ogni risoluzione** (fissata in altezza); gli oggetti nascono oltre il bordo REALE.
- **Casella bonus** (stile Mario Kart): una sola, si usa con `E`. Contenuto in base alla distanza
  (lontano da Checco → bonus per recuperare). Più rari, con uno scopo.
- **Valori fissi** per i colpi su Checco, contano anche con lui fuori schermo (Zoltraak lo raggiunge sempre).
- **Tempo limite 5 min** (reale). Se scade o Checco sfugge (> 100 m) si rifà l'inseguimento dall'INIZIO;
  la sconfitta per vita resta il checkpoint di sezione. Si vince raggiungendolo (distanza 0).
- **Tre vie** (D scivola su ringhiere), cambio via con W/S, salto solo Spazio. Resa: prospettiva vera
  leggermente inclinata (scelta mia).
- **Sfere del Drago**: sette = un desiderio a scelta tra tre. Se ti colpiscono ne perdi una. I desideri
  sono di tre tipi: a tempo, a usi limitati, per tutta la corsa (da decidere insieme).
- **Eventi a metri** con attacchi di Checco a contatore ("ONDA 32 m"): preso → modalità Buen Camino
  (Checco più veloce, torrette volanti), deviato → modalità anime (tutto a favore).
- Idee da inserire: gatto (potenziamento: cresce, ci sali, accarezzarlo e dargli da mangiare lo fa
  andare più veloce, invulnerabilità), Nuvola Speedy (tenendo premuto salta sale, rilasciando scende),
  effetto "Gear 5" a cartone, Kamehameha, personaggi che aiutano (Frieren e compagni in volo, altri),
  Eve che ti raggiunge verso la fine, Botafumeiro, karaoke, bivio (cambio via obbligato), buio, paparazzi.

## Ritocchi dopo il playtest della tappa 1 (eseguiti)
- Visuale più larga (TUNNEL_VIEW_HEIGHT 9.6 → 12.5, D più a sinistra): più tempo per decidere. Le minacce nascono sempre oltre il bordo.
- Movimento avanti/indietro più ampio (TUNNEL_STRAFE_RANGE 1.5 → 3.5, A/D).
- Lo **scatto** (Shift) ora sposta D di TUNNEL_DASH_DISTANCE nella direzione tenuta (A indietro, D avanti, nulla = avanti) con scia azzurra,
  anello e sprite allungato. NON accorcia la distanza da Checco: la marionetta segue lo scarto laterale di D, e gap è in metri lungo la corsa.

## Tappe
1. **Distanza fisica + ingresso da fuori + inquadratura fissa + casella bonus + valori fissi + tempo limite** — eseguita.
2. **Le tre vie** — eseguita (sotto).
3. **Attacchi di Checco a contatore, modalità Buen Camino / shonen, corsa a 150 s** — eseguita (sotto).
4. **Sfere → desideri di Shenron** — eseguita (sotto).
5. **Gatto, Nuvola Speedy, Eve, cameo, avvisi per via, bivio, paparazzi, Botafumeiro, karaoke, buio** — eseguita (sotto).

## Tappa 1 — cosa cambia
- `world.gap` è in METRI (0 = raggiunta, 100 = sfuggita); `TUNNEL_PUPPET_DIST_MIN + gap` è la distanza
  in unità di mondo. `addGap` NON cambia il valore: accumula in `gapPending`, che si applica con
  `TUNNEL_GAP_SMOOTH`. La velocità di avvicinamento dipende dallo Slancio.
- I lanci sono sincronizzati sull'ARRIVO a D: quando la marionetta è lontana partono prima
  (`launch = arrivo − distanza/velocità di avvicinamento`), così arrivano al secondo scritto.
- Gli oggetti nascono a `world.view.ahead` (bordo destro reale + margine), calcolato dal rig della
  camera ogni frame; `TUNNEL_SPAWN_AHEAD_MIN` è il minimo usato da `validateScript()`.
- Casella: `world.slot`, scatola (`box`) → `tunnelItems.ts`. Le Sfere e la freccia gialla restano
  oggetti del mondo.
- Il copione ripete l'ultimo tratto (`TUNNEL_LOOP_FROM`/`TUNNEL_LOOP_PERIOD`) finché non raggiungi
  Checco o scade il tempo.

## Accettazione tappa 1
- [x] Nessun oggetto nasce dentro lo schermo, a 1280×720, 1920×1080 e 2560×1080 (margine minimo ~2.3 unità oltre il bordo).
- [x] La stessa porzione di mondo si vede a ogni risoluzione (stessa altezza; l'ultrawide aggiunge solo larghezza, con un tetto).
- [x] Checco non scatta: la distanza cambia in modo continuo (spinta di +30 m versata in ~1 s); fuori schermo c'è l'indicatore con i metri.
- [x] I lanci arrivano al secondo scritto con Checco a 12, 30 o 60 m (errore ≤ 0.03 s).
- [x] La scatola riempie la casella, `E` la usa, scatola con casella piena = resta lì.
- [x] Zoltraak toglie sempre 6 m (provato con Checco a 60 m, fuori schermo); un colpo di spada (anche Gomu Gomu) su Checco ne toglie 3.
- [x] Una sfera si perde a ogni colpo subito.
- [x] Tempo scaduto / Checco sfugge → si ricomincia dall'inizio; vita a zero → inizio sezione.
- [x] Il copione si ripete oltre i 100 s.
- [x] tsc, lint, build, regressione arena (44) e bot verdi.

## Stato di esecuzione (tappa 1)
Eseguita. Bot sull'intera corsa: perfetto → alla raffica in ~72 s reali (Checco visibile ~40–80 s a 9 m,
appena dentro il bordo destro); reazioni mancate 20% → 11 colpi, nessuna sconfitta, ~130 s; 40% → 46 colpi,
3 sconfitte, perde per distanza/tempo e ricomincia dall'inizio. Chunk `SceneManagerTunnel` ~52.7 kB (gzip 17.3).

### Scostamenti / scelte
- **Distanza in metri 1:1 con le unità**: Checco si vede solo sotto ~11 m. Il minimo prima del finale è 9 m
  (`TUNNEL_GAP_FLOOR_BEFORE_FINALE`), così nella parte centrale è appena visibile al bordo.
- La corsa perfetta non si allunga ancora (~72 s reali): il copione ha 100 s di mondo. Si allunga con la tappa 3.
- Tolti: `TUNNEL_PUPPET_REVEAL_T`/`HIDDEN_DIST`, il flag `detached` e il tasto `L` (lo Zoltraak ora è un bonus
  della casella). I Gomu/Saiyan/Ciak/Senzu non sono più oggetti sul percorso: si trovano nelle scatole.
- Le Sfere sono 16 sul percorso + 4 dalle guardie + 4 dal masso; per ora i sette = Shenron (cura piena, −15 m,
  Slancio al massimo): i desideri veri a scelta arrivano con la tappa 4.
- `jumpToTime` dentro un evento lo riavvia (la distanza risale): è solo un comodo per i test.

## Tappa 2 — le tre vie
- **Input**: W/S (e frecce) cambiano via (laneUp/laneDown in usePlayerActions); nel tunnel jump è SOLO Spazio
  (usePlayerActions({ jump: [' '] })). Il cambio dura TUNNEL_LANE_CHANGE_TIME; durante il cambio D sta "fra due vie"
  (world.lane.pos continuo) e una minaccia lo colpisce solo se |via − pos| < TUNNEL_LANE_HIT_TOLERANCE.
- **Ogni cosa sta in una via**: ostacoli (hazard.lane), oggetti (pickup.lane, tolleranza più larga), lanci e colpi delle torrette
  (projectile.lane: si parano e colpiscono solo nella via di D). Il copione scrive lane e le vie multiple con across(t, kind, [vie]);
  validateScript() impone che a uno stesso istante non siano occupate tutte e tre le vie.
- **Resa**: camera ORTOGRAFICA inclinata (TUNNEL_CAMERA_PITCH); le vie sono a z diverso (TUNNEL_LANE_Z) e un po' scalate (TUNNEL_LANE_SCALE).
  TunnelRails disegna pavimento, tre binari e tacche (la via di D si illumina; sotto l'onda di Checco lampeggia di rosso). Lo sfondo
  converte le quote da altezza-schermo a quota di mondo (worldY) perché l'inclinazione non lo sposti. La finestra su Checco è ancorata
  alla camera (non al mondo). D "scivola": posa di corsa inclinata + scintille + ombra (la posa slide vera richiede arte).

## Tappa 3 — Checco altera la realtà, modalità, corsa lunga
- **Onda** (tunnelReality.ts, dati in TUNNEL_REALITY): a distanze fisse (96 s = 864 m e 132 s = 1188 m) Checco scaglia un'onda nelle vie
  indicate; parte REALITY_WAVE.warn secondi prima, con banner, finestra su Checco, contatore in metri (HUD threat) e via lampeggiante.
  Esiti: **PRESO** → modalità *Buen Camino*; **DEVIATO** (K nella via, a tempo) → modalità *shonen*; **SCHIVATO** (via, salto, scatto, Istinto) → solo −2 m.
- **Buen Camino** (22 s): Checco scappa (MODE_CAMINO.gapRate), atmosfera calda, 6 **torrette volanti** (turret: si abbattono con un colpo dato in salto,
  sparano nella loro via, ognuna ridà −3 m e una Sfera).
- **Shonen** (22 s): Slancio al massimo, −18 m, +25 vita, atmosfera viola con raggi, **Frieren** (placeholder) che ogni 2.4 s polverizza ciò che sta davanti,
  e a fine modalità il **Kamehameha** (carica 1.1 s con D protetto, −12 m, pulisce 40 unità).
- **Corsa**: 5 sezioni, 150 s di mondo (TUNNEL_TOTAL_DURATION); alterazione 80-136 (due onde) e rettilineo 136-150 (solo qui si può raggiungere Checco,
  gap min 0). Dopo i 150 s si ripete l'ultimo tratto (TUNNEL_LOOP_FROM 136, TUNNEL_LOOP_PERIOD 14). Perfetta: ~112 s reali.

## Tappa 4 — desideri di Shenron
- Sette Sfere → il gioco si ferma (world.arena.hitStop = Infinity, come la scelta del potenziamento dell'arena) e compare PowerUpChoice (riusata,
  titolo da powerUpChoiceTitle): **tre carte, una per tipo** — PERMANENTE (cuore, respiro, scatto, haki, magnete, slancio), A USI
  (istinto ×2, riserva = 3 Zoltraak su Q), A TEMPO (kaioken 25 s, ultreia 30 s). I permanenti già avuti non si ripropongono.
- tunnelWishes.ts è l'UNICO posto che legge i desideri (parata, scatto, vita massima, raggio di raccolta, ritmo dello Slancio…) e non importa
  da pickups/puppet/slancio (evita i giri di import). tryInstinct() va chiamata prima di ogni hitPlayer del tunnel (ostacoli, proiettili, onda, masso).
- I desideri durano finché non si ricomincia l'inseguimento dall'INIZIO (tempo scaduto / Checco sfugge): la sconfitta per vita li mantiene. La HUD li mostra
  come etichette (dorate = permanenti, viola = a usi) e i timer a tempo fra i bonus.

## Stato di esecuzione (tappe 1-4)
Verificato con Playwright (t10-t13, bot sulla corsa intera) + regressione dell'arena (44). Bot perfetto: ~112 s reali, devia entrambe le onde, 0 colpi;
con reazioni mancate (15-25%) 3-5 colpi, nessuna sconfitta. Chunk SceneManagerTunnel ~77 kB (gzip 25).
Da tarare giocando: REALITY_WAVE, MODE_*, CAMINO_TURRETS, ALLY_FRIEREN, KAMEHAMEHA, WISH_NUMBERS, ITEM_WEIGHTS, le sezioni e le vie di tunnelDirector.
## Tappa 5 — gatto, Nuvola, cameo, eventi nuovi, avvisi
- **Avvisi per via** (`TunnelAlerts.tsx`): ogni attacco di Checco che sta per arrivare ha un segnale sul bordo destro, NELLA VIA da cui arriva:
  triangolo arancio "PARA" (parabile), freccia gialla "SALTA" (non parabile), viola per l'onda. Compare per proiettili oltre il bordo, per lanci
  in preparazione con Checco fuori schermo e per l'onda; uno solo per via (priorità onda > schiva > para) per non fare caos. L'indicatore
  «Checco N m» della HUD sta più in alto (33 %) per non sovrapporsi.
- **Nuvola Speedy** (bonus della scatola, `NUVOLA`): tieni Spazio per salire (max 3.8), rilascia per scendere; 18 s; il salto normale si sospende.
- **Gatto randagio** (bonus della scatola, `GATTO`, `tunnelCat.ts`, `CatMount.tsx`): spelacchiato e cieco da un occhio. Cresce, D gli sale in groppa
  (Slancio 3, invulnerabile, chiude il gap più in fretta); J = coccola, R = pappa (niente attacco/cura finché ci sei sopra); l'affetto cala e,
  se lo trascuri, se ne va. Dura al massimo `GATTO.maxSeconds`.
- **Ospite della modalità shonen** (`src/data/tunnelCameos.ts`, `CameoCast.tsx`, `enterHelper`/`giveHelp` in `tunnelReality.ts`): **UNO solo per
  modalità**, scelto a caso (`pickCameo`: una SQUADRA con probabilità `TEAM_CHANCE` 0.35 — Gentleman, ciurma, Saiyan, classe 1-A — altrimenti un singolo).
  Esce da un **portale** sopra la via lontana: aprendosi spazza via ciò che sta davanti a D (`entranceRange` 10, tutte le vie) e l'ospite resta
  `CAMEO_CAST.stay` (15 s), poi il portale si richiude e D è solo fino al Kamehameha. Ognuno aiuta a modo suo (`help`): **lane** (predefinito: la via di D,
  11 unità, ogni 2.5 s), **wide** (tutte le vie, 16 unità, ogni 6 s: Goku, Gojo, All Might, Frieren, Going Merry, squadre), **lost** (Zoro: via SBAGLIATA),
  **shield** (Kratos, Esquie, Journey, Flower: 1.6 s di invulnerabilità ogni 7 s). I piccoli bonus (`heal`/`gap`) alla prima volta. **Eve** è l'ospite della
  seconda onda (`eve: true`): arriva di corsa e ripulisce la via di D ogni 2.2 s. Voci `todo: true`: battute GENERICHE da sostituire.- **Eventi nuovi**: *bivio* (bark a 83.5 s), *paparazzi* (il flash parte quando D gli arriva DAVANTI — a distanza, `PAPARAZZO.flashRange` —, non a tempo: se D l'ha già superato senza che scattasse, niente lampo alle spalle; abbaglia solo nella propria via e fa perdere metri; il bianco della HUD, `BlindFlash`, parte solo quando il conteggio sale, mai al rimontaggio), *Botafumeiro* (pendolo che
  oscilla fra le vie, colpisce solo nella via giusta), *karaoke* (evento 100-110: 8 note ♪ da parare/saltare, se nessuna ti prende «APPLAUSI» −6 m),
  *buio* (evento 154-160: cerchio di luce attorno a D, overlay sotto la HUD).
- **Corsa a 200 s** in 6 sezioni (imbocco 0-20, lanciatore 20-50, crollo 50-80, spettacolo 80-110, alterazione 110-188, rettilineo 188-200);
  onde a 130 s e 164 s; ripetizione dell'ultimo tratto da 188 (periodo 12). Perfetta: ~160 s reali.
- Bug trovato in verifica: `startEvent` accendeva il masso per OGNI evento diverso da `detach` (karaoke e buio lasciavano un masso fantasma
  che non si spegneva). Ora solo per `boulder`.
- Nei test automatici la scelta del desiderio ferma il gioco (hitStop = Infinity): il bot deve scegliere (tasti 1-3) o resta fermo.

### Stato di esecuzione (tappa 5)
tsc/eslint/build puliti (chunk SceneManagerTunnel ~108 kB, gzip 34). regress (44) tutto vero; t10-t14 positivi; bot perfetto 0 colpi, con 20 % di
reazioni mancate 4 colpi e nessuna sconfitta. Da tarare giocando: `GATTO`, `NUVOLA`, `CAMEO_CAST`, `EVE_HELP`, `KARAOKE`, `PENDULUM`, `PAPARAZZO`, `DARK`.

## Tappa 6 — nemici, malus, ospite unico col portale, più difficile
- **Nemici** (`tunnelEnemies.ts`, `PILGRIM`/`ARCHER` in `tunnelConfig.ts`; 18 nel copione dalla sezione 2): il **pellegrino fanatico** (corpo a corpo: fermo, a
  7.5 unità si carica 0.5 s (lampo bianco, cappello rosso) e poi si scaglia; lo abbatti con un colpo di spada, lo PARI mentre si scaglia, lo salti/scatti) e il
  **balestriere** (a distanza: ogni 2.8 s scocca un dardo parabile nella sua via con 0.65 s di avviso; parato, il dardo TORNA a lui e lo spezza; o spada). Valgono
  anche l'aura Super Saiyan. Cadendo danno terreno (−3/−5/−4 m), lasciano **resti** per terra e, col 45 %, un **fagiolo** (+14 vita).
- **Resti** (`remains`): 9 s per terra; chi ci passa sopra a terra è **rallentato** (`MALUS.slow` 0.9 s dopo l'ultimo contatto: tempo di D al 60 % e Checco guadagna
  1.8 m/s); si salta per evitarli.
- **Malus**: *frenato* (il dardo che ti prende: 7 s senza Slancio, `world.brakeT`) e *rallentato* (resti, `world.slowT`). In HUD sono barre rosse «MALUS: …».
  **Li toglie la modalità shonen** (insieme ai resti per terra) e il Senzu (`clearMaluses`).
- **Più difficile**: deriva base del gap −0.5 → −0.42 m/s, penalità colpo 10 → 12 m, danni di basso/muro/cassa/voragine +2, onda 18 → 22, i nemici nel copione.
  Bot (reazioni mancate): 20 % → 4 colpi 0 sconfitte; 35 % → 13 colpi 1 sconfitta (da tarare giocando: `PILGRIM`, `ARCHER`, `MALUS`, `BEAN`, copione).
- Pool dei nemici in scena: `MAX_SLOTS` 40 in `TunnelHazards`. Il bot (`t9bot`) para il pellegrino a fine carica, colpisce il balestriere e salta i resti.

## Tappa 7 — onda unica, stili permanenti, Eve che resta, masso fisso, ombre
- **Onda di Checco su TUTTE le vie** (`TUNNEL_REALITY.lanes = [0,1,2]`): una sola onda grande quanto le vie (`TunnelWave`: un sipario che le unisce più una lama per
  via), un solo avviso nella via di mezzo. Non si evita cambiando via: si PARA (K) a tempo, si salta o si scatta.
- **Stili permanenti** (`tunnelPerks.ts`, `PERKS`/`PERK_NUMBERS`, `cameoPerks` in `src/data/tunnelCameos.ts`): l'ospite che arriva (dopo la parata) ti lascia uno o più
  stili che durano fino alla ripartenza dall'INIZIO (la sconfitta per vita li mantiene, come i desideri); in HUD sono chip verdi. Ogni stile cambia il gioco e,
  dove indicato, l'aspetto di D (`PlayerRunner`: capelli d'oro, mantello, cilindro e papillon, ciuffo e nuvolette; aure colorate):
  **saiyan** (Goku, Vegeta, Trunks, Gohan, squadra Saiyan: aura dorata, VOLO tenendo premuto Spazio — carica che si consuma salendo e si ricarica a terra — e
  travolge ciò che sta a terra), **thor** (Thor/Iron Man/Spider-Man/Capitan America — gruppo `marvel` nuovo — e Kratos: un attacco J IN ARIA diventa una caduta a martello
  con fulmine ad area, tutte le vie, 4.6 unità davanti e 1.4 dietro, attesa 1.2 s), **gentleman** (smoking: «Vai uomo!» a ogni salita di Slancio; a velocità massima i
  colpi A DISTANZA dei nemici — dardi e torrette, `proj.ranged` — non lo toccano), **gear5** (Luffy e la ciurma: pugno a gomma sempre attivo) e **zoro** (ciurma o Zoro:
  una scorta di 16 s che corre davanti a D, spazza la sua via ogni 0.45 s, va a zonzo cambiando via a caso e poi perde l'orientamento e se ne va all'indietro),
  **hero** (+30 vita massima: All Might, Deku, doppiatori, classe 1-A), **magic** (Zoltraak automatico ogni 14 s: Frieren, Gojo, Midna, Shoto, Going Merry),
  **speed** (Slancio minimo 2: spadaccini e veloci), **fly** (Esquie), **calm** (scudo amico 1.6 s ogni 12 s: streamer, Journey…), **eve**. Uno stile già avuto non
  si ripete: in cambio +30 vita. Il frutto Gomu Gomu/Super Saiyan restano bonus a tempo separati (l'aura del frutto rende invulnerabili, lo stile no).
- **Eve resta** (`world.mode.eveOn`, stile `eve`): dopo l'arrivo nella seconda onda non se ne va più né a fine modalità né alla ripartenza dalla sezione (solo da
  capo); ripulisce la via di D ogni 3.6 s (10 unità). `resetPerks` va chiamata PRIMA di `jumpToTime(0)` nella ripartenza totale.
- **Il masso è fisso**: entra alle spalle di D e resta a `BOULDER.startDist` (non insegue, non recupera); si avvicina solo con colpi e malus (`boulderNudge`).
  Finisce quando si schianta contro un muro/cassa/ostacolo basso intatto che D si è lasciato dietro (`boulderCrash`; nel copione c'è il muro a 78 s) o allo scadere
  (evento 62-79.5): schianto con scossone e pioggia di Sfere.
- **Niente cure con R**: tolte (HUD, input, `TUNNEL_HEALS`); si guarisce con fagioli, Senzu e stili. Il desiderio «Fagioli a volontà» ora fa lasciare SEMPRE un fagiolo
  ai nemici caduti (+50 % di cura) e dà +20 vita subito. R resta solo la pappa del gatto.
- **Ombre sul binario** (`LaneShadows.tsx`): sotto ogni ostacolo, nemico, oggetto e proiettile cade un'ombra nella SUA via (più piccola e tenue se è in alto), per
  capire a colpo d'occhio in quale via spostarsi.
- Lezione di sessione: mai `Get-Content | Set-Content -Encoding utf8` su file con accenti in PowerShell 5.1 (doppia codifica + BOM): usare `[IO.File]::ReadAllText/WriteAllText` con UTF8 senza BOM.