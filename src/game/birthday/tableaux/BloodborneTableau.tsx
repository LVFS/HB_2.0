import { useEffect, useMemo, type CSSProperties } from 'react';
import gsap from 'gsap';
import { useSfx } from '@/hooks/useSfx';
import { TEXTS } from '../birthdayConfig';
import styles from './BloodborneTableau.module.css';

const EMBER_COUNT = 25;

/**
 * Tempi dell'uscita, in secondi. Come negli altri quadri con una coreografia
 * d'uscita sono l'unica fonte: il CSS non li riscrive, li riceve come custom
 * property sulla radice e le sue @keyframes ci si agganciano.
 */
/**
 * ────────────────────────────────────────────────────────────────────────
 *  I TEMPI SONO TARATI SUI FILE AUDIO, non a occhio.
 *
 *  Misurati decodificandoli e guardandone l'inviluppo:
 *    gunshot.mp3  1.5s — la botta sta nei primi 0.4s
 *    parry.mp3    8.4s — DUE colpi: uno subito e uno più forte a 1.4s,
 *                       poi una lunga coda di riverbero
 *    riposte.mp3  3.3s — i primi 0.3s sono SILENZIO, il colpo è dopo
 *
 *  Da lì scendono i numeri qui sotto. Se sostituisci un file, rimisura:
 *  quello che conta non è la durata ma dove cade l'attacco.
 * ────────────────────────────────────────────────────────────────────────
 */

/** Il lampo dello sparo, subito: la sequenza si apre col colpo. */
const MUZZLE_AT = 0.02;
/**
 * Quando il colpo raggiunge il centro della frase. Più lontano dallo sparo di
 * quanto sembrerebbe naturale (0.45 e non 0.18) perché la botta del gunshot
 * dura quattro decimi: con l'impatto più vicino i due suoni si accavallavano
 * e non si distingueva più che erano due cose diverse.
 */
const IMPACT_AT = 0.45;
/** Quanto ci mettono i getti a partire dal centro e spegnersi. */
const BURST_DURATION = 0.4;
/**
 * La seconda ondata. Non è una scelta di regia: è il secondo colpo che c'è
 * DENTRO parry.mp3, a 1.4s dal suo inizio. Il sangue si allarga di nuovo
 * esattamente lì, così il suono ha un riscontro a schermo invece di suonare
 * su un'immagine ormai ferma — è questo a farlo "durare di più".
 */
const SURGE_AT = IMPACT_AT + 1.4;

/**
 * Il colpo finale. `RIPOSTE_AT` è quando lo si SENTE; il file va fatto
 * partire prima, perché comincia con tre decimi di silenzio.
 */
const RIPOSTE_AT = 2.6;
const RIPOSTE_SOUND_AT = RIPOSTE_AT - 0.3;

/** La pioggia parte col colpo finale: è lui a scatenarla. */
const RAIN_AT = RIPOSTE_AT;
/** Su quanto tempo si sfalsano le gocce: è questo a fare la pioggia. */
const RAIN_STAGGER = 1;
/** Quanto ci mette una goccia a cadere fuori campo. */
const RAIN_FALL = 0.6;

const RAY_COUNT = 26;
const RAIN_COUNT = 72;

/** Costante di modulo, non un array letterale: deve avere identità stabile. */
const WARM_UP = ['gunshot', 'parry', 'riposte'] as const;

/**
 * Quanto dura tutta l'uscita. Esportata perché la LEGGE la timeline
 * (`EXIT_DURATIONS` in BirthdayScene.tsx): è lei a dare il via con questo
 * anticipo sulla fine del quadro, così l'ultima goccia cade nell'istante in
 * cui comincia la dissolvenza.
 */
export const EXIT_DURATION = RAIN_AT + RAIN_STAGGER + RAIN_FALL;

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Lo schizzo di sangue: un blob irregolare con punte che si irradiano, non un
 * cerchio. Il percorso è stato generato una volta sola (venti punti su una
 * circonferenza a raggio variabile, sette dei quali tirati fuori a punta) e
 * incollato qui come costante: a runtime non serve ricalcolarlo, e un cerchio
 * pulito avrebbe tradito l'effetto più di qualunque altra cosa.
 */
