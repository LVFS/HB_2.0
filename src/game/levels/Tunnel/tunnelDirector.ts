import { resetJump, type JumpState } from '@/game/shared/jump';
import { useArenaStore } from '@/store/arenaStore';
import type { BossMessenger } from '../BossArena/bossMessages';
import { scheduleThrow } from './tunnelPuppet';
import { spawnHazard } from './tunnelCombat';
import { syncEvents } from './tunnelEvents';
import { resetLane } from './tunnelLanes';
import { resetBonuses, spawnPickup } from './tunnelPickups';
import { resetSlancio } from './tunnelSlancio';
import { resetPerks } from './tunnelPerks';
import { resetWishes } from './tunnelWishes';
import type { HazardKind, TunnelWorld } from './tunnelState';
import {
  sectionIndexAt,
  SLANCIO_TEMPO,
  TUNNEL_DEBRIS,
  TUNNEL_BARKS,
  TUNNEL_EVENTS,
  TUNNEL_GAP_MAX,
  TUNNEL_GAP_RESPAWN_MAX,
  TUNNEL_LANE_START,
  TUNNEL_LANES,
  TUNNEL_LOOP_FROM,
  TUNNEL_LOOP_PERIOD,
  TUNNEL_RAY,
  TUNNEL_RESPAWN_DELAY,
  TUNNEL_RUN_SPEED,
  TUNNEL_SECTIONS,
  TUNNEL_SPAWN_AHEAD_MIN,
  TUNNEL_TELEGRAPH_MIN,
  TUNNEL_TELEGRAPH_MIN_AT_MAX_TEMPO,
  TUNNEL_THROW,
  TUNNEL_TIME_LIMIT,
  TUNNEL_TOTAL_DURATION,
  type PickupKind
} from './tunnelConfig';

/**
 * Il "copione" del tunnel: l'elenco ordinato di ciò che arriva, QUANDO e in QUALE VIA — il
 * secondo di corsa (del mondo) in cui D ci arriva; per i lanci, il secondo in cui il
 * proiettile raggiunge D. Sei sezioni (vedi `TUNNEL_SECTIONS`):
 *
 *  1. imbocco (0-20 s): tutorial, ostacoli isolati e ben spaziati, nessun proiettile;
 *  2. lanciatore (20-50): la marionetta lancia (da lontano, fuori schermo), si impara a rimbalzare;
 *  3. crollo (50-80): detriti dal soffitto, voragini, raggi a due altezze;
 *  4. spettacolo (80-110): bivio, paparazzi e il karaoke di Checco;
 *  5. alterazione (110-188): il Botafumeiro, le due onde di Checco (130 s e 164 s) con le modalità che ne seguono, e il buio (154-160);
 *  6. rettilineo (188-200): densità massima, sempre con ≥ 1 s di leggibilità. Solo qui si può raggiungere Checco.
 *
 * Dopo i 200 s l'ultimo tratto si ripete finché non raggiungi Checco o scade il tempo.
 * Regole: mai due minacce non telegrafate nello stesso istante (due vie occupate insieme sono UN
 * pattern: ne resta sempre una libera), ogni pattern risolvibile con un'unica sequenza di azioni.
 * È tutto dati: tarare il bilanciamento è cambiare numeri qui e in `tunnelConfig.ts`.
 */

export type DirectorEvent =
  | { t: number; kind: HazardKind; lane: number; rayHeight?: 'low' | 'high' }
  | { t: number; kind: 'throw'; lane: number; parryable: boolean };

/** Un oggetto del copione: il secondo di corsa in cui D ci arriva, la quota del centro e la via. */
export interface PickupSpec {
  t: number;
  kind: PickupKind;
  y?: number;
  lane: number;
}

const MID = TUNNEL_LANE_START;

