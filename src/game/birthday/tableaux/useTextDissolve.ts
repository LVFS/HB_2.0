import { useEffect, useRef, useState, type RefObject } from 'react';
import gsap from 'gsap';

/** Coppia di toni di un petalo: chiaro + scuro nello stesso gradiente. */
export type PetalTone = readonly [string, string];

export interface DissolveParticle {
  id: number;
  /** Posizione in px, relativa al contenitore passato all'hook. */
  x: number;
  y: number;
  size: number;
  tone: PetalTone;
  /** Deriva finale, in px relativi al punto di partenza. */
  dx: number;
  dy: number;
  rotate: number;
  delay: number;
  duration: number;
}

export interface DissolveTarget {
  ref: RefObject<HTMLElement | null>;
  /** Quante particelle spendere su questo testo. */
  budget: number;
}

interface Options {
  /** Rispetto a cui vengono calcolate le coordinate delle particelle. */
  containerRef: RefObject<HTMLElement | null>;
  targets: DissolveTarget[];
  /** Vero quando il quadro è quello corrente. */
  active: boolean;
  /** Falso sotto prefers-reduced-motion: niente campionamento, niente particelle. */
  enabled: boolean;
  /** Secondi da quando il quadro diventa attivo. */
  delay: number;
  palette: readonly PetalTone[];
}

/** Sopra questa soglia di alpha il pixel fa parte di una lettera. */
const ALPHA_THRESHOLD = 90;
/** Passo di lettura dei pixel: 1 su 2 per lato, quindi 1 su 4 in tutto. */
const SAMPLE_STEP = 2;

interface Point {
  x: number;
  y: number;
}

/**
 * A capo greedy, calcolato con le stesse metriche del canvas su cui poi
 * disegniamo. Serve perché la didascalia è un <p> che a schermo stretto va
 * su due righe: campionare la frase come riga unica disegnerebbe le
 * particelle dove il testo non è mai stato.
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

/**
 * Ridisegna il testo di `element` su un canvas fuori schermo e restituisce
 * le coordinate dei pixel "accesi", già tradotte nel sistema di riferimento
 * di `origin`.
 *
 * Il font NON è scritto a mano ma letto dall'elemento reale: `font-size` usa
 * clamp(), quindi cambia con la larghezza della finestra, e corsivo/peso
 * devono combaciare o le particelle disegnerebbero una scritta diversa da
 * quella che sta sparendo.
 */
function sampleText(element: HTMLElement, origin: DOMRect, budget: number): Point[] {
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return [];

  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  const style = getComputedStyle(element);
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const fontSize = parseFloat(style.fontSize) || 16;
  const parsedLineHeight = parseFloat(style.lineHeight);
  const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.2;

  const lines = wrapText(ctx, element.textContent ?? '', width);
  if (lines.length === 0) return [];

  // Il blocco di righe va centrato verticalmente nel riquadro dell'elemento:
  // non ricostruiamo il layout del browser, lo approssimiamo — a livello di
  // particelle un pixel di scarto non si vede.
  const top = (height - lines.length * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, top + lineHeight * (i + 0.5));
  });

  const { data } = ctx.getImageData(0, 0, width, height);
  const lit: Point[] = [];
  for (let y = 0; y < height; y += SAMPLE_STEP) {
    for (let x = 0; x < width; x += SAMPLE_STEP) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD) lit.push({ x, y });
    }
  }
  if (lit.length === 0) return [];

  // Sotto-campionamento: non serve una particella per pixel, serve che
  // l'occhio legga ancora la forma delle lettere. Il punto viene pescato a
  // caso DENTRO ogni intervallo invece di prendere sempre il primo: su una
  // lista in ordine di riga, prendere sempre l'n-esimo produce righe
  // regolari, che si leggono come una griglia e non come una scritta che si
  // sbriciola.
  const stride = Math.max(1, Math.ceil(lit.length / budget));
  const offsetX = rect.left - origin.left;
  const offsetY = rect.top - origin.top;
  const picked: Point[] = [];
  for (let i = 0; i < lit.length; i += stride) {
    const point = lit[Math.min(lit.length - 1, i + Math.floor(Math.random() * stride))];
    picked.push({ x: point.x + offsetX, y: point.y + offsetY });
  }
  return picked;
}

