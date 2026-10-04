import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Color } from 'three';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { aabbOverlap } from '@/game/render2d/collision';
import { useArenaStore } from '@/store/arenaStore';
import type { ArenaWorld } from './arenaState';
import { CHECCO_MOVES_ROUND1, CHECCO_MOVES_ROUND2, type CheccoMove, type CheccoWarning } from './checcoMoves';
import {
  addPosture,
  bossHurtbox,
  counterCharge,
  eveHurtbox,
  hitBoss,
  hitPlayer,
  onPlayerMeleeHit,
  playerHurtbox
} from './combat';
import { updateFinisher } from './finisher';
import { POWER_UP_IDS, POWER_UPS, type PowerUpId } from './powerUps';
import {
  POWER_UP_INTRO_SECONDS,
  ARENA_CEILING_Y,
  TURRET_FIRST_DELAY,
  TURRET_FLOOR_CHANCE,
  TURRET_HP,
  TURRET_INTERVAL_ROUND1,
  TURRET_INTERVAL_ROUND2,
  TURRET_MAX_ROUND1,
  TURRET_MAX_ROUND2,
  TURRET_SIZE,
  TURRET_CHARGE,
  TURRET_WALL_Y,
  CLASH_DECAY,
  CLASH_DURATION,
  CLASH_FLING_BOOST,
  CLASH_FLING_SPEED,
  CLASH_LOSE_DAMAGE,
  CLASH_LOSE_STUN,
  CLASH_START_PROGRESS,
  COUNTER_HOP_DURATION,
  COUNTER_HOP_HEIGHT,
  LUNGE_MAX_SPEED,
  LUNGE_MIN_SPEED,
  LUNGE_MIN_TRAVEL,
  TOTEM_COUNTS,
  TOTEM_HP,
  TOTEM_MIN_DISTANCE_FROM_BOSS,
  TOTEM_MIN_SPACING,
  TOTEM_TRIGGER_FRACTIONS,
  TOTEM_WINDUP,
  ARENA_HALF_WIDTH,
  PROJECTILE_LIFETIME,
  TELEPORT_BEHIND_DISTANCE,
  BOSS_HALF_WIDTH,
  BOSS_HEIGHT,
  BOSS_MOVE_COOLDOWN_ROUND1,
  BOSS_MOVE_COOLDOWN_ROUND2,
  BOSS_SPEED_ROUND1,
  BOSS_SPEED_ROUND2,
  END_DELAY,
  EVE_AGGRO_CHANCE,
  EVE_ATTACK_DAMAGE,
  EVE_ATTACK_POSTURE,
  PLAYER_MAX_HP,
  POSTURE_DECAY_DELAY,
  POSTURE_DECAY_PER_SECOND,
  POSTURE_MAX,
  SPECIAL_COMPLETED_BOSS_HEAL,
  SPECIAL_COMPLETED_PLAYER_SPEED,
  SPECIAL_INTERRUPT_DAMAGE,
  SPECIAL_INTERRUPTED_BOSS_SPEED,
  SPECIAL_INTERRUPTED_PLAYER_DAMAGE,
  SPECIAL_INTERRUPTED_PLAYER_HEAL,
  SPECIAL_PARRY_RANGE,
  SPECIAL_PARRY_WINDOW,
  SPECIAL_TRIGGER_HP_FRACTION,
  SPECIAL_WINDUP
} from './arenaConfig';

/** Quota Y massima dell'icona d'avviso (bordo alto visibile ≈ 6.3 con la camera attuale). */
const WARNING_MAX_Y = 5.3;

const COLOR_BASE = new Color('#7a4b2a');
const COLOR_WINDUP = new Color('#e0393a');
const COLOR_ACTIVE = new Color('#f5f5f5');
const COLOR_STAGGER = new Color('#7aa7ff');
const COLOR_SPECIAL_A = new Color('#c9a227');
const COLOR_SPECIAL_B = new Color('#fff2a0');
const COLOR_FLASH = new Color('#ffffff');

interface MoveRuntime {
  move: CheccoMove;
  t: number;
  hitDone: boolean[];
  /** Proiettili già lanciati / detriti già fatti cadere / teletrasporto già fatto. */
  projFired: boolean[];
  debrisFired: boolean;
  teleported: boolean;
  /** Tempesta: prossimo colpo della zona, fulmini già lanciati e quanti ne lancerà. */
  zoneTimer: number;
  boltsFired: number;
  boltCount: number;
  /** Punti di partenza/arrivo del balzo, fissati quando comincia. */
  leapStartX?: number;
  leapTargetX?: number;
  /** Dove si trovava il bersaglio quando Checco ha scelto la mossa: è il punto
   *  d'arrivo di ogni carica/balzo, sempre quello, qualunque cosa faccia il
   *  giocatore dopo. */
  targetX: number;
  lungeStartX?: number;
  /** Arrivo effettivo della carica (il bersaglio, o oltre se era troppo vicino). */
  lungeTargetX?: number;
}

interface BossCheccoProps {
  world: ArenaWorld;
  /** Chiamato dopo `END_DELAY` secondi dalla sconfitta del boss (Checco fugge). */
  onVictory: () => void;
  /** Chiamato dopo `END_DELAY` secondi dalla sconfitta del giocatore. */
  onDefeat: () => void;
}

function totalDuration(move: CheccoMove): number {
  const lastHitEnd = Math.max(0, ...move.hits.map((h) => h.start + h.duration));
  const lastProjectile = Math.max(0, ...(move.projectiles ?? []).map((p) => p.at));
  const debris = move.debris;
  const lastDebris = debris ? debris.at + debris.warn + debris.stagger * debris.count : 0;
  const leap = move.leap;
  const airTime = leap ? leap.rise + leap.hang + leap.fall : 0;
  const storm = move.storm;
  const lastBolt = leap && storm ? leap.rise + storm.chargeTime + storm.boltsMax * storm.boltInterval : 0;
  return move.windup + Math.max(lastHitEnd, lastProjectile, lastDebris, airTime, lastBolt) + move.recovery;
}

