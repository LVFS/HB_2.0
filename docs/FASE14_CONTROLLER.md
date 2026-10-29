# FASE 14 — Supporto controller con icone

Obiettivo: giocare tutto il Livello 1 **con un controller**, con le icone giuste (Xbox / PlayStation / Switch / tastiera) dove prima c'erano i nomi
dei tasti. Tastiera e mouse restano **identici**.

## Cosa c'è

| Cosa | Dove |
|---|---|
| Azioni di gioco (`GameAction`, `QteAction`, `CANNON_ACTIONS`) | `src/input/inputActions.ts` |
| Binding tastiera/mouse e controller (tabelle dati: si cambia un abbinamento in UN file) | `src/input/keyboardBindings.ts`, `src/input/gamepadBindings.ts` |
| Famiglia del pad da `pad.id` (Chrome e Firefox) — PURA, testata | `src/input/padFamily.ts` |
| Stato del pad: bottoni, croce, stick con isteresi — PURO, testato | `src/input/padState.ts` |
| Token → azioni, azioni dei QTE e del cannone — PURI, testati | `src/input/tokenActions.ts` |
| Gestore unico (non React): un solo `requestAnimationFrame`, canali e abbonati, ultimo dispositivo, vibrazione | `src/input/inputManager.ts` |
| Hook React (`useInputDevice`, `useGlyphDevice`, `useActionEvents`, `useActionPress`) | `src/input/useInputHooks.ts` |
| Etichette per dispositivo/famiglia e testi con segnaposto `{attack}` — PURE, testate | `src/input/glyphLabels.ts` |
| Icone `ActionGlyph` / righe di comandi `ControlsHint` | `src/components/ActionGlyph.tsx` (+ `.module.css`) |
| Vibrazione (opzionale) | `src/input/rumble.ts` |
| Adattatore con la STESSA interfaccia di prima | `src/game/shared/usePlayerActions.ts` |
| Impostazioni `glyphs` (auto / xbox / playstation / switch / tastiera) e `rumble` | `src/store/settingsStore.ts`, `src/components/SettingsBar.tsx` |
| Test (`npm test`) | `tests/input.test.mjs`, `tests/qte.test.mjs` |

## Come funziona
- **Token e azioni**: tastiera, mouse e pad diventano TOKEN (`j`, `mouse0`, `pad:b2`, `pad:left`) e i token diventano azioni. Un token può essere più azioni
  (`pad:b0` = salto e conferma): chi ascolta filtra per azione, oppure per token (`subscribeTokens`) se traduce a modo suo (QTE, cannone).
- **Canali**: ogni `usePlayerActions` apre un canale con la SUA coda di pressioni (chi consuma non svuota quella di un altro); i tasti tenuti sono condivisi.
  Le sostituzioni (`jump: [' ']` del tunnel) valgono solo per la tastiera: sul pad il salto è sempre A. Il menu del browser sul click destro si blocca solo
  se il canale lo chiede (arena e tunnel sì, camminata e interno no).
- **Mappatura** (mappatura standard: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 9 Start, 12-15 croce): muovere = stick sinistro (soglia 0.35 su / 0.25 giù) o croce;
  cambiare via = su/giù; **A** salta/conferma, **X** attacca, **LB** para, **B** scatto/indietro, **Y** cura/pappa, **RB** abilità/bonus, **RT** furia, **LT** richiama Eve,
  **Start** tenuto = salta la cutscene. Cannone: qualunque fra attacco/parata/salto/scatto (più click/tap).
- **QTE ad azioni**: le sequenze contengono `attack | parry | skill | heal | jump` (`QTE_KEYS`, `BARRAGE_KEYS`, `SUPPORT_QTE_KEYS`); `qte.ts` non è cambiato (lavora già su stringhe).
  Un solo percorso di lettura: `inputManager.subscribeTokens` + `qteActionForToken` in boss (`BossChecco`), raffica (`SceneManagerTunnel`) e supporto/cannone (`SceneManagerSpazio`).
  Sulla tastiera i tasti sono gli stessi di prima; W/freccia su e Maiusc NON fanno parte dei QTE (come prima).
