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
  residentEvil: 'Obiettivo: sopravvivere a un altro anno — completato',
  godOfWar: 'Tanti auguri',
  /** Il messaggio vero, quello personale. È il beat più lento della sequenza. */
  hollowKnight: 'Vent’anni e cinque primavere. Un quarto di secolo attraversato nell’oscurità, tra sogni, cadute e battaglie. Ma sei ancora qui.',
  bloodborne: 'Un’ombra è passata... un altro anno.',
  /** Mostrata sotto il numero, o al suo posto se AGE è null. */
  expedition: 'e ogni anno un colore in più.',
  expeditionFallback: 'Un altro giro attorno al sole.',
  gtaTitle: 'Buon compleanno'
} as const;

/** Le statistiche che scorrono nel finale in stile "mission passed". */
export const GTA_STATS: { label: string; from: number; to: number; suffix?: string }[] = [
  { label: 'Regali ricevuti', from: 0, to: 47 },
  { label: 'Torte mangiate', from: 0, to: 12 },
  { label: 'Livello amicizia', from: 0, to: 100, suffix: '%' }
];

/**
 * Da che punto del brano deve partire ogni quadro, come "minuti:secondi"
 * (es. "7:23"). Un quadro assente da questo oggetto (o senza voce qui)
 * parte semplicemente dall'inizio del file.
 */
export const MUSIC_START_TIMES: Partial<Record<TableauId, string>> = {
  residentEvil: '1:16',
  hollowKnight: '1:56',
  godOfWar: '0:00',
  bloodborne: '0:00',
  expedition: '7:24',
  gta: '0:00'
};

/** "mm:ss" → secondi. Input malformato: avviso in console, si parte da 0. */
function parseTimecode(value: string): number {
  const match = value.trim().match(/^(\d+):(\d{1,2})$/);
  const seconds = match ? Number(match[2]) : NaN;
  if (!match || seconds > 59) {
    console.warn(`MUSIC_START_TIMES: timecode "${value}" non valido, parto da 0.`);
    return 0;
  }
  return Number(match[1]) * 60 + seconds;
}

/** `MUSIC_START_TIMES` già convertito in secondi, calcolato una volta sola. */
export const MUSIC_START_SECONDS: Partial<Record<TableauId, number>> = Object.fromEntries(
  Object.entries(MUSIC_START_TIMES).map(([id, value]) => [id, parseTimecode(value as string)])
);

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
  bloodborne: { fadeIn: 1.2, hold: 10, fadeOut: 1 },
  godOfWar: { fadeIn: 0.9, hold: 10, fadeOut: 0.8 },
  // Il beat più lento: qui c'è il messaggio vero, deve avere aria intorno.
  hollowKnight: { fadeIn: 1.6, hold: 10, fadeOut: 1.4 },
  expedition: { fadeIn: 1, hold: 10, fadeOut: 0.9 },
  // Stacco netto in ENTRATA: è una gag, deve arrivare come uno schiaffo dopo
  // tre quadri solenni, e una dissolvenza la ammorbidirebbe.
  // In uscita invece 0.55 e non più 0.2: il quadro non sfuma e basta, viene
  // tagliato in due da una motosega (vedi ResidentEvilTableau), e a 0.2s il
  // taglio si intuiva soltanto. Resta comunque il quadro più rapido di tutti.
  residentEvil: { fadeIn: 0.05, hold: 10, fadeOut: 0.55 },
  // Il climax: resta a schermo, non svanisce.
  gta: { fadeIn: 0.7, hold: 10, fadeOut: 0 }
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
  'residentEvil',
  'hollowKnight',
  'godOfWar',
  'bloodborne',
  'expedition',
  'gta'
];
