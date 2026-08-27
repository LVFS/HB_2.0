import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import gsap from 'gsap';
import { useSfx } from '@/hooks/useSfx';
import { TEXTS, TIMINGS } from '../birthdayConfig';
import styles from './HollowKnightTableau.module.css';

/** Costante di modulo, non un array letterale: deve avere identità stabile
 * (vedi il commento su `warmUp` in `useSfx`), stesso schema di `WARM_UP` in
 * ResidentEvilTableau. */
const WARM_UP = ['heroSpell', 'heroImpact'] as const;

const MOTE_COUNT = 20;
const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Tempi del dash del Cavaliere, in secondi — stessa filosofia di
 * SWEEP_DURATION/CUT_AT/HALVES_DURATION in ResidentEvilTableau: costanti
 * fisse che disegnano la FORMA del movimento (non derivate da TIMINGS —
 * solo l'ISTANTE DI PARTENZA, in DASH_AT più sotto, lo è).
 *
 * Linguaggio del movimento diverso apposta dalla motosega: secco e
 * preciso (~0.7s in tutto), non pesante/vibrante — coerente con un
 * personaggio diverso.
 */
const DASH_TRAVEL = 0.3; // corsa fino all'impatto
const HIT_STOP = 0.08; // fermo immagine appena prima che tutto si spacchi
const RECOIL_FADE = 0.32; // rimbalzo indietro e dissolvenza del Cavaliere
const KNIGHT_TOTAL = DASH_TRAVEL + HIT_STOP + RECOIL_FADE;
/** Istante in cui scattano insieme frantumi/scintille/orbo magico: la fine del fermo immagine. */
const IMPACT_AT = DASH_TRAVEL + HIT_STOP;
const SHATTER_DURATION = 0.35;
/** Le sfere di cura partono un attimo DOPO l'impatto (non insieme a
 * frantumi/scintille): prima l'urto, poi il rilascio — non tutto insieme. */
const HEAL_DELAY = 0.08;
const HEAL_DURATION = 0.55; // deve bastare a uscire dall'inquadratura, non solo ad allontanarsi
const EFFECT_TOTAL = Math.max(
  KNIGHT_TOTAL,
  IMPACT_AT + SHATTER_DURATION,
  IMPACT_AT + HEAL_DELAY + HEAL_DURATION
);

/**
 * Esportato con lo stesso nome usato dagli altri quattro quadri con
 * un'uscita coreografata (`EXIT_DURATION` in Resident Evil/God of War/
 * Bloodborne/Expedition) — serve a `BirthdayScene` per il salto in due
 * tempi di "Salta tutto": deve sapere quanto dura l'uscita per poter
 * saltare al SUO inizio invece che aspettare il resto di `hold`. Il
 * meccanismo interno del quadro resta invariato (il proprio
 * `gsap.delayedCall` su `DASH_AT`, agganciato alla prop `active`): questo
 * numero è solo informativo per chi sta fuori.
 */
export const EXIT_DURATION = EFFECT_TOTAL;

/**
 * Istante in cui parte il dash, contato da quando il quadro diventa quello
 * corrente. Calcolato sui tempi veri (non scritto a mano), così l'impatto
 * finisce sempre esatto quando il contenitore inizia a sfumare, anche se
 * cambiano TIMINGS/HOLD_SCALE — stessa tecnica di SAW_AT in
 * ResidentEvilTableau. `TIMINGS.hollowKnight.fadeOut` (1.4s, il più lungo
 * di tutti i quadri) è già più che sufficiente per EFFECT_TOTAL (~1s, le
 * sfere di cura sono la parte più lunga): a differenza di Resident Evil
 * non è servito allungare nulla.
 */
const DASH_AT = Math.max(0, TIMINGS.hollowKnight.fadeIn + TIMINGS.hollowKnight.hold - EFFECT_TOTAL);

const SPARK_COUNT = 12;
const HEAL_COUNT = 5;
const SHARD_IDS = [0, 1, 2, 3, 4, 5] as const;

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
 *
 * L'uscita rompe apposta il silenzio: il Cavaliere (una sagoma disegnata a
 * mano, non uno sprite del gioco — stessa filosofia di lanterna/runa/
 * simbolo biohazard altrove nel branch) attraversa lo schermo con un dash e
 * colpisce il testo, che va in frantumi invece di dissolversi — coincidenza
 * felice col gioco, pieno di gusci/maschere incrinate. Il momento non può
 * arrivare dalla prop `active` (resta vera per tutto il `fadeOut` del
 * contenitore, quindi partirebbe a schermo ormai nero): il quadro se lo
 * programma da sé su `TIMINGS.hollowKnight` (vedi `DASH_AT`), stesso schema
 * già usato per l'uscita di Resident Evil. Se si salta il quadro a mano
 * mentre il dash è in volo non serve nessuna regola speciale: `active`
 * diventa falsa, l'effetto qui sotto si smonta e il quadro esce con la sua
 * dissolvenza normale.
 *
 * Due sfx accompagnano l'impatto (non uno solo con entrambi i tempi dentro,
 * come `simon_erase` in Expedition — qui sono due file distinti): `hero_
 * spell` parte insieme al dash (l'incantesimo che si carica mentre il
 * Cavaliere corre), `hero_impact` all'istante vero dell'urto (`IMPACT_AT`
 * dopo). All'impatto compare anche un piccolo orbo magico (`MagicOrb`
 * sotto — sagoma originale ispirata al linguaggio visivo del "Focus" del
 * gioco, non una sua riproduzione) da cui si sprigionano alcune sfere di
 * cura che risalgono ed escono dall'inquadratura, come l'energia vitale
 * rilasciata dal colpo.
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