function buildParticles(
  points: Point[],
  fontSize: number,
  palette: readonly PetalTone[],
  startId: number,
  originWidth: number
): DissolveParticle[] {
  // Particelle proporzionate al corpo del testo da cui nascono: quelle del
  // numero sono petali, quelle della didascalia briciole. Il minimo è alto
  // apposta — a 3px sparivano dentro l'artwork di sfondo, che è molto carico
  // (verificato a schermo: si leggevano come polvere, non come petali).
  const size = Math.max(5, Math.min(12, fontSize * 0.18));
  const centerX = originWidth / 2;

  return points.map((point, i) => ({
    id: startId + i,
    x: point.x,
    y: point.y,
    size,
    tone: palette[Math.floor(Math.random() * palette.length)],
    // Verso l'esterno (in proporzione a quanto il punto è già lontano dal
    // centro) e verso l'alto: è la direzione del "gommage" che il quadro
    // cita, non una dispersione uniforme in tutte le direzioni.
    dx: (point.x - centerX) * (0.12 + Math.random() * 0.3) + (Math.random() - 0.5) * 44,
    dy: -(40 + Math.random() * 130),
    rotate: (Math.random() - 0.5) * 260,
    delay: Math.random() * 0.28,
    duration: 0.95 + Math.random() * 0.27
  }));
}

/**
 * Il testo si sbriciola in petali invece di sfumare: la citazione più
 * diretta di Clair Obscur, dove i personaggi si disgregano in petali
 * dipinti.
 *
 * QUANDO scatta è il punto delicato. La dissolvenza in uscita del quadro è
 * una sola tween GSAP sull'intero contenitore, gestita da `BirthdayScene`, e
 * la prop `active` resta vera per tutta la sua durata: cambia solo
 * nell'istante in cui il quadro è già del tutto invisibile. Aspettare che
 * `active` diventi falso vorrebbe dire sbriciolare il testo a schermo nero.
 * Perciò il quadro si programma da sé il momento, calcolato sui suoi
 * `TIMINGS`, in modo che la dissolvenza FINISCA quando il fadeOut del
 * contenitore INIZIA: il testo si è già sparso, poi tutto il quadro (petali
 * compresi) sfuma via insieme come già succede oggi.
 *
 * Il timer è un `gsap.delayedCall` sulla timeline globale, non sulla
 * timeline della scena: come le @keyframes CSS degli altri quadri, non si
 * ferma se si mette in pausa la sequenza. Su un salto avanti/indietro
 * invece riparte pulito, perché `active` cambia e l'effetto si rifà.
 */
export function useTextDissolve({
  containerRef,
  targets,
  active,
  enabled,
  delay,
  palette
}: Options): { particles: DissolveParticle[]; dissolving: boolean } {
  const [particles, setParticles] = useState<DissolveParticle[]>([]);

  // I target sono un array letterale ricreato a ogni render: tenerli in una
  // ref evita di far ripartire l'effetto (e quindi il timer) per un motivo
  // che non c'entra nulla. Stessa tecnica di `activeIndexRef` in
  // BirthdayScene.
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const paletteRef = useRef(palette);
  paletteRef.current = palette;

  useEffect(() => {
    if (!active || !enabled) return;

    const timer = gsap.delayedCall(Math.max(0, delay), () => {
      const container = containerRef.current;
      if (!container) return;
      const origin = container.getBoundingClientRect();

      const next: DissolveParticle[] = [];
      targetsRef.current.forEach(({ ref, budget }) => {
        const element = ref.current;
        if (!element) return;
        const points = sampleText(element, origin, budget);
        const fontSize = parseFloat(getComputedStyle(element).fontSize) || 16;
        next.push(
          ...buildParticles(points, fontSize, paletteRef.current, next.length, origin.width)
        );
      });

      // Nessun pixel campionato (font non ancora disponibile, elemento a
      // dimensione zero): meglio non fare nulla che far sparire il testo
      // senza niente al suo posto — resta lo scioglimento CSS di sempre.
      if (next.length > 0) setParticles(next);
    });

    return () => {
      timer.kill();
      setParticles([]);
    };
  }, [active, enabled, delay, containerRef]);

  return { particles, dissolving: particles.length > 0 };
}
