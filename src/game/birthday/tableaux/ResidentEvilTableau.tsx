import { useEffect, useMemo, type CSSProperties } from 'react';
import { useSfx } from '@/hooks/useSfx';
import { TEXTS } from '../birthdayConfig';
import styles from './ResidentEvilTableau.module.css';

/**
 * Tempi del taglio, in secondi.
 *
 * Questi valori sono l'UNICA fonte: il CSS non li riscrive, li riceve come
 * custom property sulla radice del quadro (vedi `timing` più sotto) e le sue
 * @keyframes ci si agganciano. Prima erano scritti in tutti e due i file, e
 * cambiarli qui non spostava niente perché la durata vera era quella del
 * CSS: il tipo di trappola che non dà errore, fa solo sembrare che il codice
 * non risponda.
 */
const SWEEP_DURATION = 1.8;
/**
 * L'istante in cui la lama morde il timbro. NON è metà della passata: la sega
 * rallenta arrivando sul timbro e riparte dopo (vedi `sweep` nel CSS), quindi
 * il momento del taglio cade più avanti del punto medio del tempo.
 */
const CUT_AT = 0.85;
/** Quanto ci mettono le due metà a separarsi e svanire. */
const HALVES_DURATION = 1;
/**
 * Quanto dura tutto il taglio, dal primo fotogramma della passata all'ultima
 * scheggia svanita.
 *
 * Esportata perché la LEGGE la timeline (`EXIT_DURATIONS` in
 * BirthdayScene.tsx): è lei a dare il via con questo anticipo sulla fine del
 * quadro, così il taglio finisce nell'istante in cui comincia la dissolvenza.
 * Prima il quadro se lo calcolava da sé con un `gsap.delayedCall` sui
 * `TIMINGS` — un orologio a parte, che restava indietro appena la timeline
 * si fermava a un checkpoint o ci si saltava sopra: la sega compariva
 * congelata fuori campo e poi partiva sopra la dissolvenza (bug reale).
 */
export const EXIT_DURATION = CUT_AT + HALVES_DURATION;

const SPARK_COUNT = 18;
/** Costante di modulo, non un array letterale: deve avere identità stabile. */
const WARM_UP = ['chainsaw'] as const;
/** Denti della catena: generati, non scritti a mano cinquanta volte. */
const TEETH = Array.from({ length: 25 }, (_, i) => 124 + i * 11);

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Sagoma della motosega: corpo motore, impugnatura ad arco, barra con i
 * denti. Disegnata a mano come le altre icone del branch (lanterna, runa,
 * falena, fregi di Hollow Knight) invece di importare un asset — a
 * schermo passa in meno di mezzo secondo, quello che conta è la silhouette.
 *
 * `id` esiste perché di questa sagoma ne vengono disegnate tre sovrapposte
 * per fare la scia, e due gradienti con lo stesso identificatore nella
 * stessa pagina si annullano a vicenda.
 */
