/**
 * Tutti i numeri del tunnel (FASE 8): nessun valore magico altrove. Valori
 * iniziali da tarare in playtest (vedi `docs/FASE8_TUNNEL_INSEGUIMENTO.md`,
 * sezioni 5-7). Le costanti del giocatore (attacco, parata, cura, salto) sono
 * quelle dell'arena (`../BossArena/arenaConfig.ts`): è lo stesso D.
 */
import type { PerkId } from '@/data/tunnelCameos';

// --- corsa -----------------------------------------------------------------
/** Velocità di corsa (unità/s): D corre da solo verso destra. */
export const TUNNEL_RUN_SPEED = 9;
/** Movimento avanti/indietro lungo la corsa concesso al giocatore (± unità) con A/D e velocità con cui lo fa. */
export const TUNNEL_STRAFE_RANGE = 3.5;
export const TUNNEL_STRAFE_SPEED = 7;
// --- le tre vie (FASE 10, tappa 2) -----------------------------------------------
/** Ringhiere su cui D scivola, dalla più lontana (0) alla più vicina (2). Si cambia con W/S. */
export const TUNNEL_LANES = 3;
export const TUNNEL_LANE_START = 1;
/** Profondità (z nel mondo) di ogni via. Con la camera inclinata, la via lontana sta più in alto sullo schermo. */
export const TUNNEL_LANE_Z = [-3.2, 0, 3.2] as const;
/** Secondi per passare a una via vicina. */
export const TUNNEL_LANE_CHANGE_TIME = 0.16;
/** Una minaccia colpisce (o un oggetto si raccoglie) se la via di D è più vicina di così alla sua: durante il cambio D è "fra due vie". */
export const TUNNEL_LANE_HIT_TOLERANCE = 0.55;
/** Ingrandimento per via, solo visivo (finto effetto prospettiva): la via lontana è un po' più piccola. */
export const TUNNEL_LANE_SCALE = [0.92, 1, 1.08] as const;
/** Inclinazione (radianti) della camera verso il basso: dà profondità alle vie senza lasciare la proiezione ortografica. */
export const TUNNEL_CAMERA_PITCH = 0.35;
/** Larghezza dei binari e distanza fra una tacca e l'altra lungo la corsa. */
export const TUNNEL_RAIL = { depth: 0.55, tickSpacing: 1.8 } as const;

/** La camera sta davanti a D di tot unità (D nel quinto sinistro dello schermo). */
export const TUNNEL_CAMERA_LEAD = 5;
/** Anticipo extra della camera per ogni punto di tempo oltre 1 (a 1.3 → +1.2 unità). */
export const TUNNEL_CAMERA_LEAD_PER_TEMPO = 4;
/** Altezza (unità di mondo) della porzione di scena visibile: uguale a OGNI risoluzione (lo zoom si deriva da qui).
 *  Più è alta, più si vede in avanti e più tempo c'è per decidere. */
export const TUNNEL_VIEW_HEIGHT = 12.5;
/** Larghezza massima (unità) della porzione visibile: oltre questo rapporto (ultrawide) si zooma di più invece di mostrare altro mondo. */
export const TUNNEL_VIEW_MAX_WIDTH = 30;
/** Quota (sullo schermo) del centro della camera: i piedi di D, in mezzo alla via centrale, stanno a 0. */
export const TUNNEL_CAMERA_EYE_Y = 2.5;
/** Le minacce nascono oltre il bordo destro REALE dello schermo, più questo margine (unità). */
export const TUNNEL_SPAWN_MARGIN = 2.5;
/** Minimo davanti a D a cui nascono (anche con finestre strette): è il valore usato da `validateScript()`. */
export const TUNNEL_SPAWN_AHEAD_MIN = 18;
/** Distanza dietro D oltre la quale le minacce vengono tolte (più del bordo sinistro di una finestra ultrawide). */
export const TUNNEL_DESPAWN_BEHIND = 16;

// --- finestre del giocatore (più larghe dell'arena: qui tutto arriva a 9 u/s) --
/**
 * Dash e parata dell'arena sono tarati su avversari lenti: a 9 unità/s il
 * contatto con un muro o un raggio dura ~0.14 s, e un dash da 0.18 s lascerebbe
 * una tolleranza di ±0.02 s (impossibile da premere). Nel tunnel le finestre
 * sono più lunghe, così c'è margine di errore umano (~±0.12 s).
 */
export const TUNNEL_DASH_DURATION = 0.4;
export const TUNNEL_DASH_COOLDOWN = 0.7;
/**
 * Lo scatto sposta D di `TUNNEL_DASH_DISTANCE` unità nella direzione tenuta (A indietro, D avanti;
 * senza direzione, in avanti) in `TUNNEL_DASH_TRAVEL` secondi, restando invulnerabile per tutta la
 * durata. È solo spostamento: NON accorcia la distanza da Checco (quella è in metri lungo la corsa).
 */
export const TUNNEL_DASH_DISTANCE = 3.2;
export const TUNNEL_DASH_TRAVEL = 0.14;
/** Parata: finestra attiva e recupero (s) e portata davanti a D (unità). */
export const TUNNEL_PARRY = { active: 0.28, recovery: 0.2, reach: 1.6 } as const;