function Splatter() {
  return (
    <svg className={styles.splatterSvg} viewBox="0 0 200 200" aria-hidden="true">
      <g fill="#4d050a">
        <path d="M143.9 95.3 Q147.7 100.0 143.3 105.7 Q138.8 111.4 137.7 117.5 Q136.6 123.5 129.5 124.6 Q122.3 125.8 119.4 131.0 Q116.5 136.2 112.4 138.6 Q108.2 141.0 109.6 158.7 Q111.0 176.3 107.7 162.9 Q104.3 149.4 100.3 146.2 Q96.2 142.9 91.4 168.4 Q86.5 193.9 89.4 165.9 Q92.4 138.0 87.9 137.2 Q83.4 136.4 76.6 135.7 Q69.7 135.0 66.2 129.5 Q62.7 124.0 60.4 118.1 Q58.1 112.3 54.9 106.2 Q51.7 100.0 60.8 95.6 Q69.9 91.2 72.0 87.3 Q74.1 83.4 72.0 76.2 Q70.0 69.0 51.0 45.3 Q32.1 21.7 51.6 42.2 Q71.1 62.7 77.9 64.5 Q84.6 66.2 88.9 66.3 Q93.3 66.4 90.0 37.0 Q86.7 7.7 91.8 36.3 Q96.9 65.0 99.8 67.5 Q102.6 70.0 107.2 44.1 Q111.8 18.3 109.0 43.5 Q106.3 68.8 112.4 64.2 Q118.4 59.6 122.1 63.2 Q125.8 66.7 141.3 50.6 Q156.7 34.5 145.9 49.1 Q135.1 63.7 130.9 73.3 Q126.8 82.8 135.4 83.6 Q144.0 84.4 160.9 80.8 Q177.9 77.1 159.0 83.9 Q140.2 90.6 143.9 95.3 Z" />
        <ellipse cx="106.6" cy="165.8" rx="5.5" ry="4.3" transform="rotate(113 106.6 165.8)" />
        <ellipse cx="159.2" cy="119.4" rx="8.1" ry="5.0" transform="rotate(42 159.2 119.4)" />
        <ellipse cx="184.7" cy="98.3" rx="8.1" ry="5.8" transform="rotate(115 184.7 98.3)" />
        <ellipse cx="153.7" cy="155.9" rx="8.3" ry="6.1" transform="rotate(133 153.7 155.9)" />
        <ellipse cx="68.3" cy="55.9" rx="7.7" ry="5.9" transform="rotate(54 68.3 55.9)" />
        <ellipse cx="200.2" cy="114.8" rx="6.1" ry="5.0" transform="rotate(158 200.2 114.8)" />
        <ellipse cx="76.6" cy="23.6" rx="5.7" ry="4.9" transform="rotate(80 76.6 23.6)" />
        <ellipse cx="194.4" cy="69.7" rx="4.0" ry="2.3" transform="rotate(39 194.4 69.7)" />
        <ellipse cx="181.2" cy="86.6" rx="6.9" ry="4.4" transform="rotate(91 181.2 86.6)" />
      </g>
      <path d="M127.9 95.0 Q133.2 98.2 142.8 99.1 Q152.4 100.0 140.7 100.8 Q129.0 101.6 129.8 106.4 Q130.6 111.2 123.6 112.5 Q116.5 113.9 114.9 118.4 Q113.3 123.0 108.7 123.1 Q104.1 123.1 99.6 125.1 Q95.2 127.2 90.6 125.7 Q86.0 124.3 85.3 118.6 Q84.5 113.0 81.3 111.2 Q78.0 109.4 66.5 112.9 Q55.0 116.4 61.8 112.9 Q68.6 109.5 68.9 104.8 Q69.3 100.0 74.2 96.2 Q79.1 92.4 80.8 89.6 Q82.4 86.8 68.9 74.7 Q55.3 62.5 67.2 71.5 Q79.1 80.4 84.1 80.8 Q89.1 81.1 90.9 74.9 Q92.7 68.6 92.5 62.6 Q92.4 56.6 94.8 66.9 Q97.3 77.2 100.6 77.3 Q104.0 77.3 110.4 74.1 Q116.9 70.8 120.8 75.0 Q124.7 79.3 123.6 85.5 Q122.6 91.8 127.9 95.0 Z" fill="#7a0c12" />
    </svg>
  );
}

interface Props {
  /** Vero quando questo è il quadro visibile. Serve solo alla deriva dello
      sfondo (`.bgImage`/`bgImageActive`): senza, l'animazione partirebbe al
      montaggio della pagina invece che a quando si vede davvero il quadro,
      ed essendo tutti e sei montati insieme fin dall'inizio finirebbe già
      esaurita prima che questo diventi quello a schermo. */
  active: boolean;
  /** Via al colpo, dalla timeline (vedi `EXIT_DURATION`). */
  exiting: boolean;
}

