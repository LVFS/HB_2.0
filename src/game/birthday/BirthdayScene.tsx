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

import { useAnyInput } from '@/hooks/useAnyInput';
import { SEQUENCE, TIMINGS, type TableauId } from './birthdayConfig';
import { BloodborneTableau } from './tableaux/BloodborneTableau';
import { GodOfWarTableau } from './tableaux/GodOfWarTableau';
import { HollowKnightTableau } from './tableaux/HollowKnightTableau';
import { ExpeditionTableau } from './tableaux/ExpeditionTableau';
import { ResidentEvilTableau } from './tableaux/ResidentEvilTableau';
import { GtaTableau } from './tableaux/GtaTableau';
import styles from './BirthdayScene.module.css';

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

/** Dopo quanto dall'ultimo quadro comparire il suggerimento per lo skip. */
const HINT_AFTER = 1.6;

function renderTableau(id: TableauId, active: boolean) {
  switch (id) {
    case 'bloodborne':
      return <BloodborneTableau />;
    case 'godOfWar':
      return <GodOfWarTableau active={active} />;
    case 'hollowKnight':
      return <HollowKnightTableau />;
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
 */
export function BirthdayScene() {
  const tableauRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const timeline = gsap.timeline();
    timelineRef.current = timeline;

    let at = 0;
    SEQUENCE.forEach((id, index) => {
      const element = tableauRefs.current[index];
      if (!element) return;
      const { fadeIn, hold, fadeOut } = TIMINGS[id];
      const isLast = index === SEQUENCE.length - 1;

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

  // Il suggerimento per saltare non compare subito: apparire nello stesso
  // istante del primo quadro lo trasformerebbe in un invito ad andarsene.
  useEffect(() => {
    const id = window.setTimeout(() => setShowHint(true), HINT_AFTER * 1000);
    return () => window.clearTimeout(id);
  }, []);

  const handleSkip = useCallback(() => {
    const timeline = timelineRef.current;
    if (!timeline || skipped) return;

    setSkipped(true);
    // `activeIndex` va impostato a mano: GSAP non esegue le `.call()` quando
    // si salta a un punto della timeline, quindi senza questa riga l'ultimo
    // quadro comparirebbe senza far partire le sue animazioni interne.
    setActiveIndex(SEQUENCE.length - 1);
    timeline.progress(1);
  }, [skipped]);

  // Tastiera, mouse, touch e gamepad in un colpo solo: lo stesso hook che
  // gestisce "premi un tasto per iniziare" nel menu.
  useAnyInput(handleSkip, { enabled: !skipped });

  return (
    <div className={styles.root}>
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

      {/* Sull'ultimo quadro il suggerimento sparisce: non c'è più niente da
          saltare, e lasciarlo lì inviterebbe ad andarsene proprio mentre
          arriva il messaggio. */}
      {showHint && !skipped && activeIndex < SEQUENCE.length - 1 && (
        <span className={styles.hint}>Premi un tasto per saltare</span>
      )}
    </div>
  );
}