// --- distanza dalla marionetta (`gap`, in METRI) -----------------------------
/** `gap` è una distanza vera: la marionetta sta a `TUNNEL_PUPPET_DIST_MIN + gap` unità davanti a D.
 *  0 = raggiunta, 100 = sfuggita (si perde). Fuori dal bordo destro dello schermo non si vede. */
export const TUNNEL_GAP_MAX = 100;
/** Distanza iniziale in base all'esito del QTE finale in arena: riuscito / non giocato / fallito. */
export const TUNNEL_GAP_START_BONUS = 35;
export const TUNNEL_GAP_START_NEUTRAL = 45;
export const TUNNEL_GAP_START_MALUS = 55;
/** Velocità base con cui D si avvicina (m/s, negativa); lo Slancio la moltiplica (`SLANCIO_GAP_DRIFT`). */
export const TUNNEL_GAP_DRIFT_PER_SEC = -0.42;
/** Spinte sulla distanza (m): si applicano in ~1 s (`TUNNEL_GAP_SMOOTH`), mai di colpo. Negative = si guadagna. */
export const TUNNEL_GAP_REFLECT_BONUS = -8;
export const TUNNEL_GAP_HIT_PENALTY = 12;
/** Colpo di spada andato a segno sulla marionetta (a distanza ravvicinata o col pugno Gomu Gomu). */
export const TUNNEL_GAP_MELEE = -3;
/** Quanto in fretta (1/s) una spinta sulla distanza viene applicata. */
export const TUNNEL_GAP_SMOOTH = 2.5;
/** Prima dell'ultima sezione la distanza non scende sotto questo valore (Checco è appena visibile): la corsa deve durare. */
export const TUNNEL_GAP_FLOOR_BEFORE_FINALE = 9;
/** Dopo una sconfitta di vita si riparte con al massimo questa distanza: altrimenti, se la sezione era
 *  cominciata con la marionetta già lontana, si morirebbe in loop appena rientrati. */
export const TUNNEL_GAP_RESPAWN_MAX = 60;
/** Distanza (unità) fra D e la marionetta con la distanza a 0 (spazio visivo minimo). */
export const TUNNEL_PUPPET_DIST_MIN = 2.2;
/** Tempo limite della corsa (secondi REALI): scaduto, o con Checco oltre `TUNNEL_GAP_MAX`, si rifà l'inseguimento dall'inizio. */
export const TUNNEL_TIME_LIMIT = 300;

// --- Slancio: più corri senza farti male, più il mondo va veloce (FASE 9) --------
/** Secondi di corsa senza danni per salire di un livello. */
export const SLANCIO_STEP = 8;
/** Moltiplicatore del tempo del MONDO per livello (minacce, proiettili, detriti: il giocatore resta in tempo reale). */
export const SLANCIO_TEMPO = [1, 1.1, 1.2, 1.3] as const;
/** Quanto più in fretta cala la distanza dalla marionetta a ogni livello. */
export const SLANCIO_GAP_DRIFT = [1, 1.6, 2.2, 2.8] as const;
/** Velocità con cui il tempo del mondo rincorre il livello (1/s). */
export const SLANCIO_EASE = 2.5;
/** Leggibilità minima (s) degli avvisi AL TEMPO MASSIMO: un po' più bassa del normale, è la parte "difficile" dello Slancio. */
export const TUNNEL_TELEGRAPH_MIN_AT_MAX_TEMPO = 0.55;

// --- oggetti del mondo e casella bonus (FASE 9-10) --------------------------------
/** Oggetti sul percorso: Sfera del Drago, freccia gialla del Cammino, scatola-bonus (riempie la casella). */
export type PickupKind = 'sphere' | 'arrow' | 'box' | 'bean';
/** Bonus che si tengono nella casella e si usano con `E`. */
export type ItemId = 'gomu' | 'saiyan' | 'zoltraak' | 'ciak' | 'senzu' | 'nuvola' | 'gatto';
export const ITEM_LABEL: Record<ItemId, string> = {
  gomu: 'Gomu Gomu',
  saiyan: 'Super Saiyan',
  zoltraak: 'Zoltraak',
  ciak: 'Ciak!',
  senzu: 'Senzu',
  nuvola: 'Nuvola Speedy',
  gatto: 'Gatto randagio'
};
/**
 * Pesi per estrarre un bonus dalla scatola in base alla distanza da Checco (stile Mario Kart:
 * più sei indietro, più i bonus servono a recuperare). Si sceglie la prima fascia con `maxGap >= gap`.
 * Il Senzu pesa il triplo se la vita è sotto `ITEM_LOW_HP`.
 */