- **Icone**: seguono l'ULTIMO dispositivo usato (cambiano da sole, anche a metà di un QTE); `glyphs` può forzarle. Disegnate in SVG, un solo colore (`currentColor`):
  PlayStation ✕ ○ □ △ come sagome geometriche (nessun marchio), Xbox/Switch lettere nel cerchio (Switch ha A/B e X/Y scambiati), dorsali e grilletti con la sigla della famiglia.
  Un pad sconosciuto usa le icone Xbox. Nessun componente dipende da file di immagini.
- **Testi con segnaposto**: i messaggi del tunnel (gatto, bonus, desideri, barks) scrivono `{attack}`, `{skill}`… e `formatActionText` li sostituisce col tasto del dispositivo
  attuale (`ArenaHud`, `PowerUpChoice`). Per aggiungere un testo con un comando: usare il segnaposto, mai il nome del tasto.
- **Pulizia**: `blur`/`visibilitychange` rilasciano i tasti; se un pad sparisce i suoi token vengono rilasciati; una pressione tenuta non si ripete.
- **Vibrazione** (`rumble`, default acceso, solo Chrome/Edge): colpo subito, parata, stagger del boss, scaraventamento del finale.

## Inventario dell'input (passo 0b)
| Punto | Prima | Ora |
|---|---|---|
| `usePlayerActions` (arena, tunnel) | `keydown`/`mousedown` a mano, solo tastiera/mouse | adattatore sul gestore: tastiera + mouse + pad |
| `Player2D`, `PlayerIso` (camminata e interno) | Set di tasti propri nel modulo | `usePlayerActions` (muoversi, salto; su/giù nell'interno) |
| `BossChecco` (QTE del boss), `SceneManagerTunnel` (raffica), `SceneManagerSpazio` (supporto, cannone) | `keydown` con `event.key` | `subscribeTokens` + azioni (cannone: anche `pointerdown`) |
| `EveArena` (F, richiama Eve) | `keydown` | azione `summon` |
| `useCutsceneSkip` / `SkipCutscene` | Esc/Invio `keydown`/`keyup` | azione `skip` (Esc/Invio/Start) tenuta |
| `PowerUpChoice` (carte, anche i desideri) | frecce/Invio/numeri/click | invariato + pad (croce/stick, A) |
| `LevelSelectScene` | solo mouse nella vista a fuoco; L1/R1+A in elenco | + A avvia, B indietro (e B in elenco torna al menu) |
| `useAnyInput` (dialoghi, menu, punteggio), `useGamepadCycleSelect`, `useGamepadDetected` | già con il pad | invariati (hanno già il loro polling) |
| `useDevBossShortcut` | F-key | invariato (solo sviluppo) |
| Testi con i tasti: hint di arena/tunnel/camminata, `DialogueBox`, `SkipCutscene`, `QteChallenge`, `ArenaHud` (furia, gatto, bonus, richiamo Eve, Zoltraak), cannone, punteggio, messaggi del tunnel | nomi dei tasti scritti a mano | `ActionGlyph`/`ControlsHint`/`formatActionText` |

## Ramo `feat/only-happy-bday`: recuperato / adattato / scartato
Ispezionato in sola lettura (nessun merge, nessun `checkout`, ramo non toccato). Contiene `useGamepadNavigation`, `useInputMethod` e `src/game/birthday/controlIcons.tsx`; nessun test e nessuna icona di famiglie di pad.

| Cosa nel ramo | Esito | Motivo |
|---|---|---|
| `useGamepadNavigation` (L1/R1/A/Start per la sequenza di auguri) | **scartato** | è specifico della sequenza di auguri (indietro/avanti/play) e usa lo stesso polling con bordo di salita che il gestore unico ha già; non c'è nulla di riusabile per le azioni di gioco |
| Indici standard dei bottoni e schema di polling (`requestAnimationFrame` + insieme dei premuti per il bordo di salita) | **adattato** | stessi indici (0 A, 4 LB, 5 RB, 9 Start) e stessa tecnica, ora nel gestore unico (`inputManager.ts`, `padState.ts`) |
| `useInputMethod` (ultimo metodo usato: pointer/keyboard/gamepad) | **adattato** | l'idea — le icone seguono l'ultimo dispositivo — è quella di `useInputDevice`, ma il gestore lo ricava da solo (nessuno stato da aggiornare a mano) e distingue la famiglia del pad |
| `controlIcons.tsx` (SVG a mano: dorsali L1/R1, croce, Options, tasti freccia/spazio/fine) | **adattato** (come criterio) | non copre le azioni di gioco né le famiglie; si è ripreso il criterio — sagome geometriche senza marchio né i colori ufficiali — per le icone nuove di `ActionGlyph`, tutte a mano nello stesso stile |
| Test | **nessuno nel ramo** | i test nuovi sono in `tests/input.test.mjs` e `tests/qte.test.mjs` |

## Scostamenti dal piano
- **Icone**: invece del pacchetto Kenney (da scaricare a mano) sono **disegnate nel gioco** (SVG): nessun download, nessuna licenza da gestire, un solo stile per tutte le famiglie.
  `ActionGlyph` è l'unico punto da cambiare se un giorno si vorranno i PNG di Kenney (basterebbe mappare `family + bottone` a un file e tenere il disegno come riserva).
- **Pad non standard**: nessun avviso a schermo, solo un `console.warn` una volta; contano i bottoni 0-3 e lo stick.
- **`jump` nei QTE da tastiera** resta Spazio soltanto (W/freccia su sono cambio via); nei QTE un tasto di un'altra azione (scatto, furia…) non conta come mancato, semplicemente non conta.
- **Barre dell'HUD riparate** (bug preesistente, non della FASE 14): la barra di coccole/pappa del gatto e quella della modalità (Buen Camino/shonen) avevano `width: \`%\`` (l'espressione si era persa
  in una patch precedente) e quindi non si vedevano; ora usano `affection`, `hunger` e `mode.pct`.
