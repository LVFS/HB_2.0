# FASE 11 — Cutscene da storyboard: ingresso nella sala del boss e intermezzo

Punto di partenza: tag `v0.9-tunnel`. Questa fase NON tocca il tunnel, il combattimento né il finale nello spazio (FASE 12).
Stile: **«motion comic»** — i disegni dello storyboard (`docs/storyboard/Frame/`) a tutto schermo con camera, tagli, scosse, lampi e
battute in sovrimpressione. In-engine restano il combattimento e lo scaraventamento. La sostituzione con cinematiche video è
prevista (punto di sostituzione sotto) ma non scritta.

## Cosa c'è

| Cosa | Dove |
|---|---|
| Tipi (beat, camera, effetti, registro) | `src/data/cutscenes/types.ts` |
| Set pre-boss (14 beat, ~50 s) e post-boss (8 beat, ~45 s) — SOLO DATI, battute sostituibili | `src/data/cutscenes/level1_preboss.ts`, `level1_postboss.ts` |
| Registro `id → storyboard (+ video)` | `src/data/cutscenes/registry.ts` |
| Componente HTML/CSS a due livelli di immagini + camera GSAP + battute | `src/game/cutscenes/StoryboardCutscene.tsx` (+ `.module.css`) |
| Punto di sostituzione motion comic ↔ video | `src/game/cutscenes/CutscenePlayer.tsx` |
| Fase `dialogo_pre_boss` | `src/game/levels/BossArena/SceneManagerPreBoss.tsx`, `App.tsx` (lazy + esclusa dal catch-all), `SceneManager2DIso.handleEnterBossArena` |
| Intermezzo nel finale | `finale.ts` (fase `intermezzo`), `arenaState.ts` (`intermezzoDone`), `arenaStore.ts` (`intermezzo`), `SceneManagerBossArena.tsx` (overlay) |
| Frame convertiti (2.78 MB) | `public/cutscenes/preboss/01-14.webp`, `postboss/01-08.webp`; script `scripts/prepare-cutscene-frames.mjs` |
| Parlante `Checco`, sfx `crash/whoosh/crack/thud` (file ancora assenti: silenzio) | `level1_intro.ts`, `useSfx.ts` |
| Scorciatoia dev `F6` (cutscene pre-boss) | `hooks/useDevBossShortcut.ts` |

## Come funziona
- **Beat**: `image`, `hold` (se senza battute), `camera {from,to,duration,ease}` in % dello schermo (un disegno con `scale` s si sposta al
  massimo di (s−1)×50 % per lato senza mostrare il nero), `lines` (il beat aspetta, un tasto per riga), `fx` all'inizio e `fxEnd` alla fine
  (`shake`, `flash`, `whiteout`, `dim`), `sfx`, `cut` (taglio secco), `fit`/`focus` (disegni non 16:9).
- **Regole delle cutscene del progetto**: `applyFinalState()` IDEMPOTENTE (fine e salto con Esc/Invio tenuto passano da lì, `onFinished` scatta una
  volta sola), timeline e timer ripuliti allo smontaggio, percorsi con `import.meta.env.BASE_URL`.
- **Nessun soft-lock**: precarico con tempo massimo di 8 s (`decode()`); un disegno che non si carica lascia quel beat sul nero con le sue battute.
- **Intermezzo**: dopo `land` il finale passa a `intermezzo` (mondo fermo, input già ignorati) e imposta `arenaStore.intermezzo`; l'arena monta
  `CutscenePlayer id="postboss"` sopra tutto e nasconde HUD e comandi; a fine o salto scrive `world.finale.intermezzoDone`, e il finale passa a
  `transform` con la marionetta GIÀ svelata (niente «tell» né messaggio, solo l'anello). QTE a vuoto e QTE riuscito passano entrambi dall'intermezzo.
- **Punto di sostituzione video (non scritto)**: `CutsceneEntry.video` nel registro e `CutscenePlayer`; oggi usa SEMPRE lo storyboard. Il ramo
  video si scrive quando c'è il primo file (vedi 4c del piano: ricomprimere a 720p in `public/video/`, «Tocca per iniziare» se `play()` è bloccato,
  musica in pausa, ripiego sullo storyboard se non si carica, non committare video non definitivi).

## Scostamenti dal piano
- I **tipi** stanno in `src/data/cutscenes/types.ts` e non in `src/game/cutscenes/cutsceneTypes.ts`: `data/` non può importare da `game/` (flusso dati a senso unico).
- Un disegno che non si carica **non salta il beat**: resta sul nero con le battute, così il dialogo non si perde.
- Aggiunti `fxEnd` (effetti a fine beat: il `whiteout` finale) e `focus` (il frame 5 del post-boss è quasi quadrato: si tiene in vista la parte con i volti).
- Lo stash non contiene un pre-boss: `stash@{0}` ha solo file non tracciati di Blender/storyboard (nessun codice). Non toccato.

## Stato di esecuzione
Verificato con Playwright (`t20`) e la regressione dell'arena: la cutscene parte da `F6`/dalla porta, si avanza con un tasto fino all'arena; il salto
(Esc tenuto, poi Invio) a 0.1 s, a 6 s e a 25 s porta all'arena una volta sola; con `preboss/05.webp` bloccato la scena finisce lo stesso; all'avvio
dell'app non si scarica nessuna immagine di cutscene; nell'intermezzo J/K/Shift/E non cambiano nulla (hp, abilità, fendenti, parata); a fine o salto
il finale prosegue con `marionette = true` fino al Sotterraneo; la regressione (`D_good`/`D_bad`) passa con fasi `gather>qte>land>intermezzo>transform>fling>fade`.
`tsc`, lint e build puliti; il tunnel (F7) e l'arena (F9) funzionano come prima. Non provato: la build di produzione giocata a mano con `npm run preview`
(`F6` esiste solo in sviluppo): ho solo verificato che i `.webp` si servano sotto `/HB_2.0/cutscenes/...`.

Da fare a mano: guardare le cutscene intere in gioco, tarare i tempi della camera, scrivere/sostituire le battute e produrre sfx veri.