/**
 * Sagoma del Cavaliere: cappuccio arrotondato, due corna, due occhi a
 * mandorla — disegnata a mano come le altre icone del branch (lanterna,
 * runa, motosega, falena/fregi qui sopra) invece di importare uno sprite
 * del gioco. Riconoscibile per chi lo conosce, non una copia.
 */
function KnightShape() {
  return (
    <svg className={styles.knightSvg} viewBox="0 -3 50 60" aria-hidden="true">
      <path className={styles.knightFill} d="M15 10 C 12 6 11 1 14 -1 C 16 1 16 6 18 10 Z" />
      <path className={styles.knightFill} d="M35 10 C 38 6 39 1 36 -1 C 34 1 34 6 32 10 Z" />
      <path
        className={styles.knightFill}
        d="M25 6 C 39 6 45 18 43 32 C 41 48 33 56 25 56 C 17 56 9 48 7 32 C 5 18 11 6 25 6 Z"
      />
      <path className={styles.knightEye} d="M13 28 C 15 24 20 24 22 28 C 20 32 15 32 13 28 Z" />
      <path className={styles.knightEye} d="M28 28 C 30 24 35 24 37 28 C 35 32 30 32 28 28 Z" />
    </svg>
  );
}

/**
 * Orbo magico dell'impatto: un nucleo scuro con un bagliore chiaro
 * decentrato e alcune volute chiare che si allungano da un lato, come
 * un'energia raccolta che si sta per rilasciare — sagoma originale nel
 * linguaggio visivo del "Focus" del gioco (nucleo scuro, bagliore, volute),
 * non una sua riproduzione. Le volute usano un gradiente (sfumano da
 * trasparenti a piene verso il nucleo) invece di curve disegnate a mano:
 * più facile da leggere come "energia che si dirada" di una silhouette
 * piena.
 */
function MagicOrb() {
  return (
    <svg className={styles.orbSvg} viewBox="0 0 140 90" aria-hidden="true">
      <defs>
        <linearGradient id="hkWispFade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#eef5ff" stopOpacity="0" />
          <stop offset="0.6" stopColor="#eef5ff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#eef5ff" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <g className={styles.orbWisps} fill="url(#hkWispFade)">
        <path d="M6 40 C 30 32 55 38 82 44 C 55 46 30 50 8 46 Z" />
        <path d="M2 54 C 26 47 52 51 80 50 C 54 57 28 61 4 59 Z" opacity="0.75" />
        <path d="M10 29 C 32 25 54 31 78 37 C 52 38 30 40 12 38 Z" opacity="0.6" />
        <path d="M14 62 C 34 58 54 61 76 57 C 52 65 30 67 16 67 Z" opacity="0.55" />
      </g>
      <circle className={styles.orbCore} cx="95" cy="45" r="26" />
      <ellipse className={styles.orbHighlight} cx="104" cy="53" rx="9" ry="6" />
    </svg>
  );
}