const hazard = (t: number, kind: HazardKind, lane = MID, rayHeight?: 'low' | 'high'): DirectorEvent => ({ t, kind, lane, rayHeight });
/** Lo stesso ostacolo su più vie insieme (un solo pattern: D deve scegliere la via libera). */
const across = (t: number, kind: HazardKind, lanes: number[], rayHeight?: 'low' | 'high'): DirectorEvent[] =>
  lanes.map((lane) => hazard(t, kind, lane, rayHeight));
const toss = (t: number, parryable: boolean, lane = MID): DirectorEvent => ({ t, kind: 'throw', lane, parryable });

const one = (kind: PickupKind, t: number, y?: number, lane = MID): PickupSpec => ({ t, kind, y, lane });
/** `count` oggetti in fila, a distanza `spacing` secondi l'uno dall'altro. */
const line = (kind: PickupKind, t: number, count: number, spacing: number, y?: number, lane = MID): PickupSpec[] =>
  Array.from({ length: count }, (_, i) => ({ t: t + i * spacing, kind, y, lane }));
/** Un arco di oggetti che sale da `base` a `peak` e riscende: guida il salto sopra un ostacolo. */
const arc = (kind: PickupKind, t: number, count: number, spacing: number, base: number, peak: number, lane = MID): PickupSpec[] =>
  Array.from({ length: count }, (_, i) => ({
    t: t + i * spacing,
    kind,
    lane,
    y: base + (peak - base) * Math.sin((Math.PI * i) / Math.max(1, count - 1))
  }));

export const TUNNEL_SCRIPT: readonly DirectorEvent[] = [
  // 1. Imbocco: ostacoli isolati; l'ultimo muro copre due vie e insegna a cambiarle.
  hazard(3, 'low'),
  hazard(6.5, 'wall'),
  hazard(9.5, 'low'),
  hazard(12, 'crate'),
  hazard(14.5, 'low', 0),
  ...across(17.5, 'wall', [0, 1]),
  // 2. Il lanciatore: si impara a rimbalzare (arancio, "PARA") e a saltare (giallo, "SALTA"); arrivano i primi nemici del Cammino.
  hazard(21.4, 'archer', 1),
  toss(23.5, true),
  hazard(26, 'low', 2),
  hazard(27.2, 'pilgrim', 1),
  toss(28.5, true, 0),
  hazard(31, 'crate', 0),
  hazard(33.3, 'archer', 1),
  // Evento A «Checco si stacca» (34-48): la distanza sale e sbarrano la strada le guardie del cinema.
  hazard(36.5, 'guard'),
  hazard(38.8, 'guard', 0),
  hazard(41.1, 'guard', 2),
  hazard(43.4, 'guard'),
  ...across(45.7, 'low', [0, 1]),
  hazard(47.6, 'crate', 2),
  toss(49.4, true),
  // 3. Il crollo: detriti, voragini, raggi.
  hazard(52.5, 'debris'),
  hazard(55, 'pit'),
  hazard(57.5, 'debris', 0),
  hazard(58.9, 'pilgrim', 1),
  toss(60.5, true, 2),
  ...across(63, 'ray', [1, 2], 'low'),
  hazard(64.5, 'archer', 0),
  ...across(66, 'ray', [0, 1], 'high'),
  hazard(68.5, 'pit', 2),
  hazard(69.8, 'pilgrim', 1),
  hazard(71, 'debris'),
  hazard(73.5, 'ray', 0, 'low'),
  hazard(74.9, 'archer', 2),
  toss(76.5, true),
  // Il muro che ferma il masso (evento B, 62-79.5): D lo attraversa con lo scatto o passa dalla via libera; il masso, alle sue spalle, ci si schianta.
  ...across(78, 'wall', [0, 1]),
  // 4. Lo spettacolo (80-110): il bivio, i paparazzi e il karaoke di Checco (evento 100-110: le note si programmano da sole).
  hazard(82, 'low'),
  hazard(84.5, 'crate', 2),
  // Bivio (annuncio a 83.5 s): nella via lontana ci sono il premio e il raggio, nella via vicina la strada è libera.
  hazard(87.5, 'wall', 1),
  hazard(87.5, 'ray', 0, 'high'),
  hazard(89.2, 'pilgrim', 1),
  hazard(91, 'debris'),
  hazard(92.7, 'archer', 0),
  // Paparazzi (annuncio a 92 s): il lampo abbaglia chi sta nella via del fotografo.
  hazard(94.5, 'paparazzo', 2),
  hazard(97, 'paparazzo', 1),
  hazard(99.2, 'paparazzo', 0),
  // 5. L'alterazione (110-188): il Botafumeiro (annuncio a 111 s), la prima onda di Checco (arriva a 130 s = 1170 m), il buio (154-160)
  //    e la seconda onda (164 s = 1476 m). Durante le modalità (130-152 e 164-186) il copione è più rado: una minaccia ogni 3 s.
  hazard(113.5, 'pendulum', 1),
  hazard(117.5, 'pendulum', 0),
  hazard(119.3, 'pilgrim', 1),
  hazard(121, 'low', 2),
  hazard(122.8, 'archer', 0),
  hazard(124.5, 'pendulum', 2),
  hazard(127.5, 'debris'),
  hazard(133, 'low', 2),
  ...across(136, 'wall', [0, 1]),
  hazard(139, 'debris'),
  toss(142, true, 2),
  ...across(145, 'pit', [1, 2]),
  hazard(148, 'crate', 0),
  hazard(151, 'low'),
  hazard(153.5, 'pilgrim', 1),
  hazard(156, 'low'),
  hazard(158.5, 'wall', 0),
  hazard(161, 'low', 2),
  hazard(163, 'archer', 1),
  hazard(167, 'low', 2),
  ...across(170, 'wall', [0, 1]),
  hazard(171.5, 'pilgrim', 2),
  hazard(173, 'debris'),
  toss(176, true, 2),
  hazard(177.5, 'archer', 1),
  ...across(179, 'pit', [1, 2]),
  hazard(182, 'crate', 0),
  hazard(183.5, 'pilgrim', 1),
  hazard(185, 'low'),
  // 6. Rettilineo finale (188-200): densità massima. Solo qui si può raggiungere Checco.
  ...across(190.5, 'low', [1, 2]),
  hazard(193.5, 'debris'),
  hazard(194.8, 'pilgrim', 1),
  toss(196, true, 0),
  hazard(197.3, 'archer', 1),
  ...across(198.5, 'pit', [0, 2])
];

