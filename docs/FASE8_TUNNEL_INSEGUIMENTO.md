# FASE 8 — Tunnel: l'inseguimento di Checco-marionetta

> Documento di handoff per Claude Code in VS Code. Da eseguire **dopo** FASE 7 (pulizia).
> Copre le fasi di livello `boss_fase2_tunnel` → `combo_doppia_spada_qte` → `fuga_checco`.
> Fa parte del piano generale in `FASE_BOSS_CHECCO_ZALONE.md` (contesto "SceneManagerTunnel").

## 1. Cosa vogliamo

Dopo la caduta (Sotterraneo) e la seconda spada, D insegue la marionetta di Checco in un tunnel di servizio sotto il Cinema Ariston. È una **corsa laterale semi-automatica**: D corre verso destra, il tunnel scorre all'infinito in parallasse, e il giocatore deve schivare, parare e distruggere ciò che Checco gli lascia dietro. In fondo, un ultimo scontro breve: una **raffica con la doppia spada** (QTE) contro una nuova minaccia, poi Checco scappa su un razzo **comunque** (la storia non cambia, cambia solo il "come").

Durata target: **90–120 secondi** di corsa + 20–30 s di raffica + cutscene di fuga. Deve sentirsi come un cambio di ritmo rispetto all'arena: stessa leggibilità (telegrafo → colpo), niente più duello, tutto velocità.

## 2. Fatti tecnici da cui si parte

- `App.tsx` monta una scena per `levelPhase`. `boss_fase2_tunnel` oggi **non ha scena**: cade nel catch-all `SceneManager2D` (pillola "Fase … non ancora implementata"). Il Sotterraneo termina già con `setPhase('boss_fase2_tunnel')`.
- Pattern dello stato per frame: oggetto mondo in un ref (come `ArenaWorld` in `arenaState.ts`), regole in file puri (come `combat.ts`), Zustand solo per dati a livello di evento (HUD).
- Riutilizzabile senza modifiche: `qte.ts` + `components/QteChallenge.tsx`, `DamageNumbers`, parata/rimbalzo proiettili in `combat.ts`, `ArenaHud`/`arenaStore` (HP, cure, abilità, messaggio), pericoli dal soffitto di `ArenaThreats`, `ParallaxLayer`, pattern cutscene GSAP (`CapsuleSequence`), `CharacterAnimator2D`, whiteout via `onWhiteout`.
- `levelStore` ha già `finalQteSuccess: boolean | null` (esito del QTE finale in arena): oggi lo usa solo il dialogo del Sotterraneo. Qui diventa bonus/malus.

## 3. Aspetto di D — correzione importante

Rileggendo intro e FASE3: nell'intro **Eve consegna a D la prima spada** e il passaggio D0 → D1 è legato a quel momento. Quindi **D1 in arena è corretto** (non era "prematuro" come avevo scritto in un commento precedente). I veri buchi sono altri:

- `transformToD1` esiste in `CharacterAnimator2D` ma **non è chiamato da nessuna parte**: la trasformazione D0→D1 non è mai mostrata.
- **Non esiste uno sprite con la doppia spada**: la seconda spada ricevuta nel Sotterraneo oggi non ha alcun riscontro visivo.

