# FASE 15 — Cinematiche video: intro del livello e pre-boss

Due video prendono il posto di ciò che c'era: l'**intro** (`intro_level1`, 105 s) sostituisce il dialogo d'apertura di `level1_intro`, il **pre-boss** (`preboss_sala1`, 53 s)
sostituisce lo storyboard `level1_preboss`. L'ultimo fotogramma del pre-boss ha già le posizioni di partenza dell'arena (D a sinistra, Eve a terra al centro, Checco a destra).

## Cosa c'è

| Cosa | Dove |
|---|---|
| Tipi (`CutsceneVideo`, `CutsceneEntry` = video OPPURE storyboard, `CutsceneId`) e registro | `src/data/cutscenes/types.ts`, `registry.ts` |
| Componente video (caricamento, autoplay bloccato, errore con «Riprova / Salta», sottotitoli, pausa, dissolvenza) | `src/game/cutscenes/VideoCutscene.tsx` (+ `.module.css`) |
| Scelta fra video e storyboard | `src/game/cutscenes/CutscenePlayer.tsx` |
| Intro: all'inizio del livello, fase `intro_dialogo` | `src/game/levels/Level1/SceneManager2D.tsx` |
| Pre-boss: ingresso in Sala 1, fase `dialogo_pre_boss` → `boss_fase1` | `src/game/levels/BossArena/SceneManagerPreBoss.tsx` |
| «Una volta a partita» | `levelStore.seenCutscenes` / `markCutsceneSeen` (azzerato da `resetLevel()`) |
| Precarico | `prefetchCutsceneVideo` in `src/game/menu/assetPreload.ts` |
| Sottotitoli attivabili | `settingsStore.subtitles` (persistito), voce in `SettingsPanel` |
| Musica ferma durante il video | `uiStore.videoPlaying`, letto da `useBackgroundMusic` |
| Asset (ricompressi, i master NON sono nel repo) | `public/video/cutscenes/{intro_level1,preboss_sala1}.{mp4,vtt}` |
| Test | `tests/cutscenes.test.mjs` |

## Come funziona
- **Asset**: `ffmpeg -i <master> -vf scale=-2:720 -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart <out>` → 6,2 MB e 4,6 MB (dai 22 MB dei master).
  I `.vtt` vengono dagli `.srt` con `ffmpeg -i x.srt x.vtt`; nel pre-boss «CHECCO ZALANDO» è stato corretto in «CHECCO ZALONE». Niente poster: entrambi i video partono da un nero pieno,
  quindi il primo fotogramma è già lo sfondo.
- **`VideoCutscene`**: `<video>` a tutto schermo (`object-fit: contain`, sfondo nero), `<track kind="subtitles" srclang="it">` (acceso/spento da `settingsStore.subtitles`).
  Volume = impostazione, muto se musica ed effetti sono entrambi spenti. Salto con `SkipCutscene` (Esc/Invio/Start tenuti, tastiera e pad). Il gioco in pausa (Esc/Options, un tocco) ferma anche il video.
  A fine o saltando: `finish()` (IDEMPOTENTE) → dissolvenza al nero di 0,6 s → `onFinished`, una volta sola.
- **Caricamento e errori** (nessun soft-lock): finché il video non parte c'è «Caricamento del video…» (anche per un buffering a metà); se non parte entro 15 s, o il browser dà errore, compare
  «Il video non si carica» con **Riprova** (ricarica) e **Salta** (prosegue la partita), navigabili anche da pad. Se il browser blocca l'autoplay: «Premi un tasto per iniziare»; col solo pad
  (che per il browser non è un gesto) si ripiega sul video muto con i sottotitoli.
- **Una volta a partita**: l'intro si vede se `intro_level1` non è in `seenCutscenes`; il pre-boss idem (altrimenti si va dritti all'arena). Sia fine sia salto lo segnano come visto. Giocando di nuovo dal
  menu si rivedono.
- **Precarico**: l'intro parte da `prefetchLevel1Assets` (selezione livelli); il pre-boss all'ingresso dell'interno dell'Ariston. `fetch` a bassa priorità a riposo, una volta per id: serve solo a scaldare la cache.
- **Provare a mano**: pre-boss con **F6** (rimette «non visto» e parte il video); intro: lanciare il Livello 1 dal menu (o, da console in sviluppo, `resetProgress()` + `setScreen('game')`).
  Serve un browser con H.264/AAC (Chrome, Edge, Firefox, Safari): il Chromium di Playwright non li ha e mostrerebbe l'errore con «Riprova / Salta».

## Scostamenti e note
- Il dialogo `LEVEL1_INTRO_DIALOGUE` non è più usato dalla scena (resta nei dati: il tipo `DialogueLine` vive lì) e lo storyboard `level1_preboss.ts` (+ `public/cutscenes/preboss/`, 1,5 MB, e la sua voce in
  `scripts/prepare-cutscene-frames.mjs`) non è più registrato: sono codice/asset ormai inutilizzati, da eliminare quando si vuole. Il ripiego di un video che non carica NON è la vecchia versione (scelta dell'utente):
  è «Riprova / Salta».
- `SceneManagerPreBoss` non riceve più `onWhiteout`: la transizione è la dissolvenza al nero del video.
- Il registro importa con estensione `.ts` e senza alias (come i moduli testati con Node).

## Stato di esecuzione
Provato in Chrome con Playwright: l'intro parte (musica ferma, sottotitoli visibili, tempo che avanza), la pausa del gioco ferma e riprende il video, Esc tenuto salta e si cammina, una seconda volta non riparte;
il pre-boss con F6 finisce da solo (e saltando) in `boss_fase1` con l'arena montata; con il file bloccato compare «Il video non si carica», «Riprova» lo fa partire e «Salta» prosegue; con `play()` rifiutato
compare «Premi un tasto per iniziare» e un tasto lo avvia. 48 test, `tsc`, lint e build puliti.
**Non provato**: la riproduzione col solo pad vero, il comportamento su Safari/Firefox, e la build di produzione giocata a mano.
