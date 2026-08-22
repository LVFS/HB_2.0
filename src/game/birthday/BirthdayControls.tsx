import { useEffect, useRef, useState, type RefObject } from 'react';
import ui from '@/styles/ui.module.css';
import styles from './BirthdayControls.module.css';

/** Dopo quanto d'inattività (mouse/tocco/tastiera) i controlli si
 * nascondono da soli, stesso principio di un player video. */
const HIDE_AFTER_MS = 2600;

interface BirthdayControlsProps {
  playing: boolean;
  activeIndex: number;
  total: number;
  /** La barra di avanzamento non è pilotata da stato React: `BirthdayScene`
   * scrive `width` direttamente qui da un `onUpdate` GSAP (stessa tecnica
   * dei contatori GTA) — inutile ridisegnare l'albero 60 volte al secondo
   * per un progresso, tanto più per ognuno dei sei quadri. */
  progressFillRef: RefObject<HTMLDivElement>;
  onTogglePlaying: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSkipToEnd: () => void;
}

function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <path d="M7 5v14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M18 6 8 12l10 6z" fill="currentColor" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <path d="M17 5v14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M6 6l10 6-10 6z" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <path d="M8 5l11 7-11 7z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
    </svg>
  );
}

/**
 * Barra di controllo della sequenza — stesso linguaggio visivo/pattern di
 * `SettingsBar.tsx` (stopPropagation sul contenitore, per non far scattare
 * altro mentre si interagisce qui, incluse le frecce di tastiera che
 * spostano il focus tra i pulsanti). Nascosta di default e mostrata al
 * movimento di mouse/tocco/tastiera, come i controlli di un player video:
 * riappare subito (così si scopre che esiste) e si nasconde da sola dopo
 * un po' di inattività, per non appesantire visivamente una sequenza
 * pensata per essere spettacolare.
 *
 * Sostituisce il vecchio gesto "un tocco qualsiasi salta tutto": con dei
 * controlli avanti/indietro veri, quel gesto renderebbe scomodo rivedere
 * un quadro (un tocco fuori dai controlli e si salta tutto per sbaglio).
 */
export function BirthdayControls({
  playing,
  activeIndex,
  total,
  progressFillRef,
  onTogglePlaying,
  onPrev,
  onNext,
  onSkipToEnd
}: BirthdayControlsProps) {
  const [visible, setVisible] = useState(true);
  const hideTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const reveal = () => {
      setVisible(true);
      if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = window.setTimeout(() => setVisible(false), HIDE_AFTER_MS);
    };
    reveal();
    window.addEventListener('pointermove', reveal);
    window.addEventListener('touchstart', reveal);
    window.addEventListener('keydown', reveal);
    return () => {
      window.removeEventListener('pointermove', reveal);
      window.removeEventListener('touchstart', reveal);
      window.removeEventListener('keydown', reveal);
      if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const isFirst = activeIndex === 0;
  const isLast = activeIndex === total - 1;

  return (
    <div
      className={`${styles.container} ${visible ? styles.visible : ''}`}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className={styles.track}>
        <div ref={progressFillRef} className={styles.fill} />
      </div>

      <div className={styles.row}>
        <button
          type="button"
          className={`${ui.secondary} ${styles.button}`}
          onClick={onPrev}
          disabled={isFirst}
          aria-label="Quadro precedente"
        >
          <PrevIcon />
        </button>
        <button
          type="button"
          className={`${ui.secondary} ${styles.button}`}
          onClick={onTogglePlaying}
          aria-label={playing ? 'Pausa' : 'Riprendi'}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          className={`${ui.secondary} ${styles.button}`}
          onClick={onNext}
          disabled={isLast}
          aria-label="Quadro successivo"
        >
          <NextIcon />
        </button>

        <span className={styles.counter}>
          Quadro {activeIndex + 1} di {total}
        </span>

        <button type="button" className={ui.secondary} onClick={onSkipToEnd} disabled={isLast}>
          Salta tutto
        </button>
      </div>
    </div>
  );
}
