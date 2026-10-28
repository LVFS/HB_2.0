import { PLAYER_MAX_HP } from '../BossArena/arenaConfig';
import type { PerkId } from '@/data/tunnelCameos';
import { createArenaWorld, type ArenaWorld } from '../BossArena/arenaState';
import type { QteState } from '../BossArena/qte';
import {
  BOULDER,
  type ItemId,
  type ModeId,
  type PickupKind,
  type TunnelWindowKind,
  type TunnelEventId,
  type WishId,
  TUNNEL_CAMERA_LEAD,
  TUNNEL_LANE_START,
  TUNNEL_PUPPET_DIST_MIN,
  TUNNEL_GAP_START_BONUS,
  TUNNEL_GAP_START_MALUS,
  TUNNEL_GAP_START_NEUTRAL,
  TUNNEL_SPAWN_AHEAD_MIN
} from './tunnelConfig';

/**
 * Stato per frame del tunnel in UN solo oggetto in un ref (mai stato React),
 * come `ArenaWorld` per l'arena. Ne contiene uno vero (`arena`): giocatore,
 * proiettili, numeri di danno e "boss" (qui la marionetta) sono gli stessi
 * dell'arena, così le regole di `combat.ts` (`hitPlayer`, parata, rimbalzo)
 * si riusano senza copie. Il resto — minacce, distanza, tempo di corsa — è
 * specifico del tunnel.
 */

export type HazardKind = 'low' | 'wall' | 'crate' | 'pit' | 'ray' | 'debris' | 'guard' | 'turret' | 'pendulum' | 'paparazzo' | 'pilgrim' | 'archer' | 'remains';

/** Un oggetto sul percorso (Sfera del Drago, freccia gialla, scatola-bonus). */
export interface TunnelPickup {
  id: number;
  kind: PickupKind;
  x: number;
  /** Quota del CENTRO (la freccia gialla sta a terra). */
  y: number;
  /** Secondo di corsa in cui D ci arriva. */
  t: number;
  /** Via in cui sta (0 = la più lontana): si raccoglie solo da quella via. */
  lane: number;
  /** Secondi dal ritiro (0 = ancora lì); a `PICKUP_FADE` sparisce. */
  takenFor: number;
}

/** Bonus a tempo attivi: secondi residui. `kaioken` e `ultreia` sono desideri di Shenron a tempo. */
export interface TunnelBuffs {
  gomu: number;
  saiyan: number;
  ciak: number;
  kaioken: number;
  ultreia: number;
  nuvola: number;
}

/** Stato per-frame degli stili permanenti (timer dei poteri automatici, Zoro in scorta, fulmine in caduta). */
export interface PerkState {
  /** Secondi al prossimo Zoltraak automatico e al prossimo scudo. */
  magicT: number;
  calmT: number;
  /** Dio del tuono: attesa residua e caduta in corso (D si schianta a terra e fa il fulmine all'arrivo). */
  thorCd: number;
  slamming: boolean;
  /** Ultimo livello di Slancio visto (per il «Vai uomo!» dello smoking). */
  lastTier: number;
  /** Zoro in scorta: secondi di permanenza residui (0 = non c'è), via in cui corre, secondi fino al prossimo colpo/cambio via, e se sta andando via. */
  zoroT: number;
  zoroLane: number;
  zoroHitT: number;
  zoroWanderT: number;
  zoroFollowT: number;
  zoroLeaving: boolean;
  /** Quanto è avanti rispetto a D (unità): rientra a sinistra quando se ne va. */
  zoroAhead: number;
  /** Volo (Super Saiyan, Esquie): carica residua 0-1, si consuma salendo e si ricarica a terra. */
  flight: number;
  flightOn: boolean;
  /** Lampi per la resa (secondi residui). */
  zoroFlash: number;
  thorFlash: number;
}

/** Il gatto randagio su cui D cavalca: attivo, secondi trascorsi, crescita 0-1, affetto e fame 0-1, lampi di coccola/pappa e attese. */
export interface TunnelCat {
  active: boolean;
  t: number;
  grow: number;
  affection: number;
  hunger: number;
  petFlash: number;
  feedFlash: number;
  petCooldown: number;
  feedCooldown: number;
}

/** I desideri di Shenron in corso: i permanenti avuti, e i contatori di quelli a usi. */
export interface TunnelWishes {
  owned: WishId[];
  /** Colpi che si schiveranno da soli (Istinto Superiore). */
  instinct: number;
  /** Zoltraak di riserva (Q). */
  reserve: number;
}

