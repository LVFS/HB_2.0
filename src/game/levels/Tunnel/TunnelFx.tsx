import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, MeshBasicMaterial } from 'three';
import { laneZ } from './tunnelLanes';
import type { TunnelWorld } from './tunnelState';

const MAX_RINGS = 8;
const SLOTS = Array.from({ length: MAX_RINGS }, (_, i) => i);

/**
 * Cerchi che si espandono (impatti dei fendenti, esplosioni): quelli che
 * `combat.addRing` mette in `world.arena.fx`. Stessa idea di `PlayerShotsLayer`
 * dell'arena, ridotta ai soli cerchi — anche qui la vita degli effetti si fa
 * scendere ogni frame di gioco (non durante l'hit-stop).
 */
export function TunnelFx({ world }: { world: TunnelWorld }) {
  const meshes = useRef<(Mesh | null)[]>([]);
  const mats = useRef<(MeshBasicMaterial | null)[]>([]);

  useFrame((_, rawDelta) => {
    const { fx, hitStop } = world.arena;
    if (hitStop > 0) return;
    const delta = Math.min(rawDelta, 0.05);
    for (let i = fx.length - 1; i >= 0; i -= 1) {
      fx[i].life -= delta;
      if (fx[i].life <= 0) fx.splice(i, 1);
    }
    SLOTS.forEach((slot) => {
      const mesh = meshes.current[slot];
      const mat = mats.current[slot];
      if (!mesh || !mat) return;
      const effect = fx[slot];
      mesh.visible = effect !== undefined;
      if (!effect) return;
      const u = 1 - effect.life / effect.lifeMax;
      mesh.position.set(effect.x, effect.y, laneZ(world.lane.pos) + 0.3);
      mesh.scale.set(effect.radius * u, effect.radius * u * 0.6, 1);
      mat.color.set(effect.color);
      mat.opacity = 0.9 * (1 - u);
    });
  });

  return (
    <>
      {SLOTS.map((slot) => (
        <mesh key={slot} ref={(el) => { meshes.current[slot] = el; }} visible={false}>
          <ringGeometry args={[0.9, 1, 40]} />
          <meshBasicMaterial ref={(el) => { mats.current[slot] = el; }} color="#ffffff" transparent opacity={0.8} />
        </mesh>
      ))}
    </>
  );
}
