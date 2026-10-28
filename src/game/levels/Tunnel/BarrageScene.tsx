import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { BARRAGE_GUARDS } from './tunnelConfig';
import type { TunnelWorld } from './tunnelState';

const GUARD_SLOTS = Array.from({ length: BARRAGE_GUARDS }, (_, i) => i);
const GUARD_SPACING = 0.75;
const GUARD_FIRST_OFFSET = 1.8;
const FALL_DURATION = 0.3;

/**
 * Cosa si vede durante la raffica a doppia spada (`combo_doppia_spada_qte`): i
 * burattini-guardia in fila che sbarrano il tunnel — il primo che D incontra
 * cade per primo, a ogni fendente a segno — e il portello dietro la marionetta.
 * Solo resa, aggiornata da `world.barrage` (la logica sta in `tunnelBarrage.ts`).
 * Segnaposto a tinte unite.
 */
export function BarrageScene({ world }: { world: TunnelWorld }) {
  const guards = useRef<(Group | null)[]>([]);
  const fallen = useRef<number[]>(GUARD_SLOTS.map(() => -1));
  const hatch = useRef<Mesh>(null);
  const time = useRef(0);

  useFrame((_, rawDelta) => {
    if (world.arena.hitStop > 0) return;
    time.current += Math.min(rawDelta, 0.05);
    const barrage = world.barrage;
    const active = barrage !== null;
    const px = world.arena.player.x;
    GUARD_SLOTS.forEach((slot) => {
      const g = guards.current[slot];
      if (!g) return;
      g.visible = active;
      if (!barrage) return;
      // Quando una guardia cade parte il suo timer: ruota a terra e si spegne.
      if (slot < barrage.guardsFallen && fallen.current[slot] < 0) fallen.current[slot] = time.current;
      const fellFor = fallen.current[slot] < 0 ? -1 : time.current - fallen.current[slot];
      const u = fellFor < 0 ? 0 : Math.min(1, fellFor / FALL_DURATION);
      // Sobbalza leggermente da ferma, come un burattino appeso ai fili.
      const sway = fellFor < 0 ? Math.sin(time.current * 5 + slot) * 0.03 : 0;
      g.position.set(px + GUARD_FIRST_OFFSET + slot * GUARD_SPACING + u * 0.6, u * 0.2, 0.05);
      g.rotation.z = -u * (Math.PI / 2) + sway;
    });
    if (hatch.current) {
      hatch.current.visible = active;
      hatch.current.position.set(world.puppet.x + 1.4, 1.3, -0.4);
    }
  });

  return (
    <>
      <mesh ref={hatch} visible={false}>
        <planeGeometry args={[1.8, 2.6]} />
        <meshBasicMaterial color="#05080c" />
      </mesh>
      {GUARD_SLOTS.map((slot) => (
        <group key={slot} ref={(el) => { guards.current[slot] = el; }} visible={false}>
          <mesh position={[0, 0.7, 0]}>
            <planeGeometry args={[0.6, 1.4]} />
            <meshBasicMaterial color="#8b6b4a" />
          </mesh>
          <mesh position={[0, 1.65, 0]}>
            <planeGeometry args={[0.45, 0.45]} />
            <meshBasicMaterial color="#c9a77a" />
          </mesh>
          <mesh position={[0, 3.7, -0.02]}>
            <planeGeometry args={[0.03, 4]} />
            <meshBasicMaterial color="#e5e7eb" transparent opacity={0.6} />
          </mesh>
        </group>
      ))}
    </>
  );
}
