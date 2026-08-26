import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import gsap from 'gsap';
import { useSfx } from '@/hooks/useSfx';
import { AGE, TEXTS } from '../birthdayConfig';
import { useTextDissolve, type PetalTone } from './useTextDissolve';
import styles from './ExpeditionTableau.module.css';

const PETAL_COUNT = 50;
const PAINT_DAB_COUNT = 140;
const PAINT_PALETTE = ['#8a6a3a', '#c9974f', '#e8c37a', '#5c4326', '#f0d9a0'];

/**
 * Tre varianti, non una: rosso, bianco e oro. Ognuna resta a due toni —
 * chiaro sopra, scuro sotto, nello stesso gradiente — perché è quello a dare
 * al petalo l'aria di essere dipinto invece di essere un ritaglio di colore
 * piatto. L'oro è la variante che c'era già: adesso è una delle tre e non
 * più l'unica, così i petali non si confondono più con lo sfondo caldo.
 */
const PETAL_PALETTE: readonly PetalTone[] = [
  ['rgba(232, 120, 100, 0.9)', 'rgba(150, 45, 35, 0.4)'],
  ['rgba(255, 250, 240, 0.95)', 'rgba(210, 195, 170, 0.35)'],
  ['rgba(255, 226, 160, 0.85)', 'rgba(196, 142, 60, 0.35)']
];

/**
 * ────────────────────────────────────────────────────────────────────────
 *  I TEMPI SONO TARATI SU `simon_erase.mp3`, non a occhio (stesso principio
 *  già seguito per Bloodborne/God of War). Un file solo, due momenti:
 *
 *    simon_erase.mp3   6.09s — la CARICA riempie i primi ~3s (un rullio
 *                             continuo, non un colpo secco), poi tre secondi
 *                             di silenzio quasi totale, poi il COLPO — il
 *                             picco vero del file — a 4.30s.
 *
 *  Il bagliore rosso segna la carica (dura finché non arriva il colpo); il
 *  testo si sbriciola e il fumo sale sul colpo, non prima.
 * ────────────────────────────────────────────────────────────────────────
 */

/** Il picco di `simon_erase.mp3`: il colpo che cancella la scritta. */
const IMPACT_AT = 4.3;
/**
 * Quanto ci mettono le ultime particelle (petali o fumo) a finire di
 * sparire dopo il colpo — non il colpo stesso, la sua coda. Stesso valore
 * di prima, quando era l'intera durata dell'effetto: rappresentava già
 * "quanto dura il disperdersi", solo misurato dal momento sbagliato.
 */
const SCATTER_TAIL = 1.5;

/**
 * Quanto dura tutta l'uscita. Esportata perché la LEGGE la timeline
 * (`EXIT_DURATIONS` in BirthdayScene.tsx): è lei a dare il via all'effetto
 * con questo anticipo sulla fine del quadro, così l'ultimo petalo svanisce
 * nell'istante in cui comincia la dissolvenza.
 */
export const EXIT_DURATION = IMPACT_AT + SCATTER_TAIL;

/** Costante di modulo, non un array letterale: deve avere identità stabile. */
const WARM_UP = ['simon_erase'] as const;

const SMOKE_COUNT = 9;

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Texture pittorica generata via canvas — pennellate (ellissi ruotate,
 * opacità bassa e casuale) nella stessa palette calda già in uso nel
 * quadro, non un'immagine sourcata: un asset scaricato rischierebbe di
 * stonare col resto (tutto il resto del quadro è gradiente+CSS), questa si
 * integra invece perché nasce con la stessa "grana" del resto. Stessa
 * tecnica di `createCloudTexture`/`createRockCanvas` già in uso altrove nel
 * progetto (menu 3D, selezione livelli) per lo stesso motivo: nessun asset
 * da scaricare. Generata una volta sola a livello di modulo, non a ogni
 * render.
 */
function createPaintTexture(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  for (let i = 0; i < PAINT_DAB_COUNT; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const w = 18 + Math.random() * 55;
    const h = 4 + Math.random() * 13;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.random() * Math.PI);
    ctx.globalAlpha = 0.04 + Math.random() * 0.09;
    ctx.fillStyle = PAINT_PALETTE[Math.floor(Math.random() * PAINT_PALETTE.length)];
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return canvas.toDataURL();
}

const PAINT_TEXTURE = createPaintTexture();

interface Props {
  active: boolean;
  /** Via allo sbriciolamento, dalla timeline (vedi `EXIT_DURATION`). */
  exiting: boolean;
}

/**
 * Quadro 4 — il tocco pittorico.
 *
 * Se `AGE` è null il numero sparisce e resta la sola frase: il quadro regge
 * lo stesso, non si rompe né lascia un buco. È voluto — l'età di qualcuno non
 * è un dato che si dà per scontato di poter mettere a schermo.
 *
 * L'USCITA cita il "Gommage" del gioco: Simon carica un colpo (bagliore
 * rosso, `simon_erase.mp3` che rulla) e poi cancella la scritta dalla tela,
 * che si sbriciola in petali — e un po' di fumo/polvere sale insieme a loro.
 * Il testo non sfuma mai da solo: prima di questo effetto resta fermo a
 * piena opacità (vedi il fix a `dissolve` più sotto nel CSS), poi si
 * sbriciola tutto insieme quando arriva il colpo — non prima, non a pezzi.
 */
