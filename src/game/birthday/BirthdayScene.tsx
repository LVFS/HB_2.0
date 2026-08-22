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
import { SEQUENCE, TIMINGS, type TableauId } from './birthdayConfig';
import { BirthdayControls } from './BirthdayControls';
import { BloodborneTableau } from './tableaux/BloodborneTableau';
import { GodOfWarTableau } from './tableaux/GodOfWarTableau';
import { HollowKnightTableau } from './tableaux/HollowKnightTableau';
import { ExpeditionTableau } from './tableaux/ExpeditionTableau';
import { ResidentEvilTableau } from './tableaux/ResidentEvilTableau';
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

function renderTableau(id: TableauId, active: boolean) {
  switch (id) {
    case 'bloodborne':
      return <BloodborneTableau />;
    case 'godOfWar':
      return <GodOfWarTableau active={active} />;
    case 'hollowKnight':
      return <HollowKnightTableau active={active} />;
    case 'expedition':
      return <ExpeditionTableau active={active} />;
    case 'residentEvil':
      return <ResidentEvilTableau active={active} />;
    case 'gta':
      return <GtaTableau active={active} />;
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
export function BirthdayScene() {
  const rootRef = useRef<HTMLDivElement>(null);
  const tableauRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

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

  // Un accenno musicale per quadro, in crossfade: l'hook reagisce da solo
  // al cambio di `SEQUENCE[activeIndex]`, incluso un salto avanti/indietro
  // manuale — non gli importa COME si è arrivati a un quadro, solo QUALE è.
  useBirthdayMusic(SEQUENCE[activeIndex]);

  useEffect(() => {
    // Istante di inizio di ogni quadro (lo stesso `at` già usato per
    // posizionare `.call()`/`.fromTo()` sulla timeline), salvato invece di
    // essere buttato: serve sotto, nell'`onUpdate`, per calcolare quanto è
    // avanzato il quadro ATTUALE (non l'intera timeline) in percentuale.
    const tableauStarts: number[] = [];

    const timeline = gsap.timeline({
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
      timeline.call(() => setActiveIndex(index), undefined, at);
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

      timeline.to(element, { autoAlpha: 0, duration: fadeOut, ease: 'power2.in' }, outAt);
      at = outAt + fadeOut * (1 - OVERLAP);
    });

    return () => {
      timeline.kill();
      timelineRef.current = null;
    };
  }, []);

  // Play/pausa: GSAP fa il lavoro vero, questo effetto si limita a seguire
  // lo stato. Dichiarato DOPO l'effetto che costruisce la timeline apposta:
  // React esegue gli effetti nell'ordine in cui sono dichiarati, quindi al
  // mount `timelineRef.current` è già valorizzato quando questo gira.
  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    if (playing) timeline.play();
    else timeline.pause();
  }, [playing]);

  const goToIndex = useCallback((index: number) => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    const clamped = Math.min(Math.max(index, 0), SEQUENCE.length - 1);
    timeline.seek(SEQUENCE[clamped]);
    // `activeIndex` va impostato a mano: GSAP non esegue le `.call()` della
    // timeline quando si salta con `.seek()` (stesso comportamento di
    // `.progress()`), quindi senza questa riga il quadro di destinazione
    // non farebbe partire le sue animazioni interne (contatori GTA, falena,
    // glitch...).
    setActiveIndex(clamped);
  }, []);

  const goPrev = useCallback(() => goToIndex(activeIndex - 1), [goToIndex, activeIndex]);
  const goNext = useCallback(() => goToIndex(activeIndex + 1), [goToIndex, activeIndex]);
  const skipToEnd = useCallback(() => goToIndex(SEQUENCE.length - 1), [goToIndex]);
  const togglePlaying = useCallback(() => setPlaying((value) => !value), []);

  // Scorciatoie da tastiera, oltre ai pulsanti: frecce per avanti/indietro,
  // spazio per play/pausa, Fine per saltare tutto.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        goNext();
      } else if (event.key === 'ArrowLeft') {
        goPrev();
      } else if (event.key === ' ' || event.code === 'Space') {
        // Altrimenti la pagina scorre in basso sulla pressione di spazio.
        event.preventDefault();
        togglePlaying();
      } else if (event.key === 'End') {
        skipToEnd();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, togglePlaying, skipToEnd]);

  return (
    <div className={styles.root} ref={rootRef}>
      {SEQUENCE.map((id, index) => (
        <div
          key={id}
          className={styles.tableau}
          ref={(node) => {
            tableauRefs.current[index] = node;
          }}
        >
          {renderTableau(id, activeIndex === index)}
        </div>
      ))}

      <BirthdayControls
        playing={playing}
        activeIndex={activeIndex}
        total={SEQUENCE.length}
        progressFillRef={progressFillRef}
        onTogglePlaying={togglePlaying}
        onPrev={goPrev}
        onNext={goNext}
        onSkipToEnd={skipToEnd}
      />
    </div>
  );
}
