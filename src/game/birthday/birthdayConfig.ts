/**
 * ════════════════════════════════════════════════════════════════════════
 *  DA COMPILARE A MANO — è tutto qui dentro.
 * ════════════════════════════════════════════════════════════════════════
 */

/** Il nome che compare nel quadro finale. */
export const RECIPIENT_NAME = 'NOME';

/**
 * L'età, per il quadro di Expedition 33.
 * Metti `null` se preferisci non mostrarla: al suo posto compare la frase
 * simbolica qui sotto, e il quadro funziona lo stesso.
 */
export const AGE: number | null = null;

/** Testi dei sei quadri. Sono una proposta: riscrivili senza pensarci. */
export const TEXTS = {
  bloodborne: 'Un’ombra è passata... un altro anno.',
  godOfWar: 'Tanti auguri',
  /** Il messaggio vero, quello personale. È il beat più lento della sequenza. */
  hollowKnight: 'Che questo nuovo capitolo sia gentile con te.',
  /** Mostrata sotto il numero, o al suo posto se AGE è null. */
  expedition: 'e ogni anno un colore in più.',
  expeditionFallback: 'Un altro giro attorno al sole.',
  residentEvil: 'Obiettivo: sopravvivere a un altro anno — completato',
  gtaTitle: 'Buon compleanno'
} as const;

/** Le statistiche che scorrono nel finale in stile "mission passed". */
export const GTA_STATS: { label: string; from: number; to: number; suffix?: string }[] = [
  { label: 'Regali ricevuti', from: 0, to: 47 },
  { label: 'Torte mangiate', from: 0, to: 12 },
  { label: 'Livello amicizia', from: 0, to: 100, suffix: '%' }
];

/**
 * Tempi di ogni quadro, in secondi.
 *
 *   fadeIn  — quanto ci mette a comparire (0 = stacco netto)
 *   hold    — quanto resta fermo a piena opacità
 *   fadeOut — quanto ci mette a sparire
 *
 * Il quadro successivo inizia a comparire MENTRE il precedente svanisce
 * (vedi CROSSFADE in BirthdayScene): sono dissolvenze incrociate, non stacchi.
 * L'ultimo quadro non ha fadeOut: è lo stato finale e resta lì.
 */
export interface TableauTiming {
  fadeIn: number;
  hold: number;
  fadeOut: number;
}

/**
 * Moltiplica tutti gli `hold` insieme — un numero solo per allungare/
 * accorciare l'intera sequenza mantenendo il ritmo relativo tra un quadro e
 * l'altro. `fadeIn`/`fadeOut` restano invariati apposta: sono le
 * transizioni, già tarate per "sentirsi giuste" a prescindere da quanto
 * dura la sequenza — solo il tempo "fermo" di ogni quadro si allunga.
 */
export const HOLD_SCALE = 1;

const BASE_TIMINGS: Record<TableauId, TableauTiming> = {
  // Apertura misteriosa: entra lentissimo, è il tono che dà il via.
  bloodborne: { fadeIn: 1.2, hold: 1.8, fadeOut: 1 },
  godOfWar: { fadeIn: 0.9, hold: 2.6, fadeOut: 0.8 },
  // Il beat più lento: qui c'è il messaggio vero, deve avere aria intorno.
  hollowKnight: { fadeIn: 1.6, hold: 2.4, fadeOut: 1.4 },
  expedition: { fadeIn: 1, hold: 2.5, fadeOut: 0.9 },
  // Stacco netto in entrata E in uscita: è una gag, deve arrivare come uno
  // schiaffo dopo tre quadri solenni. Una dissolvenza la ammorbidirebbe.
  residentEvil: { fadeIn: 0.05, hold: 2.45, fadeOut: 0.2 },
  // Il climax: resta a schermo, non svanisce.
  gta: { fadeIn: 0.7, hold: 5, fadeOut: 0 }
};

export const TIMINGS: Record<TableauId, TableauTiming> = Object.fromEntries(
  Object.entries(BASE_TIMINGS).map(([id, timing]) => [id, { ...timing, hold: timing.hold * HOLD_SCALE }])
) as Record<TableauId, TableauTiming>;

export type TableauId =
  | 'bloodborne'
  | 'godOfWar'
  | 'hollowKnight'
  | 'expedition'
  | 'residentEvil'
  | 'gta';

/** L'ordine della sequenza. Cambiarlo qui cambia la scaletta. */
export const SEQUENCE: TableauId[] = [
  'bloodborne',
  'godOfWar',
  'hollowKnight',
  'expedition',
  'residentEvil',
  'gta'
];