/** Il masso dell'evento B: rotola alle spalle di D a `dist` unità. */
export interface TunnelBoulder {
  active: boolean;
  dist: number;
  /** Rotazione per la resa (radianti). */
  spin: number;
}

/** La finestra sulla marionetta: si apre quando un evento la tiene fuori scena. */
export interface PuppetWindowState {
  open: boolean;
  kind: TunnelWindowKind | null;
  /** Secondi dall'apertura (anima l'ingresso e il contenuto). */
  t: number;
}

/** Cosa si vede di un raggio (Zoltraak, Frieren, Kamehameha): dove parte, quanto dura, colore e spessore. */
export interface TunnelBeam {
  life: number;
  lifeMax: number;
  x: number;
  /** Quota e via da cui parte. */
  y: number;
  lane: number;
  color: 'violet' | 'blue' | 'orange';
  /** Lunghezza e spessore massimo (unità). */
  length: number;
  thickness: number;
}

/** L'onda con cui Checco «altera la realtà»: dove si trova (X nel mondo), le vie che copre e a che attacco del copione appartiene. */
export interface RealityWave {
  x: number;
  lanes: number[];
  index: number;
}

/** La modalità in corso (Buen Camino o shonen), o nessuna. elapsed/duration in secondi di mondo. */
export interface TunnelMode {
  id: ModeId | null;
  elapsed: number;
  duration: number;
  /** Torrette del copione della modalità già nate. */
  turretsSpawned: number;
  /** Secondi al prossimo aiuto dell'assistente in scena e secondi residui del suo lampo di luce. */
  allyTimer: number;
  allyFlash: number;
  /** Il cameo in scena (id in src/data/tunnelCameos.ts) e da quanti secondi; il cursore della rotazione dei gruppi e gli ultimi usati. */
  cameoId: string | null;
  cameoT: number;
  cameoCursor: number;
  recentCameos: string[];
  /** L'ospite è uno solo per modalità: `slot` = 0 quando è già arrivato (-1 = non ancora); `helps` = quanti aiuti ha dato. */
  slot: number;
  helps: number;
  /** Eve è l'ultimo ospite? (withEve) e in questo momento è in scena? */
  /** Eve porta aiuto in questa modalità? progresso dell'arrivo 0-1, secondi al prossimo colpo e lampo del colpo. */
  withEve: boolean;
  eveOn: boolean;
  eveArrive: number;
  eveTimer: number;
  eveFlash: number;
  /** Il finale shonen: nessuno, carica, o fuoco (secondi trascorsi nella fase). */
  finale: 'none' | 'charge' | 'fire';
  finaleT: number;
}

/** Una minaccia fissa o a ciclo (i proiettili stanno in `arena.projectiles`). */
export interface TunnelHazard {
  id: number;
  kind: HazardKind;
  /** Centro in X. Y è la quota dei PIEDI (a terra = 0); per il detrito è il centro mentre cade. */
  x: number;
  y: number;
  width: number;
  height: number;
  damage: number;
  /** Secondo di corsa in cui D arriva su questo punto (usato da raggi e detriti). */
  t: number;
  /** Via in cui sta (0 = la più lontana): colpisce solo chi è in quella via. */
  lane: number;
  hp: number;
  rayHeight?: 'low' | 'high';
  /** Raggi/detriti: `warn` (telegrafo) → `active` → `spent`. Ostacoli fermi: sempre `active`. */
  phase: 'warn' | 'active' | 'spent';
  /** Secondi residui di lampo dopo un colpo ricevuto (casse). */
  flash: number;
  /** Ha già fatto danno (un ostacolo colpisce una volta sola). */
  damaged: boolean;
  /** Ultimo fendente del giocatore che l'ha colpito (uno per fendente, solo casse). */
  lastSwing: number;
  /** Velocità di caduta del detrito. */
  vy: number;
  /** Torretta: secondi al prossimo colpo (negativo = in preparazione, poi spara). */
  shoot: number;
  /** Botafumeiro: la via (continua) su cui si trova adesso; `lane` è la via in cui sarà quando D lo raggiunge. */
  swing: number;
}

