import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { TEXTS } from '../birthdayConfig';
import styles from './GodOfWarTableau.module.css';

/**
 * Tempi dell'uscita, in secondi. Come per Resident Evil sono l'unica fonte:
 * il CSS non li riscrive, li riceve come custom property sulla radice del
 * quadro e le sue @keyframes ci si agganciano.
 */
/**
 * Quando l'ascia raggiunge il titolo, contato dal via. Quasi un secondo di
 * volo: a mezzo secondo l'ascia era un lampo e non si capiva cosa fosse
 * passato, figurarsi che stava girando su sé stessa.
 */
const IMPACT_AT = 0.95;
/** Quanto ci mette la brina a propagarsi dal punto d'impatto. */
const FREEZE_SPREAD = 0.5;
/**
 * Quanto resta FERMO e congelato dopo che la brina ha finito di allargarsi.
 * È il battito che separa il colpo che immobilizza da quello che frantuma:
 * senza una pausa vera i tre momenti si leggono come uno solo e confuso.
 */
const FREEZE_STILL = 0.6;
const FREEZE_HOLD = FREEZE_SPREAD + FREEZE_STILL;
/** Quando il titolo va in schegge. */
const SHATTER_AT = IMPACT_AT + FREEZE_HOLD;
const SHATTER_DURATION = 0.9;

/**
 * Quanto dura tutta l'uscita. Esportata perché la LEGGE la timeline
 * (`EXIT_DURATIONS` in BirthdayScene.tsx): è lei a dare il via con questo
 * anticipo sulla fine del quadro, così l'ultima scheggia svanisce
 * nell'istante in cui comincia la dissolvenza.
 */
export const EXIT_DURATION = SHATTER_AT + SHATTER_DURATION;

/** Volo dell'ascia: andata, uscita a destra, e ritorno in mano. */
const THROW_DURATION = EXIT_DURATION;

const CRYSTAL_COUNT = 18;
const VAPOUR_COUNT = 7;

/**
 * Slot opzionale per un'immagine dell'ascia al posto del disegno.
 *
 * Metti un file in `public/images/birthday/axe.png` e viene usato quello; se
 * non c'è, resta la sagoma SVG qui sotto. Stesso trattamento tollerante degli
 * sfondi e dell'audio: niente da configurare, niente che si rompe se il file
 * manca.
 *
 * Serve un PNG con lo sfondo trasparente, e conviene che l'ascia sia rivolta
 * come il disegno (lama a sinistra, manico in basso a destra): la rotazione
 * durante il lancio è tarata su quel verso, con una lama rivolta dall'altra
 * parte l'ascia arriverebbe sul titolo di spalle.
 */
const AXE_IMAGE_PATH = 'images/birthday/axe.png';

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Schegge di GHIACCIO, non di ceramica: poligoni stretti e appuntiti, non
 * blocchi. Sono `clip-path` applicati a copie sovrapposte del titolo — la
 * stessa tecnica delle due metà tagliate di Resident Evil, qui con sette
 * pezzi irregolari invece di due. Le percentuali coprono insieme tutto il
 * riquadro senza buchi: ogni pezzo confina con i vicini lungo le stesse
 * spezzate, o fra una scheggia e l'altra si vedrebbe il fondo.
 */
const SHARDS = [
  { clip: 'polygon(0% 0%, 26% 0%, 20% 46%, 33% 100%, 0% 100%)', dx: -170, dy: -54, rot: -34 },
  { clip: 'polygon(26% 0%, 47% 0%, 44% 52%, 33% 100%, 20% 46%)', dx: -104, dy: 62, rot: 22 },
  { clip: 'polygon(47% 0%, 61% 0%, 66% 44%, 55% 100%, 44% 52%)', dx: -38, dy: -76, rot: -18 },
  { clip: 'polygon(61% 0%, 78% 0%, 82% 58%, 72% 100%, 66% 44%)', dx: 44, dy: 70, rot: 27 },
  { clip: 'polygon(78% 0%, 100% 0%, 100% 100%, 72% 100%, 82% 58%)', dx: 158, dy: -48, rot: 31 },
  { clip: 'polygon(33% 100%, 55% 100%, 50% 62%)', dx: -22, dy: 108, rot: -12 },
  { clip: 'polygon(55% 100%, 72% 100%, 64% 66%)', dx: 66, dy: 116, rot: 16 }
] as const;

