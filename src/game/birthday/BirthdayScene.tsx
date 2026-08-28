import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

// Font self-hostati, come il resto del progetto: nessuna richiesta a un CDN
// esterno a runtime. Stanno qui dentro e non in `main.tsx` perché questa
// schermata è caricata con `lazy()`: i file dei font finiscono nel suo chunk
// e non pesano su chi non arriva mai fin qui.
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/playfair-display/latin-500-italic.css';
import '@fontsource/anton/latin-400.css';

import { useAudioPulse } from '@/hooks/useAudioPulse';
import { useBirthdayMusic } from '@/hooks/useBirthdayMusic';
import { useGamepadNavigation } from '@/hooks/useGamepadNavigation';
import { useInputMethod } from '@/hooks/useInputMethod';
import { SEQUENCE, TIMINGS, type TableauId } from './birthdayConfig';
import { BirthdayControls } from './BirthdayControls';
import { GamepadCrossIcon, GamepadShoulderIcon, KeyArrowIcon, KeySpaceIcon } from './controlIcons';
import { BloodborneTableau, EXIT_DURATION as BLOODBORNE_EXIT } from './tableaux/BloodborneTableau';
import { GodOfWarTableau, EXIT_DURATION as GOD_OF_WAR_EXIT } from './tableaux/GodOfWarTableau';
import { HollowKnightTableau, EXIT_DURATION as HOLLOW_KNIGHT_EXIT } from './tableaux/HollowKnightTableau';
import { ExpeditionTableau, EXIT_DURATION as EXPEDITION_EXIT } from './tableaux/ExpeditionTableau';
import { ResidentEvilTableau, EXIT_DURATION as RESIDENT_EVIL_EXIT } from './tableaux/ResidentEvilTableau';
import { GtaTableau } from './tableaux/GtaTableau';
import styles from './BirthdayScene.module.css';

// Su una timeline one-shot come questa, lagSmoothing (attivo di default)
// è la scelta sbagliata: se un fotogramma tarda (carico di font/canvas
// all'apertura, tipico proprio in questo istante), GSAP rallenta la
// timeline invece di recuperare il tempo perso — i quadri restano a
// schermo più a lungo del previsto, sempre di più mano a mano che si va
// avanti. Stesso fix già usato in `CharacterIntro.tsx` per lo stesso
// motivo (bug reale scovato verificando la sequenza per intero: i tempi
// misurati derivavano sempre di più da quelli in `TIMINGS`).
gsap.ticker.lagSmoothing(0);

/**
 * Quanto il quadro nuovo entra PRIMA che il precedente sia sparito, come
 * frazione della dissolvenza in uscita di quest'ultimo.
 *   0 = il nuovo parte quando il vecchio è già sparito del tutto
 *   1 = il nuovo parte nell'istante in cui il vecchio inizia a svanire
 *
 * Tenuto a 0. Con una sovrapposizione anche piccola due frasi diverse
 * restano leggibili contemporaneamente una sopra l'altra, e il risultato è
 * illeggibile — non una dissolvenza incrociata elegante. Fra un quadro e
 * l'altro passa così un istante di nero, che in una sequenza come questa
 * legge come una pausa voluta, non come un buco.
 */
const OVERLAP = 0;

/**
 * Di quanto si accelera il tempo GLOBALE di gsap (`gsap.globalTimeline`, non
 * solo la timeline della scena) mentre si attraversa la parte "calma" di un
 * quadro, prima che cominci la sua uscita — usato sia da `skipToEnd` sia dal
 * primo clic di `advance()` (vedi `checkpointOverrideRef` sotto: stesso
 * identico bisogno, stessa tecnica). Un numero moderato: abbastanza da
 * sentirsi come "si salta avanti", non così alto da rendere impercettibile
 * la transizione.
 */
const SKIP_TIME_SCALE = 6;

/**
 * Cosa deve succedere quando la timeline raggiunge il PROSSIMO checkpoint di
 * fine quadro, oltre al comportamento di sempre (pausa se l'automatico è
 * spento) — letto e consumato dal `.call()` di checkpoint già presente sulla
 * timeline (vedi l'effetto di costruzione sotto), scritto da `advance()` e
 * da `skipToEnd()` quando scelgono di "far vedere" la coreografia d'uscita
 * invece di saltarla di netto:
 *  - `'continue'`  (primo clic di `advance()`) — non pausare: si prosegue
 *    dritti nel quadro successivo, come se l'automatico fosse acceso per un
 *    solo checkpoint.
 *  - `'skipToEnd'` (primo clic di "Salta tutto") — salta direttamente
 *    all'ultimo quadro (GTA), invece del comportamento di default.
 *  - `null` — nessuna richiesta pendente, comportamento di sempre.
 *
 * Un solo interruttore condiviso fra i due pulsanti (non uno a testa): se
 * l'utente preme l'ALTRO pulsante mentre uno dei due ha già una richiesta in
 * sospeso, chi arriva dopo la trova già impostata e decide lui cosa farne
 * (vedi `advance()`/`skipToEnd()` sotto) — comportamento prevedibile invece
 * di due cronometri paralleli che potrebbero disallinearsi fra loro.
 */