/**
 * Un lancio della marionetta in programma: il proiettile ARRIVA a D al secondo `t` del copione.
 * Quando la marionetta è lontana parte prima; il momento si fissa (`launchT`, `dist`) all'inizio
 * dell'avviso, così un cambio di distanza a metà non sposta l'arrivo.
 */
export interface TunnelThrow {
  /** Secondo di corsa (mondo) in cui il proiettile raggiunge D. */
  t: number;
  /** Parabile (si rimbalza con la parata) oppure no (basso, si salta). */
  parryable: boolean;
  /** Via in cui viaggia il proiettile. */
  lane: number;
  /** È una nota del karaoke (si conta chi ti colpisce). */
  note?: boolean;
  /** Secondo (mondo) in cui parte e distanza da D a cui parte; null finché non è stato fissato. */
  launchT: number | null;
  dist: number;
}

/** La marionetta di Checco, che corre davanti a D. */
export interface TunnelPuppet {
  /** Distanza da D in unità (segue con ritardo quella ricavata dal `gap`) e X nel mondo. */
  dist: number;
  x: number;
  /** Avanzamento del lancio telegrafato 0..1 (0 = nessun lancio in preparazione). */
  telegraph: number;
  /** Quanto è parabile il lancio in preparazione: giallo = parabile, rosso = da schivare. */
  telegraphKind: 'parry' | 'dodge' | null;
  /** Secondi residui di lampo dopo un rimbalzo a segno. */
  flash: number;
  /** Falso quando è uscita di scena (cutscene della fuga: è saltata nel portello). */
  visible: boolean;
  /** È dentro il bordo destro dello schermo (sennò la HUD mostra l'indicatore con i metri). */
  onScreen: boolean;
  /** Quanto dello scarto laterale di D ha ripreso (lo segue piano): tiene costante la distanza VISIVA quando D scatta o si sposta. */
  follow: number;
  /** Via su cui sta (continua, 0-2): segue piano quella di D. */
  lane: number;
  /** Ultimo fendente di D che l'ha colpita (uno per fendente). */
  lastSwing: number;
  /** Quota extra sopra la corsa (il salto nel portello della cutscene della fuga). */
  lift: number;
}

export type TunnelStage = 'run' | 'respawn' | 'barrage' | 'finished';

/** La raffica a doppia spada (`combo_doppia_spada_qte`): intro → QTE → epilogo. */
export interface BarrageState {
  phase: 'intro' | 'qte' | 'outro';
  /** Secondi dall'inizio della fase corrente. */
  t: number;
  qte: QteState | null;
  /** Tasti premuti in attesa di essere letti dal QTE. */
  pressed: string[];
  /** Secondi residui di "fendente" (animazione d'attacco di D) e da che lato (alterna le due lame). */
  strike: number;
  strikeSide: 1 | -1;
  hits: number;
  misses: number;
  /** Burattini-guardia già caduti. */
  guardsFallen: number;
  /** Punteggio 0-1 a fine QTE (null finché non finisce). */
  score: number | null;
}

/** Azione in corso del giocatore (come `Action` di `PlayerArena`, ridotta a ciò che serve al tunnel). */
export type RunnerAction = 'none' | 'attack' | 'parry' | 'dash' | 'heal';

/** Stato animazione di D per `CharacterAnimator2D`, ricavato da ciò che sta facendo. */
export type RunnerAnim = 'walk' | 'attack' | 'hit' | 'parry' | 'idle';

