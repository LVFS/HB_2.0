import { useEffect, useRef, useState, type RefObject } from 'react';

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
  /**
   * Vero quando è ORA di sbriciolare. Arriva dalla timeline (vedi
   * `EXIT_DURATIONS` in BirthdayScene), non da un timer interno.
   */
  armed: boolean;
  /** Falso sotto prefers-reduced-motion: niente campionamento, niente particelle. */
  enabled: boolean;
  palette: readonly PetalTone[];
  /**
   * Secondi da sommare al ritardo di ogni particella, per far scattare lo
   * sbriciolamento VISIBILE più tardi di quando `armed` diventa vero — senza
   * toccare il momento in cui vengono campionate (che può restare immediato:
   * il testo non si è mosso). Il caso d'uso è Expedition, dove il colpo che
   * cancella la scritta arriva secondi dopo l'inizio del suono che lo
   * accompagna. Default 0: tutti gli altri usi restano invariati.
   */
  startDelay?: number;
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
  originWidth: number,
  startDelay: number
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
    delay: startDelay + Math.random() * 0.28,
    duration: 0.95 + Math.random() * 0.27
  }));
}

/**
 * Il testo si sbriciola in petali invece di sfumare: la citazione più
 * diretta di Clair Obscur, dove i personaggi si disgregano in petali
 * dipinti.
 *
 * QUANDO scatta è il punto delicato, e non lo decide questo hook. La
 * dissolvenza in uscita del quadro è una sola tween GSAP sull'intero
 * contenitore, gestita da `BirthdayScene`, e la prop `active` resta vera per
 * tutta la sua durata: aspettare che diventi falsa vorrebbe dire sbriciolare
 * il testo a schermo nero. Il via arriva da un `.call()` piazzato SULLA
 * TIMELINE, tanto prima del checkpoint di fine quadro quanto dura questo
 * effetto — così finisce nell'istante in cui comincia la dissolvenza.
 *
 * Sulla timeline e non su un timer a orologio perché la timeline si ferma ai
 * checkpoint e ci si può saltare sopra: un `gsap.delayedCall` continuava a
 * contare per conto suo e finiva per accendere l'effetto a quadro fermo,
 * congelato fuori tempo (bug reale, visto a schermo). Come effetto
 * collaterale gratuito, saltare avanti a mano salta anche l'effetto: GSAP
 * non esegue i `.call()` con `.seek()`.
 */
export function useTextDissolve({
  containerRef,
  targets,
  armed,
  enabled,
  palette,
  startDelay = 0
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
    if (!armed || !enabled) return;

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
        ...buildParticles(points, fontSize, paletteRef.current, next.length, origin.width, startDelay)
      );
    });

    // Nessun pixel campionato (font non ancora disponibile, elemento a
    // dimensione zero): meglio non fare nulla che far sparire il testo senza
    // niente al suo posto — resta lo scioglimento CSS di sempre.
    if (next.length > 0) setParticles(next);

    return () => setParticles([]);
  }, [armed, enabled, containerRef, startDelay]);

  return { particles, dissolving: particles.length > 0 };
}