Decisione proposta (da confermare dall'utente): per la **v1 del tunnel si usa D1** (nessun nuovo asset, si può giocare subito). Parallelamente si genera un set **D2** (doppia spada) con prompt Gemini/immagini — lo preparo io quando l'utente dice "vai" — e `CharacterVariant` si estende a `'D0'|'D1'|'D2'|'Eve'` in un passo successivo, senza toccare la logica.

- [ ] Decisione D2: (a) solo D1 in v1, D2 poi · (b) aspettare D2 prima di chiudere il tunnel.

## 4. Architettura

Cartella `src/game/levels/Tunnel/`:

| File | Ruolo |
|---|---|
| `SceneManagerTunnel.tsx` | Scena unica per **tutte e tre** le fasi (`boss_fase2_tunnel`, `combo_doppia_spada_qte`, `fuga_checco`): al suo interno una piccola macchina a stati (`run` → `barrage` → `escape`). Così il passaggio fra fasi non rimonta la scena. |
| `tunnelConfig.ts` | Tutte le costanti (vedi 6). Nessun numero magico altrove. |
| `tunnelState.ts` | `TunnelWorld` in un ref: posizione/velocità, `gap`, ostacoli attivi, proiettili, timer, fase interna. |
| `tunnelDirector.ts` | Il "copione": elenco ordinato di eventi (`{ at: secondi|distanza, spawn: ... }`) per le 4 sezioni (5). Puro e testabile. |
| `tunnelCombat.ts` | Regole: collisioni, danno, parata, rimbalzo, rottura detriti, effetto sul `gap`. Puro. |
| `PlayerRunner.tsx` | D in corsa: usa `usePlayerActions` e `stepJump` estratti in FASE 7 (non `PlayerArena`). |
| `TunnelBackdrop.tsx` | Tunnel infinito in parallasse (3–4 strati che scorrono a velocità diverse, luci a intervalli). |
| `TunnelHazards.tsx` | Rendering ostacoli, raggi, detriti, proiettili. |
| `CheccoPuppetRunner.tsx` | La marionetta davanti a D (sprite del boss in posa "marionetta", corsa a scatti), con i suoi gesti di lancio. |
| `BarrageScene.tsx` | Fase 2: la raffica doppia spada (QTE). |
| `EscapeCutscene.tsx` | Fase 3: la fuga col razzo. Cutscene **skippabile** (vedi 9). |

Cambi fuori dalla cartella:

- [ ] `App.tsx`: lazy import di `SceneManagerTunnel`; montarlo per le tre fasi (`levelPhase === 'boss_fase2_tunnel' || 'combo_doppia_spada_qte' || 'fuga_checco'`) **e** escluderle dal catch-all `SceneManager2D` (la condizione `!==` va estesa, come fatto per Sotterraneo).
- [ ] `levelStore.ts`: aggiungere `tunnelResult: { gapEnd: number; barrageScore: number } | null` e il setter; reset in `resetLevel()`.
- [ ] `useDevBossShortcut.ts`: scorciatoia dev (es. F7) per saltare al tunnel, e `window.__tunnelWorld` solo in `DEV`.
- [ ] HP/cure/abilità: **riusare `arenaStore`** per HP, cure (`healsLeft`) e messaggi, azzerandolo all'ingresso del tunnel (vedi 6 per i valori). Nessuno store nuovo per l'HUD; solo uno slice minimo per il `gap` se `ArenaHud` non può leggerlo da una prop.

## 5. Fase 1 — La corsa (`boss_fase2_tunnel`)

### Controlli
D **corre da solo** verso destra a velocità costante. Il giocatore:

- **Salto / doppio salto** (Space/W) — ostacoli bassi e voragini
- **Dash/scivolata** (Shift) — ostacoli alti, raggi; i-frames brevi come in arena
- **Parata** (K) — i proiettili di Checco rimbalzano **verso di lui**
- **Attacco** (J) — rompe i detriti distruttibili
- **Cura** (R) — come in arena, canale interrompibile
- **Sinistra/destra** — leggero aggiustamento lungo il corridoio (±1.5 unità), non una vera libertà di movimento

Niente pad analogici nuovi: stessi binding di `usePlayerActions`.

### La barra "distanza" (`gap`)
Valore 0–100 (0 = D raggiunge Checco, 100 = Checco è sparito).

- Parte da 55 (malus) o 35 (bonus) in base a `finalQteSuccess` (vedi 6).
- Cala lentamente da sola mentre D corre bene.
- **Parare un proiettile di Checco lo rimbalza**: colpisce la marionetta → `gap` −8, piccolo stagger visivo. È il modo di "recuperare terreno".
- **Essere colpiti** o sbattere su un ostacolo: HP giù e `gap` +10 (D inciampa).
- `gap` ≥ 100 → Checco è fuggito: **sconfitta**, ripartenza dal checkpoint (vedi sotto). `gap` ≤ 0 → fine corsa, si passa alla raffica.
- Obbligo di leggibilità: la barra è sempre visibile (stessa fila dell'HUD), con un'icona della marionetta.

### Le 4 sezioni (copione in `tunnelDirector.ts`)
1. **Imbocco (~20 s)** — tutorial muto: ostacoli bassi ed alti isolati, ben spaziati. Un detrito distruttibile. Nessun proiettile.
2. **Il lanciatore (~30 s)** — Checco si gira e lancia oggetti telegrafati (avviso lampeggiante prima del tiro, stesso linguaggio visivo dell'arena: giallo = parabile, rosso = da schivare/saltare). Qui si impara a rimbalzare.
3. **Il crollo (~30 s)** — detriti dal soffitto con segnale al suolo (riuso hazard di arena), voragini, un tratto in cui i raggi (due altezze) ciclano; combinazioni salto+scivolata.
4. **Rettilineo finale (~20 s)** — densità massima, proiettili e ostacoli intrecciati, sempre con ≥ 1 s di leggibilità. Il `gap` vicino a 0 fa **rallentare** Checco davanti: la tensione sale.

Regola di design: **mai due minacce non telegrafate nello stesso istante**; ogni pattern deve essere risolvibile con un'unica sequenza di azioni. Tutte le sezioni leggono i tempi da `tunnelConfig.ts` così il bilanciamento è una modifica di numeri.

### Checkpoint
Sconfitta (HP 0 o `gap` 100) → ricomincia dall'**inizio della sezione corrente**, non del tunnel; cure ripristinate a 1. Niente schermata di game over lunga: fade breve + riavvio (come `runId` remount in `SceneManagerBossArena`).

### Barks
Poche battute di Checco-marionetta durante la corsa (via `arenaStore.message`, niente DialogueBox che blocca): una per sezione, tono sbruffone/teatrale. Testi proposti, da rivedere:
- 1: "Corri, corri, piccolo burattino senza fili!"
- 2: "Prendi, prendi! Il pubblico adora i bis!"
- 3: "Il teatro cade a pezzi, ma lo spettacolo continua!"
- 4: "Ancora un po'… sipario!"

## 6. Valori iniziali di `tunnelConfig.ts` (da tarare in playtest)

```
TUNNEL_RUN_SPEED            = 9      // unità/s di scorrimento
TUNNEL_STRAFE_RANGE         = 1.5
TUNNEL_GAP_START_BONUS      = 35     // finalQteSuccess === true
TUNNEL_GAP_START_NEUTRAL    = 45     // null
TUNNEL_GAP_START_MALUS      = 55     // finalQteSuccess === false
TUNNEL_GAP_DRIFT_PER_SEC    = -0.6   // cala da solo
TUNNEL_GAP_REFLECT_BONUS    = -8
TUNNEL_GAP_HIT_PENALTY      = +10
TUNNEL_PLAYER_HP            = pieno  // reset all'ingresso
TUNNEL_HEALS                = 2
TUNNEL_TELEGRAPH_MIN        = 0.7    // s di leggibilità minima
```

Bonus/malus di `finalQteSuccess`: **solo sul `gap` iniziale** (35/45/55). È già una differenza percepibile senza cambiare la difficoltà in modo punitivo. Il power-up scelto in arena (pistola Bloodborne, falce finisher, berserk) **non** viene portato nel tunnel in v1; eventuale hook in v2.

## 7. Fase 2 — La raffica (`combo_doppia_spada_qte`)

In fondo al tunnel Checco si ferma davanti a un portello/montacarichi e una **nuova minaccia** lo copre: proposta, uno sciame di **burattini-guardia** (sagome di legno) che sbarrano la strada. D estrae la seconda spada e parte la **Double Sword Skill**: una raffica di colpi in sequenza.

- Riutilizzare `qte.ts` + `QteChallenge`, con parametri propri (`BARRAGE_*` in `tunnelConfig.ts`): sequenza più lunga (8–10 tasti), finestre più strette (da ~1.0 s a ~0.6 s), `QTE_MAX_MISSES` più alto (es. 2) perché è uno spettacolo, non una punizione.
- Ogni tasto riuscito = un fendente a schermo (animazione d'attacco alternata fra le due lame, flash, `DamageNumbers`).
- Esito → `barrageScore` (0–1) in `levelStore.tunnelResult`. **Checco scappa comunque**: lo score cambia solo (a) quanti burattini cadono, (b) una riga di dialogo/eco nella cutscene successiva, (c) un eventuale bonus in `inseguimento_spaziale_cutscene` (da decidere quando arriveremo lì).
- Non c'è game over qui: una raffica fallita cambia solo lo score.

## 8. Fase 3 — La fuga (`fuga_checco`)

Cutscene breve (10–15 s), skippabile, `EscapeCutscene.tsx`:

1. Checco-marionetta salta nel portello, il razzo si accende sotto il Cinema.
2. Inquadratura su D che arriva troppo tardi / sfiora la fiamma.
3. Il razzo sfonda il soffitto: whiteout (`onWhiteout`).
4. `setPhase('inseguimento_spaziale_cutscene')` (non ancora implementata: per ora il catch-all la mostra come "non implementata", va bene).

## 9. Meccanismo cutscene skippabile (condiviso)

Servirà a questa fase, al Sotterraneo e alle due cutscene che l'utente sta storyboardando (ingresso sala boss, intermezzo). Va costruito **una volta**, qui:

- [ ] `src/components/SkipCutscene.tsx` + `src/hooks/useCutsceneSkip.ts`: tenere premuto Esc/Invio (o un bottone a schermo) per ~0.6 s mostra una barra di riempimento "Salta"; al completamento chiama `onSkip`.
- [ ] Regola per chi scrive una cutscene: ha una **funzione `applyFinalState()` idempotente** (posizioni finali, flag nello store, fase successiva) e una timeline GSAP; "salta" = `timeline.progress(1)` + `applyFinalState()`. Così saltare non lascia mai la scena a metà.
- [ ] Applicarlo al Sotterraneo (oggi non skippabile) come primo cliente. Con `DIALOGUE_START_DELAY_MS` invariato.
- [ ] Prima visione non skippabile? Decisione dell'utente: oggi è "anche skippabili"; la skippabilità la lascio sempre attiva ma con tenuta (non un tap) per evitare salti accidentali.

## 10. Raccordo con il Sotterraneo

- [ ] **Continuità "crollo"**: il dialogo del Sotterraneo parla di "crollo" e "pezzi di sala", ma il finale in arena non mostra nulla di tutto ciò. Due opzioni: (a) aggiungere un po' di camera shake e detriti durante `fling`/`fade` in `finale.ts` e `ArenaThreats`, (b) ammorbidire il dialogo. Consigliata (a), costa poco.
- [ ] `getSecondSwordDialogue` resta com'è; aggiungere in coda (facoltativo) una riga di D che entra nel tunnel.
- [ ] Il commento "segnaposto a tinte unite" in `SceneManagerSotterraneo.tsx` resta vero finché non c'è arte vera.

## 11. Checklist di implementazione (in ordine)

1. [ ] **Scaffold + wiring**: cartella `Tunnel/`, `SceneManagerTunnel.tsx` con un cubo e un "fase run" a schermo, `App.tsx` aggiornato, shortcut dev. Dal Sotterraneo si arriva alla scena senza passare per la pillola "non implementata".
2. [ ] `tunnelConfig.ts` + `tunnelState.ts` + `levelStore.tunnelResult`.
3. [ ] `TunnelBackdrop` (parallasse infinita) + `PlayerRunner` (corre, salta, doppio salto, scivola, parata, attacco, cura) con `usePlayerActions`/`stepJump`.
4. [ ] `tunnelCombat.ts` + `TunnelHazards`: ostacoli bassi/alti/distruttibili/voragini; HP, i-frames, hit-stop, `DamageNumbers`.
5. [ ] `CheccoPuppetRunner` + `gap` + lancio proiettili con telegrafo + rimbalzo con la parata.
6. [ ] `tunnelDirector.ts` con le 4 sezioni; checkpoint per sezione; barks.
7. [ ] HUD: `ArenaHud` mostra HP/cure; barra `gap`. Verificare leggibilità a risoluzione piccola.
8. [ ] `BarrageScene` con `qte.ts` (parametri `BARRAGE_*`), `barrageScore`.
9. [ ] `SkipCutscene` + `EscapeCutscene` + transizione a `inseguimento_spaziale_cutscene`.
10. [ ] Continuità "crollo" (sezione 10) e collegamento di `finalQteSuccess` al `gap` iniziale.
11. [ ] Tarare in playtest: una run completa deve durare 90–120 s; la sconfitta deve ricominciare dalla sezione corrente; nessuna minaccia non telegrafata.
12. [ ] Verifica finale: `tsc`, lint, build, peso del chunk del tunnel (lazy); aggiornare CLAUDE.md "Stato del progetto" e (se esiste) il doc di riferimento del tunnel.

## 12. Playtest di accettazione

- [ ] Dall'arena (F9) si arriva al tunnel dopo il Sotterraneo; con F7 ci si salta direttamente.
- [ ] Ogni minaccia è leggibile ≥ 0.7 s prima del contatto.
- [ ] Parare un proiettile ne riduce il `gap` (verificabile dal valore).
- [ ] `finalQteSuccess` true/false/null produce rispettivamente `gap` iniziale 35/55/45.
- [ ] Morire riparte dalla sezione corrente; non si può restare incastrati.
- [ ] Raffica completata e fallita portano **entrambe** alla fuga.
- [ ] La cutscene di fuga è skippabile senza lasciare stati a metà (rifare con skip a 0 s, 5 s, a fine).
- [ ] Nessun memory leak: uscire e rientrare nel tunnel dieci volte non aumenta timeline/listener attivi.

## 13. Scene ancora da fare (non in questo documento)

- **Ingresso nella sala del boss** e **intermezzo fra fine boss fight e tunnel**: l'utente ha già appunti di storyboard. Una volta condivisi li si commenta e si pianificano come cutscene skippabili con il meccanismo della sezione 9.
- `dialogo_pre_boss` (testo già in FASE4b) prima dell'ingresso in arena, oggi saltato.
- Fasi successive: `inseguimento_spaziale_cutscene`, `qte_supporto_eve`, `carica_cannone_qte`, `dialogo_finale`, `schermata_punteggio` (contesto SceneManagerSpace in `FASE_BOSS_CHECCO_ZALONE.md`).

---

## Stato di esecuzione (aggiunto a fine FASE 8)

Eseguita (passi 1–12 della checklist, un commit per passo: `88b7d00` … ultimo). Verifica a ogni passo:
`tsc --noEmit`, lint, build + playtest in browser (Playwright). Il playtest completo dell'arena
(44 controlli) resta verde; il flusso reale arena → finale → Sotterraneo → tunnel funziona.

### Checklist di accettazione (sezione 12)
- [x] Dall'arena (F9) si arriva al tunnel dopo il Sotterraneo (provato con il finale vero); `F7` salta al tunnel.
- [x] Ogni minaccia leggibile ≥ 0.7 s: `validateScript()` (copione), nascita a 13 unità (≈1.4 s), avviso del lancio 0.8 s, detriti 0.9 s, raggi 0.8 s.
- [x] Parare un proiettile ne riduce il `gap` (−8 per rimbalzo a segno, verificato).
- [x] `finalQteSuccess` true/false/null → `gap` iniziale 35/55/45 (verificato).
- [x] Morire riparte dall'inizio della sezione; nessun incastro (bot con reazioni al 45%: 9 morti e riparte ogni volta).
- [x] Raffica completata e fallita portano entrambe alla fuga e a `inseguimento_spaziale_cutscene`.
- [x] Fuga skippabile senza stati a metà (skip a 0 s, a 5 s, nessuno skip).
- [x] Entrare e uscire dal tunnel 10 volte non accumula listener (nessuna crescita di `keydown`/`keyup`).

### Scostamenti dal documento
- **Colori degli avvisi**: il documento li scriveva come "giallo = parabile, rosso = da schivare", il contrario
  dell'arena. Ho seguito l'arena ("stesso linguaggio visivo"): ROSSO "PARA" = parabile (proiettile arancio),
  GIALLO "SALTA" = non parabile e basso.
- **Dash e parata più larghi** (`TUNNEL_DASH_DURATION` 0.4 s, `TUNNEL_PARRY` 0.28 s attiva e portata 1.6): a 9 u/s il contatto
  con un muro o un raggio dura ~0.14 s e il dash dell'arena (0.18 s) lasciava ±0.02 s di tolleranza, impossibile da premere.
- **Gap**: prima dell'ultima sezione non scende sotto `TUNNEL_GAP_FLOOR_BEFORE_FINALE` (20) — altrimenti una run
  perfetta finiva a ~90 s; ora ~99 s. La corsa finisce comunque a `TUNNEL_TOTAL_DURATION` (100 s). Dopo una sconfitta
  il gap riparte al massimo da `TUNNEL_GAP_RESPAWN_MAX` (60), per non morire in loop.
- Il sprite di D nel tunnel è **D1** (decisione "solo D1 in v1"); `transformToD1` e la variante D2 restano da fare.
- Le guardie non abbattute dalla raffica restano in piedi e frenano D nella fuga (lo score cambia quanto si avvicina al razzo).
- Il documento "FASE_BOSS_CHECCO_ZALONE.md" non è nel repo: non c'è un riferimento al piano madre oltre a questo.

### Da tarare giocando
Tutti i numeri sono in `tunnelConfig.ts` e il copione in `tunnelDirector.ts`. Un bot preciso non prende colpi: la
difficoltà reale dipende dai tempi di reazione umani — vedi `TUNNEL_THROW` (velocità e avviso), `TUNNEL_SPAWN_AHEAD`,
le distanze fra gli eventi del copione e `TUNNEL_GAP_*`.
