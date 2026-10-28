import { cameoById, cameoPerks, pickCameo } from '@/data/tunnelCameos';
import { aabbOverlap } from '@/game/render2d/collision';
import { addCuriosity } from '@/store/runStatsStore';
import type { BossMessenger } from '../BossArena/bossMessages';
import { ARENA_PLAYER_HEIGHT, HITSTOP_LIGHT } from '../BossArena/arenaConfig';
import { addRing, hitPlayer, parryProjectile, playerHurtbox } from '../BossArena/combat';
import { clearAhead } from './tunnelClear';
import { spawnHazard } from './tunnelCombat';
import { inPlayerLane } from './tunnelLanes';
import { setPlayerHp, sayAbovePlayer } from './tunnelPickups';
import { grantPerk, grantPerks } from './tunnelPerks';
import { addGap } from './tunnelPuppet';
import { clearMaluses, onPlayerHit } from './tunnelSlancio';
import { hasPerk, parryStats, tryInstinct } from './tunnelWishes';
import type { TunnelWorld } from './tunnelState';
import {
  CAMEO_CAST,
  CAMINO_TURRETS,
  EVE_HELP,
  KAMEHAMEHA,
  MODE_ANIME,
  MOOD_BLEND_SPEED,
  REALITY_WAVE,
  TUNNEL_GAP_HIT_PENALTY,
  TUNNEL_LANES,
  TUNNEL_REALITY,
  TUNNEL_RUN_SPEED,
  type ModeId
} from './tunnelConfig';

/**
 * Checco «usa i suoi poteri per alterare la realtà» (FASE 10, tappa 3). A distanze fisse del
 * percorso (`TUNNEL_REALITY`, secondo di arrivo dell'onda = metri/9) scaglia un'ONDA che viaggia nelle
 * vie indicate, con un contatore in metri che scende. Tre esiti:
 *
 *  - PRESO (l'onda ti colpisce): **modalità Buen Camino** — Checco scappa più in fretta, lo sfondo
 *    cambia atmosfera e arrivano torrette volanti da abbattere in salto.
 *  - DEVIATO (parata a tempo, K): **modalità shonen** — Checco inciampa, ti rimetti in forze, a turno UN ospite per volta
 *    (un personaggio, o un gruppo come i Gentleman; Eve l'ultima nella seconda onda) ti dà una mano a modo suo e alla fine parte il Kamehameha.
 *  - SCHIVATO (cambio via, salto, scatto): niente modalità, solo un po' di terreno.
 *
 * Pura (niente React/Three): la resa legge `world.wave`, `world.mode`, `world.mood` e `world.beam`.
 */

/** Quanto dopo il suo passaggio, oltre D, l'onda si considera "andata" (schivata). */
const WAVE_PASSED_BEHIND = 2.5;

/** Peso di ogni atmosfera (normale, Buen Camino, shonen) per una modalità. */
function moodTarget(id: ModeId | null): [number, number, number] {
  return id === 'camino' ? [0, 1, 0] : id === 'anime' ? [0, 0, 1] : [1, 0, 0];
}

/** Dopo un salto nel tempo, una ripartenza o l'inizio della raffica: nessun attacco in corso. */
export function resetReality(world: TunnelWorld): void {
  world.wave = null;
  world.mode.id = null;
  world.mode.elapsed = 0;
  world.mode.duration = 0;
  world.mode.turretsSpawned = 0;
  world.mode.allyTimer = 0;
  world.mode.allyFlash = 0;
  world.mode.cameoId = null;
  world.mode.cameoT = 0;
  world.mode.cameoCursor = 0;
  world.mode.recentCameos = [];
  world.mode.slot = -1;
  world.mode.helps = 0;
  world.mode.withEve = false;
  // Eve, una volta arrivata, resta per tutta la corsa (finché non si ricomincia dall'INIZIO).
  const eveStays = hasPerk(world, 'eve');
  world.mode.eveOn = eveStays;
  world.mode.eveArrive = eveStays ? 1 : 0;
  world.mode.eveTimer = eveStays ? EVE_HELP.interval : 0;
  world.mode.eveFlash = 0;
  world.mode.finale = 'none';
  world.mode.finaleT = 0;
  world.mood = [1, 0, 0];
  // Il prossimo attacco è il primo che non è già partito.
  const index = TUNNEL_REALITY.findIndex((def) => def.arriveT - REALITY_WAVE.warn > world.time);
  world.realityNext = index < 0 ? TUNNEL_REALITY.length : index;
}