export interface TunnelWorld {
  arena: ArenaWorld;
  stage: TunnelStage;
  /** Secondi di corsa dall'inizio (si riporta all'inizio della sezione dopo una sconfitta). */
  time: number;
  /** X da cui D parte e X attuale della corsa (senza lo scarto laterale `strafe`). */
  startX: number;
  runX: number;
  strafe: number;
  /** Distanza dalla marionetta in METRI, 0-100 (0 = raggiunta, 100 = sparita), il suo valore a inizio sezione e
   *  all'inizio della corsa. `gapPending` = spinte (colpi, rimbalzi, eventi) non ancora applicate: si
   *  versano in `gap` con `TUNNEL_GAP_SMOOTH`, così la distanza non salta mai di colpo. */
  gap: number;
  gapAtSection: number;
  gapStart: number;
  gapPending: number;
  /** Secondi REALI di corsa trascorsi (per il tempo limite). */
  elapsed: number;
  /** Perché si è persa l'ultima volta: dalla vita si riparte dall'inizio della sezione, dagli altri dall'inizio dell'inseguimento. */
  defeat: 'hp' | 'gap' | 'time';
  /** Inquadratura corrente (scritta dal rig della camera): fin dove si vede a destra di D e a che distanza nascono le minacce. */
  view: { rightEdge: number; ahead: number; halfW: number };
  /** Ultimo valore del gap (arrotondato) copiato nello store per la HUD (-1 = mai). */
  gapShown: number;
  /** Indice della sezione in corso in `TUNNEL_SECTIONS`, e dell'ultima di cui si è detta la battuta (-1 = nessuna). */
  sectionIndex: number;
  announcedSection: number;
  hazards: TunnelHazard[];
  puppet: TunnelPuppet;
  /** Lanci della marionetta ancora da fare, in ordine di tempo. */
  throws: TunnelThrow[];
  /** Raffica a doppia spada in corso (stadio `barrage`), o null. */
  barrage: BarrageState | null;
  /** Ampiezza (unità) del tremolio della camera: crolli, decollo del razzo. */
  shake: number;
  /** Prossima battuta a tempo (TUNNEL_BARKS) da dire. */
  nextBark: number;
  /** Buio: quanto è spenta la luce (0 = accesa, 1 = tutto spento); `blindCount` cresce a ogni abbaglio dei paparazzi (la HUD lo sente); note del karaoke che ti hanno colpito. */
  dark: number;
  blindCount: number;
  karaokeHits: number;
  /** Prossimo evento del copione da far nascere (indice in `tunnelDirector`). */
  nextEvent: number;
  nextId: number;
  respawnTimer: number;
  /** Stili permanenti avuti (fino alla ripartenza dall'INIZIO) e il loro stato per-frame. */
  perks: PerkId[];
  perkState: PerkState;
  /** Stato dell'azione del giocatore. `boost` = supersalto in attesa (freccia gialla). */
  runner: {
    action: RunnerAction;
    actionTime: number;
    dashCooldown: number;
    anim: RunnerAnim;
    boost: number;
    useItem: boolean;
    /** Q: lancia uno Zoltraak di riserva (lo fa il driver). */
    useReserve: boolean;
    /** In sella al gatto: J coccola e R dà da mangiare (le legge il driver). */
    pet: boolean;
    feed: boolean;
    /** Scatto in corso: direzione (+1 avanti, −1 indietro) e scarto di partenza/arrivo. */
    dashDir: -1 | 1;
    dashFrom: number;
    dashTo: number;
  };

  // --- FASE 9-10: Slancio, bonus, eventi ---
  /** Via di D: `pos` è continua (durante il cambio sta fra due vie), `target` è quella voluta. */
  lane: { pos: number; target: number };
  /** Bonus nella casella (si usa con `E`), o null. */
  slot: ItemId | null;
  /** Desideri di Shenron, la vita massima che ne risulta e, mentre si sceglie, i tre offerti (il gioco è fermo). */
  wishes: TunnelWishes;
  maxHp: number;
  wishChoice: WishId[] | null;
  /** Il gatto su cui si cavalca (Gatto randagio). */
  cat: TunnelCat;
  /** Moltiplicatore del tempo del MONDO (1 = base; sale con lo Slancio, scende col Ciak). */
  tempo: number;
  /** Malus: secondi in cui lo Slancio non sale (dardo che ti prende) e secondi di rallentamento residui (stare sui resti). */
  brakeT: number;
  slowT: number;
  /** Secondi (reali) di corsa senza danni e livello di Slancio che ne risulta. */
  noHitTime: number;
  slancio: number;
  pickups: TunnelPickup[];
  /** Prossimo bonus del copione da far nascere. */
  nextPickup: number;
  /** Sfere del Drago raccolte (0-6; a sette Shenron esaudisce un desiderio e si azzera). */
  spheres: number;
  buffs: TunnelBuffs;
  beam: TunnelBeam | null;
  boulder: TunnelBoulder;
  window: PuppetWindowState;
  /** Prossimo attacco \di realtà\ del copione, l'onda in volo (o null) e la modalità in corso. */
  realityNext: number;
  wave: RealityWave | null;
  mode: TunnelMode;
  /** Quanto ciascuna atmosfera pesa sullo sfondo (normale, Buen Camino, shonen): somma 1, rincorre la modalità. */
  mood: [number, number, number];
  /** Evento in corso (null = nessuno) e quelli già conclusi. */
  activeEvent: TunnelEventId | null;
  eventsDone: TunnelEventId[];
  /** Ultima firma della HUD copiata nello store (per aggiornarlo solo quando cambia). */
  hudSignature: string;
}