export const ITEM_WEIGHTS: readonly { maxGap: number; weights: Record<ItemId, number> }[] = [
  { maxGap: 15, weights: { gomu: 2, saiyan: 0, zoltraak: 1, ciak: 2, senzu: 2, nuvola: 2, gatto: 1 } },
  { maxGap: 40, weights: { gomu: 2, saiyan: 1, zoltraak: 2, ciak: 2, senzu: 2, nuvola: 2, gatto: 2 } },
  { maxGap: Infinity, weights: { gomu: 1, saiyan: 3, zoltraak: 3, ciak: 1, senzu: 1, nuvola: 1, gatto: 3 } }
];
export const ITEM_LOW_HP = 60;
/** Ingombro di ogni oggetto (unità); la freccia gialla è una pedana a terra. */
export const PICKUP_SIZE: Record<PickupKind, { width: number; height: number }> = {
  sphere: { width: 0.5, height: 0.5 },
  box: { width: 0.8, height: 0.8 },
  arrow: { width: 1.3, height: 0.12 },
  bean: { width: 0.5, height: 0.5 }
};
/** Quota di default degli oggetti sospesi (i piedi di D sono a 0, il centro del corpo a ~0.95). */
export const PICKUP_DEFAULT_Y = 0.95;
/** Sfera del Drago: sette = SHENRON, che esaudisce un DESIDERIO a scelta (vedi sotto). Colpiti, se ne perde una. */
export const SPHERES_FOR_SHENRON = 7;

// --- desideri di Shenron (FASE 10, tappa 4) -------------------------------------------
/**
 * Tre desideri, uno per tipo: PERMANENTE (dura finché non si ricomincia l'inseguimento dall'inizio), A USI
 * (si consuma) e A TEMPO. Ogni volta si offre uno per tipo, estratti dal loro gruppo; i permanenti già avuti non tornano.
 */
export type WishKind = 'permanente' | 'a usi' | 'a tempo';
export type WishId =
  | 'cuore'
  | 'respiro'
  | 'scatto'
  | 'haki'
  | 'magnete'
  | 'slancio'
  | 'istinto'
  | 'riserva'
  | 'kaioken'
  | 'ultreia';
export interface WishDef {
  kind: WishKind;
  label: string;
  description: string;
  /** Nome breve per la HUD. */
  short: string;
}
export const WISHES: Record<WishId, WishDef> = {
  cuore: { kind: 'permanente', label: 'Cuore del Drago', short: 'Cuore', description: '+30 di vita massima (e subito +30).' },
  respiro: { kind: 'permanente', label: 'Fagioli a volontà', short: 'Fagioli', description: 'Ogni nemico caduto lascia un fagiolo (cura di più) e subito +20 di vita.' },
  scatto: { kind: 'permanente', label: 'Istantanea', short: 'Scatto', description: 'Lo scatto si ricarica in metà tempo e va più lontano.' },
  haki: { kind: 'permanente', label: 'Haki dell’osservazione', short: 'Haki', description: 'La parata dura di più e arriva più lontano.' },
  magnete: { kind: 'permanente', label: 'Dragon Radar', short: 'Radar', description: 'Raccogli anche gli oggetti delle vie vicine.' },
  slancio: { kind: 'permanente', label: 'Kaioken passivo', short: 'Kaioken+', description: 'Lo Slancio sale molto più in fretta (ogni 5 s invece di 8).' },
  istinto: { kind: 'a usi', label: 'Istinto Superiore', short: 'Istinto', description: 'Schivi da solo i prossimi 2 colpi che subiresti.' },
  riserva: { kind: 'a usi', label: 'Riserva di Frieren', short: 'Zoltraak', description: '3 Zoltraak in più, da lanciare con {berserk} quando vuoi.' },
  kaioken: { kind: 'a tempo', label: 'Kaioken ×10', short: 'Kaioken', description: '25 s di Slancio al massimo e Checco si avvicina il doppio.' },
  ultreia: { kind: 'a tempo', label: 'Ultreia!', short: 'Ultreia', description: '30 s di scatto senza attesa: puoi scattare di continuo.' }
};
export const WISH_POOLS: Record<WishKind, readonly WishId[]> = {
  permanente: ['cuore', 'respiro', 'scatto', 'haki', 'magnete', 'slancio'],
  'a usi': ['istinto', 'riserva'],
  'a tempo': ['kaioken', 'ultreia']
};
/** Numeri dei desideri. */
export const WISH_NUMBERS = {
  heartBonus: 30,
  dash: { cooldown: 0.35, extraDistance: 1.2 },
  haki: { active: 0.42, reach: 2.4 },
  magnet: { lane: 1.3, forgiveness: 0.9 },
  slancioStep: 5,
  instinctUses: 2,
  reserveCharges: 3,
  kaioken: { seconds: 25, driftMultiplier: 2 },
  ultreia: { seconds: 30 }
} as const;
/** Fagiolo Senzu: vita ridata subito. */
export const SENZU_HEAL = 40;
/** Frutto Gomu Gomu: per `duration` secondi la spada diventa un pugno a gomma. */
export const GOMU = { duration: 8, reachMultiplier: 4 } as const;
/** Aura Super Saiyan: invincibile, Slancio al massimo, travolge gli ostacoli. */
export const SAIYAN = { duration: 5 } as const;
/** Ciak!: bullet-time (tempo del mondo × `tempo`). */
export const CIAK = { duration: 3, tempo: 0.45 } as const;
/** Nuvola Speedy: tenendo premuto il salto sale, rilasciandolo scende. Dura duration secondi; maxY è la quota massima. */
export const NUVOLA = { duration: 18, rise: 7, fall: 5, maxY: 3.8 } as const;
/**
 * Gatto randagio (mezzo gatto di Stray, mezzo vecchio gatto cieco da un occhio e spelacchiato): compare, cresce in grow
 * secondi e D gli sale in groppa — invulnerabile e più veloce. Per restare in sella lo si coccola (J) e gli si dà da
 * mangiare (R): affetto e fame scendono da soli di drain al secondo; più sono alti, più il gatto corre (closingBonus m/s
 * in più verso Checco e Slancio alzato). Se uno dei due arriva a zero il gatto se ne va; altrimenti scende dopo maxSeconds.
 */
