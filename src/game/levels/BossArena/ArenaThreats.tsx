import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color } from 'three';
import type { Mesh, MeshBasicMaterial } from 'three';
import { aabbOverlap } from '@/game/render2d/collision';
import type { ArenaWorld } from './arenaState';
import {
  bossHurtbox,
  damageTotem,
  damageTurret,
  hitBoss,
  hitPlayer,
  onPlayerMeleeHit,
  parryProjectile,
  playerHurtbox,
  reflectProjectileToBoss
} from './combat';
import {
  ARENA_HALF_WIDTH,
  ARENA_PLAYER_HEIGHT,
  DEBRIS_FALL_SPEED,
  DEBRIS_HALF_SIZE,
  PARRY_REACH,
  PROJECTILE_HALF_SIZE,
  PROJECTILE_REFLECT_POSTURE,
  TURRET_CHARGE,
  TURRET_FIRE_INTERVAL,
  TURRET_FLIGHT,
  TURRET_SHOT_DAMAGE,
  TURRET_SHOT_SPEED,
  TURRET_SIZE,
  BOLT_AIR_MIN_Y,
  BOLT_AIR_PARRY_BOOST,
  BOLT_PARRY_GROUND_DAMAGE,
  BOLT_PARRY_GROUND_FREEZE,
  BOLT_REFLECT_DAMAGE,
  BOLT_REFLECT_POSTURE,
  BOLT_REFLECT_SPEED_MULTIPLIER,
  BOLT_REFLECT_STUN,
  BOLT_TURN_RATE,
  PROJECTILE_LIFETIME,
  COUNTER_MULTIPLIER,
  EVE_ATTACK_DAMAGE,
  TOTEM_HALF_WIDTH,
  TOTEM_HEIGHT,
  TOTEM_REFLECT_DAMAGE
} from './arenaConfig';

const WHITE = new Color('#ffffff');
const MAX_PROJECTILES = 10;
const MAX_HAZARDS = 14;
const SLOTS_PROJECTILES = Array.from({ length: MAX_PROJECTILES }, (_, i) => i);
const SLOTS_HAZARDS = Array.from({ length: MAX_HAZARDS }, (_, i) => i);
const MAX_TURRETS = 6;
const SLOTS_TURRETS = Array.from({ length: MAX_TURRETS }, (_, i) => i);
const MAX_TOTEMS = 5;
const SLOTS_TOTEMS = Array.from({ length: MAX_TOTEMS }, (_, i) => i);

/**
 * Minacce che non sono il corpo di Checco: i proiettili (parabili: la parata li
 * RIMANDA indietro contro di lui) e i detriti dal soffitto (marcatore rosso a
 * terra, poi caduta non parabile — si schivano). Logica e resa nello stesso
 * posto: pool di mesh fisse, aggiornate ogni frame da `world.projectiles` /
 * `world.hazards` (mai stato React, cambiano a 60Hz).
 */