type CheckpointOverride = 'continue' | 'skipToEnd' | null;

/**
 * Quanto dura l'effetto di USCITA di ogni quadro che ne ha uno, in secondi.
 * Serve alla timeline per sapere con quanto anticipo dare il via, così
 * l'effetto finisce esattamente quando comincia la dissolvenza del quadro.
 * I quadri che non compaiono qui escono con la sola dissolvenza.
 *
 * Il numero lo dichiara il quadro stesso (`EXIT_DURATION`), non questo file:
 * chi ritocca la coreografia non deve ricordarsi di aggiornare anche un
 * secondo posto.
 */
const EXIT_DURATIONS: Partial<Record<TableauId, number>> = {
  bloodborne: BLOODBORNE_EXIT,
  godOfWar: GOD_OF_WAR_EXIT,
  hollowKnight: HOLLOW_KNIGHT_EXIT,
  expedition: EXPEDITION_EXIT,
  residentEvil: RESIDENT_EVIL_EXIT
};

function renderTableau(id: TableauId, active: boolean, exiting: boolean, onRewatch: () => void) {
  switch (id) {
    case 'bloodborne':
      return <BloodborneTableau active={active} exiting={exiting} />;
    case 'godOfWar':
      return <GodOfWarTableau active={active} exiting={exiting} />;
    case 'hollowKnight':
      return <HollowKnightTableau active={active} />;
    case 'expedition':
      return <ExpeditionTableau active={active} exiting={exiting} />;
    case 'residentEvil':
      return <ResidentEvilTableau active={active} exiting={exiting} />;
    case 'gta':
      return <GtaTableau active={active} onRewatch={onRewatch} />;
  }
}

/**
 * Sei quadri in sequenza, uno per gioco citato.
 *
 * Divisione dei ruoli, la stessa del resto del progetto:
 *  - la timeline GSAP qui sotto decide QUANDO ogni quadro entra ed esce;
 *  - ogni quadro decide COME si presenta, con le proprie @keyframes;
 *  - React tiene un solo stato, `activeIndex`, che cambia sei volte in tutto
 *    (non a ogni fotogramma) e serve ai quadri per far partire le loro
 *    animazioni interne.
 *
 * I quadri sono montati tutti insieme e nascosti con `autoAlpha` (opacità +
 * visibility), non montati e smontati: un rimontaggio a metà dissolvenza
 * darebbe uno scatto, e `visibility: hidden` impedisce comunque a quelli
 * nascosti di intercettare i click.
 *
 * Play/pausa e avanti/indietro sono estensioni della STESSA timeline (GSAP
 * supporta nativamente `.play()`/`.pause()`/`.seek()` su una timeline già
 * costruita) — non una seconda macchina a stati in parallelo.
 */