export const GATTO = {
  grow: 1.3,
  maxSeconds: 26,
  start: 0.8,
  drain: 0.09,
  pet: { gain: 0.28, cooldown: 0.25 },
  feed: { gain: 0.34, cooldown: 0.4 },
  closingBonus: 1.6,
  /** Di quanto D sta più in alto in sella (unità, a gatto cresciuto). */
  mountLift: 1.1
} as const;
/** Freccia gialla del Cammino: velocità verticale del supersalto (il salto normale è 9.5). */
export const ARROW_BOOST = 15.5;
/** Zoltraak (Grimorio di Frieren): portata del raggio e durata dell'effetto. La marionetta si colpisce
 *  SEMPRE (valore fisso `gap`), anche fuori schermo. */
export const ZOLTRAAK = { range: 24, duration: 0.5, gap: -6 } as const;

// --- guardie del cinema (evento A) -------------------------------------------------
/** Si abbattono con un colpo di spada (a 9 u/s non c'è tempo per due) o si saltano; ognuna caduta recupera terreno e lascia una Sfera. */
export const TUNNEL_GUARD = { width: 0.7, height: 1.5, hp: 1, damage: 12, gapReward: -4 } as const;

// --- nemici del Cammino (FASE 10, tappa 6) -----------------------------------------------
/**
 * Il **pellegrino fanatico** (corpo a corpo): sta fermo in una via; quando D gli arriva a `range` unità si carica per `windup` s
 * (lampo bianco) e poi si scaglia verso D a `speed` u/s per `lunge` s. Si abbatte con la spada (`hp` colpi), o lo si PARA mentre
 * si scaglia (parata a tempo: cade subito). Al contatto fa `damage`.
 */
export const PILGRIM = { width: 0.9, height: 1.7, hp: 1, damage: 14, range: 7.5, windup: 0.5, speed: 10, lunge: 0.55, gapReward: -3, parryReward: -5 } as const;
/**
 * Il **balestriere del Cammino** (a distanza): sta fermo, e ogni `every` s (con un avviso di `telegraph` s) scocca un dardo parabile
 * nella sua via: parato, il dardo TORNA a lui e lo spezza (`gapReward`). Un colpo di spada lo abbatte. Il dardo che ti prende fa
 * `damage` e ti appesantisce (`MALUS.brake`).
 */
export const ARCHER = { width: 0.8, height: 1.7, hp: 1, damage: 10, every: 2.8, telegraph: 0.65, firstDelay: 1.2, shotSpeed: -4.5, shotDamage: 9, shotY: 1.2, gapReward: -3, reflectReward: -4 } as const;
/** Ciò che resta di un nemico caduto: rallenta chi ci passa sopra a terra (salta per evitarlo); sparisce dopo `life` s. */
export const REMAINS = { width: 1.2, height: 0.35, life: 9, clearAt: 0.15 } as const;
/**
 * Malus: **frenato** (il dardo che ti prende: per `brake` s lo Slancio non sale) e **rallentato** (stai sui resti: per `slow` s dopo
 * l'ultimo contatto il tempo di D scorre al `slowTempo` e Checco guadagna `slowGap` m/s). La modalità shonen e il Senzu li tolgono.
 */
export const MALUS = { brake: 7, slow: 0.9, slowTempo: 0.6, slowGap: 1.8 } as const;
/** Il fagiolo curativo che a volte lasciano i nemici caduti (`dropChance`): cura `heal` punti vita. */
export const BEAN = { heal: 14, dropChance: 0.45 } as const;

