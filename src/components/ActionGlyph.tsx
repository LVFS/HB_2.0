import { Fragment, type ReactNode } from 'react';
import { padButtonOf } from '@/input/gamepadBindings';
import { actionLabel, padTokenFor } from '@/input/glyphLabels';
import type { GameAction, PadFamily } from '@/input/inputActions';
import { glyphFamily } from '@/input/padFamily';
import { useGlyphDevice } from '@/input/useInputHooks';
import styles from './ActionGlyph.module.css';

type GlyphFamily = Exclude<PadFamily, 'generic'>;

const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Bottone frontale: cerchio con lettera (Xbox, Switch) o forma (PlayStation: ✕ ○ □ △ — sagome geometriche, nessun marchio). */
function FaceButton({ family, button }: { family: GlyphFamily; button: number }) {
  const label = actionLabel(actionOfButton(button), 'gamepad', family);
  return (
    <svg viewBox="0 0 24 24" className={styles.svg} aria-hidden="true">
      <circle cx="12" cy="12" r="10" {...STROKE} />
      {family === 'playstation' ? (
        button === 0 ? (
          <path d="M8 8l8 8M16 8l-8 8" {...STROKE} />
        ) : button === 1 ? (
          <circle cx="12" cy="12" r="4.6" {...STROKE} />
        ) : button === 2 ? (
          <rect x="7.6" y="7.6" width="8.8" height="8.8" {...STROKE} />
        ) : (
          <path d="M12 6.6l5 8.8H7z" {...STROKE} />
        )
      ) : (
        <text x="12" y="16.4" textAnchor="middle" fontSize="12" fontWeight="700" fontFamily="var(--font-display)" fill="currentColor">
          {label}
        </text>
      )}
    </svg>
  );
}

/** Dorsali e grilletti: rettangolo arrotondato con la sigla dentro. */
function Shoulder({ text }: { text: string }) {
  const width = Math.max(30, 12 + text.length * 8);
  return (
    <svg viewBox={`0 0 ${width} 24`} className={styles.svg} aria-hidden="true">
      <rect x="1.5" y="4" width={width - 3} height="16" rx="6" {...STROKE} />
      <text x={width / 2} y="16" textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="var(--font-display)" fill="currentColor">
        {text}
      </text>
    </svg>
  );
}

/** Start/Select: pillola con la sigla (o le tre linee del menu di Xbox). */
function MenuButton({ family, text }: { family: GlyphFamily; text: string }) {
  if (family === 'xbox') {
    return (
      <svg viewBox="0 0 24 24" className={styles.svg} aria-hidden="true">
        <circle cx="12" cy="12" r="10" {...STROKE} />
        <path d="M7.5 9h9M7.5 12h9M7.5 15h9" {...STROKE} />
      </svg>
    );
  }
  return <Shoulder text={text} />;
}

/** Croce direzionale / stick: una croce con il braccio dell'azione pieno. */
function Direction({ direction }: { direction: 'left' | 'right' | 'up' | 'down' }) {
  const arms = {
    up: 'M9.5 2.5h5v7h-5z',
    down: 'M9.5 14.5h5v7h-5z',
    left: 'M2.5 9.5h7v5h-7z',
    right: 'M14.5 9.5h7v5h-7z'
  };
  return (
    <svg viewBox="0 0 24 24" className={styles.svg} aria-hidden="true">
      <path d="M9.5 2.5h5v7h7v5h-7v7h-5v-7h-7v-5h7z" {...STROKE} />
      <path d={arms[direction]} fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** L'azione che usa un bottone frontale (per ritrovare la sigla della famiglia dal solo indice). */
function actionOfButton(button: number): GameAction {
  return (['jump', 'dash', 'attack', 'heal'] as const)[button] ?? 'jump';
}

interface ActionGlyphProps {
  action: GameAction;
  /** Scrive accanto all'icona anche il nome (es. «Salta»). */
  label?: ReactNode;
  /** Da tastiera, solo il testo del tasto senza il bordo (per chi lo mette già dentro una cornice, come il QTE). */
  bare?: boolean;
}

/**
 * L'icona del comando di un'azione per il dispositivo attuale (l'ULTIMO usato: cambia da sola passando da tastiera a pad;
 * l'impostazione `glyphs` può forzarlo). Controller: bottone della famiglia giusta (Xbox / PlayStation / Switch); tastiera: il tasto.
 * Se un'icona non si sa disegnare si ripiega sul tasto testuale: nessun componente dipende da file di immagini.
 */
export function ActionGlyph({ action, label, bare = false }: ActionGlyphProps) {
  const { device, family } = useGlyphDevice();
  const text = actionLabel(action, device, family);
  const fam = glyphFamily(family);
  const token = padTokenFor(action);
  const button = padButtonOf(token);

  let icon: ReactNode;
  if (device === 'keyboard') {
    icon = bare ? <span className={styles.bareText}>{text}</span> : <span className={styles.cap}>{text}</span>;
  } else if (button === null) {
    const direction = token.replace('pad:', '') as 'left' | 'right' | 'up' | 'down';
    icon = <Direction direction={direction} />;
  } else if (button <= 3) {
    icon = <FaceButton family={fam} button={button} />;
  } else if (button <= 7) {
    icon = <Shoulder text={text} />;
  } else if (button === 8 || button === 9) {
    icon = <MenuButton family={fam} text={text} />;
  } else {
    icon = <span className={styles.cap}>{text}</span>;
  }

  return (
    <span className={styles.item}>
      <span className={styles.glyph} role="img" aria-label={text}>
        {icon}
      </span>
      {label !== undefined && <span className={styles.label}>{label}</span>}
    </span>
  );
}

interface ControlsHintProps {
  /** Un comando: una o più azioni (es. sinistra + destra per «muovi») e il suo nome. */
  items: ReadonlyArray<{ actions: readonly GameAction[]; label: ReactNode }>;
}

/** Una fila di comandi «icona + nome» separati da un punto, calcolata dall'ultimo dispositivo usato (si aggiorna da sola). */
export function ControlsHint({ items }: ControlsHintProps) {
  return (
    <span className={styles.row}>
      {items.map((item, index) => (
        <Fragment key={`${item.actions.join('+')}-${index}`}>
          {index > 0 && <span className={styles.sep}>·</span>}
          <span className={styles.item}>
            {item.actions.map((action) => (
              <ActionGlyph key={action} action={action} />
            ))}
            <span className={styles.label}>{item.label}</span>
          </span>
        </Fragment>
      ))}
    </span>
  );
}
