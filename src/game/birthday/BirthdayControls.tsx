import { useEffect, useRef, useState, type RefObject } from 'react';
import ui from '@/styles/ui.module.css';
import styles from './BirthdayControls.module.css';

/** Dopo quanto d'inattività (mouse/tocco/tastiera) i controlli si
 * nascondono da soli, stesso principio di un player video. */
const HIDE_AFTER_MS = 2600;

interface BirthdayControlsProps {
  /** Riproduzione automatica accesa/spenta — non "sta scorrendo in questo
   * istante" (quello lo decide `advance()` da solo, checkpoint per
   * checkpoint), ma "deve continuare da sola dopo ogni checkpoint?". */
  autoplayEnabled: boolean;
  activeIndex: number;
  total: number;
  /** La barra di avanzamento non è pilotata da stato React: `BirthdayScene`
   * scrive `width` direttamente qui da un `onUpdate` GSAP (stessa tecnica
   * dei contatori GTA) — inutile ridisegnare l'albero 60 volte al secondo
   * per un progresso, tanto più per ognuno dei sei quadri. */
  progressFillRef: RefObject<HTMLDivElement>;
  /** Vero dalla prima pressione rilevata su un controller — mostra le
   * etichette L1/R1/AUTO solo da lì in poi, e disattiva l'auto-nascondi
   * (con un controller in mano non c'è un mouse che li fa ricomparire). */
  gamepadDetected: boolean;
  /** Contatore incrementato dal tasto Start/Options del controller — ogni
   * cambio (non il valore in sé) alterna mostra/nascondi a comando, stesso
   * principio di `skipIntroToken` nel menu principale. */
  controlsToggleSignal: number;
  onToggleAutoplay: () => void;
  onBack: () => void;
  onAdvance: () => void;
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
  autoplayEnabled,
  activeIndex,
  total,
  progressFillRef,
  gamepadDetected,
  controlsToggleSignal,
  onToggleAutoplay,
  onBack,
  onAdvance,
  onSkipToEnd
}: BirthdayControlsProps) {
  const [visible, setVisible] = useState(true);
  const hideTimeoutRef = useRef<number | null>(null);

  // Con un controller rilevato, i controlli restano visibili finché non li
  // si nasconde a comando (vedi l'effetto sotto): mouse/tocco/tastiera
  // possono ancora rivelarli, ma non si programma più l'auto-nascondi.
  useEffect(() => {
    const reveal = () => {
      setVisible(true);
      if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
      if (gamepadDetected) return;
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
  }, [gamepadDetected]);

  // Tasto Start/Options del controller (vedi useGamepadNavigation): alterna
  // mostra/nascondi a comando, indipendentemente dall'auto-nascondi sopra.
  // `controlsToggleSignal` è un contatore, non un booleano — confrontato
  // con l'ultimo valore visto invece di essere letto come "vero/falso",
  // altrimenti due pressioni con lo stesso "valore logico" non
  // scatterebbero l'effetto una seconda volta (stesso principio di
  // `skipIntroToken` nel menu principale).
  const toggleSignalRef = useRef(controlsToggleSignal);
  useEffect(() => {
    if (controlsToggleSignal === toggleSignalRef.current) return;
    toggleSignalRef.current = controlsToggleSignal;
    if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
    setVisible((current) => !current);
  }, [controlsToggleSignal]);

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
          onClick={onBack}
          disabled={isFirst}
          aria-label="Quadro precedente (L1)"
        >
          <PrevIcon />
          {gamepadDetected && <span className={styles.buttonLabel}>L1</span>}
        </button>
        <button
          type="button"
          className={`${ui.secondary} ${styles.button}`}
          onClick={onToggleAutoplay}
          aria-label={autoplayEnabled ? 'Disattiva riproduzione automatica' : 'Attiva riproduzione automatica'}
          aria-pressed={autoplayEnabled}
        >
          {autoplayEnabled ? <PauseIcon /> : <PlayIcon />}
          {gamepadDetected && <span className={styles.buttonLabel}>AUTO</span>}
        </button>
        <button
          type="button"
          className={`${ui.secondary} ${styles.button}`}
          onClick={onAdvance}
          disabled={isLast}
          aria-label="Quadro successivo (R1)"
        >
          <NextIcon />
          {gamepadDetected && <span className={styles.buttonLabel}>R1</span>}
        </button>

        <span className={styles.counter}>
          Scena {activeIndex + 1} di {total}
        </span>

        <button type="button" className={ui.secondary} onClick={onSkipToEnd} disabled={isLast}>
          Salta tutto
        </button>
      </div>
    </div>
  );
}
