import type { InputMethod } from '@/hooks/useInputMethod';

/**
 * Icone del METODO D'INPUT corrente (tastiera/joystick), non delle azioni
 * (quelle — Prev/Next/Play/Pausa/Stop — restano in `BirthdayControls.tsx`,
 * sono la sagoma della FUNZIONE, non del tasto fisico che la richiama).
 * Usate sia dalla barra comandi sia dal messaggio "In pausa" (vedi
 * `BirthdayScene.tsx`), da qui il file a sé.
 *
 * Sagoma sì, marchio no — stessa regola già seguita per ogni altra icona di
 * questo branch (lanterna, runa, motosega, Cavaliere...): ✕/○/□/△ sono di
 * per sé forme geometriche semplici, nessun asset Sony scaricato o
 * ricalcato. Niente dei quattro colori ufficiali PlayStation nemmeno: un
 * unico colore (`currentColor`, impostato da chi le usa — di norma
 * `--text-dim`) le intona al resto dell'interfaccia invece di stonarci con
 * una palette estranea.
 */

function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Tasto dorsale (L1/R1): un piccolo trapezio arrotondato visto dall'alto,
 * con l'etichetta incisa dentro — la stessa sagoma di un vero pad, non solo
 * il testo scritto come oggi. */
export function GamepadShoulderIcon({ label }: { label: 'L1' | 'R1' }) {
  return (
    <IconBase>
      <path
        d="M4 14.5 Q4 8 8.5 6.8 L15.5 6.8 Q20 8 20 14.5 L20 15.5 Q20 17.5 18 17.5 L6 17.5 Q4 17.5 4 15.5 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text
        x="12"
        y="14"
        textAnchor="middle"
        fontSize="6.5"
        fontFamily="var(--font-display)"
        fontWeight="700"
        fill="currentColor"
      >
        {label}
      </text>
    </IconBase>
  );
}

/** Tasto Croce: un cerchio con una croce dentro — la forma, non il marchio. */
export function GamepadCrossIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </IconBase>
  );
}

/** Tasto Options: una pillola con due trattini corti — il glifo generico
 * "menu/opzioni" che PlayStation e Xbox usano entrambi più o meno allo
 * stesso modo, riconoscibile a prescindere dal pad collegato. */
export function GamepadOptionsIcon() {
  return (
    <IconBase>
      <rect x="6" y="9" width="12" height="6" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9" y1="12" x2="10.6" y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="13.4" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </IconBase>
  );
}

/** Sagoma comune di un tasto di tastiera visto da sopra — un rettangolo
 * smussato, con dentro il glifo che cambia in base al tasto. */
function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <IconBase>
      <rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {children}
    </IconBase>
  );
}

export function KeyArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  const d = direction === 'left' ? 'M14 8.5l-4 3.5 4 3.5' : 'M10 8.5l4 3.5-4 3.5';
  return (
    <KeyCap>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </KeyCap>
  );
}

/** Tasto Spazio: una sola barra orizzontale piena, come il tasto vero. */
export function KeySpaceIcon() {
  return (
    <KeyCap>
      <rect x="6.5" y="13" width="11" height="2.2" rx="1.1" fill="currentColor" />
    </KeyCap>
  );
}

/** Tasto Fine: una freccia che corre fino a un muro — "vai in fondo",
 * stessa idea visiva del "salta avanti veloce" ma dentro una sagoma di
 * tasto invece che come icona di pulsante a sé. */
export function KeyEndIcon() {
  return (
    <KeyCap>
      <path
        d="M8.5 8.5l3.5 3.5-3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="15.5" y1="7.5" x2="15.5" y2="16.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </KeyCap>
  );
}

/**
 * Componenti "per azione": scelgono da sole la sagoma giusta in base
 * all'ultimo metodo d'input rilevato (`useInputMethod`), `null` per
 * `'pointer'` — con mouse/touch resta solo l'icona funzionale già presente
 * (Prev/Next/Play-Pausa...), senza affiancarci un'icona in più.
 */
export function BackHintIcon({ method }: { method: InputMethod }) {
  if (method === 'gamepad') return <GamepadShoulderIcon label="L1" />;
  if (method === 'keyboard') return <KeyArrowIcon direction="left" />;
  return null;
}

export function AdvanceHintIcon({ method }: { method: InputMethod }) {
  if (method === 'gamepad') return <GamepadShoulderIcon label="R1" />;
  if (method === 'keyboard') return <KeyArrowIcon direction="right" />;
  return null;
}

export function InteractHintIcon({ method }: { method: InputMethod }) {
  if (method === 'gamepad') return <GamepadCrossIcon />;
  if (method === 'keyboard') return <KeySpaceIcon />;
  return null;
}

/** Solo da joystick: "Salta tutto" non ha una mappatura sul pad (vedi
 * `GAMEPAD_BUTTONS` in `useGamepadNavigation.ts`), solo la scorciatoia
 * Fine da tastiera. */
export function SkipHintIcon({ method }: { method: InputMethod }) {
  return method === 'keyboard' ? <KeyEndIcon /> : null;
}
