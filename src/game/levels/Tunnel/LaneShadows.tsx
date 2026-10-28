import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, MeshBasicMaterial } from 'three';
import { PICKUP_SIZE } from './tunnelConfig';
import { laneScale, laneZ } from './tunnelLanes';
import type { TunnelWorld } from './tunnelState';

const MAX_SHADOWS = 64;
const SLOTS = Array.from({ length: MAX_SHADOWS }, (_, i) => i);
const FLAT = -Math.PI / 2;

/**
 * L'OMBRA sul binario sotto ogni cosa che sta in una via (ostacoli, nemici, oggetti, proiettili): anche se è in aria (un
 * detrito, una torretta, un proiettile, una Sfera) l'ombra cade a terra nella SUA via, così si capisce subito in quale via
 * spostarsi. Come quella di D: ellisse scura sul piano, più piccola e più chiara se la cosa sta in alto. Solo resa.
 */
export function LaneShadows({ world }: { world: TunnelWorld }) {
  const meshes = useRef<(Mesh | null)[]>([]);
  const mats = useRef<(MeshBasicMaterial | null)[]>([]);

  useFrame(() => {
    let used = 0;
    const put = (x: number, lane: number, width: number, height: number): void => {
      if (used >= MAX_SHADOWS) return;
      const mesh = meshes.current[used];
      const mat = mats.current[used];
      if (!mesh || !mat) return;
      used += 1;
      const s = laneScale(lane);
      // Più in alto = ombra più piccola e più tenue.
      const lift = Math.min(1, Math.max(0, height) / 4);
      const w = Math.max(0.6, width * 1.3) * (1 - lift * 0.3) * s;
      mesh.visible = true;
      mesh.position.set(x, 0.025, laneZ(lane));
      mesh.scale.set(w, w * 0.8, 1);
      mat.opacity = 0.62 * (1 - lift * 0.45);
    };

    for (const h of world.hazards) {
      if (h.phase === 'spent' || h.kind === 'pit' || h.kind === 'remains' || h.kind === 'ray') continue;
      if (h.kind === 'pendulum') put(h.x, Math.round(h.swing), h.width * 1.4, h.y);
      else put(h.x, h.lane, h.width * 1.25, h.kind === 'debris' || h.kind === 'turret' ? h.y : 0);
    }
    for (const pickup of world.pickups) {
      if (pickup.takenFor > 0) continue;
      put(pickup.x, pickup.lane, PICKUP_SIZE[pickup.kind].width * 1.3, pickup.kind === 'arrow' ? 0 : pickup.y);
    }
    for (const proj of world.arena.projectiles) {
      const lane = proj.owner === 'player' ? world.lane.pos : (proj.lane ?? world.lane.pos);
      put(proj.x, lane, 0.6, proj.y);
    }
    for (let i = used; i < MAX_SHADOWS; i += 1) {
      const mesh = meshes.current[i];
      if (mesh) mesh.visible = false;
    }
  });

  return (
    <>
      {SLOTS.map((slot) => (
        <mesh key={slot} ref={(el) => { meshes.current[slot] = el; }} rotation={[FLAT, 0, 0]} visible={false}>
          <circleGeometry args={[0.5, 16]} />
          <meshBasicMaterial ref={(el) => { mats.current[slot] = el; }} color="#000000" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}