// --- eventi (FASE 9) ---------------------------------------------------------------
export type TunnelEventId = 'detach' | 'boulder' | 'karaoke' | 'dark';
/** Cosa mostra la finestra sulla marionetta: gli eventi, e il momento in cui Checco altera la realtà. */
export type TunnelWindowKind = TunnelEventId | 'reality';
export interface TunnelEventDef {
  id: TunnelEventId;
  /** Secondi di corsa (mondo) di inizio e fine. Dentro UNA sezione, ad almeno 3 s dal suo inizio (il checkpoint). */
  start: number;
  end: number;
  /** Battuta all'inizio (titolo + riga di aiuto). */
  bark: [string, string | null];
  /** Battuta alla fine, se c'è. */
  endBark?: [string, string | null];
}
export const TUNNEL_EVENTS: readonly TunnelEventDef[] = [
  {
    id: 'detach',
    start: 34,
    end: 48,
    bark: ['Checco: «Il mio scooter ha 400 cavalli, il tuo destino 4!»', 'Abbatti le guardie per riprenderlo'],
    endBark: ['Checco: «Sorpresa! Mi hai pure raggiunto?!»', null]
  },
  {
    id: 'karaoke',
    start: 100,
    end: 110,
    bark: ['KARAOKE! Checco prende il microfono: «Una canzone per il mio pubblico!»', 'Arancio = para ({parry}), giallo = salta. Nessuna nota addosso e il pubblico applaude'],
    endBark: ['Il pubblico è in delirio!', null]
  },
  {
    id: 'dark',
    start: 154,
    end: 160,
    bark: ['SALTA LA CORRENTE!', 'Resta solo il cerchio di luce attorno a te: guarda lontano'],
    endBark: ['La luce torna. Respira.', null]
  },
  {
    id: 'boulder',
    start: 62,
    end: 79.5,
    bark: ['Checco tira la leva: IL MASSO!', 'Resta dietro di te finché non si schianta su un muro. Ogni colpo e malus lo avvicina'],
    endBark: ['Il masso si schianta. Pioggia di Sfere!', null]
  }
];
/**
 * Karaoke: le note di Checco (lanci in sequenza, tutti i `spacing` secondi dall'inizio dell'evento + `lead`); ogni nota ha una via e se si
 * para (arancio) o si salta (giallo). A fine evento, se nessuna nota ti ha colpito, gli applausi valgono `perfectGap` metri.
 */
export const KARAOKE = {
  lead: 2.5,
  spacing: 1,
  perfectGap: -6,
  notes: [
    { lane: 1, parry: true },
    { lane: 2, parry: false },
    { lane: 0, parry: false },
    { lane: 1, parry: true },
    { lane: 0, parry: false },
    { lane: 2, parry: false },
    { lane: 1, parry: true },
    { lane: 2, parry: false }
  ]
} as const;
/** Botafumeiro (il grande incensiere del Cammino): oscilla attraverso le vie con questo periodo e ampiezza (in vie) ed è basso (si salta o si scatta). */
export const PENDULUM = { period: 3, amplitude: 1.6, width: 1, height: 1.4, y: 0.25, damage: 18 } as const;
/** Paparazzo: avviso `warn` secondi prima, poi il lampo; chi è nella sua via resta abbagliato (`blindSeconds`) e perde `gap` metri. */
export const PAPARAZZO = { width: 0.8, height: 1.7, warn: 1.1, flashRange: 2.4, passedBy: 0.4, flashSeconds: 0.3, blindSeconds: 1.4, gap: 4 } as const;
/** Buio: quanto in fretta si spegne e si riaccende la luce (1/s) e il raggio del cerchio di luce attorno a D (frazione della larghezza dello schermo). */
export const DARK = { speed: 2.5, radius: 0.32 } as const;
/** Battute a un secondo preciso del copione (un annuncio, senza altro): bivio, paparazzi, Botafumeiro. */
export const TUNNEL_BARKS: readonly { t: number; title: string; hint: string | null }[] = [
  { t: 83.5, title: 'BIVIO! A sinistra la scorciatoia, a destra la via sicura', hint: 'Su c’è il premio ma anche il raggio; giù si passa tranquilli' },
  { t: 92, title: 'PAPARAZZI! Occhio al flash', hint: 'Chi è nella via del fotografo resta abbagliato: cambia via o scatta' },
  { t: 111, title: 'IL BOTAFUMEIRO! Un incensiere grande come una casa', hint: 'Guarda dove oscilla: salta o scatta quando ti passa addosso' }
];

/** Evento A: di quanto sale la distanza e il massimo che può raggiungere (mai a 100: sarebbe una sconfitta). */
export const DETACH_GAP_BONUS = 30;
export const DETACH_GAP_CAP = 85;
/** Evento B: il masso rotolante. Distanza dietro D, quanto la accorcia un colpo, recupero (u/s), danno dello schiacciamento. */
export const BOULDER = { startDist: 3.4, enterDist: 9, hitStep: 1.3, malusStep: 0.9, crushDist: 1.3, damage: 35, radius: 1.5 } as const;
/** Pioggia di Sfere alla fine del masso: quante e a che distanza l'una dall'altra (s). */
export const BOULDER_REWARD = { count: 4, spacing: 0.35 } as const;

