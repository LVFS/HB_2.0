import { useEffect, useRef, useState, type FocusEvent, type MouseEvent, type RefObject } from 'react';
import ui from '@/styles/ui.module.css';
import type { InputMethod } from '@/hooks/useInputMethod';
import {
  AdvanceHintIcon,
  BackHintIcon,
  GamepadOptionsIcon,
  InteractHintIcon,
  SkipHintIcon
} from './controlIcons';
import styles from './BirthdayControls.module.css';

/** Dopo quanto d'inattività (mouse/tocco/tastiera) i controlli si
 * nascondono da soli, stesso principio di un player video. */
const HIDE_AFTER_MS = 2600;

interface BirthdayControlsProps {
  /** Riproduzione automatica accesa/spenta — non "sta scorrendo in questo
   * istante" (quello lo decide `advance()` da solo, checkpoint per
   * checkpoint), ma "deve continuare da sola dopo ogni checkpoint?". */
  autoplayEnabled: boolean;
  /** "Ferma tutto" — diverso da un checkpoint normale (che ferma solo la
   * dissolvenza fra quadri): fermo ovunque ci si trovi, musica compresa.
   * Non va confuso con `autoplayEnabled`: sono due interruttori distinti,
   * per questo hanno icone diverse (vedi `StopIcon`). */
  stopped: boolean;
  activeIndex: number;
  total: number;
  /** La barra di avanzamento non è pilotata da stato React: `BirthdayScene`
   * scrive `width` direttamente qui da un `onUpdate` GSAP (stessa tecnica
   * dei contatori GTA) — inutile ridisegnare l'albero 60 volte al secondo
   * per un progresso, tanto più per ognuno dei sei quadri. */
  progressFillRef: RefObject<HTMLDivElement>;
  /** L'ULTIMO metodo d'input usato (vedi `useInputMethod`) — sceglie quale
   * icona di scorciatoia affiancare a ogni pulsante (nessuna con il mouse,
   * per non appesantire chi guarda da schermo touch) e se disattivare
   * l'auto-nascondi (con un controller in mano non c'è un mouse che li fa
   * ricomparire). */
  inputMethod: InputMethod;
  /** Segnala a `BirthdayScene` che l'ultima interazione è arrivata da
   * mouse/tocco — chiamato dallo stesso `onPointerDown` che già ferma la
   * propagazione qui sotto, non un listener in più. */
  onPointerActivity: () => void;
  /** Contatore incrementato dal tasto Start/Options del controller — ogni
   * cambio (non il valore in sé) alterna mostra/nascondi a comando, stesso
   * principio di `skipIntroToken` nel menu principale. */
  controlsToggleSignal: number;
  onToggleAutoplay: () => void;
  onToggleStopAll: () => void;
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

/** Un quadrato pieno, non play/pausa: "ferma tutto" è concettualmente
 * diverso da AUTO (che decide solo cosa succede DOPO ogni checkpoint) — a
 * colpo d'occhio le due icone non devono confondersi. */
function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />
    </svg>
  );
}

/** Doppia freccia "avanti veloce": l'unica azione della barra meno ovvia
 * delle altre (le altre ripetono un gesto già mappato su un tasto fisico),
 * per questo tiene anche l'etichetta testuale accanto. */
function FastForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <path d="M3 6l7.5 6L3 18z" fill="currentColor" />
      <path d="M12.5 6l7.5 6-7.5 6z" fill="currentColor" />
    </svg>
  );
}

/** Suffisso "(L1)"/"(←)" per il tooltip — non per l'`aria-label`, che resta
 * generico apposta: chi usa uno screen reader naviga a Tab/Invio, non ha
 * bisogno di un rimando a un controller che magari non ha. */
function shortcutHint(method: InputMethod, gamepad: string, keyboard: string) {
  const raw = method === 'gamepad' ? gamepad : method === 'keyboard' ? keyboard : '';
  return raw ? ` (${raw})` : '';
}

/** Una fila di puntini, uno per quadro — la stessa convenzione dei menu di
 * livello/capitolo di molti giochi. Puro arricchimento visivo: il testo
 * "Scena X di 6" accanto porta già la stessa informazione in modo
 * accessibile, per questo la fila è marcata decorativa. */
function SceneDots({ total, activeIndex }: { total: number; activeIndex: number }) {
  return (
    <div className={styles.dots} aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={`${styles.dot} ${index === activeIndex ? styles.dotActive : ''}`} />
      ))}
    </div>
  );
}