/** L'onda parte: avviso a tutto schermo, finestra su Checco, contatore in metri. */
function launchWave(world: TunnelWorld, messenger: BossMessenger): void {
  const def = TUNNEL_REALITY[world.realityNext];
  // Dove sarà D quando l'onda lo raggiunge, più quanto l'onda percorre nel frattempo (viaggia verso D).
  const arriveX = world.startX + def.arriveT * TUNNEL_RUN_SPEED;
  const x = arriveX + -REALITY_WAVE.speed * (def.arriveT - world.time);
  world.wave = { x, lanes: def.lanes, index: world.realityNext };
  world.realityNext += 1;
  messenger.flash(def.bark[0], def.bark[1], 4.2);
  if (!world.window.open) {
    world.window.open = true;
    world.window.kind = 'reality';
    world.window.t = 0;
  }
}

/** Fine dell'onda: avvia la modalità giusta (o niente). */
function endWave(world: TunnelWorld, outcome: 'hit' | 'deflected' | 'dodged', messenger: BossMessenger): void {
  const waveIndex = world.wave?.index ?? -1;
  world.wave = null;
  const { arena, puppet } = world;
  if (outcome === 'dodged') {
    addGap(world, REALITY_WAVE.dodgeGap);
    sayAbovePlayer(world, 'SCHIVATA!');
    messenger.flash('Schivata. Checco ci rimane male.', null, 2);
    return;
  }
  if (outcome === 'hit') {
    startMode(world, 'camino', false);
    messenger.flash('BUEN CAMINO! Checco accelera e il cammino si fa pieno di zaini volanti', 'Salta e colpisci le torrette: ognuna ti ridà terreno', 4);
    return;
  }
  // Deviata: Checco incassa la sua stessa onda.
  parryProjectile(arena);
  puppet.flash = 0.8;
  arena.hitStop = Math.max(arena.hitStop, HITSTOP_LIGHT * 2);
  addRing(arena, arena.player.x + 1, arena.player.y + 1, 2.4, 0.5, '#f0abfc');
  startMode(world, 'anime', TUNNEL_REALITY[waveIndex]?.eve === true);
  messenger.flash('DEVIATA! MODALITÀ SHONEN!', 'Un ospite alla volta ti dà una mano a modo suo. Alla fine, Kamehameha', 4);
}

function startMode(world: TunnelWorld, id: ModeId, withEve: boolean): void {
  const { mode, arena } = world;
  mode.id = id;
  mode.elapsed = 0;
  mode.duration = REALITY_WAVE.modeSeconds;
  mode.turretsSpawned = 0;
  mode.allyTimer = CAMEO_CAST.firstHelp;
  mode.allyFlash = 0;
  mode.cameoId = null;
  mode.cameoT = 0;
  mode.slot = -1;
  mode.helps = 0;
  mode.withEve = withEve && !hasPerk(world, 'eve');
  mode.finale = 'none';
  mode.finaleT = 0;
  if (id === 'camino') {
    // Le torrette nascono tutte adesso, ben oltre il bordo dello schermo, e arrivano a tempo.
    CAMINO_TURRETS.forEach((turret) => {
      spawnHazard(world, 'turret', world.time + turret.dt, { lane: turret.lane });
    });
    mode.turretsSpawned = CAMINO_TURRETS.length;
  } else {
    addGap(world, MODE_ANIME.startGap);
    setPlayerHp(world, arena.player.hp + MODE_ANIME.heal);
    sayAbovePlayer(world, 'SHONEN!');
    // La modalità shonen toglie i malus (frenato, rallentato) e i resti dei nemici per terra.
    clearMaluses(world);
    for (const hazard of world.hazards) if (hazard.kind === 'remains') hazard.phase = 'spent';
  }
}

/** Un fascio di luce di Frieren (violetto) o del Kamehameha (azzurro). */
function setBeam(world: TunnelWorld, from: number, y: number, lane: number, color: 'violet' | 'blue' | 'orange', length: number, thickness: number, life: number): void {
  world.beam = { life, lifeMax: life, x: from, y, lane, color, length, thickness };
}