// Nessuna prop: `gamepadDetected` (sollevato da `App.tsx`) non serve più
// qui — sostituito ovunque da `useInputMethod`, che a differenza sua sa
// anche tornare indietro (mouse dopo il joystick, non solo joystick rilevato
// una volta per tutte). `App.tsx` continua a usare `useGamepadDetected` per
// conto suo, per `useAudioUnlockHint`, che invece ha bisogno di quella
// semantica "permanente".
export function BirthdayScene() {
  const rootRef = useRef<HTMLDivElement>(null);
  const tableauRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  // Quale quadro sta eseguendo il proprio effetto di uscita, se qualcuno lo
  // sta facendo. Acceso da un `.call()` PIAZZATO SULLA TIMELINE (vedi
  // sotto), non da un timer a orologio: è l'unica cosa che resta in fase con
  // una timeline che si può fermare ai checkpoint e a cui si può saltare.
  const [exitingIndex, setExitingIndex] = useState<number | null>(null);
  // La sequenza parte da sola all'arrivo su questa schermata (nessun gate
  // "premi per iniziare"): l'automatico riguarda solo cosa succede DOPO
  // ogni checkpoint di fine quadro (vedi sotto), non l'avvio.
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  // Rispecchia se la timeline GSAP sta davvero scorrendo in questo istante
  // (diverso da `autoplayEnabled`: un `advance()` la fa scorrere anche con
  // l'automatico spento, fino al prossimo checkpoint) — guida la classe
  // `.paused` che congela le @keyframes CSS dei quadri, vedi
  // BirthdayScene.module.css, e il suggerimento "in pausa" sotto.
  const [isTicking, setIsTicking] = useState(false);
  // Contatore, non booleano — stesso principio di `skipIntroToken` nel menu
  // principale: ogni pressione del tasto "mostra/nascondi" deve poter far
  // scattare di nuovo l'effetto in BirthdayControls anche se capitano due
  // pressioni ravvicinate, non solo quando il valore "logico" cambia.
  const [controlsToggleSignal, setControlsToggleSignal] = useState(0);
  // L'ULTIMO metodo d'input usato (vedi `useInputMethod`) — guida quale
  // icona di scorciatoia mostrare nella barra comandi e nel suggerimento
  // "in pausa" sotto. Aggiornato dai tre punti in cui ciascun metodo viene
  // già rilevato per altri scopi: il polling di `useGamepadNavigation`
  // (`onAnyInput`), l'handler di `keydown` per le scorciatoie, e il click/
  // tocco su `BirthdayControls` stessa (`onPointerActivity`).
  const [inputMethod, setInputMethod] = useInputMethod();
  // "Ferma tutto": diverso da un checkpoint (che ferma solo la dissolvenza
  // fra quadri) — questo ferma la timeline OVUNQUE ci si trovi, coreografia
  // d'uscita compresa, e lo stinger musicale insieme a lei (vedi il
  // parametro passato a `useBirthdayMusic` sotto). Guida la STESSA classe
  // `.paused` di `isTicking`: nessuna regola CSS nuova, il congelamento
  // visivo (timeline + @keyframes dei singoli quadri) è già quello.
  const [manuallyPaused, setManuallyPaused] = useState(false);

  // Scrive `--audio-pulse` (0-1, ampiezza dei bassi di qualunque stinger
  // stia suonando) sul contenitore della scena — CASCADE a ogni quadro
  // discendente come una qualunque custom property CSS, che può leggerla
  // con `var(--audio-pulse, 0)` senza bisogno di markup nuovo (vedi God of
  // War/GTA/Resident Evil/Expedition/Bloodborne). Disattivato sotto
  // `prefers-reduced-motion` con un solo controllo qui, invece di ripeterlo
  // in ogni .module.css che legge la property. Hollow Knight non la legge
  // MAI apposta: è il quadro pensato per essere il più silenzioso e
  // immobile di tutti, un elemento che pulsa a tempo ci stonerebbe proprio
  // per la ragione opposta.
  const reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  useAudioPulse(rootRef, !reducedMotion);

  // `onUpdate` (sotto) reagisce a ogni fotogramma della timeline: ha bisogno
  // dell'indice ATTUALE, ma vive dentro un effetto con dipendenze `[]` (la
  // timeline si costruisce una volta sola) — leggerebbe per sempre il
  // valore di `activeIndex` al mount se non fosse una ref aggiornata a ogni
  // render, stessa tecnica già in uso altrove nel progetto (es. `settings`
  // in `useBirthdayMusic`) per lo stesso motivo.
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  // Letta dentro il `.call()` di checkpoint (sotto), che vive nella timeline
  // costruita una volta sola in un effetto con dipendenze `[]`: senza una
  // ref vedrebbe per sempre il valore di `autoplayEnabled` al mount, stesso
  // motivo di `activeIndexRef` sopra.
  const autoplayRef = useRef(autoplayEnabled);
  autoplayRef.current = autoplayEnabled;

  // Popolato una volta sola dall'effetto che costruisce la timeline (sotto)
  // — un checkpoint per quadro non ultimo, in ordine. Letto da `advance()`
  // per trovare il prossimo punto di pausa quando viene premuto mentre la
  // timeline sta già scorrendo (vedi sotto), e dal nuovo `skipToEnd` per
  // sapere dove finisce il quadro corrente.
  const checkpointsRef = useRef<{ index: number; at: number }[]>([]);

  // Vedi `CheckpointOverride` sopra — letto/azzerato dal `.call()` di
  // checkpoint sulla timeline, scritto da `advance()`/`skipToEnd()`.
  const checkpointOverrideRef = useRef<CheckpointOverride>(null);

  // `goToIndex` è definito più sotto (dipende da `resetManualOverrides`), ma
  // il `.call()` di checkpoint dentro l'effetto `[]` che costruisce la
  // timeline (anche più sotto) ha bisogno di chiamarlo per il ramo
  // `'skipToEnd'` — un riferimento diretto lì dentro farebbe scattare
  // `react-hooks/exhaustive-deps` (l'effetto ha dipendenze vuote apposta,
  // la timeline si costruisce una volta sola), anche se `goToIndex` è di
  // fatto stabile. Stessa tecnica già in uso per `activeIndexRef`/
  // `autoplayRef`: una ref aggiornata a ogni render, mai letta prima che il
  // primo checkpoint scatti.
  const goToIndexRef = useRef<(index: number) => void>(() => {});

  // Il cronometro del tratto accelerato (vedi `SKIP_TIME_SCALE`), condiviso
  // da `advance()` e `skipToEnd()`: non è sulla timeline principale, quindi
  // va fermato/ripreso a mano insieme a lei da `toggleStopAll`, e cancellato
  // da qualunque altra azione che rimette in moto le cose per conto suo
  // (`resetManualOverrides`).
  const skipTimerRef = useRef<gsap.core.Tween | null>(null);
  // Se la timeline stava scorrendo nell'istante esatto in cui si è premuto
  // "ferma tutto" — letto alla riattivazione: riprendere deve rimettere in
  // moto SOLO ciò che stava davvero scorrendo, non un checkpoint su cui si
  // era già fermi in attesa dell'utente per conto suo.
  const wasTickingBeforeStopRef = useRef(false);

  // Un accenno musicale per quadro, in crossfade: l'hook reagisce da solo
  // al cambio di `SEQUENCE[activeIndex]`, incluso un salto avanti/indietro
  // manuale — non gli importa COME si è arrivati a un quadro, solo QUALE è.
  // `manuallyPaused` gli arriva così com'è: ferma/riprende lo stinger in
  // corso mantenendo la posizione, l'hook non deve sapere altro.
  useBirthdayMusic(SEQUENCE[activeIndex], { paused: manuallyPaused });

  useEffect(() => {
    // Istante di inizio di ogni quadro (lo stesso `at` già usato per
    // posizionare `.call()`/`.fromTo()` sulla timeline), salvato invece di
    // essere buttato: serve sotto, nell'`onUpdate`, per calcolare quanto è
    // avanzato il quadro ATTUALE (non l'intera timeline) in percentuale.
    const tableauStarts: number[] = [];
    // Un checkpoint per ogni quadro non ultimo: `{ index, at }` nello
    // stesso ordine della sequenza. Serve ad `advance()` (sotto) per capire
    // dove saltare se premuto mentre la timeline sta già scorrendo — non
    // solo per il `.call()` che ci pausa sopra durante il normale avanzare.
    const checkpoints: { index: number; at: number }[] = [];

    const timeline = gsap.timeline({
      // Nasce ferma a tempo zero: costruita per intero prima di partire,
      // così i checkpoint sopra sono già pronti quando la si avvia in coda
      // a questo effetto.
      paused: true,
      onUpdate: () => {
        const fill = progressFillRef.current;
        if (!fill) return;
        const index = activeIndexRef.current;
        const id = SEQUENCE[index];
        const start = tableauStarts[index] ?? 0;
        const { fadeIn, hold, fadeOut } = TIMINGS[id];
        const duration = fadeIn + hold + fadeOut;
        const elapsed = timeline.time() - start;
        const fraction = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 1;
        // Scritto direttamente nello stile, non nello stato React — stessa
        // tecnica dei contatori GTA: un progresso che cambia ogni
        // fotogramma non deve ridisegnare l'albero React.
        fill.style.width = `${fraction * 100}%`;
      }
    });
    timelineRef.current = timeline;

    let at = 0;
    SEQUENCE.forEach((id, index) => {
      const element = tableauRefs.current[index];
      if (!element) return;
      const { fadeIn, hold, fadeOut } = TIMINGS[id];
      const isLast = index === SEQUENCE.length - 1;

      tableauStarts[index] = at;
      // Un'etichetta per quadro: è ciò su cui `.seek()` salta per andare
      // avanti/indietro (sotto, in `goToIndex`), senza dover ricalcolare a
      // mano l'istante assoluto di ogni quadro fuori da questo `forEach`.
      timeline.addLabel(id, at);
      timeline.call(
        () => {
          setActiveIndex(index);
          setExitingIndex(null);
        },
        undefined,
        at
      );
      timeline.fromTo(
        element,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: fadeIn, ease: 'power2.out' },
        at
      );

      const outAt = at + fadeIn + hold;
      if (isLast) {
        // L'ultimo non svanisce: la timeline si allunga fino alla fine della
        // sua permanenza e poi finisce, lasciandolo a schermo.
        timeline.to({}, { duration: hold }, outAt);
        return;
      }

      // Checkpoint di fine quadro: con l'automatico spento, la timeline si
      // ferma qui da sola invece di proseguire nel fadeOut — `advance()`
      // (R1) la fa ripartire da questo stesso punto con la dissolvenza
      // vera, non un salto secco.
      // Via all'effetto di uscita del quadro, se ne ha uno: tanto prima del
      // checkpoint quanto dura, così finisce nell'istante esatto in cui
      // comincia la dissolvenza. `Math.max(at, ...)` per il caso limite di un
      // `hold` più corto dell'effetto: al più parte insieme al quadro.
      const exitDuration = EXIT_DURATIONS[id];
      if (exitDuration) {
        timeline.call(
          () => setExitingIndex(index),
          undefined,
          Math.max(at, outAt - exitDuration)
        );
      }

      checkpoints.push({ index, at: outAt });
      timeline.call(
        () => {
          // Consumato subito, non dopo il branch: qualunque ramo si prenda,
          // la richiesta valeva per questo SOLO checkpoint.
          const override = checkpointOverrideRef.current;
          checkpointOverrideRef.current = null;

          if (override === 'skipToEnd') {
            // Stesso identico salto secco di sempre, solo innescato da qui
            // invece che da un cronometro separato — vedi `skipToEnd()`.
            goToIndexRef.current(SEQUENCE.length - 1);
            return;
          }
          if (override === 'continue') {
            // Primo clic di `advance()`: si è accelerato apposta il tempo
            // per arrivare fin qui vedendo la coreografia d'uscita a ritmo
            // naturale — non pausare, si prosegue dritti nel fadeOut/fadeIn
            // già programmati, esattamente come farebbe l'automatico.
            return;
          }
          if (!autoplayRef.current) {
            timeline.pause();
            setIsTicking(false);
          }
        },
        undefined,
        outAt
      );
      timeline.to(element, { autoAlpha: 0, duration: fadeOut, ease: 'power2.in' }, outAt);
      at = outAt + fadeOut * (1 - OVERLAP);
    });

    checkpointsRef.current = checkpoints;

    // Nessun gate "premi per iniziare": la sequenza parte da sola non
    // appena arrivati su questa schermata (chi ricarica direttamente qui
    // durante lo sviluppo, senza passare dal resto del gioco, può non
    // sentire il primo stinger — i browser bloccano l'audio finché non
    // c'è stata un'interazione sulla pagina, e qui non ce n'è ancora
    // stata nessuna; arrivando dal resto del gioco l'interazione è già
    // avvenuta altrove, quindi l'audio parte regolarmente).
    timeline.play();
    setIsTicking(true);

    return () => {
      timeline.kill();
      timelineRef.current = null;
      // Rete di sicurezza: se si lascia questa schermata mentre "ferma
      // tutto" o il tratto accelerato di "Salta tutto" sono ancora attivi,
      // `gsap.globalTimeline` non deve restare in pausa/accelerato per
      // sempre — è condiviso da TUTTA l'app, non solo da questa schermata.
      gsap.globalTimeline.play();
      gsap.globalTimeline.timeScale(1);
    };
  }, []);

  // Punto unico da cui si esce dallo stato "fermo tutto" e si annullano
  // un eventuale cronometro accelerato pendente e una richiesta di
  // checkpoint non ancora consumata — chiamato in testa a ogni azione che
  // rimette in moto le cose per conto suo (`goToIndex`, l'accensione
  // dell'automatico, e da `advance()`/`skipToEnd()` nei rami che NON stanno
  // gestendo proprio loro un secondo clic — vedi sotto), così non ci sono
  // più leve che possono disallinearsi fra loro. Riporta anche a 1 il
  // `timeScale` globale (vedi `SKIP_TIME_SCALE`): se si interrompe
  // un'attesa accelerata a metà, il tempo di TUTTO ciò che gira su gsap
  // (timer interni dei quadri compresi) deve tornare normale, non restare
  // accelerato per sbaglio.
  const resetManualOverrides = useCallback(() => {
    checkpointOverrideRef.current = null;
    skipTimerRef.current?.kill();
    skipTimerRef.current = null;
    gsap.globalTimeline.timeScale(1);
    setManuallyPaused(false);
  }, []);

  const goToIndex = useCallback(
    (index: number) => {
      const timeline = timelineRef.current;
      if (!timeline) return;
      resetManualOverrides();
      const clamped = Math.min(Math.max(index, 0), SEQUENCE.length - 1);
      timeline.seek(SEQUENCE[clamped]);
      setExitingIndex(null);
      // `activeIndex` va impostato a mano: GSAP non esegue le `.call()` della
      // timeline quando si salta con `.seek()` (stesso comportamento di
      // `.progress()`), quindi senza questa riga il quadro di destinazione
      // non farebbe partire le sue animazioni interne (contatori GTA, falena,
      // glitch...).
      setActiveIndex(clamped);
    },
    [resetManualOverrides]
  );
  // Aggiornata a ogni render (vedi il commento su `goToIndexRef` più sopra):
  // `goToIndex` è di fatto stabile (la sua unica dipendenza, `resetManualOverrides`,
  // non cambia mai), ma la ref evita di doverla aggiungere alle dipendenze
  // vuote dell'effetto che costruisce la timeline.
  goToIndexRef.current = goToIndex;

  // Riprende la timeline da un checkpoint di fine quadro (o dal mount) —
  // usata sia da `advance()` sotto sia dall'effetto che segue
  // `autoplayEnabled`: quest'ultimo NON deve mai saltare in avanti, solo
  // riprendere se la timeline è già ferma, altrimenti attivare l'automatico
  // mentre una transizione è in corso causerebbe un salto indesiderato.
  const resume = useCallback(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    timeline.play();
    setIsTicking(true);
  }, []);

  // Salto secco al prossimo checkpoint, istantaneo: comportamento di
  // `advance()` da sempre quando la timeline sta già scorrendo, estratto qui
  // perché ora serve anche al SECONDO clic di `advance()` (annulla l'attesa
  // armata dal primo) e a `skipToEnd()` quando trova già una richiesta
  // pendente (di uno qualunque dei due pulsanti — vedi `CheckpointOverride`).
  const jumpToNextCheckpointNow = useCallback(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    const currentTime = timeline.time();
    const next = checkpointsRef.current.find((checkpoint) => checkpoint.at > currentTime + 0.001);
    if (!next) return;
    // `+ 0.001`, non `next.at` esatto: il `.call()` di checkpoint registrato
    // in quella posizione non viene eseguito da `.seek()` (stesso motivo per
    // cui `activeIndex` va impostato a mano qui sotto) ma resta "armato" —
    // un `.play()` successivo che riparte esattamente da lì lo farebbe
    // scattare di nuovo al primo fotogramma, ripausando la timeline
    // all'istante (bug reale: un secondo `advance()` sembrava non avere
    // alcun effetto). Un pelo oltre quella posizione evita di ripassarci.
    timeline.seek(next.at + 0.001);
    setActiveIndex(next.index);
    // Saltando al checkpoint si è scavalcato il momento in cui sarebbe
    // partito l'effetto di uscita: GSAP non esegue i `.call()` con `.seek()`,
    // quindi l'effetto semplicemente non c'è stato. È il comportamento
    // voluto — chi arriva qui vuole saltare, non aspettare una coreografia —
    // ma il segnale va comunque azzerato, nel caso fosse già acceso.
    setExitingIndex(null);
    if (!autoplayRef.current) {
      timeline.pause();
      setIsTicking(false);
    }
  }, []);

  // Avanti "vero" (R1), in due tempi come "Salta tutto" (vedi sotto):
  //  - ferma su un checkpoint (caso normale in modalità manuale) → riprende;
  //  - già in corso e NESSUNA richiesta ancora armata (primo clic mentre un
  //    quadro è a metà del proprio `hold`) → non salta più di netto:
  //    accelera fino all'inizio della coreografia d'uscita del quadro
  //    corrente (se ne ha una), arma `'continue'` sul prossimo checkpoint e
  //    lascia proseguire — la si VEDE e si SENTE per intero, poi si passa
  //    da sola al quadro successivo, senza bisogno di un secondo clic;
  //  - già in corso e una richiesta È già armata (secondo clic, durante
  //    l'attesa/coreografia innescata dal primo) → annulla e salta subito,
  //    esattamente il vecchio comportamento a un solo clic.
  //
  // Stessa tecnica (e stessa insidia) di `skipToEnd`: la coreografia
  // d'uscita di un quadro NON è agganciata alla posizione della timeline,
  // ogni quadro la programma da sé con un proprio `gsap.delayedCall` contato
  // in TEMPO REALE da quando `active` è diventato vero — un `.seek()` che
  // salta avanti la posizione della timeline non farebbe avanzare quel
  // conto alla rovescia indipendente, lasciando la coreografia (sfx
  // compresi) silenziosa. Per questo, come in `skipToEnd`, il tratto
  // "calmo" da saltare si comprime accelerando `gsap.globalTimeline`
  // (l'orologio condiviso da cui dipende anche il timer interno del
  // quadro), non con un `.seek()`.
  const advance = useCallback(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;

    if (checkpointOverrideRef.current) {
      checkpointOverrideRef.current = null;
      resetManualOverrides();
      jumpToNextCheckpointNow();
      return;
    }

    resetManualOverrides();

    if (timeline.paused()) {
      resume();
      return;
    }

    const currentTime = timeline.time();
    const next = checkpointsRef.current.find((checkpoint) => checkpoint.at > currentTime + 0.001);
    if (!next) return;

    const id = SEQUENCE[activeIndexRef.current];
    const exitDuration = EXIT_DURATIONS[id] ?? 0;
    const exitStartAt = Math.max(currentTime, next.at - exitDuration);

    checkpointOverrideRef.current = 'continue';

    if (currentTime < exitStartAt) {
      // Stesso numero "vero", non pre-diviso per `SKIP_TIME_SCALE` — vedi il
      // commento gemello in `skipToEnd`: è l'accelerazione ambiente a farlo
      // scattare più presto da sola, dividerlo qui comprimerebbe due volte.
      gsap.globalTimeline.timeScale(SKIP_TIME_SCALE);
      skipTimerRef.current = gsap.delayedCall(exitStartAt - currentTime, () => {
        gsap.globalTimeline.timeScale(1);
        skipTimerRef.current = null;
      });
    }
    // Se la coreografia è già in corso (o il quadro non ne ha una), niente
    // da accelerare: si lascia proseguire a ritmo naturale, il checkpoint
    // armato sopra farà il resto quando la timeline lo raggiunge da sola.
  }, [resume, resetManualOverrides, jumpToNextCheckpointNow]);

  // Indietro (L1): resta un salto secco (`.seek()` istantaneo), a
  // differenza di `advance()` — rifare la coreografia di dissolvenza anche
  // all'indietro è un lavoro in più per un tasto che serve più che altro a
  // "torna indietro se ho sbagliato/voglio rivedere", non a essere un
  // momento coreografato.
  const back = useCallback(() => goToIndex(activeIndex - 1), [goToIndex, activeIndex]);

  // "Rivedi" (solo sul quadro finale, vedi GtaTableau): torna al primo
  // quadro esattamente come farebbe `back()` ripetuto fino in fondo — un
  // `goToIndex(0)`, niente di più. Non tocca `autoplayEnabled` di proposito:
  // la prima visione si ferma già ai checkpoint se l'automatico è spento
  // (comportamento di default), quindi "rivedi" deve comportarsi allo
  // stesso modo, non improvvisamente scorrere da sola — se l'utente vuole
  // l'automatico lo riaccende lui dalla barra, come la prima volta.
  const rewatch = useCallback(() => goToIndex(0), [goToIndex]);

  // "Salta tutto", in due tempi — non più un salto secco: la prima
  // pressione si assicura che si VEDA (e si SENTA) per davvero l'uscita del
  // quadro corrente (motosega/dash/ascia/esplosione/petali), poi atterra
  // dritta su GTA; una seconda pressione mentre la prima è ancora in corso
  // annulla e salta subito, per chi non vuole aspettare nemmeno quella.
  //
  // Stesso identico meccanismo di `advance()` sopra (`checkpointOverrideRef`
  // + compressione di `gsap.globalTimeline`, per la stessa ragione: il
  // timer interno di ogni quadro conta tempo reale, non posizione della
  // timeline) — qui la richiesta armata è `'skipToEnd'` invece di
  // `'continue'`, e il checkpoint che la consuma (vedi l'effetto di
  // costruzione sopra) salta all'ultimo quadro invece di lasciar proseguire.
  // Non c'è più un secondo `gsap.delayedCall` per l'attesa a ritmo naturale
  // dopo la compressione: quel tratto lo copre già il resto della timeline
  // principale, che nel frattempo scorre da sola verso il suo checkpoint.
  const skipToEnd = useCallback(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;

    // Seconda pressione (di QUESTO pulsante o di "Avanti": un solo
    // interruttore condiviso, vedi `CheckpointOverride`) — annulla la
    // richiesta pendente e salta subito.
    if (checkpointOverrideRef.current) {
      checkpointOverrideRef.current = null;
      resetManualOverrides();
      goToIndex(SEQUENCE.length - 1);
      return;
    }

    resetManualOverrides();

    const index = activeIndexRef.current;
    const checkpoint = checkpointsRef.current.find((c) => c.index === index);
    if (!checkpoint) {
      // Ultimo quadro (GTA, che non ne registra uno) o quadro non trovato:
      // niente da aspettare, stesso salto secco di sempre.
      goToIndex(SEQUENCE.length - 1);
      return;
    }

    if (timeline.paused()) {
      timeline.play();
      setIsTicking(true);
    }

    const id = SEQUENCE[index];
    const exitDuration = EXIT_DURATIONS[id] ?? 0;
    const exitAt = Math.max(0, checkpoint.at - exitDuration);
    const currentTime = timeline.time();

    checkpointOverrideRef.current = 'skipToEnd';

    if (currentTime < exitAt) {
      // `gsap.delayedCall(N, fn)` conta N secondi di tempo della TIMELINE a
      // cui appartiene (qui `gsap.globalTimeline`, appena accelerata) — a
      // `timeScale` 6 quei secondi passano già 6 volte più in fretta in
      // tempo REALE da soli. Passare `exitAt - currentTime` diviso ANCHE a
      // mano per `SKIP_TIME_SCALE` qui sotto comprimerebbe due volte lo
      // stesso tratto (bug reale, scovato dal vivo: la timeline principale
      // avanzava normalmente, ma questo cronometro scattava ben prima che
      // avesse raggiunto `exitAt`) — il numero giusto è quello "vero", non
      // pre-diviso: è l'accelerazione ambiente a farlo scattare 6 volte
      // più presto da sola.
      gsap.globalTimeline.timeScale(SKIP_TIME_SCALE);
      skipTimerRef.current = gsap.delayedCall(exitAt - currentTime, () => {
        gsap.globalTimeline.timeScale(1);
        skipTimerRef.current = null;
      });
    }
    // La coreografia (già in corso, già finita, o appena raggiunta dal
    // cronometro sopra) prosegue/finisce a ritmo naturale: il checkpoint
    // già presente sulla timeline la aspetterà e, trovando `'skipToEnd'`
    // armato, salterà da solo a GTA.
  }, [goToIndex, resetManualOverrides]);

  // Interruttore di riproduzione automatica (tasto d'interazione/spazio):
  // accenderlo riprende subito la timeline se è ferma su un checkpoint;
  // spegnerlo NON interrompe un quadro a metà, lascia che arrivi al
  // proprio checkpoint — che lì lo fermerà da solo (vedi il `.call()` nel
  // `forEach` sopra).
  const toggleAutoplay = useCallback(() => setAutoplayEnabled((value) => !value), []);
  const toggleControls = useCallback(() => setControlsToggleSignal((value) => value + 1), []);

  // "Ferma tutto": ferma insieme OGNI movimento (non solo la dissolvenza fra
  // quadri — la coreografia d'uscita già scorre da sola, non è gated dai
  // checkpoint) e lo stinger musicale in corso (`manuallyPaused` passato a
  // `useBirthdayMusic`), in QUALSIASI istante. Ferma DUE cose, non una:
  // `timeline` (così `timeline.paused()`, letto altrove per decidere cosa
  // fare, resta corretto) E `gsap.globalTimeline` (così si ferma insieme
  // ANCHE il cronometro indipendente di uno "Salta tutto" nel frattempo in
  // corso, incluso il tratto accelerato — vedi `skipToEnd` — e il timer
  // interno di un quadro a metà della propria coreografia, nessuno dei due
  // è figlio di `timeline` e un suo solo `.pause()` non li tocca).
  //
  // Ripremuto, riprende esattamente da dove si era fermato — non un
  // `.play()` incondizionato: se la timeline era già ferma a un checkpoint
  // PER CONTO SUO (in attesa dell'utente, non per "ferma tutto"), riattivare
  // non deve farla ripartire da sola al posto dell'utente.
  const toggleStopAll = useCallback(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    setManuallyPaused((value) => {
      const next = !value;
      if (next) {
        wasTickingBeforeStopRef.current = !timeline.paused();
        timeline.pause();
        gsap.globalTimeline.pause();
        setIsTicking(false);
      } else if (wasTickingBeforeStopRef.current) {
        timeline.play();
        gsap.globalTimeline.play();
        setIsTicking(true);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (autoplayEnabled) {
      resetManualOverrides();
      resume();
    }
  }, [autoplayEnabled, resume, resetManualOverrides]);

  useGamepadNavigation(
    {
      onBack: back,
      onAdvance: advance,
      onInteract: toggleAutoplay,
      onToggleControls: toggleControls,
      onAnyInput: () => setInputMethod('gamepad')
    },
    { enabled: true }
  );

  // Scorciatoie da tastiera, oltre ai pulsanti e al controller: frecce per
  // avanti/indietro, spazio per l'automatico, Fine per saltare tutto.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      setInputMethod('keyboard');
      if (event.key === 'ArrowRight') {
        advance();
      } else if (event.key === 'ArrowLeft') {
        back();
      } else if (event.key === ' ' || event.code === 'Space') {
        // Altrimenti la pagina scorre in basso sulla pressione di spazio.
        event.preventDefault();
        toggleAutoplay();
      } else if (event.key === 'End') {
        skipToEnd();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [advance, back, toggleAutoplay, skipToEnd, setInputMethod]);

  return (
    <div className={`${styles.root} ${isTicking ? '' : styles.paused}`} ref={rootRef}>
      {SEQUENCE.map((id, index) => (
        <div
          key={id}
          className={styles.tableau}
          ref={(node) => {
            tableauRefs.current[index] = node;
          }}
        >
          {renderTableau(id, activeIndex === index, exitingIndex === index, rewatch)}
        </div>
      ))}

      {/* Compare ogni volta che la timeline si ferma a un checkpoint di
          fine quadro (mai sull'ultimo: GTA non ne registra uno, vedi il
          `forEach` sopra) — icona del tasto vero al posto della parola,
          stessa sagoma joystick/tastiera di `controlIcons.tsx`: qui
          collassata sulle due sole varianti che il testo distingueva già
          (joystick oppure tutto il resto), non le tre di `inputMethod`. */}
      {!isTicking && (
        <div className={styles.pauseHint}>
          <div className={styles.pauseHintPanel}>
            <span className={styles.pauseHintLabel}>Pausa</span>
            <p className={styles.pauseHintText}>
              <span className={styles.pauseHintIcon}>
                {inputMethod === 'gamepad' ? <GamepadShoulderIcon label="R1" /> : <KeyArrowIcon direction="right" />}
              </span>
              per continuare, o attiva l’automatico con
              <span className={styles.pauseHintIcon}>
                {inputMethod === 'gamepad' ? <GamepadCrossIcon /> : <KeySpaceIcon />}
              </span>
            </p>
          </div>
        </div>
      )}

      <BirthdayControls
        autoplayEnabled={autoplayEnabled}
        stopped={manuallyPaused}
        activeIndex={activeIndex}
        total={SEQUENCE.length}
        progressFillRef={progressFillRef}
        inputMethod={inputMethod}
        onPointerActivity={() => setInputMethod('pointer')}
        controlsToggleSignal={controlsToggleSignal}
        onToggleAutoplay={toggleAutoplay}
        onToggleStopAll={toggleStopAll}
        onBack={back}
        onAdvance={advance}
        onSkipToEnd={skipToEnd}
      />
    </div>
  );
}
