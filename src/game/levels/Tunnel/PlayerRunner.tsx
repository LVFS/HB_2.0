import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { CharacterAnimator2D, type CharacterAnimState } from '@/game/render2d/CharacterAnimator2D';
import { ARENA_PLAYER_HEIGHT, ARENA_PLAYER_VARIANT, ATTACK_HALF_HEIGHT, ATTACK_REACH } from '../BossArena/arenaConfig';
import { laneScale, laneZ } from './tunnelLanes';
import { GATTO, TUNNEL_DASH_DURATION, TUNNEL_PARRY } from './tunnelConfig';
import type { TunnelWorld } from './tunnelState';
import { hasPerk, parryStats } from './tunnelWishes';

/** Hitbox d'attacco visibile solo in sviluppo, per tararla. */
const SHOW_DEBUG_BOXES = import.meta.env.DEV;
const TRAIL = [0, 1, 2, 3, 4];
const SPARKS = [0, 1, 2, 3, 4, 5, 6, 7];
const FLAT = -Math.PI / 2;

/**
 * D che scivola sulla ringhiera della sua via (sprite D1 della v1, vedi `docs/FASE8_TUNNEL_INSEGUIMENTO.md`
 * sez. 3). Solo resa: la logica sta in `tunnelPlayer.ts`, fatta avanzare da `TunnelDriver` — qui si copiano
 * posizione, via e posa dal mondo. La posa "scivola" non esiste ancora: D sta inclinato all'indietro con
 * scintille sotto i piedi. Lo scatto (dash) lo allunga, lo inclina e lascia una scia azzurra.
 */