/**
 * L'ospite della modalità: UNO solo (un personaggio, o un gruppo che arriva insieme) per tutta la modalità, `CAMEO_CAST.stay` secondi.
 * Nella seconda onda è Eve, che arriva di corsa; gli altri escono da un PORTALE che, aprendosi, spazza via ciò che sta davanti a D.
 */
function enterHelper(world: TunnelWorld, messenger: BossMessenger): void {
  const { mode, arena } = world;
  mode.slot = 0;
  mode.helps = 0;
  mode.cameoT = 0;
  if (mode.withEve) {
    // Eve arriva di corsa e RESTA: il suo stile è «sempre con te».
    mode.cameoId = null;
    mode.eveOn = true;
    mode.eveArrive = 0;
    mode.eveTimer = EVE_HELP.arrive + EVE_HELP.firstHelp;
    mode.eveFlash = 0;
    grantPerk(world, 'eve');
    addCuriosity('cameo:eve');
    return;
  }
  const cameo = pickCameo(mode.recentCameos);
  mode.cameoCursor += 1;
  mode.recentCameos = [...mode.recentCameos, cameo.id].slice(-12);
  mode.cameoId = cameo.id;
  addCuriosity(`cameo:${cameo.id}`);
  mode.allyTimer = CAMEO_CAST.firstHelp;
  // Lo stile permanente che l'ospite ti lascia (cambia anche l'aspetto di D).
  grantPerks(world, cameoPerks(cameo), messenger);
  // Il portale si apre e spazza via ciò che sta davanti, in tutte le vie.
  const player = arena.player;
  const count = clearAhead(world, player.x, CAMEO_CAST.entranceRange);
  setBeam(world, player.x + CAMEO_CAST.offsetX, 3.2, CAMEO_CAST.lane, cameo.beam ?? 'violet', CAMEO_CAST.entranceRange, 1, 0.4);
  addRing(arena, player.x + CAMEO_CAST.offsetX, 3.1, 2.6, 0.5, '#c4b5fd');
  arena.popups.push({ x: player.x + CAMEO_CAST.offsetX + 1, y: 4.8, amount: 0, target: 'boss', boost: 1, label: count > 0 ? 'PORTALE!' : 'ARRIVANO!' });
}

/** L'aiuto dell'ospite in scena, a modo suo (vedi `CameoHelp`); la prima volta anche l'eventuale piccolo bonus. */
function giveHelp(world: TunnelWorld): void {
  const { mode, arena } = world;
  const cameo = mode.cameoId ? cameoById(mode.cameoId) : undefined;
  if (!cameo) return;
  const player = arena.player;
  const help = cameo.help ?? 'lane';
  const ship = cameo.style === 'ship';
  const here = Math.round(world.lane.pos);
  const first = mode.helps === 0;
  mode.helps += 1;
  mode.allyFlash = 0.45;
  const popupX = player.x + CAMEO_CAST.offsetX + 1;
  if (help === 'shield') {
    player.iframes = Math.max(player.iframes, CAMEO_CAST.shield);
    addRing(arena, player.x, player.y + 1, 1.8, 0.4, '#fde68a');
    arena.popups.push({ x: popupX, y: 4.4, amount: 0, target: 'boss', boost: 1, label: cameo.shout });
  } else {
    let lane: number | undefined = here;
    let range: number = CAMEO_CAST.range;
    if (help === 'wide') {
      lane = undefined;
      range = CAMEO_CAST.wideRange;
    } else if (help === 'lost') {
      // Sbaglia strada: aiuta (per caso) in una via che non è quella di D.
      const others = Array.from({ length: TUNNEL_LANES }, (_, i) => i).filter((i) => i !== here);
      lane = others[Math.floor(Math.random() * others.length)];
    }
    if (ship) range *= CAMEO_CAST.shipRangeFactor;
    const count = clearAhead(world, player.x, range, lane);
    if (lane === undefined) setBeam(world, player.x + CAMEO_CAST.offsetX, 3.2, CAMEO_CAST.lane, cameo.beam ?? 'violet', range, ship ? 1.1 : 0.9, 0.4);
    else setBeam(world, player.x + CAMEO_CAST.offsetX, 1.2, lane, cameo.beam ?? 'violet', range, 0.5, 0.4);
    // La scritta dell'urlo compare solo se ha davvero ripulito qualcosa (o se ha sbagliato via), per non riempire lo schermo.
    if (count > 0 || help === 'lost') arena.popups.push({ x: popupX, y: 4.4, amount: 0, target: 'boss', boost: 1, label: help === 'lost' ? `${cameo.shout} …di là!` : cameo.shout });
  }
  if (first && cameo.bonus === 'heal') setPlayerHp(world, player.hp + CAMEO_CAST.heal);
  else if (first && cameo.bonus === 'gap') addGap(world, CAMEO_CAST.gap);
  // I potenti (wide) e chi dà lo scudo aiutano più di rado; gli altri ogni `helpEvery` secondi.
  mode.allyTimer = help === 'wide' ? CAMEO_CAST.wideEvery : help === 'shield' ? CAMEO_CAST.shieldEvery : CAMEO_CAST.helpEvery;
}

