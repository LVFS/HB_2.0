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

/**
 * Fregio in filigrana sopra e sotto il messaggio, nello stile dei cartelli
 * di Hollow Knight: rombo centrale con la punta rastremata, due bracci che
 * si allontanano e si arricciano su sé stessi, una perlina per lato.
 *
 * Disegnato a mano come SVG e non importato come immagine per lo stesso
 * motivo per cui la texture di Expedition nasce da un canvas: un asset
 * scaricato avrebbe un suo colore e una sua grana, questo invece eredita
 * `currentColor` e l'alone dal quadro, quindi resta coerente anche se un
 * giorno cambiamo la tinta del testo.
 *
 * Sotto la scritta è lo STESSO disegno ribaltato in verticale (`.flipped`),
 * non un secondo tracciato: due disegni diversi che vogliono sembrare
 * simmetrici divergono al primo ritocco.
 */
function Ornament() {
  return (
    <svg viewBox="0 0 400 44" aria-hidden="true">
      {/* rombo centrale, con la punta che lo prolunga verso l'alto */}
      <path className={styles.ornamentFill} d="M200 14 L206 26 L200 38 L194 26 Z" />
      <path className={styles.ornamentFill} d="M200 13 L202 6 L200 0 L198 6 Z" />

      {/* braccio destro: sale, si allontana, torna indietro in un ricciolo */}
      <path d="M207 26 C 236 26 258 20 284 15 C 312 10 340 12 350 22 C 357 29 353 39 344 38 C 337 37 335 30 341 27" />
      <path d="M205 31 C 232 39 260 41 282 35" />

      {/* braccio sinistro: gli stessi numeri specchiati su x = 200 */}
      <path d="M193 26 C 164 26 142 20 116 15 C 88 10 60 12 50 22 C 43 29 47 39 56 38 C 63 37 65 30 59 27" />
      <path d="M195 31 C 168 39 140 41 118 35" />

      <circle className={styles.ornamentFill} cx="284" cy="15" r="2.2" />
      <circle className={styles.ornamentFill} cx="116" cy="15" r="2.2" />
    </svg>
  );
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
      <div className={`${styles.bgImage} ${active ? styles.bgImageActive : ''}`} />

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

      <div className={styles.block}>
        <span className={styles.ornament}>
          <Ornament />
        </span>
        <p className={styles.text}>{TEXTS.hollowKnight}</p>
        <span className={`${styles.ornament} ${styles.ornamentFlipped}`}>
          <Ornament />
        </span>
      </div>
    </div>
  );
}