/**
 * Gli oggetti (FASE 10), in ordine di tempo: poche scatole-bonus (una ogni ~15 s, nei
 * punti dove servono), le Sfere del Drago (archi sopra gli ostacoli e file in alto che
 * premiano il supersalto della freccia gialla) e la freccia. Non hanno regole di
 * spaziatura: stanno negli spazi fra le minacce, spesso nelle vie meno comode.
 */
export const TUNNEL_PICKUPS: readonly PickupSpec[] = [
  // 1. Imbocco: un arco sul primo ostacolo, la scatola, la freccia gialla e le Sfere in alto che premiano il supersalto.
  ...arc('sphere', 9.05, 3, 0.45, 0.9, 2.3),
  one('box', 13.2),
  one('arrow', 15.3),
  ...line('sphere', 16.1, 3, 0.25, 3.4),
  // 2. Il lanciatore: una fila di Sfere nella via libera, in alto un'altra sopra le guardie.
  ...arc('sphere', 25.55, 3, 0.45, 0.9, 2.2, 2),
  one('box', 29.4, undefined, 0),
  one('sphere', 37.65, 2.4),
  one('sphere', 39.95, 2.4, 0),
  one('sphere', 42.25, 2.4, 2),
  one('box', 46.65, undefined, 2),
  // 3. Il crollo.
  ...arc('sphere', 54.55, 4, 0.25, 0.8, 2.2),
  one('box', 59),
  one('box', 75.2, undefined, 0),
  // 4. Lo spettacolo: il premio del bivio (Sfere nella via lontana, sotto il raggio), la scatola nella via sicura e una prima dei paparazzi.
  ...line('sphere', 86.6, 3, 0.45, 1.3, 0),
  one('box', 88.5, undefined, 2),
  one('box', 93.5, undefined, 1),
  // 5. L'alterazione: scatole prima e dopo le onde e il buio, un arco di Sfere sopra la bassa della via vicina.
  one('box', 115.5, undefined, 1),
  ...arc('sphere', 120.6, 3, 0.4, 0.8, 2.1, 2),
  one('box', 126.5, undefined, 0),
  one('box', 140.5, undefined, 0),
  one('box', 153, undefined, 2),
  one('box', 162.5, undefined, 1),
  one('box', 177.5, undefined, 0),
  // 6. Il rettilineo.
  one('box', 192, undefined, 1)
].sort((a, b) => a.t - b.t);