interface Props {
  active: boolean;
  /** Via all'uscita, dalla timeline (vedi `EXIT_DURATION`). */
  exiting: boolean;
}

/**
 * Sagoma dell'ascia: testa a doppia curva con due incisioni geometriche e un
 * manico corto. Disegnata a mano nello stesso linguaggio della runa già
 * presente in questo quadro (tratti dritti, angoli netti, stesso oro), non
 * una riproduzione dell'arma del gioco — stessa regola seguita per lanterna,
 * falena, simbolo biohazard e motosega.
 */
function Axe() {
  return (
    <svg className={styles.axeSvg} viewBox="0 0 130 130" aria-hidden="true">
      {/* manico, con la legatura in cuoio sotto la testa */}
      <path d="M76 26 L90 26 L82 126 L70 126 Z" fill="#5c4227" />
      <path d="M76 26 L82 26 L76 126 L70 126 Z" fill="#7d5f38" />
      <rect x="72" y="56" width="18" height="9" rx="2" fill="#3a2c1c" transform="rotate(4 81 60)" />

      {/* Lama a una sola faccia, barbuta: bordo superiore quasi dritto, filo
          ad arco, barba appuntita in basso. Una testa simmetrica a doppia
          curva — la prima versione — a schermo leggeva come un fungo. */}
      <path d="M74 20 L30 25 C 16 40 16 60 29 75 L54 67 L72 54 Z" fill="#9fb0c1" />
      <path d="M30 25 C 16 40 16 60 29 75 C 24 58 25 40 36 27 Z" fill="#eef5fb" />
      <path d="M74 20 L44 23 C 38 38 40 54 48 66 L72 54 Z" fill="#b9c6d4" />

      {/* occhio: il blocco che stringe il manico */}
      <path d="M70 16 L94 20 L88 60 L68 55 Z" fill="#43505d" />
      <path d="M70 16 L79 17.5 L74 57 L68 55 Z" fill="#5d6d7c" />

      {/* incisione: lo stesso segno della runa sopra il titolo */}
      <g stroke="#e0c896" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <line x1="52" y1="32" x2="48" y2="56" />
        <line x1="52" y1="32" x2="61" y2="39" />
        <line x1="50" y1="44" x2="59" y2="50" />
      </g>
    </svg>
  );
}

/**
 * Quadro 2 — titolo cerimoniale alla God of War.
 *
 * Cinzel è ispirato ai caratteri romani scolpiti nella pietra: è la stessa
 * radice del lettering dei titoli del gioco. Maiuscolo e molto spaziato,
 * perché è così che si legge un'iscrizione, non un titolo.
 *
 * Il micro-ingrandimento in entrata è una @keyframes e non GSAP: la timeline
 * generale detta QUANDO appare il quadro, il quadro decide COME si presenta.
 * Tenere le due cose separate evita di dover sincronizzare due orologi.
 *
 * La runa sopra il titolo è un simbolo geometrico disegnato a mano (non una
 * copia dell'ascia Leviatano del gioco) che si "incide" con uno
 * stroke-dashoffset — stessa durata/curva di `carve` sul titolo
 * (1.6s, lo stesso cubic-bezier), così leggono come UNA sola incisione,
 * non due animazioni per caso sincronizzate. `pathLength="1"` normalizza la
 * lunghezza di ogni tratto a 1: permette di animare `stroke-dasharray`/
 * `stroke-dashoffset` con lo stesso valore su tratti di lunghezza diversa,
 * senza calcolare la lunghezza reale di ciascuno.
 *
 * L'USCITA, in quattro battute: un'ascia arriva ruotando e SI CONFICCA nel
 * titolo (non lo attraversa — si pianta lì, con un contraccolpo, e ci resta);
 * il freddo si propaga dal punto in cui è entrata la lama e prende tutto il
 * quadro; segue una pausa vera col titolo immobile e gelato; poi l'ascia
 * viene richiamata e strappandosi via porta con sé il titolo, che le si
 * sbriciola dietro in schegge di ghiaccio.
 *
 * È il richiamo a rompere la scritta, non un secondo colpo: nel gioco
 * l'ascia che torna in mano è un gesto tanto quanto il lancio, e qui dà alla
 * frantumazione una causa invece di farla succedere e basta.
 *
 * Il freddo su un quadro caldo e dorato è un contrasto voluto: è lo stesso
 * che fa il gioco, un personaggio associato al fuoco che impugna un'arma di
 * ghiaccio.
 *
 * `carve` (entrata) e l'uscita non si pestano i piedi: la prima dura 1.6s
 * dall'inizio del quadro, la seconda parte a `hold - EXIT_DURATION` (circa 3s
 * di coreografia), e le due finestre non si toccano finché `hold` resta sopra
 * i cinque secondi circa. Sotto, `BirthdayScene` fa partire l'uscita insieme
 * al quadro e le due si sovrappongono.
 */
