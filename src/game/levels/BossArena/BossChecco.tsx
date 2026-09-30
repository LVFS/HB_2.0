import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color } from 'three';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { aabbOverlap } from '@/game/render2d/collision';
import { useArenaStore } from '@/store/arenaStore';
import type { ArenaWorld } from './arenaState';
import { CHECCO_MOVES_ROUND1, CHECCO_MOVES_ROUND2, type CheccoMove } from './checcoMoves';
import { addPosture, bossHurtbox, eveHurtbox, hitBoss, hitPlayer, playerHurtbox } from './combat';
import {
  ARENA_HALF_WIDTH,
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
  /** Punti di partenza/arrivo del balzo, fissati quando comincia. */
  leapStartX?: number;
  leapTargetX?: number;
}

interface BossCheccoProps {
  world: ArenaWorld;
  /** Chiamato dopo `END_DELAY` secondi dalla sconfitta del boss (Checco fugge). */
  onVictory: () => void;
  /** Chiamato dopo `END_DELAY` secondi dalla sconfitta del giocatore. */
  onDefeat: () => void;
}

function totalDuration(move: CheccoMove): number {
  const lastHitEnd = Math.max(...move.hits.map((h) => h.start + h.duration));
  return move.windup + lastHitEnd + move.recovery;
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
  const messageTimer = useRef<number | undefined>(undefined);

  const rt = useRef({
    action: null as MoveRuntime | null,
    cooldown: 1.4,
    lastMoveId: '',
    special: null as { t: number } | null,
    specialDone: false,
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
      // Interrotto: parte un altro film, buff al giocatore e malus a Checco.
      player.hp = Math.min(PLAYER_MAX_HP, player.hp + SPECIAL_INTERRUPTED_PLAYER_HEAL);
      player.damageMultiplier = SPECIAL_INTERRUPTED_PLAYER_DAMAGE;
      boss.speedMultiplier = SPECIAL_INTERRUPTED_BOSS_SPEED;
      boss.staggerTimer = 0;
      addPosture(world, POSTURE_MAX);
      store.set({ backdrop: 'altro_film', playerHp: Math.round(player.hp) });
      flashMessage('Round 2', 'Film interrotto! Recuperi forze, Checco è sbilanciato');
    }

    boss.round = 2;
    store.set({ round: 2 });
    store.triggerFlash();
    r.cooldown = 1.6;
    r.action = null;
    boss.attackBox = null;
  };

  const chooseMove = (distance: number): CheccoMove | null => {
    const r = rt.current;
    const moves = world.boss.round === 1 ? CHECCO_MOVES_ROUND1 : CHECCO_MOVES_ROUND2;
    const inRange = moves.filter((m) => distance >= m.minRange && distance <= m.maxRange);
    const fresh = inRange.filter((m) => m.id !== r.lastMoveId);
    const pool = fresh.length > 0 ? fresh : inRange;
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  useFrame((_, rawDelta) => {
    const g = group.current;
    if (!g) return;
    const r = rt.current;
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

    boss.hitFlash = Math.max(0, boss.hitFlash - delta);

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
      boss.y = 0;
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
              ? Math.min(ARENA_HALF_WIDTH - 0.4, Math.max(-ARENA_HALF_WIDTH + 0.4, targetX))
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

      a.move.hits.forEach((h, i) => {
        if (tt < h.start || tt >= h.start + h.duration) return;
        if (h.lunge) boss.x += boss.facing * h.lunge * delta;
        const box = h.bothSides
          ? { x: boss.x, y: h.offsetY, halfWidth: h.reach, halfHeight: h.halfHeight }
          : {
              x: boss.x + (boss.facing * h.reach) / 2,
              y: h.offsetY,
              halfWidth: h.reach / 2,
              halfHeight: h.halfHeight
            };
        boss.attackBox = box;
        if (a.hitDone[i]) return;
        if (aabbOverlap(box, playerHurtbox(world))) {
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
        r.cooldown = boss.round === 1 ? BOSS_MOVE_COOLDOWN_ROUND1 : BOSS_MOVE_COOLDOWN_ROUND2;
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
          r.action = { move, t: 0, hitDone: move.hits.map(() => false) };
        } else {
          boss.x += Math.sign(dx) * speed * delta;
        }
      } else if (Math.abs(dx) > 1.6) {
        boss.x += Math.sign(dx) * speed * delta;
      }
    }

    boss.x = Math.min(ARENA_HALF_WIDTH - 0.4, Math.max(-ARENA_HALF_WIDTH + 0.4, boss.x));

    // --- resa ---
    g.position.x = boss.x;
    g.position.y = boss.y;
    g.scale.x = boss.facing;

    const mat = bodyMat.current;
    if (mat) {
      if (boss.hitFlash > 0) mat.color.copy(COLOR_FLASH);
      else if (boss.staggerTimer > 0) mat.color.copy(COLOR_STAGGER);
      else if (r.special) {
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