function SawShape({ id }: { id: string }) {
  return (
    <svg className={styles.sawSvg} viewBox="0 0 420 100" aria-hidden="true">
      <defs>
        <linearGradient id={`corpo-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a5f66" />
          <stop offset="0.5" stopColor="#2e3238" />
          <stop offset="1" stopColor="#16191d" />
        </linearGradient>
        <linearGradient id={`barra-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a7b0ba" />
          <stop offset="0.45" stopColor="#646c76" />
          <stop offset="1" stopColor="#2b3036" />
        </linearGradient>
      </defs>

      {/* impugnatura: due tratti sovrapposti, scuro sotto e chiaro sopra,
          per darle spessore senza disegnare due contorni */}
      <path
        d="M30 46 C 28 26 48 16 72 17 C 96 18 108 28 110 42"
        fill="none"
        stroke="#1b1f24"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M30 46 C 28 26 48 16 72 17 C 96 18 108 28 110 42"
        fill="none"
        stroke="#454c55"
        strokeWidth="4"
        strokeLinecap="round"
      />

      <path
        d="M12 46 C 12 36 20 32 32 32 L100 32 C 112 32 118 38 118 48 L118 76 C 118 86 110 92 98 92 L32 92 C 20 92 12 86 12 76 Z"
        fill={`url(#corpo-${id})`}
      />
      <rect x="20" y="54" width="86" height="8" rx="4" fill="#b81f1f" />
      <g fill="#12151a" opacity="0.85">
        <rect x="26" y="70" width="48" height="4" rx="2" />
        <rect x="26" y="78" width="34" height="4" rx="2" />
      </g>
      <circle cx="100" cy="76" r="6" fill="#12151a" />

      <path
        d="M116 52 L386 52 C 400 52 406 55 406 59 C 406 63 400 66 386 66 L116 66 Z"
        fill={`url(#barra-${id})`}
      />
      <path d="M124 57 L388 57 C 391 57 391 61 388 61 L124 61 Z" fill="#171b20" opacity="0.9" />

      <g fill="#ccd4dd">
        {TEETH.map((x) => (
          <path key={`s${x}`} d={`M${x} 52 l4 -5 l3 5 z`} />
        ))}
        {TEETH.map((x) => (
          <path key={`g${x}`} d={`M${x} 66 l4 5 l3 -5 z`} />
        ))}
      </g>
    </svg>
  );
}

interface Props {
  active: boolean;
  /** Via alla motosega, dalla timeline (vedi `EXIT_DURATION`). */
  exiting: boolean;
}

/**
 * Quadro 5 — il siparietto.
 *
 * Serve a rompere il tono: dopo tre quadri solenni arriva uno stacco secco,
 * senza dissolvenza (vedi i tempi in birthdayConfig: fadeIn 0.05). Se entrasse
 * in dissolvenza come gli altri la battuta non funzionerebbe — le gag hanno
 * bisogno di essere improvvise.
 *
 * Il timbro è storto di proposito: uno perfettamente allineato sembra un
 * bottone, uno storto sembra sbattuto sopra un referto.
 *
 * Il simbolo di rischio biologico dietro il timbro è il simbolo universale
 * (non un'icona proprietaria di Resident Evil — nessun gioco lo possiede),
 * disegnato a mano in SVG e tenuto molto tenue, in filigrana. Il glitch RGB
 * (due `<span>` dello stesso testo, sfalsati in rosso/ciano) scatta insieme
 * a `slam` e da lì in poi TORNA ogni tanto: rinforza la citazione VHS già
 * presente nelle `.scanlines`.
 *
 * L'uscita non è una dissolvenza: una motosega attraversa lo schermo e taglia
 * il timbro in due. Il via non arriva dalla prop `active` (resta vera per
 * tutta la dissolvenza del contenitore, quindi il taglio partirebbe a schermo
 * ormai nero) ma da `exiting`, acceso da un `.call()` sulla timeline con
 * `EXIT_DURATION` di anticipo sulla fine del quadro. Da lì in poi è tutto
 * CSS: nessuno stato locale, i ritardi li tengono le @keyframes.
 *
 * Due conseguenze gratuite: in pausa il taglio si ferma col resto (la regola
 * `.paused` in BirthdayScene.module.css congela le @keyframes), e saltando
 * avanti a mano il taglio viene semplicemente saltato — GSAP non esegue i
 * `.call()` quando si salta con `.seek()`, quindi il quadro esce con la sua
 * dissolvenza normale senza bisogno di nessuna regola speciale.
 */
export function ResidentEvilTableau({ active, exiting }: Props) {
  const reducedMotion = prefersReducedMotion();
  // Nessuno stato locale e nessun timer: la timeline dice quando, il CSS
  // dice come.
  const sawing = exiting && !reducedMotion;
  const playSfx = useSfx(WARM_UP);

  const sparks = useMemo(() => {
    if (reducedMotion) return [];
    return Array.from({ length: SPARK_COUNT }, (_, i) => {
      // Distribuite lungo la linea di taglio, con un po' di margine oltre i
      // bordi del timbro: le scintille schizzano anche fuori dal foglio.
      const across = Math.random();
      return {
        id: i,
        left: `${-8 + across * 116}%`,
        dx: `${(Math.random() - 0.5) * 90}px`,
        dy: `${(Math.random() - 0.5) * 70}px`,
        // Scoccano nell'ordine in cui la lama le raggiunge — prima quelle a
        // sinistra — invece che tutte insieme: con il taglio rallentato la
        // lama impiega mezzo secondo ad attraversare il timbro, e una fila
        // di scintille accese in blocco tradirebbe che è un effetto.
        delay: `${CUT_AT - 0.12 + across * 0.45 + Math.random() * 0.05}s`,
        duration: `${0.3 + Math.random() * 0.22}s`
      };
    });
  }, [reducedMotion]);

  useEffect(() => {
    if (!sawing) return;
    // Il file è tarato sulla stessa linea del tempo dell'animazione (morso a
    // CUT_AT, passata finita a SWEEP_DURATION): parte insieme allo sweep e da
    // lì in poi i due restano allineati da soli.
    playSfx('chainsaw');
  }, [sawing, playSfx]);

  // Lo stesso contenuto serve tre volte: il timbro vero e le due metà
  // ritagliate. Scritto una volta sola, o al primo ritocco al testo le copie
  // resterebbero indietro.
  const stampContent = <span className={styles.stampText}>{TEXTS.residentEvil}</span>;

  // I tempi scendono al CSS da qui: le @keyframes non li riscrivono, li
  // leggono. Una custom property non può stare dentro `@keyframes`, ma può
  // stare in `animation-duration`/`animation-delay`, che è tutto quello che
  // serve — la FORMA del movimento resta nel CSS, la sua DURATA qui.
  const timing = {
    '--sweep': `${SWEEP_DURATION}s`,
    '--cut-at': `${CUT_AT}s`,
    '--halves': `${HALVES_DURATION}s`
  } as CSSProperties;

  return (
    <div className={`${styles.root} ${sawing ? styles.rootShake : ''}`} style={timing}>
      {/* Slot opzionale: resta trasparente se il file manca, lo sfondo
          scuro di `.root` fa comunque da base. */}
      <div className={`${styles.bgImage} ${active ? styles.bgImageActive : ''}`} />
      <div className={styles.scanlines} />

      

      <div className={styles.stampWrap}>
        <div
          className={`${styles.stamp} ${active ? styles.stampActive : ''} ${
            sawing ? styles.stampCut : ''
          }`}
        >
          {stampContent}
          {active && (
            <>
              <span aria-hidden="true" className={`${styles.stampText} ${styles.glitchRed}`}>
                {TEXTS.residentEvil}
              </span>
              <span aria-hidden="true" className={`${styles.stampText} ${styles.glitchCyan}`}>
                {TEXTS.residentEvil}
              </span>
            </>
          )}
        </div>

        {/* Le due metà: due copie identiche del timbro, sovrapposte a quello
            vero e ritagliate una sopra e una sotto la linea di taglio (stessa
            tecnica delle copie rosso/ciano del glitch, con `clip-path` al
            posto del colore). Restano invisibili finché la lama non arriva —
            ci pensa il ritardo delle loro animazioni. */}
        {sawing && (
          <>
            <div aria-hidden="true" className={`${styles.half} ${styles.halfTop}`}>
              {stampContent}
            </div>
            <div aria-hidden="true" className={`${styles.half} ${styles.halfBottom}`}>
              {stampContent}
            </div>
            <div aria-hidden="true" className={styles.sparks}>
              {sparks.map((spark) => (
                <span
                  key={spark.id}
                  className={styles.spark}
                  style={
                    {
                      left: spark.left,
                      '--dx': spark.dx,
                      '--dy': spark.dy,
                      animationDelay: spark.delay,
                      animationDuration: spark.duration
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>

      {sawing && (
        <div aria-hidden="true" className={styles.sawFlight}>
          {/* Tre copie sfalsate all'indietro con opacità calante: una scia,
              al costo di due nodi in più invece che di un vero motion blur. */}
          <div className={styles.sawGhostFar}>
            <SawShape id="far" />
          </div>
          <div className={styles.sawGhostNear}>
            <SawShape id="near" />
          </div>
          <div className={styles.sawBlade}>
            <SawShape id="main" />
          </div>
        </div>
      )}
    </div>
  );
}
