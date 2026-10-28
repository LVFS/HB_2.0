import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, MeshBasicMaterial } from 'three';
import { createPickupTextures } from './pickupIcons';
import { laneScale, laneZ } from './tunnelLanes';
import { PICKUP_FADE } from './tunnelPickups';
import { PICKUP_SIZE } from './tunnelConfig';
import type { TunnelWorld } from './tunnelState';

const MAX_SLOTS = 28;
const SLOTS = Array.from({ length: MAX_SLOTS }, (_, i) => i);
/** Le icone sono disegnate più grandi dell'ingombro: la sagoma riempie il quadrato solo in parte. */
const ICON_SCALE = 1.35;

/**
 * Gli oggetti del tunnel (Sfere del Drago, scatole-bonus, frecce gialle): pool di mesh con
 * l'icona disegnata al volo (`pickupIcons.ts`), aggiornate ogni frame da
 * `world.pickups`. Fluttuano; quelli raccolti si gonfiano e svaniscono. Solo
 * resa: raccolta ed effetti stanno in `tunnelPickups.ts`.
 */
export function PickupsLayer({ world }: { world: TunnelWorld }) {
  const meshes = useRef<(Mesh | null)[]>([]);
  const mats = useRef<(MeshBasicMaterial | null)[]>([]);
  const time = useRef(0);
  const textures = useMemo(() => createPickupTextures(), []);
  useEffect(
    () => () => {
      Object.values(textures).forEach((texture) => texture.dispose());
    },
    [textures]
  );

  useFrame((_, rawDelta) => {
    if (world.arena.hitStop > 0) return;
    time.current += Math.min(rawDelta, 0.05);
    SLOTS.forEach((slot) => {
      const mesh = meshes.current[slot];
      const mat = mats.current[slot];
      if (!mesh || !mat) return;
      const pickup = world.pickups[slot];
      mesh.visible = pickup !== undefined;
      if (!pickup) return;
      const texture = textures[pickup.kind];
      if (mat.map !== texture) {
        mat.map = texture;
        mat.needsUpdate = true;
      }
      const size = PICKUP_SIZE[pickup.kind];
      const bob = pickup.kind === 'arrow' ? 0 : Math.sin(time.current * 4 + pickup.id) * 0.08;
      const taken = pickup.takenFor > 0 ? Math.min(1, pickup.takenFor / PICKUP_FADE) : 0;
      const pulse = 1 + (pickup.kind === 'arrow' ? 0.06 * Math.sin(time.current * 10) : 0) + taken * 0.8;
      // La freccia gialla è una pedana larga e bassa; gli altri sono quadrati.
      const w = pickup.kind === 'arrow' ? size.width : size.width * ICON_SCALE;
      const h = pickup.kind === 'arrow' ? size.width * 0.6 : size.height * ICON_SCALE;
      // Il disegno della pedana sta al centro del quadrato: lo si appoggia a terra.
      const s = laneScale(pickup.lane);
      mesh.position.set(pickup.x, (pickup.kind === 'arrow' ? 0.12 : pickup.y + bob) * s, laneZ(pickup.lane) + 0.2);
      mesh.scale.set(w * pulse * s, h * pulse * s, 1);
      // Con la casella piena le scatole restano lì, più spente: non si possono prendere.
      mat.opacity = (pickup.kind === 'box' && world.slot !== null ? 0.4 : 1) * (1 - taken);
    });
  });

  return (
    <>
      {SLOTS.map((slot) => (
        <mesh key={slot} ref={(el) => { meshes.current[slot] = el; }} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial ref={(el) => { mats.current[slot] = el; }} transparent />
        </mesh>
      ))}
    </>
  );
}