export function GodOfWarTableau({ active, exiting }: Props) {
  const reducedMotion = prefersReducedMotion();

  // Sondato al montaggio e non al momento del lancio: il quadro è in scena da
  // secondi quando serve, quindi l'immagine è già decodificata e non si vede
  // un buco al posto dell'ascia. Se il file non c'è, `onload` non scatta mai,
  // lo stato resta null e si usa il disegno.
  const [axeImage, setAxeImage] = useState<string | null>(null);
  useEffect(() => {
    const src = `${import.meta.env.BASE_URL}${AXE_IMAGE_PATH}`;
    const probe = new Image();
    probe.onload = () => setAxeImage(src);
    probe.src = src;
  }, []);
  // Nessuno stato locale e nessun timer: la timeline dice quando, il CSS come.
  const breaking = exiting && !reducedMotion;

  // Cristalli che si POSANO intorno al titolo, non che schizzano via: nella
  // fase di congelamento restano quasi fermi. Quelli che volano sono le
  // schegge, dopo — sono due momenti diversi e devono muoversi in modo
  // diverso.
  const crystals = useMemo(() => {
    if (reducedMotion) return [];
    return Array.from({ length: CRYSTAL_COUNT }, (_, i) => ({
      id: i,
      left: `${4 + Math.random() * 92}%`,
      top: `${10 + Math.random() * 80}%`,
      size: `${5 + Math.random() * 9}px`,
      tilt: `${Math.random() * 360}deg`,
      // Sfalsati sulla finestra in cui la brina si propaga: si formano uno
      // dopo l'altro come farebbe il ghiaccio, non tutti nello stesso
      // fotogramma, e hanno finito quando comincia la pausa da congelato.
      delay: `${IMPACT_AT + Math.random() * FREEZE_SPREAD}s`
    }));
  }, [reducedMotion]);

  // Sbuffi di vapore dal punto d'impatto: salgono piano e si allargano, come
  // il freddo che sfiata da una crepa. Sono l'unica cosa che si muove durante
  // la pausa da congelato — senza, quel mezzo secondo sembra un fermo
  // immagine invece di un momento.
  const vapours = useMemo(() => {
    if (reducedMotion) return [];
    return Array.from({ length: VAPOUR_COUNT }, (_, i) => ({
      id: i,
      left: `${34 + Math.random() * 32}%`,
      size: `${40 + Math.random() * 60}px`,
      drift: `${(Math.random() - 0.5) * 90}px`,
      delay: `${IMPACT_AT + Math.random() * 0.35}s`,
      duration: `${1 + Math.random() * 0.5}s`
    }));
  }, [reducedMotion]);

  const timing = {
    '--impact-at': `${IMPACT_AT}s`,
    '--freeze-spread': `${FREEZE_SPREAD}s`,
    '--freeze-hold': `${FREEZE_HOLD}s`,
    '--shatter-at': `${SHATTER_AT}s`,
    '--shatter': `${SHATTER_DURATION}s`,
    '--throw': `${THROW_DURATION}s`
  } as CSSProperties;

  return (
    <div className={`${styles.root} ${breaking ? styles.rootHit : ''}`} style={timing}>
      {/* Slot opzionale: resta trasparente se il file manca, la texture di
          pietra procedurale sotto fa comunque da base. */}
      <div className={styles.bgImage} />
      {/* <div className={styles.stone} /> */}

      {/* Tinta fredda su TUTTO il quadro, non solo sul titolo: entra
          all'impatto e se ne va con le schegge. È quello che fa sembrare
          gelata la scena e non soltanto la scritta. */}
      {breaking && <div aria-hidden="true" className={styles.coldOverlay} />}
      {/* Vampata bianco-azzurra nell'istante del colpo, brevissima. */}
      {breaking && <span aria-hidden="true" className={styles.frostFlash} />}

      <div
        className={`${styles.block} ${active ? styles.blockActive : ''} ${
          breaking ? styles.blockFrozen : ''
        }`}
      >
        <svg className={styles.rune} viewBox="0 0 40 48" aria-hidden="true">
          <g className={styles.runeStroke}>
            <line pathLength="1" x1="20" y1="4" x2="20" y2="44" />
            <line pathLength="1" x1="20" y1="4" x2="34" y2="16" />
            <line pathLength="1" x1="20" y1="22" x2="32" y2="30" />
            <line pathLength="1" x1="20" y1="4" x2="6" y2="16" />
            <line pathLength="1" x1="20" y1="22" x2="8" y2="30" />
          </g>
        </svg>
        <span className={styles.rule} />

        {/* Il titolo e le sue copie vivono in un contenitore proprio: le
            schegge sono copie assolute sovrapposte a quella vera, e hanno
            bisogno di un riferimento che sia esattamente il suo riquadro. */}
        <div className={styles.titleWrap}>
          <h1 className={`${styles.title} ${breaking ? styles.titleBreaking : ''}`}>
            {TEXTS.godOfWar}
          </h1>

          {breaking && (
            <>
              {/* Brina: una copia del titolo in bianco-azzurro, scoperta da
                  un `clip-path: circle()` che si allarga dal punto d'impatto.
                  Il ghiaccio si propaga da un punto, non compare uniforme. */}
              <span aria-hidden="true" className={styles.frost}>
                {TEXTS.godOfWar}
              </span>

              {SHARDS.map((shard, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={styles.shard}
                  style={
                    {
                      clipPath: shard.clip,
                      '--dx': `${shard.dx}px`,
                      '--dy': `${shard.dy}px`,
                      '--rot': `${shard.rot}deg`
                    } as CSSProperties
                  }
                >
                  {TEXTS.godOfWar}
                </span>
              ))}
            </>
          )}
        </div>

        <span className={styles.rule} />
      </div>

      {breaking && (
        <>
          {vapours.map((vapour) => (
            <span
              key={`v${vapour.id}`}
              aria-hidden="true"
              className={styles.vapour}
              style={
                {
                  left: vapour.left,
                  width: vapour.size,
                  height: vapour.size,
                  '--drift': vapour.drift,
                  animationDelay: vapour.delay,
                  animationDuration: vapour.duration
                } as CSSProperties
              }
            />
          ))}

          {crystals.map((crystal) => (
            <span
              key={crystal.id}
              aria-hidden="true"
              className={styles.crystal}
              style={
                {
                  left: crystal.left,
                  top: crystal.top,
                  width: crystal.size,
                  height: crystal.size,
                  rotate: crystal.tilt,
                  animationDelay: crystal.delay
                } as CSSProperties
              }
            />
          ))}

          {/* L'ascia sta fuori dal blocco del titolo: attraversa tutto lo
              schermo, non solo il riquadro della scritta. */}
          <div aria-hidden="true" className={styles.axe}>
            {axeImage ? <img className={styles.axeSvg} src={axeImage} alt="" /> : <Axe />}
          </div>
        </>
      )}
    </div>
  );
}
