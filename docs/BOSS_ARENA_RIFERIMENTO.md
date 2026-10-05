<!-- Riferimento di dettaglio spostato da CLAUDE.md (FASE 7): copia fedele della sezione. In fondo, la mappa del codice dopo il refactor. -->

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
(`SPECIAL_TRIGGER_HP_FRACTION`), non a un numero fisso. Passi 7-10 del piano (finale):
vedi "Finale del boss" più sotto.

Nuove minacce (`ArenaThreats.tsx`, pool di mesh aggiornate da `world.projectiles`/
`world.hazards`): proiettili parabili — la parata a timing li RIMANDA contro Checco
(`parryProjectile` in `combat.ts`, `PROJECTILE_REFLECT_*`) — e detriti dal soffitto con
marcatore rosso a terra prima della caduta (non parabili). Mosse (dati in
`checcoMoves.ts`): `lancio`/`crollo` dal round 1; `raffica` (3 lanci a quote diverse),
`crollo_esteso` e `comparsa` (teletrasporto dietro il giocatore con marcatore viola,
boss invisibile e non colpibile mentre è sparito: `boss.vanished`) dal round 2. Avviso
alla Sekiro per i colpi NON parabili: triangolo giallo con "!" e la parola `SALTA`
sopra il boss (`CheccoMove.warning`, texture via canvas in `BossChecco.tsx`, mai oltre
`WARNING_MAX_Y` per non uscire dallo schermo). Le mosse a distanza (`lancio`, `raffica`)
hanno `minRange: RANGED_MIN_RANGE` (3): da più vicino Checco usa la mischia. Evento
"oggetti del Buen Camino" (`TOTEM_*` in `arenaConfig.ts`): a 45% e 20% di vita Checco
evoca 3 poi 4 oggetti lontani da lui; finché ne esiste uno è INVULNERABILE (scudo
azzurro, `hitBoss`/`addPosture` bloccano tutto) e il giocatore deve staccarsi per
distruggerli (colpendoli, o rimandando un proiettile parato: `damageTotem` in
`combat.ts`; anche Eve li colpisce). Fili dorati li legano a Checco, la HUD mostra il
conteggio. Questo è ciò che rende utile il range minimo dei proiettili: il giocatore
lontano da Checco è proprio quando lui tira.

Contrattacchi e tempesta: le cariche di Checco (`charge: true` in `checcoMoves.ts`:
`passo_falso`, `balzo`, `carica`) hanno un avviso ROSSO "PARA O CONTRASTA" e si fermano
o parando o con un CONTRASTO (alla mikiri di Sekiro): un dash VERSO di lui mentre
carica (`player.dashDir`, `counterCharge` in `combat.ts`) lo stordisce per
`COUNTER_STUN_DURATION` e carica la barra abilità. Mossa `tempesta` (solo round 2, campo
`storm`): Checco salta e resta in aria a caricare con una zona elettrica che ferisce
(`boss.zoneRadius`), poi scaglia 1-3 fulmini a ricerca (`kind: 'bolt'`, `homing` in
`ArenaThreats.tsx`, avviso azzurro "SCHIVA O PARA IN ARIA"): dash = schivata; parata a
TERRA = poco danno e giocatore fermo (`BOLT_PARRY_GROUND_*`); parata IN ARIA
(`player.y >= BOLT_AIR_MIN_Y`) = il fulmine torna a Checco e lo stordisce
(`BOLT_REFLECT_*`). Solo in sviluppo: `__arenaWorld.forceMove = 'id'` (es. `'tempesta'`,
`'carica'`) fa usare a Checco quella mossa alla prossima scelta, per provarla.

Rifiniture alle cariche/tempesta: le cariche (`lunge`/`balzo`) arrivano SEMPRE nel punto
in cui era il bersaglio al momento della scelta (`MoveRuntime.targetX`), con velocità
adattata alla distanza fra `LUNGE_MIN_SPEED`/`LUNGE_MAX_SPEED` — per questo le
`maxRange` di `passo_falso`/`carica` sono quelle raggiungibili a velocità massima; la
hitbox del `balzo` è attiva per tutto il volo e segue il corpo in quota (`offsetY` delle
hit è relativo a `boss.y`); dopo un contrasto Checco fa un mini balzo all'indietro
(`COUNTER_HOP_*`, `boss.hopTime`). In `tempesta` Checco resta in aria per tutta la mossa
(`storm.chargeTime` per la zona elettrica, poi i fulmini partono ancora in quota) e ogni
parata in aria di un fulmine spinge il giocatore verso l'alto (`BOLT_AIR_PARRY_BOOST`,
`player.airBoost`) per poter parare anche i successivi.

