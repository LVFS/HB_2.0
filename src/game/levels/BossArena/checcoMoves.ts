import { RANGED_MIN_RANGE } from './arenaConfig';

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

/** Proiettile lanciato `at` secondi dopo il windup, dritto verso il bersaglio.
 *  Parabile: la parata lo rimanda indietro contro Checco. */
export interface CheccoProjectile {
  at: number;
  /** Quota di partenza/volo (bassa = va saltato, alta = va parato/schivato). */
  y: number;
  speed: number;
  damage: number;
}

/** Detriti dal soffitto, attorno al giocatore: marcatore a terra, poi caduta
 *  non parabile. Si schivano muovendosi/dashando. */
export interface CheccoDebris {
  at: number;
  count: number;
  /** Distanza fra un detrito e il successivo, in unità. */
  spacing: number;
  /** Secondi tra marcatore e caduta (il primo), poi `stagger` per ciascuno. */
  warn: number;
  stagger: number;
  damage: number;
}

/** Teletrasporto: dopo il windup Checco sparisce per `vanish` secondi (con un
 *  marcatore a terra dove ricomparirà, dietro il giocatore); `hits[].start`
 *  parte da qui, quindi va fissato un po' oltre `vanish`. */
export interface CheccoTeleport {
  vanish: number;
}

/** Avviso per attacchi non parabili, mostrato sopra il boss. */
export type CheccoWarning = 'salta' | 'schiva' | 'carica' | 'fulmine';

/**
 * Tempesta (solo round 2): Checco salta, resta fermo in aria a caricare energia
 * elettrica (zona di danno attorno a lui: bisogna allontanarsi), poi scaglia da
 * `boltsMin` a `boltsMax` fulmini a ricerca contro il giocatore. Va abbinata a
 * un `leap` con `travel: 'none'`: la fase di `hang` del salto è la carica.
 */
export interface CheccoStorm {
  /** Secondi (dopo la salita) in cui la zona elettrica è attiva, prima dei
   *  fulmini. Checco resta in aria per TUTTA la mossa: `leap.hang` deve coprire
   *  `chargeTime + boltsMax * boltInterval` più il tempo per reagire. */
  chargeTime: number;
  zoneRadius: number;
  zoneDamage: number;
  /** Secondi fra un colpo e l'altro della zona. */
  zoneTick: number;
  boltsMin: number;
  boltsMax: number;
  boltInterval: number;
  boltSpeed: number;
  boltDamage: number;
}