- **Posizione degli hint**: il riquadro dei comandi ora contiene icone e va a capo; il suo ancoraggio in basso ha specificità doppia (`.hint.hint`) perché in sviluppo l'ordine di iniezione del CSS lo
  faceva a volte comparire in alto sopra la HUD.
- **Impostazioni, menu e selezione livelli da controller**: fatti nella tappa 14b (sezione sotto).

## Stato di esecuzione
Verificato con Playwright e un `navigator.getGamepads` FINTO iniettato prima del caricamento (`t26`): arena (stick e croce muovono e si fermano, X attacca, LB para e rimanda, B schiva, A doppio salto,
Y cura, RB abilità, LT richiama Eve), tunnel (croce su/giù cambiano via, A salta, raffica a 10/10 con i bottoni delle azioni), spazio (QTE di supporto 10/10 e cannone con X/LB alternati, salto della
distruzione con Start tenuto), cutscene pre-boss (un tap di Start NON salta, tenuto sì), scelta a carte (croce/stick + A), selezione livelli (A avvia, B indietro, B in elenco → menu; Silì «Prossimamente» non parte),
icone per famiglia (Xbox, PlayStation, Switch riconosciute e disegnate) e cambio automatico tastiera ↔ pad; scollegare il pad rilascia tasti e stick, ricollegarlo funziona, `blur` rilascia i tasti
della tastiera. Tastiera e mouse invariati: regressione dell'arena (inclusi finale e QTE del boss), tunnel → spazio, cutscene con Esc tenuto, selezione livelli. 42 test (`npm test`): famiglia del pad (Chrome e
Firefox), soglia e isteresi dello stick, bordo di salita, pad non standard, binding invariati, azioni dei QTE e del cannone, etichette e segnaposto. `tsc`, lint e build puliti.

**Non provato**: pad veri (Xbox, PlayStation, Switch; Chrome e Firefox) — a cura dell'utente, con un giro completo del Livello 1 solo col pad; la vibrazione (nessun supporto nel browser di prova); la
build di produzione giocata a mano.

## Tappa 14b: menu, selezione livelli, pausa e vibrazione (dopo la prova con un DualSense via Bluetooth)