const LOOP_EVENTS = TUNNEL_SCRIPT.filter((event) => event.t >= TUNNEL_LOOP_FROM);
/** Le Sfere non si ripetono (sono sette per corsa): si ripetono solo scatole e frecce. */
const LOOP_PICKUPS = TUNNEL_PICKUPS.filter((pickup) => pickup.t >= TUNNEL_LOOP_FROM && pickup.kind !== 'sphere');

/** L'`index`-esimo evento del copione, comprese le ripetizioni dell'ultimo tratto. */
export function scriptEvent(index: number): DirectorEvent {
  if (index < TUNNEL_SCRIPT.length) return TUNNEL_SCRIPT[index];
  const k = index - TUNNEL_SCRIPT.length;
  const cycle = Math.floor(k / LOOP_EVENTS.length) + 1;
  return { ...LOOP_EVENTS[k % LOOP_EVENTS.length], t: LOOP_EVENTS[k % LOOP_EVENTS.length].t + cycle * TUNNEL_LOOP_PERIOD };
}

/** L'`index`-esimo oggetto del copione, comprese le ripetizioni dell'ultimo tratto. */
export function scriptPickup(index: number): PickupSpec {
  if (index < TUNNEL_PICKUPS.length) return TUNNEL_PICKUPS[index];
  const k = index - TUNNEL_PICKUPS.length;
  const cycle = Math.floor(k / LOOP_PICKUPS.length) + 1;
  const base = LOOP_PICKUPS[k % LOOP_PICKUPS.length];
  return { ...base, t: base.t + cycle * TUNNEL_LOOP_PERIOD };
}

/**
 * Controlla il copione: ordinato, ogni minaccia leggibile abbastanza prima del
 * contatto (anche al tempo massimo dello Slancio), e distanziate di almeno
 * `TUNNEL_TELEGRAPH_MIN` + 0.3 s fra loro. Gli eventi allo STESSO istante sono un solo pattern:
 * vie diverse, mai tutte e tre occupate (ne resta una libera). Restituisce l'elenco dei
 * problemi (vuoto = ok). Usato dai test e in sviluppo.
 */