// --- Checco altera la realtà: onda a contatore e modalità (FASE 10, tappa 3) --------
/** Le due modalità in cui può finire un attacco: preso → Buen Camino (a vantaggio di Checco), deviato → shonen (a tuo vantaggio). */
export type ModeId = 'camino' | 'anime';
export interface RealityDef {
  id: string;
  /** Secondo di corsa (mondo) in cui l'onda RAGGIUNGE D (a 9 u/s = una distanza fissa lungo il percorso). */
  arriveT: number;
  /** Vie coperte dall'onda. */
  lanes: number[];
  /** Battuta e riga di aiuto al lancio. */
  bark: [string, string | null];
  /** La modalità shonen che ne segue porta anche Eve. */
  eve?: boolean;
}
/** L'onda di Checco è sempre una sola e occupa tutte le vie: non si evita cambiando via. */
const ALL_LANES: number[] = Array.from({ length: TUNNEL_LANES }, (_, i) => i);
export const TUNNEL_REALITY: readonly RealityDef[] = [
  {
    id: 'onda1',
    arriveT: 130,
    lanes: ALL_LANES,
    bark: ['CHECCO USA I SUOI POTERI PER ALTERARE LA REALTÀ!', 'L’onda copre TUTTE le vie: para ({parry}) a tempo, salta o scatta. Se ti prende…']
  },
  {
    id: 'onda2',
    arriveT: 164,
    lanes: ALL_LANES,
    eve: true,
    bark: ['«ANCORA UNA VOLTA: LA REALTÀ È UNA MIA OPINIONE!»', 'Un’unica onda su tutte le vie: para, salta o scatta']
  }
];
/**
 * L'onda: parte warn secondi prima dell'arrivo, vola a velocità fissa (la stessa dei lanci: speed negativa verso D)
 * e porta con sé un contatore in metri. Si PARA (K) con il timing giusto, si salta (è bassa), si attraversa con il dash o si
 * evita cambiando via. modeSeconds = durata della modalità che ne segue; windowSeconds = quanto resta aperta la finestra su Checco.
 */
export const REALITY_WAVE = { warn: 6.5, speed: -2, height: 1.4, width: 1.2, damage: 22, modeSeconds: 22, windowSeconds: 3.2, dodgeGap: -2 } as const;
/** Modalità Buen Camino: Checco si allontana più in fretta (m/s, positiva = lui scappa) e compaiono torrette volanti. */
export const MODE_CAMINO = { gapRate: 0.9 } as const;
/** Modalità shonen: Slancio al massimo, Checco inciampa (spinta in m, negativa = lo si guadagna), un po' di vita, gap che cala in fretta e l'alleata. */
export const MODE_ANIME = { gapRate: -0.9, startGap: -18, heal: 25 } as const;
/** Torrette volanti del Buen Camino: quota del centro, ingombro, colpo di spada (uno), danno al contatto, ritmo del tiro e premio. */
export const TUNNEL_TURRET = {
  y: 3,
  width: 0.9,
  height: 0.9,
  hp: 1,
  damage: 12,
  shootEvery: 2.2,
  telegraph: 0.6,
  /** Il colpo parte orizzontale nella sua via; velocità nel mondo (verso D) e danno. */
  shotSpeed: -3,
  shotDamage: 8,
  gapReward: -3
} as const;
/** Quando nascono le torrette dentro la modalità (secondi dall'inizio della modalità, via). */
export const CAMINO_TURRETS: readonly { dt: number; lane: number }[] = [
  { dt: 4.5, lane: 1 },
  { dt: 7.5, lane: 0 },
  { dt: 10.5, lane: 2 },
  { dt: 13.5, lane: 1 },
  { dt: 16.5, lane: 0 },
  { dt: 19.5, lane: 2 }
];
/**
 * L'ospite della modalità shonen (src/data/tunnelCameos.ts): UNO solo per modalità (un personaggio, o un gruppo che arriva insieme come i
 * Gentleman), che esce da un PORTALE sopra la via più lontana — aprendosi spazza via ciò che sta davanti a D entro `entranceRange` — e
 * resta `stay` secondi (gli ultimi `leave` il portale si richiude). Dà il suo aiuto (`help` del cameo) la prima volta dopo `firstHelp` s:
 * di norma ripulisce UNA sola via (quella di D) entro `range` ogni `helpEvery` s; chi è «wide» le ripulisce tutte entro `wideRange` ogni
 * `wideEvery` s; chi è «lost» sbaglia via; chi è «shield» dà `shield` s di invulnerabilità ogni `shieldEvery` s. La nave Going Merry spara
 * più lontano (`shipRangeFactor`). `heal` e `gap` sono i piccoli bonus di certi cameo (dati alla prima volta).
 */
export const CAMEO_CAST = {
  stay: 15,
  leave: 0.8,
  portal: 0.9,
  entranceRange: 10,
  firstHelp: 1.8,
  helpEvery: 2.5,
  wideEvery: 6,
  shieldEvery: 7,
  range: 11,
  wideRange: 16,
  shipRangeFactor: 1.35,
  offsetX: 3.4,
  lane: 0,
  heal: 8,
  gap: -2,
  shield: 1.6
} as const;
/** Eve (seconda onda): è l'ospite di quella modalità. Raggiunge D da dietro in `arrive` s, gli corre accanto e ogni `interval` s ripulisce la via di D davanti a lui entro `range`. */
export const EVE_HELP = { arrive: 1.5, firstHelp: 0.4, interval: 3.6, range: 10, lane: 2, behind: 1.8 } as const;

// --- stili permanenti (FASE 10, tappa 7) -----------------------------------------------------
/**
 * Lo stile che l'ospite ti lascia per il resto dell'inseguimento (si perde solo se si ricomincia dall'INIZIO; la sconfitta per
 * vita lo mantiene, come i desideri). `outfit` = cambia anche l'aspetto di D. Gli effetti stanno in `tunnelPerks.ts`
 * (e, per il volo e il fulmine, in `tunnelPlayer.ts`).
 */