/**
 * Distanza di ingaggio per il prossimo ciclo: metà delle volte da vicino
 * (mischia), le altre da lontano (cariche, balzi, lanci). Senza questo Checco
 * si avvicinava sempre a ~1.6 prima di scegliere e le mosse a distanza non
 * uscivano mai.
 */
function pickEngageDistance(): number {
  return Math.random() < 0.45 ? 1.6 : 3.8 + Math.random() * 4.2;
}

/** Fine dell'ultima finestra NON parabile di una mossa (secondi dal windup): l'avviso resta fino a lì. */
function unparryableUntil(move: CheccoMove): number {
  return Math.max(0, ...move.hits.filter((h) => h.unparryable).map((h) => h.start + h.duration));
}

/**
 * Avviso per gli attacchi non parabili (alla Sekiro): triangolo giallo con "!"
 * e la parola dell'azione giusta ("SALTA", "SCHIVA"). Texture disegnata al volo
 * via `<canvas>`, nessun asset.
 */
const WARNING_STYLES: Record<CheccoWarning, { color: string; lines: string[] }> = {
  salta: { color: '#facc15', lines: ['SALTA'] },
  schiva: { color: '#facc15', lines: ['SCHIVA'] },
  // Cariche: rosso, due soluzioni (parare o contrastare scontrandosi).
  carica: { color: '#dc1f1f', lines: ['PARA O', 'CONTRASTA'] },
  fulmine: { color: '#7dd3fc', lines: ['SCHIVA O', 'PARA IN ARIA'] }
};