export function validateScript(script: readonly DirectorEvent[] = TUNNEL_SCRIPT): string[] {
  const problems: string[] = [];
  const visibleFor = TUNNEL_SPAWN_AHEAD_MIN / TUNNEL_RUN_SPEED;
  if (visibleFor < TUNNEL_TELEGRAPH_MIN) problems.push('la distanza di nascita non basta per la leggibilità minima');
  if (TUNNEL_THROW.telegraph < TUNNEL_TELEGRAPH_MIN) problems.push('l’avviso del lancio è più corto della leggibilità minima');

  // Pattern = eventi con lo stesso `t`.
  const patterns: { t: number; lanes: number[] }[] = [];
  for (const event of script) {
    if (event.lane < 0 || event.lane >= TUNNEL_LANES) problems.push(`via ${event.lane} inesistente (a ${event.t} s)`);
    const last = patterns[patterns.length - 1];
    if (last && last.t === event.t) last.lanes.push(event.lane);
    else patterns.push({ t: event.t, lanes: [event.lane] });
  }
  for (const pattern of patterns) {
    if (new Set(pattern.lanes).size !== pattern.lanes.length) problems.push(`due minacce nella stessa via a ${pattern.t} s`);
    if (pattern.lanes.length >= TUNNEL_LANES) problems.push(`tutte le vie occupate a ${pattern.t} s`);
  }
  for (let i = 1; i < patterns.length; i += 1) {
    const gap = patterns[i].t - patterns[i - 1].t;
    if (gap < 0) problems.push(`pattern ${i} fuori ordine`);
    else if (gap < TUNNEL_TELEGRAPH_MIN + 0.3) problems.push(`pattern ${i - 1} e ${i} troppo vicini (${gap.toFixed(2)} s)`);
  }
  if (script.length > 0 && script[script.length - 1].t > TUNNEL_TOTAL_DURATION) problems.push('un evento oltre la fine della corsa');
  for (const section of TUNNEL_SECTIONS) {
    const first = script.find((e) => e.t >= section.start);
    if (first && first.t - section.start < TUNNEL_TELEGRAPH_MIN + 0.3) {
      problems.push(`la sezione ${section.id} comincia con una minaccia troppo presto`);
    }
  }
  // La ripetizione dell'ultimo tratto deve incollarsi bene al resto.
  if (script === TUNNEL_SCRIPT && LOOP_EVENTS.length > 0) {
    const join = scriptEvent(TUNNEL_SCRIPT.length).t - TUNNEL_SCRIPT[TUNNEL_SCRIPT.length - 1].t;
    if (join < TUNNEL_TELEGRAPH_MIN + 0.3) problems.push(`la ripetizione si attacca troppo vicina (${join.toFixed(2)} s)`);
  }

  // Slancio: al tempo massimo il mondo corre più in fretta, ma gli avvisi devono restare leggibili.
  const maxTempo = SLANCIO_TEMPO[SLANCIO_TEMPO.length - 1];
  if (visibleFor / maxTempo < TUNNEL_TELEGRAPH_MIN) problems.push('al tempo massimo le minacce nascono troppo vicine');
  for (const [name, seconds] of [
    ['lancio', TUNNEL_THROW.telegraph],
    ['raggio', TUNNEL_RAY.warn],
    ['detrito', TUNNEL_DEBRIS.warn]
  ] as const) {
    if (seconds / maxTempo < TUNNEL_TELEGRAPH_MIN_AT_MAX_TEMPO) problems.push(`al tempo massimo l’avviso del ${name} è troppo breve`);
  }

  // Eventi: dentro UNA sezione e a ≥ 3 s dal suo inizio (il checkpoint).
  for (const event of TUNNEL_EVENTS) {
    const section = TUNNEL_SECTIONS[sectionIndexAt(event.start)];
    if (event.start - section.start < 3) problems.push(`l’evento ${event.id} parte troppo vicino al checkpoint`);
    if (event.end > section.start + section.duration) problems.push(`l’evento ${event.id} esce dalla sua sezione`);
  }
  // Battute a tempo: in ordine e dentro la corsa.
  for (let i = 0; i < TUNNEL_BARKS.length; i += 1) {
    if (TUNNEL_BARKS[i].t < 0 || TUNNEL_BARKS[i].t > TUNNEL_TOTAL_DURATION) problems.push(`una battuta fuori dalla corsa (${TUNNEL_BARKS[i].t} s)`);
    if (i > 0 && TUNNEL_BARKS[i].t < TUNNEL_BARKS[i - 1].t) problems.push(`battuta ${i} fuori ordine`);
  }
  // Oggetti: dentro la corsa e in una via che esiste.
  for (const pickup of TUNNEL_PICKUPS) {
    if (pickup.t < 0 || pickup.t > TUNNEL_TOTAL_DURATION) problems.push(`un oggetto fuori dalla corsa (${pickup.kind} a ${pickup.t.toFixed(1)} s)`);
    if (pickup.lane < 0 || pickup.lane >= TUNNEL_LANES) problems.push(`un oggetto in una via inesistente (${pickup.kind} a ${pickup.t.toFixed(1)} s)`);
  }
  return problems;
}