export interface PerkDef {
  label: string;
  description: string;
  outfit: boolean;
}
export const PERKS: Record<PerkId, PerkDef> = {
  saiyan: { label: 'Super Saiyan', description: 'Aura dorata: voli (tieni {jump}) e travolgi ciò che sta a terra.', outfit: true },
  thor: { label: 'Dio del tuono', description: 'Un attacco ({attack}) in aria ti fa schiantare a terra con un fulmine ad area.', outfit: true },
  gentleman: { label: 'Smoking', description: '«Vai uomo!» quando acceleri; a velocità massima i colpi a distanza dei nemici non ti toccano.', outfit: true },
  gear5: { label: 'Gear 5', description: 'Pugno a gomma sempre attivo: più portata, e rimandi anche ciò che non si può parare.', outfit: true },
  zoro: { label: 'Zoro in scorta', description: 'Zoro spazza via ciò che trova… finché non perde l’orientamento.', outfit: false },
  hero: { label: 'Cuore da eroe', description: '+30 di vita massima (e subito +30).', outfit: false },
  magic: { label: 'Magia in appoggio', description: 'Ogni tot secondi parte da solo uno Zoltraak.', outfit: false },
  speed: { label: 'Passo veloce', description: 'Lo Slancio parte almeno dal livello 2.', outfit: false },
  fly: { label: 'Volo', description: 'Tieni premuto {jump} per volare.', outfit: false },
  calm: { label: 'Scudo amico', description: 'Ogni tot secondi ti protegge per un attimo.', outfit: false },
  eve: { label: 'Eve al tuo fianco', description: 'Resta con te e ripulisce la tua via.', outfit: false }
};
/** Numeri degli stili. */
export const PERK_NUMBERS = {
  heroHp: 30,
  /** Magia in appoggio: secondi fra due Zoltraak automatici. */
  magicEvery: 14,
  /** Scudo amico: ogni `every` s, `seconds` di invulnerabilità. */
  calm: { every: 12, seconds: 1.6 },
  /** Passo veloce: livello minimo di Slancio. */
  speedTier: 2,
  /** Volo (Super Saiyan, Esquie): salita e discesa (u/s), quota massima, quanto si consuma salendo (1/s), quanto si ricarica a terra (1/s). */
  fly: { rise: 7, fall: 4.5, maxY: 4.2, drain: 0.22, recharge: 0.45 },
  /** Dio del tuono: attesa fra due fulmini, velocità della caduta, raggio dell'area (davanti e dietro D) e fulmini disegnati. */
  thor: { cooldown: 1.2, fallSpeed: 18, ahead: 4.6, behind: 1.4 },
  /** Smoking: a questo livello di Slancio i colpi a distanza non ti toccano. */
  gentlemanTier: 3,
  /** Zoro: quanto resta, ogni quanto spazza (s), portata davanti a D e quanto va a zonzo prima di cambiare via. */
  zoro: { stay: 16, every: 0.45, range: 8, followFor: 4, wanderEvery: 2.2, ahead: 3.4 }
} as const;
/** Il finale della modalità shonen: D carica charge secondi e scaglia l'onda (Kamehameha), che pulisce range unità e toglie metri a Checco. */
export const KAMEHAMEHA = { charge: 1.1, range: 40, gap: -12, duration: 0.9 } as const;
/** Colori di sfondo per modalità: [normale, Buen Camino, shonen]. Lo sfondo passa dall'uno all'altro in MOOD_BLEND_SPEED (1/s). */
export const MOOD_BLEND_SPEED = 1.4;
export const MOOD_PALETTE = {
  wall: ['#0a1017', '#2a180a', '#1d0f3d'],
  ribs: ['#131c27', '#33200f', '#2c1a5c'],
  columns: ['#1a2633', '#4a2f19', '#43287d'],
  lamps: ['#f2d98d', '#ffb347', '#ff7ad9'],
  pipe: ['#1b2a38', '#5c3a1c', '#53307d'],
  floor: ['#16222f', '#2b1c10', '#241447']
} as const;

// --- sconfitta (le cure con R non ci sono più: si guarisce con fagioli, Senzu e stili) ---------------
/** Pausa (s) fra la sconfitta e la ripartenza dall'inizio della sezione. */
export const TUNNEL_RESPAWN_DELAY = 1.1;
/** Secondi minimi di leggibilità di ogni minaccia prima del contatto. */
export const TUNNEL_TELEGRAPH_MIN = 0.7;

// --- ostacoli ------------------------------------------------------------------
/** Ostacolo basso a terra: si salta (o si schiva con i-frames). */
export const TUNNEL_LOW = { width: 0.9, height: 0.9, damage: 14 } as const;
/** Muro a tutta altezza: non si salta, si attraversa con i-frames (dash). */
export const TUNNEL_WALL = { width: 0.6, height: 4, damage: 17 } as const;
/** Cassa distruttibile (un colpo di spada) o saltabile. */
export const TUNNEL_CRATE = { width: 0.9, height: 1.3, hp: 1, damage: 12 } as const;
/** Voragine a terra: si salta. */
export const TUNNEL_PIT = { width: 2.2, damage: 14 } as const;
/** Raggio: basso (si salta) o alto (si attraversa con i-frames). Quote Y [da, a]. */
export const TUNNEL_RAY = {
  width: 0.5,
  low: [0.1, 0.7] as [number, number],
  high: [1.0, 1.8] as [number, number],
  damage: 12,
  /** Secondi in cui lampeggia prima di attivarsi, e per quanto resta attivo. */
  warn: 0.8,
  active: 0.6
} as const;
/** Detrito dal soffitto: marcatore a terra, poi cade (si evita con strafe o i-frames). */
export const TUNNEL_DEBRIS = { warn: 0.9, fallSpeed: 20, halfSize: 0.45, damage: 14, height: 7 } as const;

