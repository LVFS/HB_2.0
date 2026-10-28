# FASE 12 — La fuga di Checco: spazio, cannone, finale e punteggio

Punto di partenza: FASE 11 committata. Questa fase chiude il Livello 1 da cima a fondo:
`inseguimento_spaziale_cutscene` → `qte_supporto_eve` → `carica_cannone_qte` → `dialogo_finale` → `schermata_punteggio` → titoli di coda → menu.
Fonte della storia: `docs/storyboard/Info_storia_e_musica_ost.txt`.

## Decisioni prese con l'utente
- **Resa**: in-engine semplice con segnaposto (stelle in scorrimento, forme a tinte unite), con i QTE dentro. Le parti non interattive potranno
  essere sostituite da video senza toccare le fasi.
- **QTE non fallibili**: la storia è fissa (Checco muore, la navicella di Eve si schianta). L'esito cambia solo punteggio e una riga di dialogo.
- **Punteggio**: tempo totale, esito dei QTE, colpi subiti (boss + tunnel), cose curiose raccolte e le future attività secondarie nel cinema.
- **Dopo il punteggio**: titoli di coda, poi menu. Il livello va segnato completato. Il punteggio non si salva.
- **Dedica dei titoli**: da scrivere a mano (`src/data/credits.ts`: oggi un segnaposto ben visibile).

## Cosa c'è

| Cosa | Dove |
|---|---|
| Scena spazio (una per le tre fasi), macchina a stati interna | `src/game/levels/Spazio/SceneManagerSpazio.tsx` (+ `.module.css`) |
| Costanti (durate, QTE, carica, posizioni) | `Spazio/spazioConfig.ts` (senza alias `@/`: lo legge Node nei test) |
| Mondo per-frame (un ref) e driver di simulazione senza React | `Spazio/spazioState.ts`, `Spazio/spazioDriver.ts` |
| Carica del cannone (PURA, testata) | `Spazio/chargeMeter.ts` |
| Sfondo (stelle in 3 strati + pianeta) e navi (razzo, navicella di Eve, nave madre, raggio, effetti) | `Spazio/SpaceBackdrop.tsx`, `Spazio/SpaceShips.tsx` |
| Battute (didascalie a tempo per le cutscene, dialogo a un tasto per riga dopo il QTE) | `src/data/dialogues/level1_spazio.ts` |
| Finale a terra + dialogo con due righe variabili | `src/game/levels/Finale/SceneManagerFinale.tsx`, `src/data/dialogues/level1_finale.ts` |
| Schermata del punteggio e titoli di coda | `src/game/levels/Finale/SceneManagerPunteggio.tsx`, `src/data/credits.ts` |
| Statistiche della run (non persistite) | `src/store/runStatsStore.ts` |
| `computeScore` (pura) e pesi/soglie | `src/game/score/computeScore.ts`, `src/game/score/scoreConfig.ts` |
| Esito dello spazio | `levelStore.spaceResult` (`{ support, cannon }`, azzerato da `resetLevel()`) |
| Test (`npm test`) | `tests/computeScore.test.mjs`, `tests/chargeMeter.test.mjs` |
| Scorciatoie dev | `F2` spazio, `F3` finale a terra, `F4` punteggio con statistiche d'esempio (`hooks/useDevBossShortcut.ts`) |

## Come funziona
- **Tappe dello spazio**: `opening` (cutscene ~20 s) → `support` (QTE) → `supportAfter` (dialogo, un tasto per riga) → `cannon` → `destruction`
  (cutscene ~12.5 s) → bianco → `dialogo_finale`. Le fasi di `levelStore` si aggiornano ai passaggi: `inseguimento_spaziale_cutscene` (apertura),
  `qte_supporto_eve` (supporto), `carica_cannone_qte` (dialogo, cannone e distruzione).
- **Cutscene (apertura e distruzione)**: timeline GSAP su `SpazioWorld` + didascalie a tempo; `applyFinalState()` idempotente; saltabili con
  Esc/Invio tenuto (due `<SkipCutscene key=…>` distinti, perché ogni istanza scatta una volta).
- **QTE di supporto**: 10 prompt (`SUPPORT_QTE_COUNT`), finestre da 1.2 s a 0.8 s, pausa 0.35 s, tasti J/K/E/R/Spazio. Un tasto riuscito fa schivare la
  navicella (il colpo la manca), uno mancato la fa colpire. `supportScore = riusciti / totale`. Lo scafo è compromesso comunque.
- **Cannone**: si martellano J / K / Spazio (o click/tap). `CANNON_GAIN_PER_TAP` per pressione, ×1.2 se il tasto è diverso dal precedente, decadimento
  solo dopo 0.3 s di tregua. A ~6 pressioni/s su un tasto la barra si riempie in ~7.6 s; limite 10 s; a tempo scaduto sotto il 70% spara lo stesso
  a carica forzata 0.7 (raggio più sottile). Il punteggio del cannone è la carica massima raggiunta (quella vera, non la forzata).