/** Indice del primo evento che arriva a `time` o dopo. */
function firstEventFrom(time: number): number {
  let index = 0;
  while (scriptEvent(index).t < time) index += 1;
  return index;
}

/** Indice del primo oggetto del copione che arriva a `time` o dopo. */
function firstPickupFrom(time: number): number {
  let index = 0;
  while (scriptPickup(index).t < time) index += 1;
  return index;
}

/** Fa nascere ciò che sta per entrare: le minacce e gli oggetti nascono OLTRE il bordo destro reale dello schermo. */
export function spawnDue(world: TunnelWorld, messenger: BossMessenger): void {
  const ahead = world.view.ahead / TUNNEL_RUN_SPEED;
  // Le battute a tempo (bivio, paparazzi, Botafumeiro).
  for (;;) {
    const bark = TUNNEL_BARKS[world.nextBark];
    if (!bark || world.time < bark.t) break;
    messenger.flash(bark.title, bark.hint, 3.6);
    world.nextBark += 1;
  }
  for (;;) {
    const event = scriptEvent(world.nextEvent);
    // I lanci si pianificano con largo anticipo: quando partono lo decide la marionetta in base alla distanza.
    if (world.time < event.t - (event.kind === 'throw' ? TUNNEL_THROW.planAhead : ahead)) break;
    if (event.kind === 'throw') scheduleThrow(world, event.t, event.parryable, event.lane);
    else spawnHazard(world, event.kind, event.t, { rayHeight: event.rayHeight, lane: event.lane });
    world.nextEvent += 1;
  }
  for (;;) {
    const spec = scriptPickup(world.nextPickup);
    if (world.time < spec.t - ahead) break;
    spawnPickup(world, spec.kind, spec.t, spec.y, spec.lane);
    world.nextPickup += 1;
  }
}

/** Sposta la corsa a `time`: azzera ciò che c'è in scena e ricalcola il prossimo evento (checkpoint, test). */
export function jumpToTime(world: TunnelWorld, time: number): void {
  world.time = time;
  world.runX = world.startX + time * TUNNEL_RUN_SPEED;
  world.hazards.length = 0;
  world.throws.length = 0;
  world.pickups.length = 0;
  world.arena.projectiles.length = 0;
  world.nextEvent = firstEventFrom(time);
  world.nextPickup = firstPickupFrom(time);
  const bark = TUNNEL_BARKS.findIndex((entry) => entry.t >= time);
  world.nextBark = bark < 0 ? TUNNEL_BARKS.length : bark;
  world.sectionIndex = sectionIndexAt(time);
  syncEvents(world);
}

/** Cosa serve al direttore per un frame. */
export interface DirectorContext {
  world: TunnelWorld;
  jump: JumpState;
  messenger: BossMessenger;
}

/** Sconfitta: ripartenza fra poco. Per vita dall'inizio della sezione; per distanza o tempo, dall'inizio dell'inseguimento. */
function startRespawn({ world, messenger }: DirectorContext, reason: 'hp' | 'gap' | 'time'): void {
  world.stage = 'respawn';
  world.defeat = reason;
  world.respawnTimer = TUNNEL_RESPAWN_DELAY;
  world.arena.projectiles.length = 0;
  const hint = reason === 'hp' ? 'Si riparte dall’inizio della sezione' : 'L’inseguimento ricomincia dall’inizio';
  const title = reason === 'hp' ? 'Sconfitto' : reason === 'gap' ? 'Checco è sfuggito!' : 'Tempo scaduto!';
  messenger.flash(title, hint, TUNNEL_RESPAWN_DELAY + 0.4);
}

