import { useMemo } from 'react';
import { AGE, TEXTS } from '../birthdayConfig';
import styles from './ExpeditionTableau.module.css';

const PETAL_COUNT = 24;
const PAINT_DAB_COUNT = 140;
const PAINT_PALETTE = ['#8a6a3a', '#c9974f', '#e8c37a', '#5c4326', '#f0d9a0'];
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
}

/**
 * Quadro 4 — il tocco pittorico.
 *
 * Se `AGE` è null il numero sparisce e resta la sola frase: il quadro regge
 * lo stesso, non si rompe né lascia un buco. È voluto — l'età di qualcuno non
 * è un dato che si dà per scontato di poter mettere a schermo.
 */
export function ExpeditionTableau({ active }: Props) {
  const petals = useMemo(() => {
    if (prefersReducedMotion()) return [];
    return Array.from({ length: PETAL_COUNT }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      // I ritardi vanno tenuti ben sotto la durata del quadro: un petalo che
      // parte al sesto secondo, su un quadro che ne dura quattro, non lo vede
      // nessuno. Stesso ragionamento per la durata della caduta.
      delay: `${Math.random() * 2.2}s`,
      duration: `${5.5 + Math.random() * 4}s`,
      size: `${5 + Math.random() * 7}px`,
      tilt: `${Math.random() * 360}deg`
    }));
  }, []);

  return (
    <div className={styles.root}>
      {/* Slot opzionale: resta trasparente se il file manca, il gradiente
          di `.root` fa comunque da base. Sta SOTTO la texture pittorica
          (vedi il CSS) — l'artwork reale come base, la grana dipinta sopra. */}
      <div className={styles.bgImage} />
      <div className={styles.paintTexture} style={{ backgroundImage: `url(${PAINT_TEXTURE})` }} />

      {petals.map((petal) => (
        <span
          key={petal.id}
          className={styles.petal}
          style={{
            left: petal.left,
            width: petal.size,
            height: petal.size,
            animationDelay: petal.delay,
            animationDuration: petal.duration,
            rotate: petal.tilt
          }}
        />
      ))}

      <div className={styles.stack}>
        {AGE !== null && (
          <span className={`${styles.number} ${active ? styles.numberActive : ''}`}>{AGE}</span>
        )}
        <p className={`${styles.caption} ${active ? styles.captionActive : ''}`}>
          {AGE !== null ? TEXTS.expedition : TEXTS.expeditionFallback}
        </p>
      </div>
    </div>
  );
}
