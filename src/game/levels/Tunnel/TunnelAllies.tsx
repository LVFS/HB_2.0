import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { CharacterAnimator2D, type CharacterAnimState } from '@/game/render2d/CharacterAnimator2D';
import { ARENA_PLAYER_HEIGHT, EVE_HEIGHT } from '../BossArena/arenaConfig';
import { EVE_HELP, KAMEHAMEHA } from './tunnelConfig';
import { laneScale, laneZ } from './tunnelLanes';
import type { TunnelWorld } from './tunnelState';

/**
 * Gli aiuti fissi della modalità shonen: **Eve** (la vera Eve dello sprite) che nella seconda onda raggiunge D da dietro e
 * gli corre accanto sulla via vicina (resta per tutta la corsa), **Zoro** in scorta (corre davanti a D, spazza e poi si perde) e la sfera blu del **Kamehameha** che D carica fra le mani nel finale. I cameo a turno
 * sono in `CameoCast.tsx`. Solo resa: stato e colpi stanno in `tunnelReality.ts`.
 */
export function TunnelAllies({ world }: { world: TunnelWorld }) {
  const eve = useRef<Group>(null);
  const orb = useRef<Mesh>(null);
  const zoro = useRef<Group>(null);
  const zoroSlash = useRef<Mesh>(null);
  const orbHalo = useRef<Mesh>(null);
  const time = useRef(0);
  const [eveAnim, setEveAnim] = useState<CharacterAnimState>('walk');

  useFrame((_, rawDelta) => {
    if (world.arena.hitStop > 0) return;
    time.current += Math.min(rawDelta, 0.05);
    const t = time.current;
    const { mode, arena } = world;
    const player = arena.player;

    // Eve: arriva dal fondo (da dietro D) e si ferma accanto a lui; il colpo la fa scattare.
    const g = eve.current;
    if (g) {
      const here = mode.eveOn;
      g.visible = here;
      if (here) {
        const s = laneScale(EVE_HELP.lane);
        const arrive = 1 - (1 - mode.eveArrive) ** 3;
        g.position.set(player.x - EVE_HELP.behind - (1 - arrive) * 10, Math.abs(Math.sin(t * 9)) * 0.06 * s, laneZ(EVE_HELP.lane) + 0.15);
        g.scale.setScalar(s);
        setEveAnim(mode.eveFlash > 0 ? 'attack' : 'walk');
      }
    }

    // Zoro in scorta: corre davanti a D nella sua via (cambia via a caso e alla fine se ne va nella direzione sbagliata).
    const zg = zoro.current;
    if (zg) {
      const ps = world.perkState;
      const here = ps.zoroT > 0 || (ps.zoroLeaving && ps.zoroAhead > -9);
      zg.visible = here;
      if (here) {
        const zs = laneScale(ps.zoroLane);
        zg.position.set(player.x + ps.zoroAhead, Math.abs(Math.sin(t * 10)) * 0.07 * zs, laneZ(ps.zoroLane) + 0.2);
        const pop = 1 + ps.zoroFlash * 1.6;
        zg.scale.set(zs * pop, zs * pop, 1);
      }
      if (zoroSlash.current) {
        zoroSlash.current.visible = here && ps.zoroFlash > 0;
        if (zoroSlash.current.visible) {
          zoroSlash.current.position.set(player.x + ps.zoroAhead + 1.2, 1.1 * laneScale(ps.zoroLane), laneZ(ps.zoroLane) + 0.3);
          zoroSlash.current.scale.set(2.6 * laneScale(ps.zoroLane), 0.18, 1);
          zoroSlash.current.rotation.z = -0.4 + ps.zoroFlash * 2;
        }
      }
    }

    // Il Kamehameha: la sfera cresce durante la carica fra le mani di D.
    const charging = mode.id === 'anime' && mode.finale === 'charge';
    const k = charging ? Math.min(1, mode.finaleT / KAMEHAMEHA.charge) : 0;
    const s = laneScale(world.lane.pos);
    const y = (player.y + ARENA_PLAYER_HEIGHT * 0.55) * s;
    if (orb.current) {
      orb.current.visible = charging;
      orb.current.position.set(player.x + 0.9, y, laneZ(world.lane.pos) + 0.35);
      orb.current.scale.setScalar((0.15 + 0.85 * k) * (1 + 0.1 * Math.sin(t * 30)));
    }
    if (orbHalo.current) {
      orbHalo.current.visible = charging;
      orbHalo.current.position.set(player.x + 0.9, y, laneZ(world.lane.pos) + 0.33);
      orbHalo.current.scale.setScalar((0.3 + 1.7 * k) * (1 + 0.15 * Math.sin(t * 22)));
    }
  });

  return (
    <>
      <group ref={zoro} visible={false}>
        <mesh position={[0, 0.78, 0]}>
          <planeGeometry args={[0.74, 1.3]} />
          <meshBasicMaterial color="#14532d" />
        </mesh>
        <mesh position={[0, 0.52, 0.01]}>
          <planeGeometry args={[0.76, 0.2]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
        <mesh position={[0, 1.62, 0.01]}>
          <planeGeometry args={[0.46, 0.46]} />
          <meshBasicMaterial color="#f3d9c4" />
        </mesh>
        <mesh position={[0, 1.88, 0.02]}>
          <planeGeometry args={[0.52, 0.2]} />
          <meshBasicMaterial color="#16a34a" />
        </mesh>
        <mesh position={[0.5, 1.0, 0.02]} rotation={[0, 0, -0.5]}>
          <planeGeometry args={[0.08, 1.3]} />
          <meshBasicMaterial color="#e2e8f0" />
        </mesh>
      </group>
      <mesh ref={zoroSlash} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#bbf7d0" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <group ref={eve} visible={false}>
        <CharacterAnimator2D variant="Eve" state={eveAnim} facing={1} height={EVE_HEIGHT} />
      </group>
      <mesh ref={orbHalo} visible={false}>
        <circleGeometry args={[0.8, 24]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh ref={orb} visible={false}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial color="#e0f2fe" />
      </mesh>
    </>
  );
}