/** Eve: arriva da dietro, gli corre accanto e ogni tanto ripulisce la via di D davanti a lui (senza esagerare). */
function updateEve(world: TunnelWorld, delta: number, worldDt: number, messenger: BossMessenger): void {
  const { mode, arena } = world;
  if (!mode.eveOn) return;
  mode.eveFlash = Math.max(0, mode.eveFlash - delta);
  const wasArriving = mode.eveArrive < 1;
  mode.eveArrive = Math.min(1, mode.eveArrive + delta / EVE_HELP.arrive);
  if (wasArriving && mode.eveArrive >= 1 && world.mode.id === 'anime') messenger.flash('Eve: «Non pensavi di fare tutto da solo, vero?»', 'Resta con te fino alla fine', 3);
  mode.eveTimer -= worldDt;
  if (mode.eveArrive >= 1 && mode.eveTimer <= 0) {
    mode.eveTimer = EVE_HELP.interval;
    mode.eveFlash = 0.4;
    const lane = Math.round(world.lane.pos);
    const count = clearAhead(world, arena.player.x, EVE_HELP.range, lane);
    setBeam(world, arena.player.x + 1.2, 1.2, lane, 'violet', EVE_HELP.range, 0.5, 0.3);
    if (count > 0) arena.popups.push({ x: arena.player.x + 3, y: 2.2, amount: 0, target: 'boss', boost: 1, label: 'EVE!' });
  }
}

/** La modalità shonen: un ospite per volta (Eve l'ultima, se c'è) aiuta a modo suo e, finita, parte il Kamehameha. */
function updateAnime(world: TunnelWorld, delta: number, worldDt: number, messenger: BossMessenger): void {
  const { mode, arena } = world;
  const player = arena.player;
  mode.allyFlash = Math.max(0, mode.allyFlash - delta);
  mode.cameoT += delta;

  if (mode.finale === 'none') {
    mode.elapsed += worldDt;
    if (mode.slot < 0) enterHelper(world, messenger);
    // L'ospite se ne va (il portale si richiude) dopo `stay` secondi: da lì in poi D è solo.
    const leaving = mode.cameoT >= CAMEO_CAST.stay - CAMEO_CAST.leave;
    if (mode.cameoId && !leaving) {
      mode.allyTimer -= worldDt;
      if (mode.allyTimer <= 0) giveHelp(world);
    }
    if (mode.elapsed >= mode.duration) {
      // Fine: D carica il Kamehameha, protetto, mentre Frieren si fa da parte.
      mode.finale = 'charge';
      mode.finaleT = 0;
      player.iframes = Math.max(player.iframes, KAMEHAMEHA.charge + 0.4);
      messenger.flash('KA… ME… HA… ME…', null, KAMEHAMEHA.charge + 0.2);
    }
    return;
  }

  mode.finaleT += delta;
  if (mode.finale === 'charge' && mode.finaleT >= KAMEHAMEHA.charge) {
    mode.finale = 'fire';
    mode.finaleT = 0;
    clearAhead(world, player.x, KAMEHAMEHA.range);
    addGap(world, KAMEHAMEHA.gap);
    world.puppet.flash = 0.8;
    setBeam(world, player.x + 0.8, player.y + 1.05, world.lane.pos, 'blue', KAMEHAMEHA.range, 2.4, KAMEHAMEHA.duration);
    arena.popups.push({ x: player.x + 4, y: 3.4, amount: 0, target: 'boss', boost: 1, label: `KAMEHAMEHA! ${KAMEHAMEHA.gap} m` });
    world.shake = Math.max(world.shake, 0.3);
    arena.hitStop = Math.max(arena.hitStop, HITSTOP_LIGHT * 3);
    messenger.flash('HAAAAA!', null, 1.2);
  } else if (mode.finale === 'fire' && mode.finaleT >= KAMEHAMEHA.duration) {
    mode.id = null;
    mode.finale = 'none';
    messenger.flash('Il sole torna a splendere… sul tunnel.', null, 2);
  }
}