/**
 * Quadro 1 — apertura misteriosa alla Bloodborne.
 *
 * La cornice dorata sottile è la citazione: nei Souls-like introduce il nome
 * di un boss. Qui, al posto del nome, una frase. Sta in basso al centro come
 * l'originale, non al centro dello schermo.
 *
 * La lanterna sopra la cornice è un'icona disegnata a mano (pochi tratti
 * SVG), non un asset del gioco: richiama l'oggetto senza riprodurne nulla.
 * Le braci rosse sono la stessa idea dei pulviscoli di Hollow Knight, ma
 * rossastre — danno respiro alla vignettatura altrimenti statica senza
 * distogliere dal testo.
 *
 * L'USCITA, in quattro battute, ognuna agganciata a un suono: parte un COLPO
 * da fuori campo — se ne vede la vampata e la scia — che raggiunge il centro
 * della frase; da lì il sangue ESPLODE verso l'esterno in getti; una SECONDA
 * ONDATA più larga arriva sul secondo attacco che c'è dentro parry.mp3; e il
 * colpo finale scatena una PIOGGIA di sangue che cade da quel punto.
 *
 * È l'unica delle quattro uscite in cui la scritta non si rompe: resta lì,
 * sotto il sangue. In un gioco il cui tema è letteralmente il sangue è il
 * finale che gli somiglia di più.
 *
 * Il via arriva da `exiting`, acceso da un `.call()` sulla timeline con
 * `EXIT_DURATION` di anticipo sulla fine del quadro — non dalla prop
 * `active`, che resta vera per tutta la dissolvenza del contenitore. Da lì in
 * poi è tutto CSS. Ne segue, gratis, che in pausa il colpo si ferma col resto
 * e che saltando avanti a mano viene semplicemente saltato.
 */