| Cosa | Dove |
|---|---|
| Azione `interact` (E / Invio / A-✕: entrare dalla porta del cinema; NON Spazio, che è il salto) | `keyboardBindings.ts`, `gamepadBindings.ts`; la legge `useActionPress` in `SceneManager2D` |
| Azione `pause` (Esc / Start-Options: un TOCCO) e `skip` (gli stessi tasti TENUTI) | `src/input/`, `useTapAction` in `useInputHooks.ts` |
| Navigazione dei menu col pad: livelli di navigazione, fuoco spaziale sugli elementi `data-nav`, X/✕ conferma, ○ indietro, cursori col sinistra/destra | `src/input/padNav.ts` (`usePadNavLayer`) |
| Pausa del gioco: GSAP, input e `<Canvas>` fermi | `store/pauseStore.ts`, `components/GameCanvas.tsx` (al posto di `Canvas` in tutte le scene dei livelli), `components/PauseMenu.tsx` |
| Impostazioni (contenuto riusato da menu, selezione livelli e pausa) | `components/SettingsPanel.tsx`, `SettingsBar.tsx`, `store/uiStore.ts` |
| Conferma, promemoria dei comandi | `components/ConfirmDialog.tsx`, `components/PadHints.tsx` |

- **Menu iniziale**: Options (un tocco) apre le impostazioni; croce/stick muovono, X/✕ seleziona, ○ chiude. Con le impostazioni aperte la sequenza NON parte (`useAnyInput` è spento e ignora
  comunque Esc, Select e Options). **Tenendo premuto Options/Esc** (`SkipCutscene`, «per andare alla selezione livelli») il filmato — il volo d'intro e la sequenza del pugno — si salta e si va alla
  selezione livelli (con il bianco). Il bottone «Seleziona livello» a mouse c'è ancora.
- **Selezione livelli**: croce/stick scelgono fra mondi e schede, X/✕ conferma (apre il dettaglio), ○ dal dettaglio torna all'elenco, ○ dall'elenco chiede «Tornare al menu principale?» (○ annulla),
  Options apre le impostazioni e ○ le chiude (il livello più in alto comanda). Nel dettaglio il fuoco parte su «Avvia livello». Rimosso il ciclo L1/R1 (`useGamepadCycleSelect` non è più usato qui).
- **Pausa**: un tocco di Esc/Options (sotto 350 ms, al rilascio) ferma il gioco e apre «Pausa» (Riprendi / Impostazioni / Esci dal livello con conferma, che porta alla selezione livelli); lo stesso tasto,
  ○ o «Riprendi» riprende. TENERE premuto resta il salto delle cutscene. In pausa il gioco non vede nessuna pressione (`inputManager.setSuspended`: canali, QTE, richiami; i rilasci passano
  sempre) e le pressioni fatte nel menu non «trapelano» alla ripresa. I timer `setTimeout` delle scene non si fermano (le cutscene a fumetti sì: ricontrollano la pausa).
- **Vibrazione**: oltre a colpo subito, parata, stagger e scaraventamento, ora anche un battito leggero quando D colpisce Checco, a ogni tasto riuscito dei QTE, e un colpo forte allo sparo del cannone.
  Nelle impostazioni c'è «Prova la vibrazione» (ignora l'interruttore) e dice cosa ha risposto il browser: `ok` (l'ha eseguita: se non si sente è il collegamento/driver, tipico del Bluetooth),
  `unsupported`, `no-pad`. Provata solo con un pad finto: con un DualSense vero via Bluetooth dipende da browser e sistema.

**Verificato** (Playwright, pad finto): menu (Options apre, X/○ lavorano nel pannello, la sequenza non parte, tenuto → selezione livelli), selezione livelli (fuoco, dettaglio, ○ a cascata, conferma, Options/○ sulle
impostazioni), pausa (si ferma tutto, la tastiera è ignorata, nessun colpo spurio alla ripresa, impostazioni dentro la pausa, Esci con conferma, Esc apre/chiude), cutscene (tenuto salta, tocco mette in pausa),
prova della vibrazione (supportata / non supportata). 44 test. Regressioni da tastiera (arena e finale, spazio, selezione livelli bloccata) invariate.