/** Distanza (unità di mondo) della marionetta davanti a D per una distanza di `gap` metri: 1 m = 1 unità. */
export function puppetDistanceFor(gap: number): number {
  return TUNNEL_PUPPET_DIST_MIN + gap;
}

/** Distanza iniziale dalla marionetta in base all'esito del QTE finale dell'arena. */
export function gapStartFor(finalQteSuccess: boolean | null): number {
  if (finalQteSuccess === true) return TUNNEL_GAP_START_BONUS;
  if (finalQteSuccess === false) return TUNNEL_GAP_START_MALUS;
  return TUNNEL_GAP_START_NEUTRAL;
}

export function createTunnelWorld(gapStart: number): TunnelWorld {
  const arena = createArenaWorld();
  // Il giocatore parte da X = 0 con vita piena e le cure del tunnel.
  arena.player.x = 0;
  arena.player.heals = 0;
  return {
    arena,
    stage: 'run',
    time: 0,
    startX: 0,
    runX: 0,
    strafe: 0,
    gap: gapStart,
    gapAtSection: gapStart,
    gapStart,
    gapPending: 0,
    elapsed: 0,
    defeat: 'hp',
    view: { rightEdge: TUNNEL_CAMERA_LEAD + 8.6, ahead: TUNNEL_SPAWN_AHEAD_MIN, halfW: 8.6 },
    gapShown: -1,
    sectionIndex: 0,
    announcedSection: -1,
    hazards: [],
    // La distanza è fisica: parte dove dice il gap iniziale (di solito fuori schermo).
    puppet: {
      dist: puppetDistanceFor(gapStart),
      x: puppetDistanceFor(gapStart),
      telegraph: 0,
      telegraphKind: null,
      flash: 0,
      visible: true,
      onScreen: false,
      follow: 0,
      lane: TUNNEL_LANE_START,
      lastSwing: -1,
      lift: 0
    },
    shake: 0,
    throws: [],
    barrage: null,
    nextBark: 0,
    dark: 0,
    blindCount: 0,
    karaokeHits: 0,
    nextEvent: 0,
    nextId: 0,
    respawnTimer: 0,
    perks: [],
    perkState: { magicT: 0, calmT: 0, thorCd: 0, slamming: false, lastTier: 0, zoroT: 0, zoroLane: 1, zoroHitT: 0, zoroWanderT: 0, zoroFollowT: 0, zoroLeaving: false, zoroAhead: 0, flight: 1, flightOn: false, zoroFlash: 0, thorFlash: 0 },
    runner: { action: 'none', actionTime: 0, dashCooldown: 0, anim: 'walk', boost: 0, useItem: false, useReserve: false, pet: false, feed: false, dashDir: 1, dashFrom: 0, dashTo: 0 },
    lane: { pos: TUNNEL_LANE_START, target: TUNNEL_LANE_START },
    slot: null,
    wishes: { owned: [], instinct: 0, reserve: 0 },
    maxHp: PLAYER_MAX_HP,
    wishChoice: null,
    cat: { active: false, t: 0, grow: 0, affection: 0, hunger: 0, petFlash: 0, feedFlash: 0, petCooldown: 0, feedCooldown: 0 },
    tempo: 1,
    brakeT: 0,
    slowT: 0,
    noHitTime: 0,
    slancio: 0,
    pickups: [],
    nextPickup: 0,
    spheres: 0,
    buffs: { gomu: 0, saiyan: 0, ciak: 0, kaioken: 0, ultreia: 0, nuvola: 0 },
    beam: null,
    boulder: { active: false, dist: BOULDER.enterDist, spin: 0 },
    window: { open: false, kind: null, t: 0 },
    realityNext: 0,
    wave: null,
    mode: { id: null, elapsed: 0, duration: 0, turretsSpawned: 0, allyTimer: 0, allyFlash: 0, cameoId: null, cameoT: 0, cameoCursor: 0, recentCameos: [], slot: -1, helps: 0, withEve: false, eveOn: false, eveArrive: 0, eveTimer: 0, eveFlash: 0, finale: 'none', finaleT: 0 },
    mood: [1, 0, 0],
    activeEvent: null,
    eventsDone: [],
    hudSignature: ''
  };
}