/** Un frame di realtà: lancio dell'onda, volo e collisioni, modalità in corso, atmosfera dello sfondo. */
export function updateReality(world: TunnelWorld, delta: number, worldDt: number, messenger: BossMessenger): void {
  const { arena, mode } = world;
  const player = arena.player;

  // Lancio: manca `warn` secondi all'arrivo.
  if (!world.wave && world.realityNext < TUNNEL_REALITY.length) {
    const def = TUNNEL_REALITY[world.realityNext];
    if (world.time >= def.arriveT - REALITY_WAVE.warn) launchWave(world, messenger);
  }

  // Finestra su Checco: si chiude da sola dopo qualche secondo.
  if (world.window.open && world.window.kind === 'reality' && world.window.t > REALITY_WAVE.windowSeconds) world.window.open = false;

  // Eve (se è con noi) lavora sempre, anche fuori dalla modalità shonen.
  updateEve(world, delta, worldDt, messenger);

  // Volo e collisioni dell'onda.
  const wave = world.wave;
  if (wave) {
    wave.x += REALITY_WAVE.speed * worldDt;
    const box = { x: wave.x, y: REALITY_WAVE.height / 2, halfWidth: REALITY_WAVE.width / 2, halfHeight: REALITY_WAVE.height / 2 };
    const parryReach = parryStats(world).reach;
    const parryBox = {
      x: player.x + parryReach / 2,
      y: player.y + ARENA_PLAYER_HEIGHT / 2,
      halfWidth: parryReach / 2,
      halfHeight: ARENA_PLAYER_HEIGHT / 2
    };
    const inWave = wave.lanes.some((lane) => inPlayerLane(world, lane));
    if (inWave && aabbOverlap(box, parryBox) && player.parryActive) {
      endWave(world, 'deflected', messenger);
    } else if (inWave && aabbOverlap(box, playerHurtbox(arena))) {
      // L'Istinto Superiore schiva anche l'onda (conta come schivata: nessuna modalità).
      if (tryInstinct(world)) {
        endWave(world, 'dodged', messenger);
        return;
      }
      const result = hitPlayer(arena, REALITY_WAVE.damage, { unparryable: true, sourceX: wave.x + 1 });
      if (result === 'hit') {
        addGap(world, TUNNEL_GAP_HIT_PENALTY);
        onPlayerHit(world);
        endWave(world, 'hit', messenger);
      }
      // 'ignored' = scatto, aura o un attimo di invulnerabilità: l'onda passa senza fare nulla.
    } else if (wave.x < player.x - WAVE_PASSED_BEHIND) {
      endWave(world, 'dodged', messenger);
    }
  }

  // Modalità in corso.
  if (mode.id === 'anime') updateAnime(world, delta, worldDt, messenger);
  else if (mode.id === 'camino') {
    mode.elapsed += worldDt;
    if (mode.elapsed >= mode.duration) {
      mode.id = null;
      messenger.flash('Il Cammino finisce… per ora.', null, 2.4);
    }
  }

  // Atmosfera dello sfondo: i pesi rincorrono la modalità attuale.
  const target = moodTarget(mode.id);
  const ease = Math.min(1, MOOD_BLEND_SPEED * delta);
  for (let i = 0; i < 3; i += 1) world.mood[i] += (target[i] - world.mood[i]) * ease;
}