export interface CheccoMove {
  id: string;
  projectiles?: CheccoProjectile[];
  storm?: CheccoStorm;
  /** Carica che accorcia le distanze (dash/balzo addosso al giocatore): si
   *  ferma parando o con un CONTRASTO (dash verso di lui), che lo stordisce. */
  charge?: boolean;
  /** Secondi dopo il windup fino a cui resta l'avviso; se manca, fino alla
   *  fine delle finestre non parabili. */
  warningUntil?: number;
  debris?: CheccoDebris;
  teleport?: CheccoTeleport;
  /** Icona gialla + parola sopra il boss mentre carica un colpo non parabile. */
  warning?: CheccoWarning;
  /** Segnale in anticipo: dura `windup` secondi, il boss diventa rosso. */
  windup: number;
  hits: CheccoHit[];
  leap?: CheccoLeap;
  recovery: number;
  /** Distanza dal bersaglio da cui ha senso usarla. */
  minRange: number;
  maxRange: number;
  /** Peso nella scelta casuale fra le mosse disponibili (default 1): le
   *  cariche ne hanno di più, così si vedono spesso. */
  weight?: number;
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
    charge: true,
    warning: 'carica',
    warningUntil: 0.5,
    windup: 0.7,
    hits: [{ start: 0, duration: 0.5, reach: 1.4, halfHeight: 0.9, offsetY: 1, damage: 12, lunge: 9 }],
    recovery: 0.7,
    minRange: 2.4,
    // Fin dove arriva a velocità massima nel tempo della finestra (0.5s).
    maxRange: 9,
    weight: 3
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
    // scatola ampia. Parabile come le mosse a terra. La hitbox è attiva per
    // TUTTO il volo e l'atterraggio (da 0 a 0.82s dopo il windup), non solo
    // all'arrivo, e segue il corpo di Checco in quota.
    id: 'balzo',
    charge: true,
    warning: 'carica',
    warningUntil: 0.82,
    windup: 0.6,
    leap: { rise: 0.3, hang: 0, fall: 0.3, height: 2.4, travel: 'target' },
    hits: [{ start: 0, duration: 0.82, reach: 2.4, halfHeight: 1, offsetY: 0.9, damage: 14 }],
    recovery: 0.8,
    minRange: 3.5,
    maxRange: 16,
    weight: 2
  },
  {
    // Sale dritto, resta un attimo in aria (il segnale), atterra con un'onda
    // che si espande dai due lati. NON parabile: si schiva col dash o si
    // salta nel momento giusto.
    id: 'schianto',
    warning: 'salta',
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
  },
  {
    // A distanza: lancia un oggetto di scena (un ciak) dritto contro il
    // giocatore. Parabile con la parata a timing: viene RIMANDATO indietro.
    id: 'lancio',
    windup: 0.6,
    projectiles: [{ at: 0, y: 1, speed: 8, damage: 12 }],
    hits: [],
    recovery: 0.9,
    minRange: RANGED_MIN_RANGE,
    maxRange: 16
  },
  {
    // Colpisce il soffitto: cadono detriti attorno al giocatore, ognuno
    // preceduto da un marcatore rosso a terra. Non parabili: si schivano.
    id: 'crollo',
    windup: 0.8,
    debris: { at: 0, count: 3, spacing: 2.2, warn: 0.9, stagger: 0.25, damage: 14 },
    hits: [],
    recovery: 1.5,
    minRange: 0,
    maxRange: 16
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
    charge: true,
    warning: 'carica',
    warningUntil: 0.6,
    windup: 0.6,
    hits: [{ start: 0, duration: 0.6, reach: 1.2, halfHeight: 1, offsetY: 1, damage: 16, lunge: 11 }],
    recovery: 0.9,
    minRange: 3.5,
    // Fin dove arriva a velocità massima nel tempo della finestra (0.6s).
    maxRange: 10.8,
    weight: 3
  },
  {
    // Schianto di round 2: più rapido e con un'onda più ampia.
    id: 'schianto_ampio',
    warning: 'salta',
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
  },
  {
    // Tre lanci in fila a quote diverse: quello basso va saltato (o parato).
    id: 'raffica',
    windup: 0.5,
    projectiles: [
      { at: 0, y: 1, speed: 8.5, damage: 12 },
      { at: 0.4, y: 0.3, speed: 8.5, damage: 12 },
      { at: 0.8, y: 1, speed: 8.5, damage: 12 }
    ],
    hits: [],
    recovery: 0.9,
    minRange: RANGED_MIN_RANGE,
    maxRange: 16
  },
  {
    id: 'crollo_esteso',
    windup: 0.6,
    debris: { at: 0, count: 5, spacing: 1.9, warn: 0.8, stagger: 0.22, damage: 16 },
    hits: [],
    recovery: 1.5,
    minRange: 0,
    maxRange: 16
  },
  {
    // Teletrasporto: sparisce (marcatore a terra dove ricompare, dietro il
    // giocatore) e colpisce appena riappare. Parabile.
    id: 'comparsa',
    windup: 0.35,
    teleport: { vanish: 0.55 },
    hits: [{ start: 0.7, duration: 0.14, reach: 2, halfHeight: 1, offsetY: 1.1, damage: 12 }],
    recovery: 0.8,
    minRange: 0,
    maxRange: 16
  },
  {
    // Solo round 2. Salta e resta fermo in aria a caricare: attorno a lui una
    // zona elettrica ferisce chi ci resta dentro (ci si allontana), poi lancia
    // da 1 a 3 fulmini a ricerca. Dash = schivata; parata a terra = poco danno
    // ma si resta fermi; parata IN ARIA = il fulmine torna indietro e stordisce
    // Checco.
    id: 'tempesta',
    warning: 'fulmine',
    warningUntil: 4.2,
    windup: 0.5,
    // In aria per tutta la mossa: 2.4s di carica + fino a 3 fulmini (0.45s
    // l'uno) + 1s di coda per parare gli ultimi, poi scende.
    leap: { rise: 0.45, hang: 4.75, fall: 0.3, height: 3.4, travel: 'none' },
    storm: {
      chargeTime: 2.4,
      zoneRadius: 3.6,
      zoneDamage: 6,
      zoneTick: 0.5,
      boltsMin: 1,
      boltsMax: 3,
      boltInterval: 0.45,
      boltSpeed: 7.5,
      boltDamage: 18
    },
    hits: [],
    recovery: 1.2,
    minRange: 0,
    maxRange: 16
  }
];