- **Statistiche**: un punto di aggancio per fonte. Colpi: SOLO `hitPlayer` (`combat.ts`, dopo parata/i-frame; passa da lì anche il tunnel).
  QTE del boss: `finale.ts`. Raffica: `SceneManagerTunnel.onBarrageFinished`. Supporto e cannone: la scena spazio. Curiosità (id univoci):
  `wish:<id>` (`applyWish`), `cameo:<id>` / `cameo:eve` (`enterHelper`), `cat` (`startCat`), `pickup:arrow` / `pickup:bean` (`applyPickup`).
  Un QTE non giocato è `null` e NON conta come zero (le scorciatoie dev non penalizzano).
- **Punteggio** (`computeScore`, 0-100 + voto S/A/B/C): tempo 20, QTE 30, colpi subiti 25, curiosità 15, attività 10. Tempo: pieno fino a 18 min, zero
  a 45; colpi: zero colpi = pieno, 30 = zero; curiosità: 6 = pieno. Una componente senza dato (attività senza definizioni, tempo ignoto, nessun QTE)
  cede il suo peso alle altre. Voti: S ≥ 90, A ≥ 75, B ≥ 55, altrimenti C.
- **Attività secondarie nel cinema (punto di estensione)**: aggiungere la definizione in `ACTIVITY_DEFINITIONS` (`scoreConfig.ts`) e chiamare
  `completeActivity('id')` dove l'attività si conclude. La riga «Attività» della schermata compare solo se c'è almeno una definizione (oggi nessuna:
  biglietti e popcorn non sono ancora nel gioco).
- **Fine**: titoli di coda saltabili; a fine/salto (idempotente) `completeLevel('oristano-ariston')` e `setScreen('menu')`. Rigiocando, `resetLevel()`
  riporta a pulito fase, esiti e statistiche.

## Scostamenti dal piano
- **Didascalie a tempo** nelle due cutscene (apertura/distruzione) invece di dialoghi a tasto: la scena si muove da sola e il salto resta unico. Il
  dialogo dopo il QTE, invece, è a un tasto per riga come il resto del gioco. `DialogueBox` ha ora `showHint` (nasconde «premi un tasto» sulle didascalie).
- **`runStatsStore`** ha QTE `number | null` (non `number`): «non giocato» ≠ zero.
- **Test con Node**, senza aggiungere dipendenze: `npm test` carica i `.ts` puri con type stripping (richiede Node ≥ 22.18). Per questo `tsconfig.json` ha
  `allowImportingTsExtensions` e i file testati (`computeScore`, `scoreConfig`, `chargeMeter`, `spazioConfig`) importano con estensione `.ts` e senza alias.
- **Pillola «non implementata»**: rimossa da `SceneManager2D` (era codice morto); `App.tsx` ha `OWN_SCENE_PHASES` e il tipo `LevelPhase[]` per le liste di fasi.
- **Soglie del dialogo finale** (`GOOD_SUPPORT_AT` 0.6, `GOOD_CANNON_AT` 0.7) stanno in `level1_finale.ts` perché `data/` non può importare da `game/`.
  Le righe che cambiano sono due: «accettabile» / «presente» (supporto e cannone buoni) e la risposta di D sul cannone.
- **Curiosità**: Sfere raccolte singolarmente non contano (non hanno un id); contano i desideri esauditi, gli ospiti, il gatto e due bonus (freccia, fagiolo).

## Stato di esecuzione
Verificato con Playwright (`t21`, `t22`) e la regressione dell'arena/tunnel: da F2 si gioca l'apertura, il QTE di supporto (tutti riusciti: 10/10, tutti
mancati: 0/10 e lasciati scadere, metà: 5/10 → `supportScore` 1 / 0 / 0.5 coerente), il cannone (martellato: pieno; lasciato stare: scade a ~10 s e spara
a 0.7 con punteggio 0, nessun blocco), la distruzione e si arriva a `dialogo_finale`; il salto (Esc tenuto, poi Invio) dell'apertura a 0.2/7/19 s e della
distruzione a 0.3/6/11 s porta alla fase successiva una volta sola; dal tunnel (F7: corsa → raffica → fuga) si arriva allo spazio senza la pillola; il
finale (F3) si completa e la camminata è saltabile; il punteggio (F4) mostra le righe con conteggio animato e voto, un tasto porta ai titoli, il salto dei
titoli segna `oristano-ariston` completato e torna al menu; `resetProgress()` azzera fase, esiti e statistiche. Il conteggio dei colpi è provato
(colpo = +1, i-frame e parata = +0); le curiosità si deduplicano per id. 19 test (`npm test`) passano (`computeScore`: tutto 0, tutto al massimo, nessuna
attività, soglie, purezza; `chargeMeter`: ~7.6 s di pressione continua, alternanza, tempo scaduto, tregua, limiti 0-1). `tsc`, lint e build puliti;
la regressione (`D_good`/`D_bad`) passa con le fasi del finale invariate.

Non provato: il giro completo menu → … → titoli giocato di fila a mano (le tappe sono state provate a pezzi con le scorciatoie), la build di produzione
giocata con `npm run preview` (nessun nuovo asset statico: solo codice), il comportamento con un gamepad.

Da fare a mano: guardare le cutscene intere e tarare i tempi (decollo, QTE, cannone), scrivere la dedica dei titoli (`data/credits.ts`), rivedere le battute,
sfx e musica (spazio, finale, titoli: nella lista di `Info_storia_e_musica_ost.txt`), sprite veri di navicella e nave madre.