Il contrasto è un braccio di ferro (`CLASH_*` in `arenaConfig.ts`, `world.clash`):
giocatore e Checco si bloccano e bisogna premere `J`/click a ripetizione (~6 al
secondo). La barra parte da 30%, ogni pressione la alza, la spinta di Checco la
abbassa. Piena = vinci (Checco stordito + mini balzo, come prima); a 0 o a tempo
scaduto = perdi (sbalzato via con danno e stordimento). La logica sta in `BossChecco`
(la vittoria va controllata PRIMA del decadimento dello stesso frame), il lato
giocatore in `PlayerArena`, la barra in `ArenaHud`.

Percorrenza minima delle cariche a terra (`LUNGE_MIN_TRAVEL`, non per il balzo): se il
bersaglio è più vicino Checco prosegue oltre di lui nella stessa direzione.

Frequenza delle cariche: Checco sceglie a ogni ciclo una distanza di ingaggio
(`pickEngageDistance` in `BossChecco.tsx`: 45% vicino, altrimenti 3.8-8) e la raggiunge
(avvicinandosi, o arretrando piano se il giocatore è troppo vicino) PRIMA di scegliere
la mossa; senza questo si avvicinava sempre a ~1.6 e `passo_falso`/`carica`/`balzo`/
lanci non uscivano mai. Le mosse hanno un `weight` (cariche 2-3) per la scelta casuale
pesata. In sviluppo `__arenaWorld.moveLog` registra le mosse scelte.

