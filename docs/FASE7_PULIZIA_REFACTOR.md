# FASE 7 — Pulizia e refactor prima del tunnel

> Documento di handoff per Claude Code in VS Code. Da eseguire **prima** di FASE 8 (tunnel).
> Regola d'oro: **zero cambi di comportamento**. Ogni passo si chiude con tsc/lint/build puliti e un playtest rapido. Un commit per passo.

## 0. Perché adesso

- `BossChecco.tsx` è un unico componente da ~45 KB con un `useFrame` di ~550 righe (circa L435–985). Funziona, ma ogni ritocco di bilanciamento costa caro e il tunnel (FASE 8) deve riusare pezzi che oggi sono sepolti lì dentro.
- `CLAUDE.md` pesa ~71 KB: è il file che ogni sessione carica per intero. La sezione "Boss arena" (circa L365–548) e quella "Livello 1" (circa L240–364) sono riferimenti di dettaglio, non regole: devono stare in `docs/` con un riassunto breve in CLAUDE.md.
- Le righe indicate sono approssimative (fotografia di quando ho letto i file): **rigrepare prima di toccare**.

## 1. Prompt da incollare in VS Code

```
Leggi docs/FASE7_PULIZIA_REFACTOR.md ed esegui i passi in ordine. Non cambiare nessun comportamento
di gioco: stesse costanti, stesso ordine di esecuzione per frame, stessi side effect sugli store.
Dopo ogni passo: npx tsc --noEmit, lint, build; poi spunta la checklist del passo e fai un commit
separato. Se un passo ti sembra rischioso, fermati e dimmelo invece di improvvisare.
```

## 2. Rete di sicurezza (fare per primo)

- [ ] Annotare lo stato di partenza: `tsc`, lint e `vite build` puliti; peso del chunk `BossArena` (per confronto finale).
- [ ] Playtest di riferimento (5 minuti, F9 per saltare in arena). Spuntare cosa funziona **prima** di toccare nulla:
  - [ ] attacco J, parata K (anche su proiettile → rimbalza), dash con i-frames, doppio salto
  - [ ] cura R (3 cariche, interrompibile), abilità E a 50 e a 100, Q berserk, F evoca Eve
  - [ ] postura del boss → stagger → danno doppio
  - [ ] salti del boss (balzo, schianto non parabile), corpo solido (si salta sopra, non attraverso)
  - [ ] totem a 45% e 20% (invulnerabilità finché non caduti), torrette, saette che inseguono, soffitto
  - [ ] "Avvia il film": completato e interrotto, con scelta power-up
  - [ ] clash (tiro alla fune) e avvisi "PARA O CONTRASTA" / "SALTA"
  - [ ] finale a 10%: Eve si alza → QTE (successo e fallimento) → marionetta → Sotterraneo
- [ ] (Opzionale ma consigliato) se non c'è già un runner di test, aggiungere **vitest solo per i moduli puri**: `qte.ts` (createQte/updateQte/pickQteKeys), regole di `combat.ts`, avanzamento di `finale.ts`. Pochi test mirati, non una suite. Servono anche al tunnel, che riusa `qte.ts`.

## 3. Costanti e numeri magici

- [ ] Grep dei numeri letterali dentro `BossChecco.tsx` e `PlayerArena.tsx` (tempi, distanze, moltiplicatori).
- [ ] Spostare in `arenaConfig.ts` (o in un nuovo `bossTuning.ts` se il file di config supera ~20 KB) quelli che sono bilanciamento: nome in `SCREAMING_SNAKE`, un commento di una riga con l'unità.
- [ ] Lasciare inline solo ciò che è davvero locale (offset di un mesh, uno z-fighting fix).
- [ ] Nessun valore cambia: dopo lo spostamento il `git diff` deve mostrare solo righe "const → import".

## 4. Spezzare `BossChecco.tsx`

Obiettivo: `BossChecco.tsx` resta il **componente orchestratore** (ordine delle sezioni nel frame + render), sotto le ~400 righe. La logica va in moduli **senza React**, che ricevono `world`/`boss` e restituiscono eventi o mutano lo stato condiviso (stesso pattern di `combat.ts`).

Ordine consigliato, dal meno rischioso al più rischioso. Un commit per modulo.

- [ ] **4.1 `bossWarnings.ts`** — texture/stili degli avvisi (canvas texture, colori, testi "PARA O CONTRASTA", "SALTA"). Pura estrazione, nessuna dipendenza dal frame.
- [ ] **4.2 `bossSpawns.ts`** — helper che creano proiettili, saette inseguitrici, pericoli dal soffitto, torrette (`spawnProjectile`, `spawnCeilingHazard`, ecc.). Firma: `(world, params) => void`.
- [ ] **4.3 `bossClash.ts`** — logica del tiro alla fune (avvio, avanzamento, esito).
- [ ] **4.4 `bossSpecial.ts`** — "Avvia il film" (soglia HP, esiti completed/interrupted, scelta power-up), evocazione/KO di Eve, eventi totem a 45%/20%.
- [ ] **4.5 `bossMoveRunner.ts`** — il blocco più grosso: esecuzione della mossa corrente (circa L674–977: telegrafo → attivo → recupero, hitbox, salti, tempeste, avvisi). Una funzione `updateBossMove(world, boss, dt, ctx)` che ritorna eventuali eventi (`{ type: 'hitPlayer', ... }`). I side effect sugli store restano **identici** per ordine.
- [ ] **4.6 Render** — estrarre i sotto-componenti di rendering (sprite, barra/avvisi, debug box dietro `import.meta.env.DEV`) in `BossVisuals.tsx`. Il frame non deve cambiare.
- [ ] **4.7 Controllo finale** — `BossChecco.tsx` sotto ~400 righe; nessun modulo estratto importa da `BossChecco.tsx` (niente cicli); `window.__arenaWorld`, `forceMove` e `moveLog` funzionano ancora (sono usati per il debug).