/** Rimette D in piedi dopo una sconfitta: vita piena, niente stordimento, via di partenza, un attimo di protezione. */
function resetPlayerAfterDefeat({ world, jump }: DirectorContext): void {
  const player = world.arena.player;
  world.arena.over = null;
  world.stage = 'run';
  world.strafe = 0;
  world.gapPending = 0;
  resetLane(world);
  player.hp = world.maxHp;
  player.heals = 0;
  player.healing = false;
  player.hitTimer = 0;
  player.knockbackVx = 0;
  player.y = 0;
  // Un attimo di protezione per non essere colpiti appena si riparte.
  player.iframes = 1;
  world.runner.action = 'none';
  world.runner.actionTime = 0;
  resetJump(jump, true);
  useArenaStore.getState().set({ playerHp: Math.round(player.hp), message: null, hint: null });
}

/** Ripartenza dal checkpoint: vita piena e distanza di inizio sezione (stili e desideri restano). */
function restartSection(ctx: DirectorContext): void {
  const { world, messenger } = ctx;
  const section = TUNNEL_SECTIONS[world.sectionIndex];
  jumpToTime(world, section.start);
  // Ripartenza da zero: niente Slancio, bonus o Sfere raccolti prima della sconfitta.
  resetSlancio(world);
  resetBonuses(world);
  resetPlayerAfterDefeat(ctx);
  world.gap = Math.min(world.gapAtSection, TUNNEL_GAP_RESPAWN_MAX);
  world.announcedSection = world.sectionIndex;
  messenger.flash(section.bark, null, 3);
}

/** Ripartenza dall'INIZIO dell'inseguimento: distanza iniziale, tempo azzerato, via desideri e stili. */
function restartRun(ctx: DirectorContext): void {
  const { world, messenger } = ctx;
  // Si ricomincia da capo: gli stili svaniscono PRIMA del salto (Eve resta solo se è ancora uno stile) e così i desideri
  // (la vita massima torna a quella di base).
  resetPerks(world);
  jumpToTime(world, 0);
  resetSlancio(world);
  resetBonuses(world);
  resetWishes(world);
  resetPlayerAfterDefeat(ctx);
  world.gap = world.gapStart;
  world.gapAtSection = world.gapStart;
  world.elapsed = 0;
  world.announcedSection = 0;
  messenger.flash(TUNNEL_SECTIONS[0].bark, null, 3);
}

/**
 * Un frame di direzione: nascita delle minacce, cambio sezione (battuta e
 * checkpoint), sconfitta/ripartenza e fine della corsa. Restituisce `true`
 * quando la corsa è finita (D ha raggiunto la marionetta), una volta sola.
 */
export function updateDirector(ctx: DirectorContext, delta: number): boolean {
  const { world, messenger } = ctx;

  if (world.stage === 'respawn') {
    world.respawnTimer -= delta;
    if (world.respawnTimer <= 0) {
      if (world.defeat === 'hp') restartSection(ctx);
      else restartRun(ctx);
    }
    return false;
  }
  if (world.stage !== 'run') return false;

  // Cambio di sezione: nuovo checkpoint (la distanza di quel momento) e battuta della marionetta.
  const index = sectionIndexAt(world.time);
  if (index !== world.sectionIndex) {
    world.sectionIndex = index;
    world.gapAtSection = world.gap;
  }
  if (world.announcedSection !== index) {
    world.announcedSection = index;
    messenger.flash(TUNNEL_SECTIONS[index].bark, null, 3);
  }

  spawnDue(world, messenger);

  // Sconfitte: vita a zero, la marionetta è sfuggita, tempo scaduto.
  if (world.arena.over === 'defeat') {
    startRespawn(ctx, 'hp');
    return false;
  }
  if (world.gap >= TUNNEL_GAP_MAX) {
    startRespawn(ctx, 'gap');
    return false;
  }
  if (world.elapsed >= TUNNEL_TIME_LIMIT) {
    startRespawn(ctx, 'time');
    return false;
  }

  // Fine corsa: raggiunta (solo nell'ultima sezione il minimo scende a 0).
  if (world.gap <= 0) {
    world.gap = 0;
    world.gapPending = 0;
    world.stage = 'finished';
    world.hazards.length = 0;
    world.throws.length = 0;
    world.arena.projectiles.length = 0;
    return true;
  }
  return false;
}