Torrette (attacco asincrono, `TURRET_*` in `arenaConfig.ts`, `world.turrets`): un timer
proprio in `BossChecco` (`turretTimer`, indipendente da mosse/stordimento) ne lancia una
ogni 10-15s (round 1, max 2) o 6-10s (round 2, max 4), a terra o su uno dei due muri a
`TURRET_WALL_Y` (raggiungibile col doppio salto). Sparano da sole al giocatore
(`ArenaThreats.tsx`); un proiettile parato viene rimandato VERSO IL BOSS; si distruggono solo
attaccandole (`damageTurret` in `combat.ts`, un colpo per swing). Il giocatore ha il doppio
salto (`ARENA_MAX_JUMPS`, `ARENA_DOUBLE_JUMP_SPEED`; il contatore si azzera all'atterraggio).

Numeri di danno e valori sulle barre: ogni danno passa da `hitBoss`/`hitPlayer`/
`damageTotem`/`damageTurret` in `combat.ts`, che mettono un `DamagePopup` in
`world.popups`; `DamageNumbers.tsx` (drei `<Html>`, animazione CSS) la svuota ogni frame e
mostra il numero sopra chi ha subito il colpo (oro e più grande se il colpo è potenziato:
`boost` > 1, cioè barcollante / finestra post-parata / buff; "BLOCCATO" contro lo scudo del
Buen Camino). La HUD mostra "vita / max" sulle barre e "Postura x / max": il massimo
(`bossPostureMax`) arriva dallo store perché `POSTURE_MAX` non è più 100 — la barra
postura prima si riempiva in percentuale diretta e risultava "piena" a un terzo.
In sviluppo ogni colpo sul boss stampa in console `[danno boss] …` con i moltiplicatori.

Potenziamenti (`powerUps.ts`, `PowerUpId`/`POWER_UPS`, oggi solo `bloodborne`): quando si
INTERROMPE "Avvia il film" (`resolveSpecial('interrupted')`), oltre agli effetti già decisi
(cura, ×1.25, postura al massimo) il gioco si ferma e compare `components/PowerUpChoice`.
Il blocco è un hit-stop INFINITO (`world.hitStop = Infinity`: tutti i sistemi già lo
controllano), gestito da `world.choice` in cima al frame di `BossChecco`: attesa della carta
(`store.powerUpPicked`) → scritta di introduzione (`PowerUpIntro`, `powerUps[].intro`, il
campo `videoSrc` la sostituirà col video, tollerante se manca) per `POWER_UP_INTRO_SECONDS`
→ ripartenza con "Round 2". Lo sfondo cambia (`backdrop` in `ArenaBackdrop`, texture
segnaposto via canvas). Per aggiungere un potenziamento: voce nel `Record` + la sua logica
leggendo `world.powerUp` (i loadout non sono ancora un'astrazione a parte: in `PlayerArena`
c'è `const bloodborne = world.powerUp === 'bloodborne'`). In sviluppo `window.__arenaStore`
espone lo store per i test.
Loadout Bloodborne (tutto in `arenaConfig.ts`, da tarare): `K`/click destro SPARA invece di
parare (`fireGun` in `playerShots.ts`, hitscan: il primo bersaglio lungo la X fra
proiettili nemici, torrette, oggetti del Buen Camino, boss). Proiettile nemico → rimandato
contro Checco; torretta/oggetto → danno; Checco in attacco PARABILE (`boss.parryable`,
calcolato da `BossChecco`: finestre non `unparryable` ancora da fare) → PARATA
(`gunParryBoss`: interrompe la mossa via `boss.interrupted`, postura, contraccolpo, nessun
danno), altrimenti danno minimo. Abilità a mezza barra = "fendente celeste": onda
(`launchWave`, `world.shots`) che si ferma al primo ostacolo con la stessa regola. A barra
piena = "carica con falce" (`finisher.ts`, `world.finisher`): sequenza guidata scatto →
colpo che lo lancia in aria → falce che si schianta con danno ad area; la fa avanzare
`BossChecco` (comanda `boss.y`) e `PlayerArena` legge `playerX/playerY`, giocatore
invulnerabile. Asset segnaposto: pistola, asta e lama in `PlayerShotsLayer.tsx`.
Berserk: l'eccesso della barra abilità già piena carica la FURIA (`player.rage`, in
`gainSkill`); a furia piena `Q` attiva `player.berserk`, che si svuota di
`BERSERK_DRAIN_PER_SECOND`. In berserk: più veloce/salti più alti/attacchi più ampi e rapidi,
l'attacco conta anche come parata, danni subiti ×0.5, ogni colpo a segno alza il
moltiplicatore a catena (`player.combo`, tetto `BERSERK_COMBO_MAX`, torna a 1 al primo colpo
preso), colpi in salto fanno un'area (`onPlayerMeleeHit`/`areaBlast` in `combat.ts`) e `E`
costa furia e lancia ruggito + onda d'urto fino al bordo dell'arena (`launchShock`).

Finale del boss (passi 7-10 del piano; `finale.ts`, `qte.ts`, `world.finale`): Checco non
muore più per danno (`hitBoss` lascia vita minima 1) — sotto `FINALE_HP_FRACTION` (10%) il
combattimento si ferma (pulizia di proiettili/torrette/oggetti, mosse e carica annullate) e
`BossChecco` fa avanzare la sequenza fase per fase: `gather` (Checco al centro, D ed Eve ai
lati; Eve si rialza SEMPRE da sola) → `qte` (5 prompt a tempo, tasti a caso da `QTE_KEYS`,
`QTE_WINDOWS`; i colpi durante il finale sono ignorati) → `land` (atterra) → `transform`
(marionetta: snodi e fili, segnaposto a linee) → `fling` (D ed Eve scaraventati ai due
lati) → `fade` (`onVictory`, whiteout, fase `transizione_seconda_spada`). Come per
`finisher.ts`, la sequenza scrive le posizioni (`playerX/Y`, `eveX/Y`) e `PlayerArena`/
`EveArena` le applicano. L'esito del QTE (≤ `QTE_MAX_MISSES` mancati = riuscito) NON cambia la
storia: finisce in `levelStore.finalQteSuccess` e sceglie una riga di dialogo
(`data/dialogues/level1_sotterraneo.ts`); il bonus/malus di vita per `boss_fase2_tunnel` è
ancora da collegare quando quella fase esisterà. La logica del QTE (`qte.ts`) è pura e
riusabile; `components/QteChallenge.tsx` la disegna da `store.qte`. Il Sotterraneo
(`game/levels/Sotterraneo/SceneManagerSotterraneo.tsx`, montato da `App.tsx` per
`transizione_seconda_spada`) è una scena SCRIPTATA 2D senza LDtk (D caduto sotto, Eve dal
varco, dialogo; a fine dialogo `setPhase('boss_fase2_tunnel')`): se serve un livello LDtk vero
si sostituisce il componente. Il dialogo `getSecondSwordDialogue` è stato scritto di nuovo
(il testo del piano madre `LEVEL1_SECOND_SWORD_DIALOGUE` non era nel repo). L'arena usa D1
fin dall'inizio, quindi `transformToD1` al Sotterraneo non è stato fatto (servirebbe una
posa d'attacco per D0).

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

---

## Mappa del codice dopo il refactor FASE 7 (aggiunta, non fa parte della copia fedele sopra)

Il testo sopra, scritto prima della FASE 7, cita spesso `BossChecco.tsx` per la logica del boss:
oggi quel file è solo l'orchestratore e la logica è nei moduli qui sotto (stessi nomi di funzione
dove possibile, comportamento invariato). Tutti i moduli `boss*.ts` sono senza React e ricevono un
`BossContext` (`{ world, rt, messenger }`, vedi `bossRuntime.ts`).