export function BloodborneTableau({ active, exiting }: Props) {
  const reducedMotion = prefersReducedMotion();
  const striking = exiting && !reducedMotion;
  const playSfx = useSfx(WARM_UP);

  /**
   * I tre suoni, ai tre istanti della coreografia.
   *
   * Qui `gsap.delayedCall` va bene, mentre per far PARTIRE l'uscita no (vedi
   * `EXIT_DURATION`): questi ritardi sono interni all'effetto e partono dallo
   * stesso istante da cui partono le @keyframes, quindi i due orologi sono lo
   * stesso orologio. E se l'effetto viene annullato — si salta avanti a mano
   * mentre è in corso — la pulizia qui sotto li spegne, così non ci si ritrova
   * uno sparo su un quadro che non c'è più.
   */
  useEffect(() => {
    if (!striking) return;
    const timers = [
      gsap.delayedCall(MUZZLE_AT, () => playSfx('gunshot')),
      gsap.delayedCall(IMPACT_AT, () => playSfx('parry')),
      // In anticipo di tre decimi: il file comincia con altrettanto silenzio,
      // e senza questo scarto il colpo si sentirebbe dopo che è già successo.
      gsap.delayedCall(RIPOSTE_SOUND_AT, () => playSfx('riposte'))
    ];
    return () => timers.forEach((timer) => timer.kill());
  }, [striking, playSfx]);

  const embers = useMemo(() => {
    if (reducedMotion) return [];
    return Array.from({ length: EMBER_COUNT }, (_, i) => ({
      id: i,
      left: `${8 + Math.random() * 84}%`,
      delay: `${Math.random() * 3.5}s`,
      duration: `${9 + Math.random() * 6}s`
    }));
  }, [reducedMotion]);

  // I getti dell'esplosione: partono TUTTI dal centro della frase e si
  // allungano verso l'esterno. Sono disposti per angolo attorno al giro, con
  // uno scarto casuale — a distanza regolare si leggerebbero come una ruota.
  // DUE ondate, non una: la prima sul colpo, la seconda sul secondo attacco
  // che c'è dentro parry.mp3. La seconda è più lunga e più spessa perché lì
  // il suono è più forte.
  const rays = useMemo(() => {
    if (reducedMotion) return [];
    return [0, 1].flatMap((wave) =>
      Array.from({ length: RAY_COUNT }, (_, i) => ({
        id: wave * RAY_COUNT + i,
        // La seconda ondata è ruotata di mezzo passo: sovrapposta alla prima
        // sembrerebbe la stessa immagine che ricompare.
        angle: `${(360 / RAY_COUNT) * (i + wave * 0.5) + (Math.random() - 0.5) * 12}deg`,
        length: `${(wave ? 110 : 70) + Math.random() * (wave ? 190 : 150)}px`,
        thickness: `${(wave ? 4 : 3) + Math.random() * (wave ? 10 : 8)}px`,
        reach: `${18 + Math.random() * 46}px`,
        delay: `${(wave ? SURGE_AT : IMPACT_AT) + Math.random() * 0.06}s`,
        duration: `${BURST_DURATION * (wave ? 1.3 : 1) * (0.7 + Math.random() * 0.3)}s`
      }))
    );
  }, [reducedMotion]);

  // La pioggia. Sono la stessa tecnica delle braci qui sopra ma il contrario
  // in tutto: le braci sono punti tondi che salgono piano per dieci secondi,
  // queste sono gocce allungate che CADONO. E soprattutto sono SFALSATE su
  // quasi mezzo secondo: se partissero tutte insieme sarebbe uno schizzo, è
  // lo scaglionamento a farla leggere come pioggia.
  const rain = useMemo(() => {
    if (reducedMotion) return [];
    return Array.from({ length: RAIN_COUNT }, (_, i) => ({
      id: i,
      size: `${4 + Math.random() * 6}px`,
      // Partono da un ventaglio stretto attorno al punto colpito, non da
      // tutta la larghezza dello schermo: piove DA LÌ.
      dx: `${(Math.random() - 0.5) * 220}px`,
      spread: `${(Math.random() - 0.5) * 90}px`,
      fallY: `${180 + Math.random() * 220}px`,
      delay: `${RAIN_AT + Math.random() * RAIN_STAGGER}s`,
      duration: `${RAIN_FALL * (0.7 + Math.random() * 0.3)}s`
    }));
  }, [reducedMotion]);

  const timing = {
    '--muzzle-at': `${MUZZLE_AT}s`,
    '--impact-at': `${IMPACT_AT}s`,
    '--surge-at': `${SURGE_AT}s`,
    '--riposte-at': `${RIPOSTE_AT}s`,
    '--burst': `${BURST_DURATION}s`
  } as CSSProperties;

  return (
    <div className={`${styles.root} ${striking ? styles.rootHit : ''}`} style={timing}>
      {/* Slot opzionale: se public/images/birthday/bloodborne-bg.jpg non
          c'è, questo div resta semplicemente trasparente — il gradiente di
          `.root` sotto fa da base sempre presente, nessuna icona rotta. */}
      <div className={`${styles.bgImage} ${active ? styles.bgImageActive : ''}`} />
      {/* La vignettatura è già rossa: al colpo si accende per un istante,
          invece di aggiungere un lampo a parte. */}
      <div className={`${styles.vignette} ${striking ? styles.vignetteHit : ''}`} />

      {embers.map((ember) => (
        <span
          key={ember.id}
          className={styles.ember}
          style={{ left: ember.left, animationDelay: ember.delay, animationDuration: ember.duration }}
        />
      ))}

      <div className={styles.frame}>
        <svg className={styles.icon} viewBox="0 0 24 30" aria-hidden="true">
          <path className={styles.iconStroke} d="M7 8 Q12 2 17 8" />
          <rect className={styles.iconStroke} x="7" y="8" width="10" height="13" rx="1.2" />
          <path className={styles.iconFlame} d="M12 11.5 Q9 16 12 20 Q15 16 12 11.5 Z" />
          <line className={styles.iconStroke} x1="9" y1="24" x2="15" y2="24" />
        </svg>

        <div className={styles.rule}>
          <span className={styles.diamond} />
          <span className={styles.line} />
          <span className={styles.diamond} />
        </div>
        <p className={styles.text}>{TEXTS.bloodborne}</p>
        <div className={styles.rule}>
          <span className={styles.diamond} />
          <span className={styles.line} />
          <span className={styles.diamond} />
        </div>

        {striking && (
          <>
            {/* Lo sparo arriva da fuori campo: si vedono la vampata sul bordo
                e la scia che attraversa fino al centro della frase. Disegnare
                anche l'arma voleva dire disegnarla bene, e in centocinquanta
                millisecondi non la guarderebbe nessuno. */}
            <span aria-hidden="true" className={styles.muzzle} />
            <span aria-hidden="true" className={styles.tracer} />

            {rays.map((ray) => (
              <span
                key={`r${ray.id}`}
                aria-hidden="true"
                className={styles.ray}
                style={
                  {
                    width: ray.length,
                    height: ray.thickness,
                    '--a': ray.angle,
                    '--reach': ray.reach,
                    animationDelay: ray.delay,
                    animationDuration: ray.duration
                  } as CSSProperties
                }
              />
            ))}

            <div aria-hidden="true" className={styles.splatter}>
              <Splatter />
            </div>

            {rain.map((drop) => (
              <span
                key={`p${drop.id}`}
                aria-hidden="true"
                className={styles.rainDrop}
                style={
                  {
                    width: drop.size,
                    height: `calc(${drop.size} * 2.2)`,
                    '--dx': drop.dx,
                    '--spread': drop.spread,
                    '--fall-y': drop.fallY,
                    animationDelay: drop.delay,
                    animationDuration: drop.duration
                  } as CSSProperties
                }
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