export function ArenaThreats({ world }: { world: ArenaWorld }) {
  const projectileMeshes = useRef<(Mesh | null)[]>([]);
  const projectileMats = useRef<(MeshBasicMaterial | null)[]>([]);
  const markerMeshes = useRef<(Mesh | null)[]>([]);
  const rockMeshes = useRef<(Mesh | null)[]>([]);
  const turretBodies = useRef<(Mesh | null)[]>([]);
  const turretBodyMats = useRef<(MeshBasicMaterial | null)[]>([]);
  const turretBarrels = useRef<(Mesh | null)[]>([]);
  const turretBars = useRef<(Mesh | null)[]>([]);
  const totemMeshes = useRef<(Mesh | null)[]>([]);
  const totemMats = useRef<(MeshBasicMaterial | null)[]>([]);
  const totemBars = useRef<(Mesh | null)[]>([]);
  const beamMeshes = useRef<(Mesh | null)[]>([]);
  const time = useRef(0);

  useFrame((_, rawDelta) => {
    // Come gli altri sistemi: congelati durante hit-stop, fermi a fine round.
    if (world.hitStop > 0 || world.over) return;
    const delta = Math.min(rawDelta, 0.05);
    time.current += delta;
    const player = world.player;

    // --- proiettili ---
    const parryBox = {
      x: player.x + (player.facing * PARRY_REACH) / 2,
      y: player.y + ARENA_PLAYER_HEIGHT / 2,
      halfWidth: PARRY_REACH / 2,
      halfHeight: ARENA_PLAYER_HEIGHT / 2
    };
    for (let i = world.projectiles.length - 1; i >= 0; i -= 1) {
      const proj = world.projectiles[i];

      // Fulmine a ricerca: sterza verso il bersaglio (il giocatore, o Checco
      // se è stato rimandato) mantenendo la velocità.
      if (proj.homing) {
        const targetX = proj.owner === 'boss' ? player.x : world.boss.x;
        const targetY = proj.owner === 'boss' ? player.y + ARENA_PLAYER_HEIGHT / 2 : world.boss.y + 1.4;
        const speed = Math.hypot(proj.vx, proj.vy ?? 0) || 1;
        const dx = targetX - proj.x;
        const dy = targetY - proj.y;
        const length = Math.hypot(dx, dy) || 1;
        const steer = Math.min(1, BOLT_TURN_RATE * delta);
        let nvx = proj.vx + ((dx / length) * speed - proj.vx) * steer;
        let nvy = (proj.vy ?? 0) + ((dy / length) * speed - (proj.vy ?? 0)) * steer;
        const nlen = Math.hypot(nvx, nvy) || 1;
        nvx = (nvx / nlen) * speed;
        nvy = (nvy / nlen) * speed;
        proj.vx = nvx;
        proj.vy = nvy;
      }
      proj.x += proj.vx * delta;
      proj.y += (proj.vy ?? 0) * delta;
      proj.life -= delta;
      const box = { x: proj.x, y: proj.y, halfWidth: PROJECTILE_HALF_SIZE, halfHeight: PROJECTILE_HALF_SIZE };
      let remove = proj.life <= 0 || Math.abs(proj.x) > ARENA_HALF_WIDTH + 3;

      if (proj.owner === 'boss') {
        if (player.parryActive && aabbOverlap(box, parryBox)) {
          if (proj.kind === 'bolt') {
            if (player.y >= BOLT_AIR_MIN_Y) {
              // Parata IN ARIA: il fulmine torna indietro verso Checco.
              proj.owner = 'player';
              proj.damage = BOLT_REFLECT_DAMAGE;
              proj.vx *= -BOLT_REFLECT_SPEED_MULTIPLIER;
              proj.vy = (proj.vy ?? 0) * -BOLT_REFLECT_SPEED_MULTIPLIER;
              proj.life = PROJECTILE_LIFETIME;
              parryProjectile(world);
              // Spinto in aria: può parare anche i fulmini che seguono.
              player.airBoost = BOLT_AIR_PARRY_BOOST;
            } else {
              // Parata a TERRA: poco danno e si resta fermi per un po'.
              hitPlayer(world, BOLT_PARRY_GROUND_DAMAGE, { unparryable: true });
              player.hitTimer = Math.max(player.hitTimer, BOLT_PARRY_GROUND_FREEZE);
              remove = true;
            }
          } else {
            // Parata a timing: lo rimanda CONTRO CHECCO (anche se era sparato da
            // una torretta, quindi in diagonale), più veloce.
            reflectProjectileToBoss(world, proj);
          }
        } else if (aabbOverlap(box, playerHurtbox(world))) {
          if (hitPlayer(world, proj.damage) !== 'ignored') remove = true;
        }
      } else {
        // Rimandato: colpisce un oggetto del Buen Camino se ce n'è sulla
        // traiettoria, altrimenti Checco (se è vulnerabile).
        const totemIndex = world.totems.findIndex((totem) =>
          aabbOverlap(box, { x: totem.x, y: TOTEM_HEIGHT / 2, halfWidth: TOTEM_HALF_WIDTH, halfHeight: TOTEM_HEIGHT / 2 })
        );
        if (totemIndex >= 0) {
          damageTotem(world, totemIndex, TOTEM_REFLECT_DAMAGE);
          remove = true;
        } else if (!world.boss.vanished && aabbOverlap(box, bossHurtbox(world))) {
          if (proj.kind === 'bolt') {
            // Fulmine rimandato: danno, postura e uno stordimento vero.
            hitBoss(world, { damage: proj.damage, posture: BOLT_REFLECT_POSTURE, source: 'player' });
            if (world.totems.length === 0) {
              world.boss.staggerTimer = Math.max(world.boss.staggerTimer, BOLT_REFLECT_STUN);
            }
          } else {
            hitBoss(world, { damage: proj.damage, posture: PROJECTILE_REFLECT_POSTURE, source: 'player' });
          }
          remove = true;
        }
      }
      if (remove) world.projectiles.splice(i, 1);
    }

    // --- oggetti del Buen Camino: colpi del giocatore e di Eve ---
    for (let i = world.totems.length - 1; i >= 0; i -= 1) {
      const totem = world.totems[i];
      // (una area del berserk può aver tolto altri oggetti durante questo giro)
      if (!totem) continue;
      totem.flash = Math.max(0, totem.flash - delta);
      const box = { x: totem.x, y: TOTEM_HEIGHT / 2, halfWidth: TOTEM_HALF_WIDTH, halfHeight: TOTEM_HEIGHT / 2 };
      if (player.attackBox && totem.lastPlayerSwing !== player.swingId && aabbOverlap(player.attackBox, box)) {
        totem.lastPlayerSwing = player.swingId;
        let damage = player.attackDamage * player.damageMultiplier;
        if (player.counterWindow > 0) damage *= COUNTER_MULTIPLIER;
        damageTotem(world, i, damage);
        onPlayerMeleeHit(world);
        continue;
      }
      if (world.eve.attackBox && totem.lastEveSwing !== world.eve.swingId && aabbOverlap(world.eve.attackBox, box)) {
        totem.lastEveSwing = world.eve.swingId;
        damageTotem(world, i, EVE_ATTACK_DAMAGE);
      }
    }

    // --- torrette: volo, tiro autonomo e colpi ricevuti ---
    for (let i = world.turrets.length - 1; i >= 0; i -= 1) {
      const turret = world.turrets[i];
      if (!turret) continue;
      turret.flash = Math.max(0, turret.flash - delta);

      if (turret.state === 'flying') {
        turret.flyT += delta;
        if (turret.flyT >= TURRET_FLIGHT) turret.state = 'active';
        continue;
      }

      // Si elimina ATTACCANDOLA (giocatore o Eve), una volta per fendente.
      const box = { x: turret.x, y: turret.y, halfWidth: TURRET_SIZE / 2, halfHeight: TURRET_SIZE / 2 };
      if (player.attackBox && turret.lastPlayerSwing !== player.swingId && aabbOverlap(player.attackBox, box)) {
        turret.lastPlayerSwing = player.swingId;
        let damage = player.attackDamage * player.damageMultiplier;
        if (player.counterWindow > 0) damage *= COUNTER_MULTIPLIER;
        damageTurret(world, i, damage);
        onPlayerMeleeHit(world);
        continue;
      }
      if (world.eve.attackBox && turret.lastEveSwing !== world.eve.swingId && aabbOverlap(world.eve.attackBox, box)) {
        turret.lastEveSwing = world.eve.swingId;
        damageTurret(world, i, EVE_ATTACK_DAMAGE);
        continue;
      }

      // Spara da sola: dopo una breve carica visibile, un colpo dritto sul
      // giocatore (parabile, e rimandabile contro Checco).
      turret.fireTimer -= delta;
      if (turret.fireTimer <= 0) {
        const dx = player.x - turret.x;
        const dy = player.y + ARENA_PLAYER_HEIGHT / 2 - turret.y;
        const length = Math.hypot(dx, dy) || 1;
        world.projectiles.push({
          x: turret.x,
          y: turret.y,
          vx: (dx / length) * TURRET_SHOT_SPEED,
          vy: (dy / length) * TURRET_SHOT_SPEED,
          damage: TURRET_SHOT_DAMAGE,
          owner: 'boss',
          life: PROJECTILE_LIFETIME
        });
        turret.fireTimer = TURRET_FIRE_INTERVAL[0] + Math.random() * (TURRET_FIRE_INTERVAL[1] - TURRET_FIRE_INTERVAL[0]);
      }
    }

    // --- detriti ---
    for (let i = world.hazards.length - 1; i >= 0; i -= 1) {
      const hazard = world.hazards[i];
      if (hazard.state === 'warn') {
        hazard.warn -= delta;
        if (hazard.warn <= 0) {
          hazard.state = 'fall';
          hazard.vy = -DEBRIS_FALL_SPEED;
        }
        continue;
      }
      hazard.y += hazard.vy * delta;
      const box = { x: hazard.x, y: hazard.y, halfWidth: DEBRIS_HALF_SIZE, halfHeight: DEBRIS_HALF_SIZE };
      let remove = hazard.y <= DEBRIS_HALF_SIZE;
      if (aabbOverlap(box, playerHurtbox(world))) {
        // Non parabile: la parata non lo ferma, si schiva.
        if (hitPlayer(world, hazard.damage, { unparryable: true }) !== 'ignored') remove = true;
      }
      if (remove) world.hazards.splice(i, 1);
    }

    // --- resa ---
    SLOTS_TURRETS.forEach((slot) => {
      const body = turretBodies.current[slot];
      const bodyMat = turretBodyMats.current[slot];
      const barrel = turretBarrels.current[slot];
      const bar = turretBars.current[slot];
      const turret = world.turrets[slot];
      if (!body || !bodyMat || !barrel || !bar) return;
      body.visible = barrel.visible = bar.visible = turret !== undefined;
      if (!turret) return;
      let tx = turret.x;
      let ty = turret.y;
      if (turret.state === 'flying') {
        // Volo dalla mano di Checco al punto di montaggio, con un arco.
        const u = Math.min(1, turret.flyT / TURRET_FLIGHT);
        tx = turret.fromX + (turret.x - turret.fromX) * u;
        ty = turret.fromY + (turret.y - turret.fromY) * u + Math.sin(u * Math.PI) * 1.3;
      }
      body.position.set(tx, ty, 0.2);
      body.rotation.z = turret.state === 'flying' ? time.current * 12 : 0;
      // Canna orientata sul giocatore; durante la carica la torretta si accende.
      const aim = Math.atan2(player.y + ARENA_PLAYER_HEIGHT / 2 - ty, player.x - tx);
      barrel.position.set(tx + Math.cos(aim) * 0.5, ty + Math.sin(aim) * 0.5, 0.25);
      barrel.rotation.z = aim;
      const charging = turret.state === 'active' && turret.fireTimer < TURRET_CHARGE;
      if (turret.flash > 0) bodyMat.color.set('#ffffff');
      else if (charging) bodyMat.color.set('#f59e0b').lerp(WHITE, 0.4 * Math.sin(time.current * 40) ** 2);
      else bodyMat.color.set(turret.mount === 'wall' ? '#475569' : '#52525b');
      bar.position.set(tx, ty + TURRET_SIZE / 2 + 0.25, 0.3);
      bar.scale.x = Math.max(0.02, turret.hp / turret.hpMax);
    });
    SLOTS_TOTEMS.forEach((slot) => {
      const mesh = totemMeshes.current[slot];
      const mat = totemMats.current[slot];
      const bar = totemBars.current[slot];
      const beam = beamMeshes.current[slot];
      const totem = world.totems[slot];
      if (!mesh || !mat || !bar || !beam) return;
      mesh.visible = bar.visible = beam.visible = totem !== undefined;
      if (!totem) return;
      mesh.position.set(totem.x, TOTEM_HEIGHT / 2, -0.15);
      // Oro pulsante (segnale: "è questo che tiene in piedi Checco"), bianco al colpo.
      if (totem.flash > 0) mat.color.set('#ffffff');
      else mat.color.set('#facc15').lerp(WHITE, 0.05 + 0.12 * Math.sin(time.current * 6));
      bar.position.set(totem.x, TOTEM_HEIGHT + 0.35, -0.1);
      bar.scale.x = Math.max(0.02, totem.hp / totem.hpMax);
      // Filo luminoso dall'oggetto a Checco: lo lega visivamente a lui.
      const boss = world.boss;
      const fromX = totem.x;
      const toX = boss.x;
      const fromY = TOTEM_HEIGHT * 0.7;
      const toY = boss.y + 1.4;
      const dx = toX - fromX;
      const dy = toY - fromY;
      beam.position.set((fromX + toX) / 2, (fromY + toY) / 2, -0.2);
      beam.rotation.z = Math.atan2(dy, dx);
      beam.scale.set(Math.hypot(dx, dy), 1, 1);
    });
    SLOTS_PROJECTILES.forEach((slot) => {
      const mesh = projectileMeshes.current[slot];
      const mat = projectileMats.current[slot];
      const proj = world.projectiles[slot];
      if (!mesh || !mat) return;
      mesh.visible = proj !== undefined;
      if (!proj) return;
      mesh.position.set(proj.x, proj.y, 0.3);
      if (proj.kind === 'bolt') {
        // Fulmine: allungato nella direzione di volo, bianco-azzurro (giallo se rimandato).
        mesh.rotation.z = Math.atan2(proj.vy ?? 0, proj.vx);
        mesh.scale.set(2.6, 0.7 + 0.25 * Math.sin(time.current * 50), 1);
        mat.color.set(proj.owner === 'boss' ? '#bae6fd' : '#facc15');
      } else {
        mesh.rotation.z = time.current * 14;
        mesh.scale.set(1, 1, 1);
        mat.color.set(proj.owner === 'boss' ? '#f97316' : '#38bdf8');
      }
    });
    SLOTS_HAZARDS.forEach((slot) => {
      const marker = markerMeshes.current[slot];
      const rock = rockMeshes.current[slot];
      const hazard = world.hazards[slot];
      if (!marker || !rock) return;
      marker.visible = hazard !== undefined && hazard.state === 'warn';
      rock.visible = hazard !== undefined && hazard.state === 'fall';
      if (!hazard) return;
      marker.position.set(hazard.x, 0.1, 0.25);
      marker.scale.x = 0.8 + 0.2 * Math.sin(time.current * 24);
      rock.position.set(hazard.x, hazard.y, 0.25);
    });
  });

  return (
    <>
      {SLOTS_PROJECTILES.map((slot) => (
        <mesh key={`p${slot}`} ref={(m) => (projectileMeshes.current[slot] = m)} visible={false}>
          <planeGeometry args={[PROJECTILE_HALF_SIZE * 2, PROJECTILE_HALF_SIZE * 2]} />
          <meshBasicMaterial ref={(m) => (projectileMats.current[slot] = m)} color="#f97316" />
        </mesh>
      ))}
      {SLOTS_TURRETS.map((slot) => (
        <group key={`u${slot}`}>
          <mesh ref={(m) => (turretBodies.current[slot] = m)} visible={false}>
            <planeGeometry args={[TURRET_SIZE, TURRET_SIZE]} />
            <meshBasicMaterial ref={(m) => (turretBodyMats.current[slot] = m)} color="#52525b" />
          </mesh>
          <mesh ref={(m) => (turretBarrels.current[slot] = m)} visible={false}>
            <planeGeometry args={[0.7, 0.22]} />
            <meshBasicMaterial color="#cbd5e1" />
          </mesh>
          <mesh ref={(m) => (turretBars.current[slot] = m)} visible={false}>
            <planeGeometry args={[0.9, 0.1]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
        </group>
      ))}
      {SLOTS_TOTEMS.map((slot) => (
        <group key={`t${slot}`}>
          <mesh ref={(m) => (beamMeshes.current[slot] = m)} visible={false}>
            <planeGeometry args={[1, 0.08]} />
            <meshBasicMaterial color="#facc15" transparent opacity={0.45} />
          </mesh>
          <mesh ref={(m) => (totemMeshes.current[slot] = m)} visible={false}>
            <planeGeometry args={[TOTEM_HALF_WIDTH * 2, TOTEM_HEIGHT]} />
            <meshBasicMaterial ref={(m) => (totemMats.current[slot] = m)} color="#facc15" />
          </mesh>
          <mesh ref={(m) => (totemBars.current[slot] = m)} visible={false}>
            <planeGeometry args={[1, 0.12]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
        </group>
      ))}
      {SLOTS_HAZARDS.map((slot) => (
        <group key={`h${slot}`}>
          <mesh ref={(m) => (markerMeshes.current[slot] = m)} visible={false}>
            <planeGeometry args={[DEBRIS_HALF_SIZE * 2.6, 0.22]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.75} />
          </mesh>
          <mesh ref={(m) => (rockMeshes.current[slot] = m)} visible={false}>
            <planeGeometry args={[DEBRIS_HALF_SIZE * 2, DEBRIS_HALF_SIZE * 2]} />
            <meshBasicMaterial color="#6b5b4a" />
          </mesh>
        </group>
      ))}
    </>
  );
}
