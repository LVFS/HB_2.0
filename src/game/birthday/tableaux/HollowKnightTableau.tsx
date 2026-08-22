import { useMemo } from 'react';
import { TEXTS } from '../birthdayConfig';
import styles from './HollowKnightTableau.module.css';

const MOTE_COUNT = 20;
const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Quadro 3 — il sussurro. È il beat più lento della sequenza ed è qui che va
 * il messaggio vero: tutto il resto gli fa da cornice.
 *
 * Niente di appariscente apposta. L'unico movimento sono pulviscoli che
 * salgono piano, come nelle grotte silenziose del gioco: servono a impedire
 * che l'immagine sembri congelata mentre si legge, non a farsi notare.
 *
 * La falena SVG attraversa lo schermo UNA sola volta (`animation-iteration-
 * count: 1`, non infinite come i pulviscoli): un loop la trasformerebbe in
 * un elemento decorativo che si fa notare, mentre qui deve restare nel
 * registro "silenzioso" del quadro — un singolo passaggio si nota e basta.
 * Montata solo quando `active` diventa vero, non da subito: i quadri sono
 * montati tutti insieme fin dall'inizio (vedi `BirthdayScene`), quindi
 * un'animazione one-shot legata al mount partirebbe con l'orologio del
 * componente, non con quello del quadro — completandosi (e sparendo, con
 * `forwards`) ben prima che questo quadro diventi visibile (bug reale
 * scovato a schermo: la falena non si vedeva mai).
 */
interface Props {
  active: boolean;
}

export function HollowKnightTableau({ active }: Props) {
  const motes = useMemo(() => {
    if (prefersReducedMotion()) return [];
    return Array.from({ length: MOTE_COUNT }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      // Come per i petali: ritardi contenuti, o metà pulviscoli non farebbero
      // in tempo a entrare in scena prima che il quadro sia già svanito.
      delay: `${Math.random() * 2.6}s`,
      duration: `${7 + Math.random() * 5}s`,
      size: `${1 + Math.random() * 2}px`
    }));
  }, []);

  const showMoth = active && !prefersReducedMotion();

  return (
    <div className={styles.root}>
      {/* Slot opzionale: resta trasparente se il file manca, il gradiente
          radiale sotto fa comunque da base. */}
      <div className={styles.bgImage} />

      {motes.map((mote) => (
        <span
          key={mote.id}
          className={styles.mote}
          style={{
            left: mote.left,
            width: mote.size,
            height: mote.size,
            animationDelay: mote.delay,
            animationDuration: mote.duration
          }}
        />
      ))}

      {showMoth && (
        <svg className={styles.moth} viewBox="0 0 40 24" aria-hidden="true">
          <path d="M20 12 C15 4 5 5 2 10 C5 15 13 14.5 20 12 Z" />
          <path d="M20 12 C25 4 35 5 38 10 C35 15 27 14.5 20 12 Z" />
          <line className={styles.mothBody} x1="20" y1="7" x2="20" y2="17" />
        </svg>
      )}

      <p className={styles.text}>{TEXTS.hollowKnight}</p>
    </div>
  );
}