| Modulo | Cosa contiene |
|---|---|
| `BossChecco.tsx` | solo l'ORDINE delle sezioni del frame: potenziamento → hit-stop → fine → contrasto → finale → carica con falce → interruzioni/postura/colpi ricevuti → (barcolla / evento / evocazione / mossa / libero) → clamp → `parryable` → resa |
| `bossRuntime.ts` | tipi `BossRuntime`/`MoveRuntime`/`BossContext`, `createBossRuntime`, `pickEngageDistance`, `totalDuration` |
| `bossSpecial.ts` | evento "Avvia il film" (`resolveSpecial`, `tickSpecial`), scelta del potenziamento (`updatePowerUpChoice`), evocazione dei totem a 45%/20% |
| `bossClash.ts` | contrasto: `startClash`, `updateClash` |
| `bossSequences.ts` | passaggio di consegne alle sequenze scriptate: `startFinaleIfDue`, `beginFinisherIfNew`, `endFinisher` |
| `bossStatus.ts` | stato passivo: `handleInterrupted`, `updatePosture`, `applyHitsOnBoss`, `updateStaggered` |
| `bossMoveRunner.ts` | `updateBossMove` (telegrafo → colpi → recupero: salti, tempesta, teletrasporto, cariche), `updateBossFree` (avvicinamento e scelta pesata) |
| `bossSpawns.ts` | cosa Checco crea: `spawnTotems`, `spawnTurret`, `tickTurretTimer`, `spawnBossProjectile`, `spawnDebris`, `spawnBolt` |
| `bossRender.ts`, `BossVisuals.tsx`, `useBossVisualRefs.ts` | resa a tinte unite: aggiornamento per frame, JSX, ref delle mesh |
| `bossWarnings.ts`, `bossMessages.ts` | texture degli avvisi "SALTA/PARA O CONTRASTA", messaggio al centro con timer |

Altri file: `combat.ts` (regole di danno), `finale.ts` + `qte.ts` (finale e QTE), `finisher.ts`
(carica con falce), `playerShots.ts` + `PlayerShotsLayer.tsx` (pistola/onde), `PlayerArena.tsx`
(giocatore, usa `game/shared/usePlayerActions.ts` e `game/shared/jump.ts`), `arenaConfig.ts`
(TUTTI i numeri di bilanciamento — anche quelli dell'IA di Checco, spostati lì nella FASE 7).

Nota sui nomi: su Windows i file `bossRender.ts` e `BossVisuals.tsx` non possono chiamarsi entrambi
`bossVisuals` (i nomi differiscono solo per le maiuscole e il compilatore li considera lo stesso
file): è già successo anche con `playerShots.ts` / `PlayerShotsLayer.tsx`.