// --- proiettili lanciati dalla marionetta ------------------------------------
/**
 * Il proiettile esce dalla mano della marionetta dopo `telegraph` secondi di avviso e ARRIVA a D al
 * secondo scritto nel copione: se lei è lontana parte prima (`arrivo − distanza / avvicinamento`).
 */
export const TUNNEL_THROW = {
  telegraph: 0.8,
  /** Velocità nel mondo (negativa: verso D, che corre in direzione opposta). L'avvicinamento rispetto a D è `TUNNEL_RUN_SPEED − speed`. */
  speed: -2,
  /** Un lancio si pianifica con questo anticipo (s) sull'arrivo: abbastanza per la marionetta più lontana possibile. */
  planAhead: 12,
  /** Vita (s di mondo) di un proiettile rimandato verso la marionetta lontana. */
  reflectLife: 8,
  damage: 10,
  /** Quota di lancio. */
  y: 1.1,
  /** Il proiettile rosso (non parabile) è basso: si salta. */
  redY: 0.4,
  /** Velocità di un proiettile rimbalzato verso la marionetta (deve superare la corsa). */
  reflectSpeed: 24
} as const;

// --- raffica a doppia spada (`combo_doppia_spada_qte`) ------------------------
export const BARRAGE_KEYS = ['attack', 'parry', 'skill', 'heal', 'jump'] as const; // azioni (FASE 14)
/** Finestre dei prompt (s): da larga a stretta. Il numero dei prompt è la lunghezza dell'array. */
export const BARRAGE_WINDOWS = [1.0, 1.0, 0.9, 0.9, 0.8, 0.8, 0.7, 0.65, 0.6];
export const BARRAGE_GAP = 0.3;
/** Mancati tollerati perché la raffica conti come riuscita (è uno spettacolo, non una punizione). */
export const BARRAGE_MAX_MISSES = 2;
/** Burattini-guardia che sbarrano la strada. */
export const BARRAGE_GUARDS = 6;
/** Distanza della marionetta da D durante la raffica (i burattini-guardia stanno in mezzo). */
export const BARRAGE_PUPPET_DIST = 7;
/** Durata (s) della fase prima che parta il QTE, e dopo che finisce. */
export const BARRAGE_INTRO = 2.2;
export const BARRAGE_OUTRO = 1.4;

// --- fuga (`fuga_checco`) ------------------------------------------------------
export const ESCAPE_DURATION = 12;

// --- sezioni della corsa (durata totale ≈ 200 s di mondo) --------------------------
export interface TunnelSection {
  id: 'imbocco' | 'lanciatore' | 'crollo' | 'spettacolo' | 'alterazione' | 'rettilineo';
  /** Secondi dall'inizio della corsa. */
  start: number;
  duration: number;
  /** Battuta della marionetta all'inizio della sezione. */
  bark: string;
}

export const TUNNEL_SECTIONS: readonly TunnelSection[] = [
  { id: 'imbocco', start: 0, duration: 20, bark: 'Corri, corri, piccolo burattino senza fili!' },
  { id: 'lanciatore', start: 20, duration: 30, bark: 'Prendi, prendi! Il pubblico adora i bis!' },
  { id: 'crollo', start: 50, duration: 30, bark: 'Il teatro cade a pezzi, ma lo spettacolo continua!' },
  { id: 'spettacolo', start: 80, duration: 30, bark: 'Signore e signori, lo spettacolo sta per iniziare!' },
  { id: 'alterazione', start: 110, duration: 78, bark: 'Adesso cambio le regole del gioco!' },
  { id: 'rettilineo', start: 188, duration: 12, bark: 'Ancora un po’… sipario!' }
];
export const TUNNEL_TOTAL_DURATION = 200;
/**
 * Il copione non finisce da solo: la corsa termina quando raggiungi Checco (distanza 0) o scade il tempo.
 * Passati `TUNNEL_TOTAL_DURATION` secondi di mondo, il tratto da `TUNNEL_LOOP_FROM` in poi si ripete
 * ogni `TUNNEL_LOOP_PERIOD` secondi (le Sfere non si ripetono: sono sette per corsa).
 */
export const TUNNEL_LOOP_FROM = 188;
export const TUNNEL_LOOP_PERIOD = 12;

/** Indice della sezione che contiene il secondo di corsa `time` (l'ultima oltre la fine). */
export function sectionIndexAt(time: number): number {
  let index = 0;
  TUNNEL_SECTIONS.forEach((section, i) => {
    if (time >= section.start) index = i;
  });
  return index;
}