export function ExpeditionTableau({ active, exiting }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);

  const reducedMotion = prefersReducedMotion();
  const striking = exiting && !reducedMotion;
  const playSfx = useSfx(WARM_UP);

  // Un file solo, un solo lancio: la carica e il colpo sono la stessa
  // traccia, non due suoni separati da sincronizzare. Il bagliore e il fumo
  // seguono via CSS (rispettivamente durata e ritardo su --impact-at), non
  // servono altri gsap.delayedCall qui.
  useEffect(() => {
    if (!striking) return;
    const timer = gsap.delayedCall(0, () => playSfx('simon_erase'));
    return () => {
      timer.kill();
    };
  }, [striking, playSfx]);

  const petals = useMemo(() => {
    if (reducedMotion) return [];
    return Array.from({ length: PETAL_COUNT }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      // I ritardi vanno tenuti ben sotto la durata del quadro: un petalo che
      // parte al sesto secondo, su un quadro che ne dura quattro, non lo vede
      // nessuno. Stesso ragionamento per la durata della caduta.
      delay: `${Math.random() * 2.2}s`,
      duration: `${5.5 + Math.random() * 4}s`,
      size: `${5 + Math.random() * 7}px`,
      tilt: `${Math.random() * 360}deg`,
      tone: PETAL_PALETTE[Math.floor(Math.random() * PETAL_PALETTE.length)]
    }));
  }, [reducedMotion]);

  const { particles, dissolving } = useTextDissolve({
    containerRef: rootRef,
    // Il numero è più grande e più "pieno": si prende qualche particella in
    // più della didascalia, o al confronto sembrerebbe sbriciolarsi meno.
    targets: [
      { ref: numberRef, budget: 140 },
      { ref: captionRef, budget: 170 }
    ],
    armed: exiting,
    enabled: !reducedMotion,
    palette: PETAL_PALETTE,
    // I petali vanno campionati subito (il testo non si è ancora mosso) ma
    // devono sbriciolarsi solo al colpo, non alla carica: è questo ritardo a
    // farli aspettare, non il momento del campionamento.
    startDelay: IMPACT_AT
  });

  // Fumo che si alza col colpo, insieme ai petali — non prima: stessa idea
  // degli sbuffi di vapore di God of War, qui più caldi (polvere di una tela
  // cancellata, non ghiaccio).
  const smoke = useMemo(() => {
    if (reducedMotion) return [];
    return Array.from({ length: SMOKE_COUNT }, (_, i) => ({
      id: i,
      left: `${30 + Math.random() * 40}%`,
      size: `${70 + Math.random() * 90}px`,
      drift: `${(Math.random() - 0.5) * 100}px`,
      delay: `${IMPACT_AT + Math.random() * 0.4}s`,
      duration: `${1 + Math.random() * 0.6}s`
    }));
  }, [reducedMotion]);

  const timing = { '--impact-at': `${IMPACT_AT}s` } as CSSProperties;

  return (
    <div className={styles.root} ref={rootRef} style={timing}>
      {striking && <span aria-hidden="true" className={styles.eraseGlow} />}
      {/* Slot opzionale: resta trasparente se il file manca, il gradiente
          di `.root` fa comunque da base. Sta SOTTO la texture pittorica
          (vedi il CSS) — l'artwork reale come base, la grana dipinta sopra. */}
      <div className={`${styles.bgImage} ${active ? styles.bgImageActive : ''}`} />
      <div className={styles.paintTexture} style={{ backgroundImage: `url(${PAINT_TEXTURE})` }} />

      {petals.map((petal) => (
        <span
          key={petal.id}
          className={styles.petal}
          style={
            {
              left: petal.left,
              width: petal.size,
              height: petal.size,
              animationDelay: petal.delay,
              animationDuration: petal.duration,
              rotate: petal.tilt,
              '--petal-a': petal.tone[0],
              '--petal-b': petal.tone[1]
            } as CSSProperties
          }
        />
      ))}

      <div className={styles.stack}>
        {AGE !== null && (
          <span
            ref={numberRef}
            className={`${styles.number} ${active ? styles.numberActive : ''} ${
              dissolving ? styles.vanishing : ''
            }`}
          >
            {AGE}
          </span>
        )}
        <p
          ref={captionRef}
          className={`${styles.caption} ${active ? styles.captionActive : ''} ${
            dissolving ? styles.vanishing : ''
          }`}
        >
          {AGE !== null ? TEXTS.expedition : TEXTS.expeditionFallback}
        </p>
      </div>

      {striking &&
        smoke.map((puff) => (
          <span
            key={`s${puff.id}`}
            aria-hidden="true"
            className={styles.smokePuff}
            style={
              {
                left: puff.left,
                width: puff.size,
                height: puff.size,
                '--drift': puff.drift,
                animationDelay: puff.delay,
                animationDuration: puff.duration
              } as CSSProperties
            }
          />
        ))}

      {/* I petali del testo vivono in un livello a parte sopra `.stack`, con
          coordinate assolute rispetto a `.root`: così non toccano il layout
          della griglia del testo (che sarebbe la cosa più facile da rompere)
          e possono derivare fuori dal riquadro delle lettere. */}
      {dissolving && (
        <div className={styles.textParticles} aria-hidden="true">
          {particles.map((particle) => (
            <span
              key={particle.id}
              className={styles.textParticle}
              style={
                {
                  left: `${particle.x}px`,
                  top: `${particle.y}px`,
                  width: `${particle.size}px`,
                  height: `${particle.size}px`,
                  animationDelay: `${particle.delay}s`,
                  animationDuration: `${particle.duration}s`,
                  '--petal-a': particle.tone[0],
                  '--petal-b': particle.tone[1],
                  '--dx': `${particle.dx}px`,
                  '--dy': `${particle.dy}px`,
                  '--rot': `${particle.rotate}deg`
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