Regole:

- Non cambiare l'**ordine** delle sezioni nel `useFrame` (hit-stop → input → movimento → mossa → eventi → finale…): l'hit-stop è decrementato solo nel frame di `BossChecco` e molte cose dipendono da questo.
- Niente nuovi store, niente nuove astrazioni "per il futuro": si sposta codice, non lo si riscrive.
- Se una funzione estratta ha più di ~6 parametri, passare un oggetto `ctx` tipizzato.

## 5. Primitive condivise per il tunnel (estrarre solo ciò che serve)

FASE 8 avrà un `PlayerRunner` leggero, non il pesante `PlayerArena`. Per non copiare codice, estrarre **solo** queste tre cose:

- [ ] **Input a azioni** — `src/game/shared/usePlayerActions.ts`: una sola mappa tastiera/mouse/gamepad → azioni (`attack`, `parry`, `dash`, `jump`, `heal`, `skill`, `berserk`, `summon`) con stato "premuto adesso" e "premuto in questo frame", in un ref (niente re-render). `PlayerArena` passa a usarlo; nessun cambio di binding.
- [ ] **Fisica di salto** — gravità, salto singolo/doppio, coyote time se c'è: funzione pura `stepJump(state, input, dt)` in `src/game/shared/jump.ts`.
- [ ] **Flusso "colpito"** — applicazione del danno al giocatore con i-frames e hit-stop: è già in `combat.ts` (`hitPlayer`); verificare che non dipenda da campi esclusivi dell'arena e, se serve, renderlo accessibile da un secondo contesto.
- [ ] Non estrarre altro. Se `PlayerArena` ha altro (loadout, skill, finisher), resta lì.

## 6. Snellire `CLAUDE.md`

- [ ] Spostare "Boss arena" (circa L365–548) in `docs/BOSS_ARENA_RIFERIMENTO.md` **così com'è** (copia fedele, nessuna riscrittura).
- [ ] Spostare "Livello 1" (circa L240–364) in `docs/LIVELLO1_RIFERIMENTO.md`.
- [ ] In `CLAUDE.md` lasciare per ciascuna: 5–10 righe di riassunto (cosa c'è, file chiave, regole che non vanno violate) + il puntatore al doc.
- [ ] Aggiungere in testa un mini-indice "Quando leggere cosa" (es. *tocchi l'arena → leggi docs/BOSS_ARENA_RIFERIMENTO.md*).
- [ ] Obiettivo: `CLAUDE.md` sotto ~30 KB. Le **Regole architetturali** (circa L138) e le istruzioni operative restano intere.
- [ ] Copiare in `docs/` i documenti di design prodotti in chat: `FASE6_ARENA_BOSS_COMBATTIMENTO.md`, `FASE6b_ARENA_DIFFICOLTA_ABILITA_FINALE.md`, `FASE_BOSS_CHECCO_ZALONE.md` (oggi in `docs/` non c'è nessun FASE6) e `FASE8_TUNNEL_INSEGUIMENTO.md`. Aggiungerli all'indice dei doc in CLAUDE.md.
- [ ] Aggiornare la sezione "Stato del progetto" con: FASE6/6b completate, FASE7 (questa) in corso, FASE8 prossima.

## 7. Piccole pulizie

- [ ] `src/audio/theme.mp3` duplicato ("Piccola cosa da pulire" in CLAUDE.md): **prima grep** per verificare che nulla lo importi, poi rimuovere il duplicato non usato.
- [ ] `.gitignore`: la riga su `public/maps/bkp_satellite` è incoerente con i 3 PNG che **devono restare tracciati**. Sistemare la regola (es. eccezione `!`) senza far sparire quei file dal repo. Verificare con `git ls-files public/maps/bkp_satellite`.
- [ ] Commenti obsoleti: `SceneManagerSotterraneo` si definisce "segnaposto a tinte unite" — va bene finché lo è, ma aggiornare il commento quando FASE 8 lo tocca.
- [ ] `transformToD1` in `CharacterAnimator2D` non è chiamato da nessuna parte: decidere se è codice morto (rimuoverlo) o se FASE 8 lo userà (vedi FASE8, sezione "Aspetto di D"). **Non rimuoverlo ora**: lasciare un commento `// usato da FASE 8` o decidere dopo.

## 8. Chiusura

- [ ] `tsc --noEmit`, lint, `vite build` puliti. Confrontare il peso del chunk `BossArena` con quello annotato al punto 2 (deve essere ≈ uguale).
- [ ] Rifare il playtest del punto 2 **per intero**; spuntare ogni voce.
- [ ] Un ultimo commit "docs: aggiorna stato progetto" e poi si parte con FASE 8.

## 9. Fuori scope (non farlo ora)

Nuove meccaniche, bilanciamento, nuove mosse del boss, cambi grafici, `dialogo_pre_boss`, storyboard di entrata sala e intermezzo (arrivano dopo, vedi FASE 8 e note a fine documento).