export function PlayerRunner({ world }: { world: TunnelWorld }) {
  const group = useRef<Group>(null);
  const shield = useRef<Mesh>(null);
  const attackBox = useRef<Mesh>(null);
  const heal = useRef<Mesh>(null);
  const arm = useRef<Mesh>(null);
  const aura = useRef<Mesh>(null);
  const shadow = useRef<Mesh>(null);
  const cloud = useRef<Group>(null);
  // Stili: pezzi di «costume» agganciati a D (si muovono con lui) e aura colorata.
  const outfit = useRef<Record<string, Group | Mesh | null>>({});
  const styleAura = useRef<Mesh>(null);
  const styleAuraMat = useRef<MeshBasicMaterial>(null);
  const bolts = useRef<(Mesh | null)[]>([]);
  const trail = useRef<(Mesh | null)[]>([]);
  const trailMats = useRef<(MeshBasicMaterial | null)[]>([]);
  const sparks = useRef<(Mesh | null)[]>([]);
  const sparkMats = useRef<(MeshBasicMaterial | null)[]>([]);
  const time = useRef(0);
  const [anim, setAnim] = useState<CharacterAnimState>('walk');

  useFrame((_, rawDelta) => {
    const g = group.current;
    if (!g) return;
    if (world.arena.hitStop <= 0) time.current += Math.min(rawDelta, 0.05);
    const player = world.arena.player;
    const z = laneZ(world.lane.pos);
    const s = laneScale(world.lane.pos);
    const { runner } = world;
    const dashing = runner.action === 'dash';
    const grounded = player.y < 0.05;

    // Posizione, via e posa: allungato e inclinato nello scatto, appena reclinato mentre scivola.
    // In sella al gatto D sta più in alto (solo resa: il corpo resta a terra per le collisioni).
    const lift = world.cat.active ? (1 - (1 - world.cat.grow) ** 3) * GATTO.mountLift : 0;
    g.position.set(player.x, (player.y + lift) * s, z);
    g.scale.set(s * (dashing ? 1.22 : 1), s * (dashing ? 0.94 : 1), 1);
    g.rotation.z = dashing ? -runner.dashDir * 0.24 : grounded ? -0.07 : -0.03;
    // React solo quando cambia il valore LOGICO della posa.
    setAnim(runner.anim);

    if (shield.current) {
      shield.current.visible = runner.action === 'parry';
      const reach = parryStats(world).reach;
      shield.current.scale.x = reach / TUNNEL_PARRY.reach;
      shield.current.position.set(player.x + reach / 2, (player.y + ARENA_PLAYER_HEIGHT / 2) * s, z + 0.1);
    }
    if (heal.current) {
      heal.current.visible = runner.action === 'heal';
      heal.current.position.set(player.x, (player.y + ARENA_PLAYER_HEIGHT / 2) * s, z + 0.1);
    }
    if (attackBox.current) {
      attackBox.current.visible = SHOW_DEBUG_BOXES && player.attackBox !== null;
      if (player.attackBox) {
        attackBox.current.position.set(player.attackBox.x, player.attackBox.y * s, z + 0.1);
        attackBox.current.scale.x = (player.attackBox.halfWidth * 2) / ATTACK_REACH;
      }
    }
    // Gomu Gomu: il braccio si allunga fin dove arriva il colpo.
    if (arm.current) {
      arm.current.visible = world.buffs.gomu > 0 && player.attackBox !== null;
      if (player.attackBox) {
        arm.current.position.set(player.attackBox.x, (player.y + 1.05) * s, z + 0.12);
        arm.current.scale.set(player.attackBox.halfWidth * 2, 1, 1);
      }
    }
    // Super Saiyan (frutto): aura dorata che pulsa attorno a D.
    if (aura.current) {
      aura.current.visible = world.buffs.saiyan > 0;
      if (aura.current.visible) {
        const pulse = 1 + 0.08 * Math.sin(time.current * 14);
        aura.current.position.set(player.x, (player.y + ARENA_PLAYER_HEIGHT / 2) * s, z - 0.05);
        aura.current.scale.set(pulse, pulse, 1);
      }
    }
    // Stili permanenti: costume e aura (saiyan = oro, thor = azzurro elettrico, gear 5 = bianco).
    const saiyan = hasPerk(world, 'saiyan');
    const thor = hasPerk(world, 'thor');
    const gentleman = hasPerk(world, 'gentleman');
    const gear5 = hasPerk(world, 'gear5');
    const set = (key: string, on: boolean): void => {
      const obj = outfit.current[key];
      if (obj) obj.visible = on;
    };
    set('hair', saiyan);
    set('cape', thor);
    set('hat', gentleman);
    set('tie', gentleman);
    set('puffs', gear5);
    const auraOn = (saiyan || thor || gear5) && world.buffs.saiyan <= 0;
    if (styleAura.current && styleAuraMat.current) {
      styleAura.current.visible = auraOn;
      if (auraOn) {
        styleAuraMat.current.color.set(thor ? '#7dd3fc' : saiyan ? '#fde047' : '#ffffff');
        styleAuraMat.current.opacity = (thor ? 0.28 : 0.32) * (0.8 + 0.2 * Math.sin(time.current * (thor ? 31 : 12)));
        styleAura.current.position.set(player.x, (player.y + ARENA_PLAYER_HEIGHT / 2) * s, z - 0.06);
        styleAura.current.scale.setScalar(s * (1 + 0.07 * Math.sin(time.current * 13)));
      }
    }
    const cape = outfit.current.cape;
    if (cape && thor) cape.rotation.z = 0.18 + 0.1 * Math.sin(time.current * 7) + (grounded ? 0 : 0.2);
    // Fulmini del Dio del tuono: schegge che lampeggiano attorno a D, più fitte nel colpo.
    bolts.current.forEach((mesh, i) => {
      if (!mesh) return;
      const flash = world.perkState.thorFlash > 0;
      const on = thor && (flash || Math.sin(time.current * 23 + i * 1.7) > 0.55);
      mesh.visible = on;
      if (!on) return;
      const a = time.current * 9 + i * 2.1;
      mesh.position.set(player.x + Math.cos(a) * 0.7, (player.y + 0.95 + Math.sin(a * 1.3) * 0.8) * s, z + 0.12);
      mesh.rotation.z = a * 3;
      mesh.scale.set((flash ? 0.9 : 0.5) * s, 0.07 * s, 1);
    });
    // Nuvola Speedy: una nuvoletta gialla sotto i piedi, che sale e scende con D.
    if (cloud.current) {
      cloud.current.visible = world.buffs.nuvola > 0;
      if (cloud.current.visible) {
        cloud.current.position.set(player.x - 0.05, (player.y - 0.1) * s, z - 0.02);
        cloud.current.scale.setScalar(s * (1 + 0.05 * Math.sin(time.current * 9)));
      }
    }
    // Ombra sul binario: si restringe e sbiadisce con l'altezza del salto.
    if (shadow.current) {
      const lift = Math.min(1, player.y / 3);
      shadow.current.position.set(player.x, 0.03, z);
      shadow.current.scale.set((1 - lift * 0.5) * s, (1 - lift * 0.5) * s, 1);
      (shadow.current.material as MeshBasicMaterial).opacity = 0.4 * (1 - lift * 0.7);
    }

    // Scia dello scatto: strisce azzurre dietro D (rispetto alla direzione), che sbiadiscono a fine scatto.
    const u = dashing ? Math.min(1, runner.actionTime / TUNNEL_DASH_DURATION) : 1;
    TRAIL.forEach((i) => {
      const mesh = trail.current[i];
      const mat = trailMats.current[i];
      if (!mesh || !mat) return;
      mesh.visible = dashing;
      if (!dashing) return;
      mesh.position.set(player.x - runner.dashDir * (0.5 + i * 0.6), (player.y + 0.35 + i * 0.3) * s, z - 0.05);
      mesh.scale.set(1.5 - i * 0.18, 0.06 + (i % 2) * 0.03, 1);
      mat.opacity = (1 - u) * (0.85 - i * 0.12);
    });

    // Scintille della ringhiera: schizzano all'indietro dai piedi finché D è a terra e non scatta.
    SPARKS.forEach((i) => {
      const mesh = sparks.current[i];
      const mat = sparkMats.current[i];
      if (!mesh || !mat) return;
      const showing = grounded && !dashing && runner.action !== 'heal';
      mesh.visible = showing;
      if (!showing) return;
      const phase = (time.current * 3.2 + i * 0.37) % 1;
      mesh.position.set(player.x - 0.15 - phase * 1.5, (0.06 + (i % 3) * 0.07 + phase * 0.3) * s, z + 0.05);
      mesh.scale.setScalar(0.07 + (i % 2) * 0.03);
      mat.opacity = (1 - phase) * 0.9;
    });
  });

  return (
    <>
      <mesh ref={shadow} rotation={[FLAT, 0, 0]}>
        <circleGeometry args={[0.7, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <group ref={cloud} visible={false}>
        {[[-0.55, 0, 0.42], [0, 0.12, 0.55], [0.55, 0, 0.42]].map(([x, y, r]) => (
          <mesh key={x} position={[x, y, 0]}>
            <circleGeometry args={[r, 16]} />
            <meshBasicMaterial color="#fde68a" />
          </mesh>
        ))}
      </group>
      <group ref={group}>
        <CharacterAnimator2D variant={ARENA_PLAYER_VARIANT} state={anim} facing={1} height={ARENA_PLAYER_HEIGHT} />
        {/* Costume dello stile: Super Saiyan = capelli d'oro a punta; Dio del tuono = mantello rosso; smoking = cilindro e papillon; Gear 5 = ciuffo e nuvolette bianche. */}
        <group ref={(el) => { outfit.current.hair = el; }} visible={false} position={[0, ARENA_PLAYER_HEIGHT * 0.96, 0.06]}>
          {[-0.17, 0, 0.17].map((x, i) => (
            <mesh key={x} position={[x, i === 1 ? 0.12 : 0.04, 0]} rotation={[0, 0, (1 - i) * 0.35]} scale={[0.17, i === 1 ? 0.34 : 0.26, 1]}>
              <circleGeometry args={[1, 3]} />
              <meshBasicMaterial color="#fde047" />
            </mesh>
          ))}
        </group>
        <mesh ref={(el) => { outfit.current.cape = el; }} visible={false} position={[-0.38, ARENA_PLAYER_HEIGHT * 0.5, -0.03]} rotation={[0, 0, 0.2]}>
          <planeGeometry args={[0.5, ARENA_PLAYER_HEIGHT * 0.6]} />
          <meshBasicMaterial color="#dc2626" />
        </mesh>
        <group ref={(el) => { outfit.current.hat = el; }} visible={false} position={[0.02, ARENA_PLAYER_HEIGHT * 0.97, 0.07]}>
          <mesh position={[0, 0.18, 0]}>
            <planeGeometry args={[0.36, 0.36]} />
            <meshBasicMaterial color="#111827" />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[0.62, 0.07]} />
            <meshBasicMaterial color="#111827" />
          </mesh>
          <mesh position={[0, 0.07, 0.02]}>
            <planeGeometry args={[0.36, 0.06]} />
            <meshBasicMaterial color="#dc2626" />
          </mesh>
        </group>
        <group ref={(el) => { outfit.current.tie = el; }} visible={false} position={[0.02, ARENA_PLAYER_HEIGHT * 0.78, 0.07]}>
          <mesh position={[-0.07, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.1, 0.1, 1]}>
            <circleGeometry args={[1, 3]} />
            <meshBasicMaterial color="#dc2626" />
          </mesh>
          <mesh position={[0.07, 0, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[0.1, 0.1, 1]}>
            <circleGeometry args={[1, 3]} />
            <meshBasicMaterial color="#dc2626" />
          </mesh>
        </group>
        <group ref={(el) => { outfit.current.puffs = el; }} visible={false} position={[0, ARENA_PLAYER_HEIGHT * 0.9, 0.06]}>
          {[[-0.2, 0.08, 0.17], [0, 0.17, 0.2], [0.2, 0.08, 0.15], [-0.32, -0.38, 0.14], [0.3, -0.4, 0.12]].map(([x, y, r]) => (
            <mesh key={`${x}${y}`} position={[x, y, 0]}>
              <circleGeometry args={[r, 12]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.92} />
            </mesh>
          ))}
        </group>
      </group>
      <mesh ref={styleAura} visible={false}>
        <circleGeometry args={[1.3, 24]} />
        <meshBasicMaterial ref={styleAuraMat} color="#fde047" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`bolt-${i}`} ref={(el) => { bolts.current[i] = el; }} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={i % 2 === 0 ? '#fef08a' : '#bae6fd'} transparent opacity={0.95} depthWrite={false} />
        </mesh>
      ))}
      {TRAIL.map((i) => (
        <mesh key={`trail-${i}`} ref={(el) => { trail.current[i] = el; }} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial ref={(el) => { trailMats.current[i] = el; }} color="#7dd3fc" transparent opacity={0.8} depthWrite={false} />
        </mesh>
      ))}
      {SPARKS.map((i) => (
        <mesh key={`spark-${i}`} ref={(el) => { sparks.current[i] = el; }} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial ref={(el) => { sparkMats.current[i] = el; }} color="#fde68a" transparent opacity={0.9} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={shield} visible={false}>
        <planeGeometry args={[TUNNEL_PARRY.reach * 0.6, ARENA_PLAYER_HEIGHT * 0.9]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.35} />
      </mesh>
      <mesh ref={heal} visible={false}>
        <planeGeometry args={[1.3, ARENA_PLAYER_HEIGHT * 1.05]} />
        <meshBasicMaterial color="#4ade80" transparent opacity={0.28} />
      </mesh>
      <mesh ref={arm} visible={false}>
        <planeGeometry args={[1, 0.3]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.85} />
      </mesh>
      <mesh ref={aura} visible={false}>
        <circleGeometry args={[1.35, 24]} />
        <meshBasicMaterial color="#fde047" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh ref={attackBox} visible={false}>
        <planeGeometry args={[ATTACK_REACH, ATTACK_HALF_HEIGHT * 2]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.25} />
      </mesh>
    </>
  );
}