/**
 * Barra di controllo della sequenza — stesso linguaggio visivo/pattern di
 * `SettingsBar.tsx` (stopPropagation sul contenitore, per non far scattare
 * altro mentre si interagisce qui, incluse le frecce di tastiera che
 * spostano il focus tra i pulsanti; pannello `ui.panelCompact`, lo stesso
 * "vetro" HUD del resto del gioco, non più una fila di pulsanti a mezz'aria
 * senza sfondo). Nascosta di default e mostrata al movimento di mouse/
 * tocco/tastiera, come i controlli di un player video: riappare subito
 * (così si scopre che esiste) e si nasconde da sola dopo un po' di
 * inattività, per non appesantire visivamente una sequenza pensata per
 * essere spettacolare.
 *
 * Sostituisce il vecchio gesto "un tocco qualsiasi salta tutto": con dei
 * controlli avanti/indietro veri, quel gesto renderebbe scomodo rivedere
 * un quadro (un tocco fuori dai controlli e si salta tutto per sbaglio).
 */
export function BirthdayControls({
  autoplayEnabled,
  stopped,
  activeIndex,
  total,
  progressFillRef,
  inputMethod,
  onPointerActivity,
  controlsToggleSignal,
  onToggleAutoplay,
  onToggleStopAll,
  onBack,
  onAdvance,
  onSkipToEnd
}: BirthdayControlsProps) {
  const [visible, setVisible] = useState(true);
  const hideTimeoutRef = useRef<number | null>(null);

  // Tooltip: un solo elemento condiviso, posizionato via JS invece che
  // annidato dentro `.panel` (CSS puro, come al primo tentativo). `.panel`
  // (vedi `ui.module.css`) porta sia `clip-path` sia `filter`: il primo
  // ritaglia TUTTO ciò che viene disegnato al suo interno alla sagoma
  // smussata del pannello, il secondo crea un containing block anche per
  // eventuali discendenti `position: fixed` — un tooltip innestato lì
  // dentro e fatto galleggiare sopra il pulsante (`bottom: 100%`) restava
  // tagliato al bordo del pannello, comunque lo si posizionasse in CSS. Qui
  // invece il tooltip è un fratello di `.panel`, dentro `.container` (che
  // non ha né clip-path né filter): l'unico prezzo è calcolare a mano, con
  // `getBoundingClientRect()`, dove piazzarlo rispetto al pulsante sotto il
  // cursore/fuoco — `left` è relativo a `.container`, che essendo già
  // `position: absolute` è il containing block giusto per un figlio
  // assoluto.
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ label: string; left: number } | null>(null);

  function showTooltip(label: string) {
    return (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;
      const targetRect = event.currentTarget.getBoundingClientRect();
      setTooltip({ label, left: targetRect.left + targetRect.width / 2 - containerRect.left });
    };
  }

  function hideTooltip() {
    setTooltip(null);
  }

  // Con un joystick come ultimo metodo rilevato, i controlli restano
  // visibili finché non li si nasconde a comando (vedi l'effetto sotto):
  // mouse/tocco/tastiera possono ancora rivelarli, e passare a uno di loro
  // riattiva anche l'auto-nascondi (a differenza di `useGamepadDetected`,
  // `inputMethod` torna indietro: vedi il suo commento).
  useEffect(() => {
    const reveal = () => {
      setVisible(true);
      if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
      if (inputMethod === 'gamepad') return;
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
  }, [inputMethod]);

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
    <>
      <div
        ref={containerRef}
        className={`${styles.container} ${visible ? styles.visible : ''}`}
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerActivity();
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className={styles.panel}>
          <div className={styles.track}>
            <div ref={progressFillRef} className={styles.fill} />
          </div>

          <div className={styles.row}>
            {/* Il comando più "generale" di tutti — ferma insieme animazione
                e musica, ovunque ci si trovi — per questo sta a parte, prima
                dei tre che navigano la sequenza, non in mezzo a loro. */}
            <button
              type="button"
              className={`${ui.secondary} ${styles.button} ${styles.stopButton}`}
              onClick={onToggleStopAll}
              onMouseEnter={showTooltip(stopped ? 'Riprendi' : 'Ferma tutto')}
              onMouseLeave={hideTooltip}
              onFocus={showTooltip(stopped ? 'Riprendi' : 'Ferma tutto')}
              onBlur={hideTooltip}
              aria-label={stopped ? 'Riprendi' : 'Ferma tutto'}
              aria-pressed={stopped}
            >
              <StopIcon />
            </button>

            <button
              type="button"
              className={`${ui.secondary} ${styles.button}`}
              onClick={onBack}
              onMouseEnter={showTooltip(`Quadro precedente${shortcutHint(inputMethod, 'L1', '←')}`)}
              onMouseLeave={hideTooltip}
              onFocus={showTooltip(`Quadro precedente${shortcutHint(inputMethod, 'L1', '←')}`)}
              onBlur={hideTooltip}
              disabled={isFirst}
              aria-label="Quadro precedente"
            >
              <PrevIcon />
              <span className={styles.hintIcon}>
                <BackHintIcon method={inputMethod} />
              </span>
            </button>

            <button
              type="button"
              className={`${ui.secondary} ${styles.button}`}
              onClick={onToggleAutoplay}
              onMouseEnter={showTooltip(
                `${autoplayEnabled ? 'Disattiva' : 'Attiva'} riproduzione automatica${shortcutHint(inputMethod, '✕', 'Spazio')}`
              )}
              onMouseLeave={hideTooltip}
              onFocus={showTooltip(
                `${autoplayEnabled ? 'Disattiva' : 'Attiva'} riproduzione automatica${shortcutHint(inputMethod, '✕', 'Spazio')}`
              )}
              onBlur={hideTooltip}
              aria-label={autoplayEnabled ? 'Disattiva riproduzione automatica' : 'Attiva riproduzione automatica'}
              aria-pressed={autoplayEnabled}
            >
              {autoplayEnabled ? <PauseIcon /> : <PlayIcon />}
              <span className={styles.hintIcon}>
                <InteractHintIcon method={inputMethod} />
              </span>
            </button>

            <button
              type="button"
              className={`${ui.secondary} ${styles.button}`}
              onClick={onAdvance}
              onMouseEnter={showTooltip(`Quadro successivo${shortcutHint(inputMethod, 'R1', '→')}`)}
              onMouseLeave={hideTooltip}
              onFocus={showTooltip(`Quadro successivo${shortcutHint(inputMethod, 'R1', '→')}`)}
              onBlur={hideTooltip}
              disabled={isLast}
              aria-label="Quadro successivo"
            >
              <NextIcon />
              <span className={styles.hintIcon}>
                <AdvanceHintIcon method={inputMethod} />
              </span>
            </button>

            <div className={styles.counterGroup}>
              <span className={styles.counter}>
                Scena {activeIndex + 1} di {total}
              </span>
              <SceneDots total={total} activeIndex={activeIndex} />
            </div>

            <button
              type="button"
              className={`${ui.secondary} ${styles.button} ${styles.skipButton}`}
              onClick={onSkipToEnd}
              onMouseEnter={showTooltip(`Salta tutto${shortcutHint(inputMethod, '', 'Fine')}`)}
              onMouseLeave={hideTooltip}
              onFocus={showTooltip(`Salta tutto${shortcutHint(inputMethod, '', 'Fine')}`)}
              onBlur={hideTooltip}
              disabled={isLast}
            >
              <FastForwardIcon />
              <span className={styles.skipLabel}>Salta tutto</span>
              <span className={styles.hintIcon}>
                <SkipHintIcon method={inputMethod} />
              </span>
            </button>
          </div>
        </div>

        {tooltip && (
          <span className={`${ui.pill} ${styles.tooltip}`} role="tooltip" style={{ left: tooltip.left }}>
            {tooltip.label}
          </span>
        )}
      </div>

      {/* Unica via per sapere "come si nasconde/mostra la barra" quando si
          gioca da joystick: un tocco sul touchpad o un movimento del mouse
          la rivelano da soli per tutti gli altri metodi, ma un pad non
          genera nessuno dei due — senza questo promemoria, chi ha nascosto
          la barra con Options non avrebbe modo di ricordarsi come farla
          ricomparire. */}
      {!visible && inputMethod === 'gamepad' && (
        <div className={`${ui.pill} ${styles.hiddenHint}`} aria-hidden="true">
          <GamepadOptionsIcon />
          <span>Mostra comandi</span>
        </div>
      )}
    </>
  );
}
