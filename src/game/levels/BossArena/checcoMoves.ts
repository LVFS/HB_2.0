// Mosse di Checco, in forma di DATI (non hardcoded nel componente): aggiungerne
// una è aggiungere una voce qui, senza toccare la logica di `BossChecco.tsx`.

/** Una finestra di danno dentro una mossa. `start` è misurato dalla fine del
 *  windup. `lunge` > 0 sposta il boss in avanti (u/s) mentre la finestra è
 *  aperta. */
export interface CheccoHit {
  start: number;
  duration: number;
  reach: number;
  halfHeight: number;
  offsetY: number;
  damage: number;
  lunge?: number;
  /** Onda d'urto: la scatola è centrata sul boss e si estende da entrambi i
   *  lati (`reach` per lato), invece di andare solo davanti a lui. */
  bothSides?: boolean;
  /** La parata NON lo annulla: va schivato (dash) o saltato. */
  unparryable?: boolean;
}

/**
 * Asse verticale: dopo il windup Checco si solleva per `rise`, resta in aria
 * per `hang` (il "tell": il giocatore capisce che sta per scendere) e scende
 * per `fall`. Con `travel: 'target'` durante il salto si sposta fino alla X del
 * bersaglio (balzo d'assalto), con `'none'` sale e scende sul posto (schianto).
 * Le finestre di danno (`hits[].start`) partono da qui: vanno fissate a
 * `rise + hang + fall` per sincronizzarle con l'atterraggio.
 */
export interface CheccoLeap {
  rise: number;
  hang: number;
  fall: number;
  height: number;
  travel: 'target' | 'none';
}

export interface CheccoMove {
  id: string;
  /** Segnale in anticipo: dura `windup` secondi, il boss diventa rosso. */
  windup: number;
  hits: CheccoHit[];
  leap?: CheccoLeap;
  recovery: number;
  /** Distanza dal bersaglio da cui ha senso usarla. */
  minRange: number;
  maxRange: number;
}

/** Round 1: 3 mosse semplici, ognuna con telegraph chiaro. */
export const CHECCO_MOVES_ROUND1: CheccoMove[] = [
  {
    id: 'battuta',
    windup: 0.55,
    hits: [{ start: 0, duration: 0.14, reach: 1.9, halfHeight: 0.9, offsetY: 1.2, damage: 10 }],
    recovery: 0.55,
    minRange: 0,
    maxRange: 2.4
  },
  {
    id: 'passo_falso',
    windup: 0.7,
    hits: [{ start: 0, duration: 0.3, reach: 1.4, halfHeight: 0.9, offsetY: 1, damage: 12, lunge: 9 }],
    recovery: 0.7,
    minRange: 3,
    maxRange: 8
  },
  {
    id: 'buen_camino',
    windup: 0.8,
    hits: [{ start: 0, duration: 0.18, reach: 2.8, halfHeight: 1.4, offsetY: 1.4, damage: 14 }],
    recovery: 0.8,
    minRange: 1.4,
    maxRange: 3.4
  },
  {
    // Gap closer: si accuccia, vola addosso al giocatore e atterra con una
    // scatola ampia. Parabile come le mosse a terra.
    id: 'balzo',
    windup: 0.6,
    leap: { rise: 0.3, hang: 0, fall: 0.3, height: 2.4, travel: 'target' },
    hits: [{ start: 0.6, duration: 0.22, reach: 2.4, halfHeight: 1, offsetY: 0.9, damage: 14 }],
    recovery: 0.8,
    minRange: 3.5,
    maxRange: 16
  },
  {
    // Sale dritto, resta un attimo in aria (il segnale), atterra con un'onda
    // che si espande dai due lati. NON parabile: si schiva col dash o si
    // salta nel momento giusto.
    id: 'schianto',
    windup: 0.5,
    leap: { rise: 0.35, hang: 0.3, fall: 0.18, height: 3.4, travel: 'none' },
    hits: [
      {
        start: 0.83,
        duration: 0.25,
        reach: 4.5,
        halfHeight: 0.4,
        offsetY: 0.4,
        damage: 16,
        bothSides: true,
        unparryable: true
      }
    ],
    recovery: 1,
    minRange: 0,
    maxRange: 5.5
  }
];

/** Round 2: le mosse del round 1 più due nuove, coerenti col buff ottenuto. */
export const CHECCO_MOVES_ROUND2: CheccoMove[] = [
  ...CHECCO_MOVES_ROUND1,
  {
    id: 'doppia_battuta',
    windup: 0.5,
    hits: [
      { start: 0, duration: 0.12, reach: 1.9, halfHeight: 0.9, offsetY: 1.2, damage: 10 },
      { start: 0.35, duration: 0.12, reach: 2.2, halfHeight: 0.9, offsetY: 1.2, damage: 10 }
    ],
    recovery: 0.6,
    minRange: 0,
    maxRange: 2.6
  },
  {
    id: 'carica',
    windup: 0.6,
    hits: [{ start: 0, duration: 0.6, reach: 1.2, halfHeight: 1, offsetY: 1, damage: 16, lunge: 11 }],
    recovery: 0.9,
    minRange: 4,
    maxRange: 16
  },
  {
    // Schianto di round 2: più rapido e con un'onda più ampia.
    id: 'schianto_ampio',
    windup: 0.4,
    leap: { rise: 0.28, hang: 0.2, fall: 0.14, height: 3.4, travel: 'none' },
    hits: [
      {
        start: 0.62,
        duration: 0.3,
        reach: 6.5,
        halfHeight: 0.4,
        offsetY: 0.4,
        damage: 18,
        bothSides: true,
        unparryable: true
      }
    ],
    recovery: 0.8,
    minRange: 0,
    maxRange: 7
  }
];