export function HollowKnightTableau({ active }: Props) {
  const reducedMotion = prefersReducedMotion();

  const motes = useMemo(() => {
    if (reducedMotion) return [];
    return Array.from({ length: MOTE_COUNT }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      // Come per i petali: ritardi contenuti, o metà pulviscoli non farebbero
      // in tempo a entrare in scena prima che il quadro sia già svanito.
      delay: `${Math.random() * 2.6}s`,
      duration: `${7 + Math.random() * 5}s`,
      size: `${1 + Math.random() * 2}px`
    }));
  }, [reducedMotion]);

  const showMoth = active && !reducedMotion;

  const [dashing, setDashing] = useState(false);
  const playSfx = useSfx(WARM_UP);

  useEffect(() => {
    if (!active || reducedMotion) return;
    // Due `delayedCall` distinti, non uno solo: `hero_spell` parte insieme
    // al dash, `hero_impact` all'istante vero dell'urto — se si salta il
    // quadro mentre solo il primo è già scattato, il cleanup qui sotto deve
    // poter fermare anche il secondo prima che parta.
    let impactTimer: gsap.core.Tween | null = null;
    const dashTimer = gsap.delayedCall(DASH_AT, () => {
      setDashing(true);
      playSfx('heroSpell');
      impactTimer = gsap.delayedCall(IMPACT_AT, () => playSfx('heroImpact'));
    });
    return () => {
      dashTimer.kill();
      impactTimer?.kill();
      setDashing(false);
    };
  }, [active, reducedMotion, playSfx]);

  // Scintille: esplodono in cerchio dal punto d'impatto (non lungo una linea
  // come in Resident Evil, che taglia — qui il colpo è puntuale). Origine
  // fissa al centro del testo (vedi `.spark` nel CSS), solo direzione e
  // tempismo randomizzati.
  const sparks = useMemo(() => {
    if (reducedMotion) return [];
    return Array.from({ length: SPARK_COUNT }, (_, i) => {
      const angle = (i / SPARK_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const distance = 30 + Math.random() * 55;
      return {
        id: i,
        dx: `${Math.cos(angle) * distance}px`,
        dy: `${Math.sin(angle) * distance}px`,
        delay: `${IMPACT_AT + Math.random() * 0.06}s`,
        duration: `${0.25 + Math.random() * 0.2}s`
      };
    });
  }, [reducedMotion]);

  // Sfere di cura: si sprigionano dall'orbo magico e risalgono verso l'alto
  // a ventaglio, abbastanza lontano da uscire davvero dall'inquadratura
  // (non solo allontanarsi, vedi `HEAL_DURATION`) — l'energia vitale
  // rilasciata dal colpo che si disperde verso l'alto.
  const healMotes = useMemo(() => {
    if (reducedMotion) return [];
    return Array.from({ length: HEAL_COUNT }, (_, i) => {
      const spread = (i - (HEAL_COUNT - 1) / 2) * 16 + (Math.random() - 0.5) * 10;
      const angle = ((-90 + spread) * Math.PI) / 180;
      const distance = 65 + Math.random() * 20; // vh
      return {
        id: i,
        dx: `${Math.cos(angle) * distance * 0.55}vw`,
        dy: `${Math.sin(angle) * distance}vh`,
        delay: `${IMPACT_AT + HEAL_DELAY + Math.random() * 0.08}s`,
        duration: `${HEAL_DURATION + Math.random() * 0.15}s`
      };
    });
  }, [reducedMotion]);

  // I tempi scendono al CSS da qui: le @keyframes non li riscrivono, li
  // leggono — stessa tecnica di `timing` in ResidentEvilTableau.
  const timing = {
    '--knight-total': `${KNIGHT_TOTAL}s`,
    '--impact-at': `${IMPACT_AT}s`,
    '--shatter': `${SHATTER_DURATION}s`
  } as CSSProperties;

  return (
    <div className={styles.root} style={timing}>
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

        <div className={styles.textWrap}>
          <p className={`${styles.text} ${dashing ? styles.textCut : ''}`}>{TEXTS.hollowKnight}</p>

          {dashing && (
            <div aria-hidden="true" className={styles.shatter}>
              {SHARD_IDS.map((id) => (
                <p key={id} className={`${styles.shard} ${styles[`shard${id}`]}`}>
                  {TEXTS.hollowKnight}
                </p>
              ))}
              <div className={styles.magicOrb}>
                <MagicOrb />
              </div>
              {sparks.map((spark) => (
                <span
                  key={spark.id}
                  className={styles.spark}
                  style={
                    {
                      '--dx': spark.dx,
                      '--dy': spark.dy,
                      animationDelay: spark.delay,
                      animationDuration: spark.duration
                    } as CSSProperties
                  }
                />
              ))}
              {healMotes.map((heal) => (
                <span
                  key={heal.id}
                  className={styles.healOrb}
                  style={
                    {
                      '--dx': heal.dx,
                      '--dy': heal.dy,
                      animationDelay: heal.delay,
                      animationDuration: heal.duration
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}
        </div>

        <span className={`${styles.ornament} ${styles.ornamentFlipped}`}>
          <Ornament />
        </span>
      </div>

      {dashing && (
        <div aria-hidden="true" className={styles.knightFlight}>
          {/* Tre copie sfalsate all'indietro con opacità calante: una scia,
              stessa tecnica della motosega di Resident Evil. */}
          <div className={styles.knightGhostFar}>
            <KnightShape />
          </div>
          <div className={styles.knightGhostNear}>
            <KnightShape />
          </div>
          <div className={styles.knightBlade}>
            <KnightShape />
          </div>
        </div>
      )}
    </div>
  );
}