function makeWarningTexture(kind: CheccoWarning): CanvasTexture {
  const { color, lines } = WARNING_STYLES[kind];
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 250;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.strokeStyle = '#1a1200';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(160, 8);
    ctx.lineTo(268, 126);
    ctx.lineTo(52, 126);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1a1200';
    ctx.font = 'bold 84px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 160, 112);
    ctx.font = 'bold 46px sans-serif';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#1a1200';
    lines.forEach((line, i) => {
      const y = 176 + i * 52;
      ctx.strokeText(line, 160, y);
      ctx.fillStyle = color;
      ctx.fillText(line, 160, y);
    });
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Checco Zalone: IA, mosse (dati in `checcoMoves.ts`), evento speciale
 * "Avvia il film" e risoluzione di tutti i colpi (giocatore→boss, boss→
 * giocatore/Eve, Eve→boss). Segnaposto grafico a tinte unite finché non c'è
 * arte vera: il colore comunica lo stato — rosso = sta caricando (windup),
 * bianco = colpo attivo, azzurro = barcolla, oro lampeggiante = evento
 * speciale.
 */
export function BossChecco({ world, onVictory, onDefeat }: BossCheccoProps) {
  const group = useRef<Group>(null);
  const bodyMat = useRef<MeshBasicMaterial>(null);
  const slash = useRef<Mesh>(null);
  const slashDebug = useRef<Mesh>(null);
  const shieldMesh = useRef<Mesh>(null);
  const shieldMat = useRef<MeshBasicMaterial>(null);
  const warningMesh = useRef<Mesh>(null);
  const warningMat = useRef<MeshBasicMaterial>(null);
  const teleportMarker = useRef<Mesh>(null);
  const zoneMesh = useRef<Mesh>(null);
  const zoneColumn = useRef<Mesh>(null);
  const warningTextures = useMemo(
    () => ({
      salta: makeWarningTexture('salta'),
      schiva: makeWarningTexture('schiva'),
      carica: makeWarningTexture('carica'),
      fulmine: makeWarningTexture('fulmine')
    }),
    []
  );
  useEffect(
    () => () => {
      Object.values(warningTextures).forEach((texture) => texture.dispose());
    },
    [warningTextures]
  );
  const messageTimer = useRef<number | undefined>(undefined);

  const rt = useRef({
    action: null as MoveRuntime | null,
    cooldown: 1.4,
    /** Secondi alla prossima torretta (timer indipendente dalle mosse). */
    turretTimer: TURRET_FIRST_DELAY,
    /** Distanza a cui Checco vuole stare prima di scegliere la mossa (cambia a ogni ciclo). */
    preferredDistance: pickEngageDistance(),
    lastMoveId: '',
    special: null as { t: number } | null,
    specialDone: false,
    /** Evocazione degli oggetti del Buen Camino in corso, e quante ne sono già scattate. */
    summon: null as { t: number } | null,
    totemEvents: 0,
    targetEve: false,
    lastPlayerSwing: -1,
    lastEveSwing: -1,
    lastPosture: 0,
    sinceGain: 0,
    time: 0,
    endTimer: -1,
    endNotified: false
  });

  useEffect(() => () => window.clearTimeout(messageTimer.current), []);

  const flashMessage = (message: string, hint: string | null, seconds = 2.4) => {
    useArenaStore.getState().set({ message, hint });
    window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(
      () => useArenaStore.getState().set({ message: null, hint: null }),
      seconds * 1000
    );
  };

  /**
   * Ferma il gioco e offre i potenziamenti. Il blocco è lo stesso dell'hit-stop
   * (tutti i sistemi lo controllano) ma senza scadenza; lo toglie il blocco
   * "scelta" in cima al frame quando il giocatore ha scelto e la scritta è finita.
   */
  const startPowerUpChoice = () => {
    world.choice = { picked: null, introT: 0 };
    world.hitStop = Number.POSITIVE_INFINITY;
    useArenaStore.getState().set({
      powerUpPicked: null,
      powerUpChoice: POWER_UP_IDS.map((id) => ({
        id,
        label: POWER_UPS[id].label,
        description: POWER_UPS[id].description
      }))
    });
  };

  const resolveSpecial = (kind: 'completed' | 'interrupted') => {
    const r = rt.current;
    const { boss, player } = world;
    const store = useArenaStore.getState();
    r.special = null;
    r.specialDone = true;
    boss.specialActive = false;

    if (kind === 'completed') {
      // Parte "Buen Camino": Checco si rinvigorisce, il giocatore rallenta.
      boss.hp = Math.min(boss.hpMax, boss.hp + SPECIAL_COMPLETED_BOSS_HEAL);
      player.speedMultiplier = SPECIAL_COMPLETED_PLAYER_SPEED;
      store.set({ backdrop: 'buen_camino', bossHp: Math.round(boss.hp) });
      flashMessage('Round 2', 'Buen Camino: Checco si rinvigorisce e ti rallenta');
    } else {
      // Interrotto: buff al giocatore e malus a Checco, poi il gioco si ferma e
      // il giocatore sceglie un potenziamento (= il film che parte al posto
      // del suo). Sfondo e messaggio di "Round 2" arrivano dopo la scelta.
      player.hp = Math.min(PLAYER_MAX_HP, player.hp + SPECIAL_INTERRUPTED_PLAYER_HEAL);
      player.damageMultiplier = SPECIAL_INTERRUPTED_PLAYER_DAMAGE;
      boss.speedMultiplier = SPECIAL_INTERRUPTED_BOSS_SPEED;
      boss.staggerTimer = 0;
      addPosture(world, POSTURE_MAX);
      store.set({ playerHp: Math.round(player.hp), message: null, hint: null });
      startPowerUpChoice();
    }

    boss.round = 2;
    store.set({ round: 2 });
    if (kind === 'completed') store.triggerFlash();
    r.cooldown = 1.6;
    r.action = null;
    boss.attackBox = null;
  };

  /** Fa comparire gli oggetti del Buen Camino, lontani da Checco e fra loro. */
  const spawnTotems = (count: number) => {
    const { boss } = world;
    const limit = ARENA_HALF_WIDTH - 1.5;
    const placed: number[] = [];
    for (let n = 0; n < count; n += 1) {
      let x = 0;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        x = (Math.random() * 2 - 1) * limit;
        const farFromBoss = Math.abs(x - boss.x) >= TOTEM_MIN_DISTANCE_FROM_BOSS;
        const farFromOthers = placed.every((other) => Math.abs(x - other) >= TOTEM_MIN_SPACING);
        if (farFromBoss && farFromOthers) break;
      }
      placed.push(x);
      world.totems.push({ x, hp: TOTEM_HP, hpMax: TOTEM_HP, flash: 0, lastPlayerSwing: -1, lastEveSwing: -1 });
    }
    useArenaStore.getState().set({ totemsLeft: world.totems.length });
  };

  /**
   * Lancia una torretta: indipendente dalla mossa in corso (attacco asincrono).
   * Si pianta a terra oppure su uno dei due muri, a un'altezza raggiungibile
   * saltando (anche in doppio salto), e da lì spara da sola.
   */
  const spawnTurret = () => {
    const { boss, player } = world;
    const max = boss.round === 1 ? TURRET_MAX_ROUND1 : TURRET_MAX_ROUND2;
    if (world.turrets.length >= max) return;

    let x = 0;
    let y = 0;
    let mount: 'floor' | 'wall' = 'floor';
    if (Math.random() < TURRET_FLOOR_CHANCE) {
      y = TURRET_SIZE / 2;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        x = (Math.random() * 2 - 1) * (ARENA_HALF_WIDTH - 1.5);
        const farFromPlayer = Math.abs(x - player.x) >= 3;
        const farFromOthers = world.turrets.every((other) => Math.abs(other.x - x) >= 2.5);
        if (farFromPlayer && farFromOthers) break;
      }
    } else {
      mount = 'wall';
      const side = Math.random() < 0.5 ? -1 : 1;
      x = side * (ARENA_HALF_WIDTH - TURRET_SIZE / 2 + 0.05);
      for (let attempt = 0; attempt < 20; attempt += 1) {
        y = TURRET_WALL_Y[0] + Math.random() * (TURRET_WALL_Y[1] - TURRET_WALL_Y[0]);
        const clearOfOthers = world.turrets.every((other) => other.x !== x || Math.abs(other.y - y) >= 1.1);
        if (clearOfOthers) break;
      }
    }
    world.turrets.push({
      x,
      y,
      mount,
      state: 'flying',
      fromX: boss.x,
      fromY: boss.y + 1.6,
      flyT: 0,
      hp: TURRET_HP,
      hpMax: TURRET_HP,
      // Prima di sparare passa un po': non appena atterra non deve fare fuoco.
      fireTimer: TURRET_CHARGE + 1 + Math.random(),
      flash: 0,
      lastPlayerSwing: -1,
      lastEveSwing: -1
    });
  };

  const chooseMove = (distance: number): CheccoMove | null => {
    const r = rt.current;
    const moves = world.boss.round === 1 ? CHECCO_MOVES_ROUND1 : CHECCO_MOVES_ROUND2;
    if (import.meta.env.DEV && world.forceMove) {
      const forced = CHECCO_MOVES_ROUND2.find((candidate) => candidate.id === world.forceMove);
      world.forceMove = null;
      if (forced) return forced;
    }
    const inRange = moves.filter((m) => distance >= m.minRange && distance <= m.maxRange);
    const fresh = inRange.filter((m) => m.id !== r.lastMoveId);
    const pool = fresh.length > 0 ? fresh : inRange;
    if (pool.length === 0) return null;
    // Scelta pesata: le cariche (`weight` più alto) escono più spesso.
    const total = pool.reduce((sum, move) => sum + (move.weight ?? 1), 0);
    let roll = Math.random() * total;
    let picked = pool[pool.length - 1];
    for (const move of pool) {
      roll -= move.weight ?? 1;
      if (roll <= 0) {
        picked = move;
        break;
      }
    }
    if (import.meta.env.DEV) world.moveLog.push(picked.id);
    return picked;
  };

  useFrame((_, rawDelta) => {
    const g = group.current;
    if (!g) return;
    const r = rt.current;

    // --- scelta del potenziamento: gioco fermo (hit-stop infinito). Prima si
    // aspetta la carta scelta nella HUD, poi resta la scritta di introduzione,
    // infine si riparte con "Round 2". ---
    if (world.choice) {
      const choice = world.choice;
      const store = useArenaStore.getState();
      if (!choice.picked) {
        const picked = store.powerUpPicked;
        if (picked && picked in POWER_UPS) {
          const def = POWER_UPS[picked as PowerUpId];
          choice.picked = def.id;
          choice.introT = POWER_UP_INTRO_SECONDS;
          world.powerUp = def.id;
          store.set({
            powerUpChoice: null,
            powerUpPicked: null,
            powerUp: def.label,
            backdrop: def.backdrop,
            powerUpIntro: def.intro
          });
        }
      } else {
        choice.introT -= rawDelta;
        if (choice.introT <= 0) {
          world.choice = null;
          world.hitStop = 0;
          store.set({ powerUpIntro: null });
          store.triggerFlash();
          flashMessage('Round 2', 'Film interrotto! Recuperi forze, Checco è sbilanciato');
        }
      }
      return;
    }

    // Hit-stop: unico punto che lo fa scendere (giocatore e boss controllano
    // solo che sia > 0, così scade una volta sola per frame).
    if (world.hitStop > 0) {
      world.hitStop -= rawDelta;
      return;
    }
    const delta = Math.min(rawDelta, 0.05);
    const { boss, player, eve } = world;
    r.time += delta;

    // --- fine del combattimento ---
    if (!world.over && boss.hp <= 0) {
      world.over = 'victory';
      world.finisher = null;
      boss.y = 0;
      boss.attackBox = null;
      useArenaStore.getState().set({ message: 'Checco fugge!', hint: null });
    }
    if (world.over) {
      if (r.endTimer < 0) r.endTimer = END_DELAY;
      r.endTimer -= delta;
      if (r.endTimer <= 0 && !r.endNotified) {
        r.endNotified = true;
        if (world.over === 'victory') onVictory();
        else onDefeat();
      }
      return;
    }

    // --- braccio di ferro del contrasto: tutto fermo finché non si decide ---
    if (world.clash) {
      const clash = world.clash;
      // La parte di resa sotto non gira durante il braccio di ferro: l'avviso
      // rosso va spento qui, altrimenti resterebbe sopra la scritta.
      if (warningMesh.current) warningMesh.current.visible = false;
      clash.t += delta;
      const store = useArenaStore.getState();
      // Vittoria controllata PRIMA del decadimento: la pressione che riempie la
      // barra non deve essere "mangiata" dal calo dello stesso frame.
      const won = clash.progress >= 1;
      if (!won) clash.progress = Math.max(0, clash.progress - CLASH_DECAY * delta);
      const shown = Math.round(clash.progress * 50) / 50;
      if (store.clash !== shown) store.set({ clash: shown });

      if (won) {
        // Vinto: Checco stordito e fa il mini balzo indietro.
        world.clash = null;
        store.set({ clash: null });
        counterCharge(world);
        flashMessage('CONTRASTATO!', 'Checco è stordito: colpiscilo!', 1.8);
      } else if (clash.progress <= 0 || clash.t >= clash.duration) {
        // Perso: il giocatore viene sbalzato via, con danno e stordimento.
        world.clash = null;
        store.set({ clash: null });
        player.invulnerable = false;
        player.iframes = 0;
        const away = player.x >= boss.x ? 1 : -1;
        hitPlayer(world, CLASH_LOSE_DAMAGE, { unparryable: true });
        player.knockbackVx = away * CLASH_FLING_SPEED;
        player.hitTimer = Math.max(player.hitTimer, CLASH_LOSE_STUN);
        player.airBoost = CLASH_FLING_BOOST;
        flashMessage('SBALZATO!', 'Contrasto fallito', 1.6);
      }
      return;
    }

    // --- carica con falce (Bloodborne): sequenza guidata, boss e giocatore
    // comandati da `finisher.ts`; l'IA di Checco resta ferma ---
    if (world.finisher) {
      const f = world.finisher;
      if (!f.started) {
        f.started = true;
        r.action = null;
        boss.attackBox = null;
        boss.vanished = false;
        boss.teleportDestX = null;
        boss.zoneRadius = null;
        boss.hopTime = 0;
        boss.parryable = false;
        boss.interrupted = false;
      }
      // Il blocco di resa in fondo al frame non gira durante la sequenza:
      // spegni qui ciò che il boss lasciava acceso (avviso, scia e hitbox del colpo, zona).
      for (const mesh of [warningMesh.current, slash.current, slashDebug.current, zoneMesh.current, zoneColumn.current]) {
        if (mesh) mesh.visible = false;
      }
      if (updateFinisher(world, delta)) {
        world.finisher = null;
        boss.y = 0;
        r.cooldown = 1.2;
        r.preferredDistance = pickEngageDistance();
      }
      g.position.set(boss.x, boss.y, 0);
      return;
    }

    // Un colpo a distanza ha PARATO la sua mossa: la interrompe.
    if (boss.interrupted) {
      boss.interrupted = false;
      if (r.action) {
        r.lastMoveId = r.action.move.id;
        r.action = null;
        boss.attackBox = null;
        boss.y = 0;
        boss.vanished = false;
        boss.teleportDestX = null;
        boss.zoneRadius = null;
        r.cooldown = 1.1;
        r.preferredDistance = pickEngageDistance();
      }
    }

    boss.hitFlash = Math.max(0, boss.hitFlash - delta);

    // --- torrette: attacco asincrono, scandito da un timer proprio e del tutto
    // indipendente da quello che Checco sta facendo (mossa, evento, stordimento) ---
    r.turretTimer -= delta;
    if (r.turretTimer <= 0) {
      spawnTurret();
      const [minGap, maxGap] = boss.round === 1 ? TURRET_INTERVAL_ROUND1 : TURRET_INTERVAL_ROUND2;
      r.turretTimer = minGap + Math.random() * (maxGap - minGap);
    }

    // --- postura: decade da sola se non guadagna per un po' ---
    if (boss.posture > r.lastPosture) r.sinceGain = 0;
    r.sinceGain += delta;
    if (boss.staggerTimer > 0) {
      boss.staggerTimer -= delta;
      if (boss.staggerTimer <= 0) {
        boss.posture = 0;
        useArenaStore.getState().set({ bossPosture: 0 });
      }
    } else if (r.sinceGain > POSTURE_DECAY_DELAY && boss.posture > 0) {
      boss.posture = Math.max(0, boss.posture - POSTURE_DECAY_PER_SECOND * delta);
      if (Math.round(boss.posture) !== Math.round(r.lastPosture)) {
        useArenaStore.getState().set({ bossPosture: Math.round(boss.posture) });
      }
    }
    r.lastPosture = boss.posture;

    // --- colpi del giocatore e di Eve sul boss (una volta per fendente) ---
    const hurt = bossHurtbox(world);
    if (player.attackBox && r.lastPlayerSwing !== player.swingId && aabbOverlap(player.attackBox, hurt)) {
      r.lastPlayerSwing = player.swingId;
      // Danno e postura del fendente in corso li fissa `PlayerArena` (attacco
      // base o abilità) quando lo inizia.
      hitBoss(world, { damage: player.attackDamage, posture: player.attackPosture, source: 'player' });
      onPlayerMeleeHit(world);
    }
    if (eve.attackBox && r.lastEveSwing !== eve.swingId && aabbOverlap(eve.attackBox, hurt)) {
      r.lastEveSwing = eve.swingId;
      hitBoss(world, { damage: EVE_ATTACK_DAMAGE, posture: EVE_ATTACK_POSTURE, source: 'eve' });
    }

    const staggered = boss.staggerTimer > 0;
    const eveActive = eve.status === 'active';
    const targetX = r.targetEve && eveActive ? eve.x : player.x;
    const dx = targetX - boss.x;

    if (staggered) {
      // Barcolla: niente azioni. Se stava caricando lo speciale, lo perde.
      r.action = null;
      boss.attackBox = null;
      boss.vanished = false;
      boss.teleportDestX = null;
      boss.zoneRadius = null;
      if (boss.hopTime > 0) {
        // Mini balzo all'indietro dopo un contrasto: un arco corto, poi a terra.
        boss.hopTime = Math.max(0, boss.hopTime - delta);
        const u = 1 - boss.hopTime / COUNTER_HOP_DURATION;
        boss.y = COUNTER_HOP_HEIGHT * 4 * u * (1 - u);
        boss.x += boss.hopVx * delta;
      } else {
        boss.y = 0;
      }
      if (r.special) resolveSpecial('interrupted');
    } else if (r.special) {
      // --- evento "Avvia il film": windup molto lungo, due esiti ---
      const special = r.special;
      special.t += delta;
      boss.facing = player.x >= boss.x ? 1 : -1;
      const inParryWindow = special.t >= SPECIAL_WINDUP - SPECIAL_PARRY_WINDOW;
      if (inParryWindow && player.parryActive && Math.abs(player.x - boss.x) <= SPECIAL_PARRY_RANGE) {
        resolveSpecial('interrupted');
      } else if (boss.specialDamageTaken >= SPECIAL_INTERRUPT_DAMAGE) {
        resolveSpecial('interrupted');
      } else if (special.t >= SPECIAL_WINDUP) {
        resolveSpecial('completed');
      }
    } else if (
      !r.specialDone &&
      !r.action &&
      boss.round === 1 &&
      boss.hp <= boss.hpMax * SPECIAL_TRIGGER_HP_FRACTION
    ) {
      r.special = { t: 0 };
      boss.specialActive = true;
      boss.specialDamageTaken = 0;
      useArenaStore.getState().set({
        message: 'AVVIA IL FILM!',
        hint: 'Para all’ultimo istante o colpiscilo forte per interromperlo'
      });
    } else if (r.summon) {
      // --- evoca gli oggetti del Buen Camino: carica, poi compaiono ---
      r.summon.t += delta;
      boss.facing = player.x >= boss.x ? 1 : -1;
      if (r.summon.t >= TOTEM_WINDUP) {
        spawnTotems(TOTEM_COUNTS[Math.min(r.totemEvents - 1, TOTEM_COUNTS.length - 1)]);
        r.summon = null;
        r.cooldown = 0.8;
        useArenaStore.getState().set({
          message: 'BUEN CAMINO!',
          hint: 'Distruggi gli oggetti: finché esistono Checco è invulnerabile'
        });
        window.clearTimeout(messageTimer.current);
        messageTimer.current = window.setTimeout(
          () => useArenaStore.getState().set({ message: null, hint: null }),
          3200
        );
      }
    } else if (
      !r.action &&
      world.totems.length === 0 &&
      r.totemEvents < TOTEM_TRIGGER_FRACTIONS.length &&
      boss.hp <= boss.hpMax * TOTEM_TRIGGER_FRACTIONS[r.totemEvents]
    ) {
      r.summon = { t: 0 };
      r.totemEvents += 1;
    } else if (r.action) {
      // --- mossa in corso ---
      const a = r.action;
      a.t += delta;
      const tt = a.t - a.move.windup;
      boss.attackBox = null;

      // --- asse verticale: balzo (si sposta verso il bersaglio) o schianto
      // (sale e scende sul posto, con una pausa in aria come segnale) ---
      const leap = a.move.leap;
      if (leap && tt >= 0) {
        if (a.leapStartX === undefined) {
          a.leapStartX = boss.x;
          a.leapTargetX =
            leap.travel === 'target'
              ? Math.min(ARENA_HALF_WIDTH - 0.4, Math.max(-ARENA_HALF_WIDTH + 0.4, a.targetX))
              : boss.x;
        }
        const airTime = leap.rise + leap.hang + leap.fall;
        if (tt < airTime) {
          if (leap.travel === 'target') {
            boss.x = a.leapStartX + ((a.leapTargetX ?? boss.x) - a.leapStartX) * (tt / airTime);
          }
          if (tt < leap.rise) boss.y = leap.height * Math.sin((tt / leap.rise) * (Math.PI / 2));
          else if (tt < leap.rise + leap.hang) boss.y = leap.height;
          else boss.y = leap.height * Math.cos(((tt - leap.rise - leap.hang) / leap.fall) * (Math.PI / 2));
        } else {
          boss.y = 0;
        }
      }

      // --- proiettili (a distanza, parabili e rimandabili indietro) ---
      (a.move.projectiles ?? []).forEach((pr, i) => {
        if (a.projFired[i] || tt < pr.at) return;
        a.projFired[i] = true;
        boss.facing = dx >= 0 ? 1 : -1;
        world.projectiles.push({
          x: boss.x + boss.facing * 0.9,
          y: pr.y,
          vx: boss.facing * pr.speed,
          damage: pr.damage,
          owner: 'boss',
          life: PROJECTILE_LIFETIME
        });
      });

      // --- detriti dal soffitto attorno al giocatore: marcatore, poi caduta ---
      const debris = a.move.debris;
      if (debris && !a.debrisFired && tt >= debris.at) {
        a.debrisFired = true;
        // Ordine di caduta mescolato, così non si legge una sequenza fissa.
        const order = Array.from({ length: debris.count }, (_, i) => i).sort(() => Math.random() - 0.5);
        order.forEach((slot, n) => {
          const offset = (slot - (debris.count - 1) / 2) * debris.spacing + (Math.random() - 0.5) * 0.5;
          const x = Math.min(ARENA_HALF_WIDTH - 0.5, Math.max(-ARENA_HALF_WIDTH + 0.5, player.x + offset));
          world.hazards.push({
            x,
            y: ARENA_CEILING_Y,
            vy: 0,
            warn: debris.warn + n * debris.stagger,
            damage: debris.damage,
            state: 'warn'
          });
        });
      }

      // --- tempesta: in aria a caricare (zona elettrica), poi fulmini a ricerca ---
      const storm = a.move.storm;
      if (storm && leap && tt >= 0) {
        // Zona elettrica solo durante la carica; poi i fulmini partono mentre
        // Checco è ANCORA in aria (il `hang` del salto copre tutta la mossa).
        const chargeEnd = leap.rise + storm.chargeTime;
        if (tt >= leap.rise && tt < chargeEnd) {
          // Zona di danno attorno a lui: bisogna allontanarsi.
          boss.zoneRadius = storm.zoneRadius;
          a.zoneTimer -= delta;
          if (a.zoneTimer <= 0 && Math.abs(player.x - boss.x) <= storm.zoneRadius) {
            hitPlayer(world, storm.zoneDamage, { unparryable: true });
            a.zoneTimer = storm.zoneTick;
          }
        } else {
          boss.zoneRadius = null;
        }
        if (tt >= chargeEnd) {
          if (a.boltCount === 0) {
            a.boltCount = storm.boltsMin + Math.floor(Math.random() * (storm.boltsMax - storm.boltsMin + 1));
          }
          while (a.boltsFired < a.boltCount && tt >= chargeEnd + a.boltsFired * storm.boltInterval) {
            a.boltsFired += 1;
            const originX = boss.x;
            const originY = boss.y + 1.4;
            const dxToPlayer = player.x - originX;
            const dyToPlayer = player.y + 0.95 - originY;
            const length = Math.hypot(dxToPlayer, dyToPlayer) || 1;
            world.projectiles.push({
              x: originX,
              y: originY,
              vx: (dxToPlayer / length) * storm.boltSpeed,
              vy: (dyToPlayer / length) * storm.boltSpeed,
              damage: storm.boltDamage,
              owner: 'boss',
              life: PROJECTILE_LIFETIME,
              homing: true,
              kind: 'bolt'
            });
          }
        }
      }

      // --- teletrasporto: sparisce, marcatore dietro il giocatore, ricompare ---
      const teleport = a.move.teleport;
      if (teleport && tt >= 0) {
        if (!a.teleported && boss.teleportDestX === null) {
          boss.vanished = true;
          const behind = player.x - player.facing * TELEPORT_BEHIND_DISTANCE;
          boss.teleportDestX = Math.min(ARENA_HALF_WIDTH - 0.5, Math.max(-ARENA_HALF_WIDTH + 0.5, behind));
        }
        if (!a.teleported && tt >= teleport.vanish) {
          a.teleported = true;
          boss.vanished = false;
          boss.x = boss.teleportDestX ?? boss.x;
          boss.teleportDestX = null;
          boss.facing = player.x >= boss.x ? 1 : -1;
        }
      }

      a.move.hits.forEach((h, i) => {
        if (tt < h.start || tt >= h.start + h.duration) return;
        if (h.lunge) {
          // Va sempre verso il punto in cui era il bersaglio alla scelta della
          // mossa e ci arriva nel tempo della finestra (velocità adattata
          // alla distanza, fra i limiti), poi si ferma: né pochi metri né
          // mezza arena a caso.
          if (a.lungeStartX === undefined) {
            a.lungeStartX = boss.x;
            boss.facing = a.targetX >= boss.x ? 1 : -1;
            // Percorrenza minima: se il bersaglio è troppo vicino prosegue
            // oltre di lui, nella stessa direzione, dentro i confini dell'arena.
            const travel = Math.max(Math.abs(a.targetX - boss.x), LUNGE_MIN_TRAVEL);
            a.lungeTargetX = Math.min(
              ARENA_HALF_WIDTH - 0.4,
              Math.max(-ARENA_HALF_WIDTH + 0.4, boss.x + boss.facing * travel)
            );
          }
          const lungeTarget = a.lungeTargetX ?? a.targetX;
          const total = Math.abs(lungeTarget - a.lungeStartX);
          const speed = Math.min(LUNGE_MAX_SPEED, Math.max(LUNGE_MIN_SPEED, total / h.duration));
          const remaining = Math.abs(lungeTarget - boss.x);
          boss.x += Math.sign(lungeTarget - boss.x) * Math.min(speed * delta, remaining);
        }
        // La scatola segue il corpo anche in quota (balzo): `offsetY` è relativo.
        const box = h.bothSides
          ? { x: boss.x, y: boss.y + h.offsetY, halfWidth: h.reach, halfHeight: h.halfHeight }
          : {
              x: boss.x + (boss.facing * h.reach) / 2,
              y: boss.y + h.offsetY,
              halfWidth: h.reach / 2,
              halfHeight: h.halfHeight
            };
        boss.attackBox = box;
        if (a.hitDone[i]) return;
        if (aabbOverlap(box, playerHurtbox(world))) {
          // CONTRASTO (alla mikiri): schivare CONTRO una carica la ferma e
          // stordisce Checco. Va a segno solo con un dash VERSO di lui.
          if (
            a.move.charge &&
            player.invulnerable &&
            player.dashDir !== 0 &&
            Math.sign(boss.x - player.x) === player.dashDir
          ) {
            // Contrasto: parte il braccio di ferro. Vinto (barra piena) Checco
            // è stordito, perso il giocatore viene sbalzato via.
            world.clash = { t: 0, duration: CLASH_DURATION, progress: CLASH_START_PROGRESS };
            a.hitDone[i] = true;
            window.clearTimeout(messageTimer.current);
            useArenaStore.getState().set({ clash: CLASH_START_PROGRESS, message: null, hint: null });
            return;
          }
          const result = hitPlayer(world, h.damage, { unparryable: h.unparryable });
          if (result !== 'ignored') a.hitDone[i] = true;
        } else if (eveActive && aabbOverlap(box, eveHurtbox(world))) {
          eve.status = 'staggered';
          a.hitDone[i] = true;
        }
      });

      if (a.t >= totalDuration(a.move)) {
        r.lastMoveId = a.move.id;
        r.action = null;
        boss.attackBox = null;
        boss.y = 0;
        boss.vanished = false;
        boss.teleportDestX = null;
        boss.zoneRadius = null;
        r.cooldown = boss.round === 1 ? BOSS_MOVE_COOLDOWN_ROUND1 : BOSS_MOVE_COOLDOWN_ROUND2;
        r.preferredDistance = pickEngageDistance();
      }
    } else {
      // --- libero: si avvicina e sceglie una mossa ---
      boss.attackBox = null;
      boss.facing = dx >= 0 ? 1 : -1;
      r.cooldown -= delta;
      const speed = (boss.round === 1 ? BOSS_SPEED_ROUND1 : BOSS_SPEED_ROUND2) * boss.speedMultiplier;
      if (r.cooldown <= 0) {
        const move = chooseMove(Math.abs(dx));
        if (move) {
          r.targetEve = eveActive && Math.random() < EVE_AGGRO_CHANCE;
          r.action = {
            move,
            t: 0,
            hitDone: move.hits.map(() => false),
            projFired: (move.projectiles ?? []).map(() => false),
            debrisFired: false,
            teleported: false,
            zoneTimer: 0,
            boltsFired: 0,
            boltCount: 0,
            targetX
          };
        } else {
          boss.x += Math.sign(dx) * speed * delta;
        }
      } else if (Math.abs(dx) > r.preferredDistance + 0.3) {
        // Raggiunge la distanza di ingaggio scelta per questo ciclo...
        boss.x += Math.sign(dx) * speed * delta;
      } else if (Math.abs(dx) < r.preferredDistance - 0.8) {
        // ...e se il giocatore è più vicino si sposta all'indietro, più piano
        // di lui: così Checco non è sempre addosso e le cariche/i lanci a
        // distanza hanno spazio per essere scelti.
        boss.x -= Math.sign(dx) * speed * 0.7 * delta;
      }
    }

    boss.x = Math.min(ARENA_HALF_WIDTH - 0.4, Math.max(-ARENA_HALF_WIDTH + 0.4, boss.x));

    // Sta eseguendo (o caricando) un attacco parabile? Un colpo a distanza lo
    // para invece di ferirlo. Mosse con sole finestre non parabili: no.
    const current = r.action;
    boss.parryable =
      current !== null &&
      !staggered &&
      current.move.hits.some((h) => !h.unparryable && current.t - current.move.windup < h.start + h.duration);

    // --- resa ---
    g.position.x = boss.x;
    g.position.y = boss.y;
    g.visible = !boss.vanished;

    // Zona elettrica della tempesta: una colonna e una fascia a terra che
    // sfarfallano, larghe quanto il raggio di danno.
    if (zoneMesh.current && zoneColumn.current) {
      const radius = boss.zoneRadius;
      zoneMesh.current.visible = zoneColumn.current.visible = radius !== null;
      if (radius !== null) {
        const flicker = 0.55 + 0.35 * Math.sin(r.time * 40);
        zoneMesh.current.position.set(boss.x, 0.14, 0.1);
        zoneMesh.current.scale.set(radius * 2, 1, 1);
        zoneColumn.current.position.set(boss.x, 3, -0.05);
        zoneColumn.current.scale.set(radius * 2, 1, 1);
        (zoneMesh.current.material as MeshBasicMaterial).opacity = flicker;
        (zoneColumn.current.material as MeshBasicMaterial).opacity = 0.1 + 0.1 * flicker;
      }
    }

    // Scudo azzurro attorno a Checco finché esistono oggetti del Buen Camino:
    // i colpi vengono bloccati (si accende di più quando ne riceve uno).
    boss.shieldHit = Math.max(0, boss.shieldHit - delta);
    if (shieldMesh.current && shieldMat.current) {
      const shielded = world.totems.length > 0 && !boss.vanished;
      shieldMesh.current.visible = shielded;
      if (shielded) {
        shieldMesh.current.position.set(boss.x, boss.y + BOSS_HEIGHT / 2, 0.15);
        shieldMat.current.opacity = boss.shieldHit > 0 ? 0.65 : 0.22 + 0.08 * Math.sin(r.time * 7);
      }
    }

    // Avviso giallo sopra il boss finché sta caricando un colpo NON parabile
    // (dal via della mossa fino alla fine della finestra non parabile).
    const warnMove = r.action?.move;
    const warnVisible =
      world.clash === null &&
      warnMove?.warning !== undefined &&
      r.action !== null &&
      r.action.t - warnMove.windup < (warnMove.warningUntil ?? unparryableUntil(warnMove));
    if (warningMesh.current && warningMat.current) {
      warningMesh.current.visible = warnVisible;
      if (warnVisible && warnMove?.warning) {
        const texture = warningTextures[warnMove.warning];
        if (warningMat.current.map !== texture) {
          warningMat.current.map = texture;
          warningMat.current.needsUpdate = true;
        }
        const pulse = 1 + 0.12 * Math.sin(r.time * 18);
        // Sopra la testa, ma mai oltre il bordo alto dello schermo (in cima
        // allo schianto Checco esce dall'inquadratura).
        warningMesh.current.position.set(boss.x, Math.min(boss.y + BOSS_HEIGHT + 0.95, WARNING_MAX_Y), 0.4);
        warningMesh.current.scale.set(pulse, pulse, 1);
      }
    }
    // Marcatore a terra dove il boss ricomparirà (teletrasporto).
    if (teleportMarker.current) {
      teleportMarker.current.visible = boss.teleportDestX !== null;
      if (boss.teleportDestX !== null) {
        teleportMarker.current.position.set(boss.teleportDestX, 0.12, 0.25);
        teleportMarker.current.scale.x = 0.85 + 0.25 * Math.sin(r.time * 22);
      }
    }
    g.scale.x = boss.facing;

    const mat = bodyMat.current;
    if (mat) {
      if (boss.hitFlash > 0) mat.color.copy(COLOR_FLASH);
      else if (boss.staggerTimer > 0) mat.color.copy(COLOR_STAGGER);
      else if (r.special || r.summon) {
        mat.color.copy(COLOR_SPECIAL_A).lerp(COLOR_SPECIAL_B, 0.5 + 0.5 * Math.sin(r.time * 12));
      } else if (r.action && r.action.t < r.action.move.windup) {
        mat.color.copy(COLOR_BASE).lerp(COLOR_WINDUP, r.action.t / r.action.move.windup);
      } else if (boss.y > 0.05) {
        // In aria: resta rosso fino all'atterraggio, è il segnale da leggere.
        mat.color.copy(COLOR_WINDUP);
      } else if (boss.attackBox) mat.color.copy(COLOR_ACTIVE);
      else mat.color.copy(COLOR_BASE);
    }

    const box = boss.attackBox;
    for (const mesh of [slash.current, slashDebug.current]) {
      if (!mesh) continue;
      mesh.visible = box !== null && (mesh === slash.current || import.meta.env.DEV);
      if (box) {
        mesh.position.set(box.x, box.y, 0.2);
        mesh.scale.set(box.halfWidth * 2, box.halfHeight * 2, 1);
      }
    }
  });

  return (
    <>
      <group ref={group} position={[world.boss.x, 0, 0]}>
        {/* Segnaposto: corpo, testa e "occhio" dal lato in cui guarda. */}
        <mesh position={[0, BOSS_HEIGHT * 0.34, 0]}>
          <planeGeometry args={[BOSS_HALF_WIDTH * 2, BOSS_HEIGHT * 0.68]} />
          <meshBasicMaterial ref={bodyMat} color="#7a4b2a" />
        </mesh>
        <mesh position={[0, BOSS_HEIGHT * 0.83, 0]}>
          <planeGeometry args={[BOSS_HALF_WIDTH * 1.2, BOSS_HALF_WIDTH * 1.2]} />
          <meshBasicMaterial color="#e0b48a" />
        </mesh>
        <mesh position={[BOSS_HALF_WIDTH * 0.25, BOSS_HEIGHT * 0.86, 0.05]}>
          <planeGeometry args={[0.18, 0.1]} />
          <meshBasicMaterial color="#1a1a1a" />
        </mesh>
      </group>

      {/* Scudo di invulnerabilità (oggetti del Buen Camino ancora in piedi). */}
      <mesh ref={shieldMesh} visible={false}>
        <planeGeometry args={[BOSS_HALF_WIDTH * 3.4, BOSS_HEIGHT * 1.2]} />
        <meshBasicMaterial ref={shieldMat} color="#67e8f9" transparent opacity={0.25} />
      </mesh>
      {/* Avviso giallo per i colpi non parabili (SALTA/SCHIVA) sopra il boss. */}
      <mesh ref={warningMesh} visible={false}>
        <planeGeometry args={[2.3, 1.8]} />
        <meshBasicMaterial ref={warningMat} transparent depthTest={false} />
      </mesh>
      {/* Zona elettrica della tempesta (danno a chi ci resta dentro). */}
      <mesh ref={zoneColumn} visible={false}>
        <planeGeometry args={[1, 6]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.15} />
      </mesh>
      <mesh ref={zoneMesh} visible={false}>
        <planeGeometry args={[1, 0.3]} />
        <meshBasicMaterial color="#e0f2fe" transparent opacity={0.8} />
      </mesh>
      {/* Dove ricomparirà Checco dopo il teletrasporto. */}
      <mesh ref={teleportMarker} visible={false}>
        <planeGeometry args={[1.6, 0.26]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.8} />
      </mesh>

      {/* Il colpo attivo si vede sempre; il rettangolo esatto solo in dev. */}
      <mesh ref={slash} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
      </mesh>
      <mesh ref={slashDebug} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.25} />
      </mesh>
    </>
  );
}
