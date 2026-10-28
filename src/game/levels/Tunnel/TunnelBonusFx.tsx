import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Mesh, MeshBasicMaterial, OrthographicCamera } from 'three';
import { laneZ } from './tunnelLanes';
import type { TunnelWorld } from './tunnelState';

/** Colori del raggio: [alone, nucleo]. */
const BEAM_COLORS = { violet: ['#a78bfa', '#ffffff'], blue: ['#38bdf8', '#ffffff'], orange: ['#fb923c', '#fff7ed'] } as const;
const LINE_COUNT = 14;
const LINES = Array.from({ length: LINE_COUNT }, (_, i) => i);
/** Quota e velocità di ogni linea di velocità, scelte una volta per tutte (non a caso: stesso aspetto a ogni avvio). */
const LANES = LINES.map((i) => ({ y: 0.4 + ((i * 0.83) % 4.6), speed: 22 + (i % 4) * 7, phase: i * 3.1 }));

/**
 * Effetti dei bonus e dello Slancio: le linee di velocità (si vedono dal livello
 * 1 in su) e il raggio dello Zoltraak. Solo resa: leggono `world.slancio`,
 * `world.tempo` e `world.beam`.
 */
export function TunnelBonusFx({ world }: { world: TunnelWorld }) {
  const camera = useThree((state) => state.camera) as OrthographicCamera;
  const width = useThree((state) => state.size.width);
  const lines = useRef<(Mesh | null)[]>([]);
  const lineMats = useRef<(MeshBasicMaterial | null)[]>([]);
  const beam = useRef<Mesh>(null);
  const beamCore = useRef<Mesh>(null);
  const time = useRef(0);

  useFrame((_, rawDelta) => {
    if (world.arena.hitStop > 0) return;
    const delta = Math.min(rawDelta, 0.05);
    time.current += delta;
    const halfW = width / 2 / camera.zoom;
    const span = halfW * 2 + 4;
    const strength = Math.min(1, world.slancio / 3 + (world.buffs.saiyan > 0 ? 0.4 : 0));
    LINES.forEach((i) => {
      const mesh = lines.current[i];
      const mat = lineMats.current[i];
      if (!mesh || !mat) return;
      const lane = LANES[i];
      mesh.visible = strength > 0;
      if (!mesh.visible) return;
      // Scorrono verso sinistra rispetto alla camera, più in fretta con lo Slancio.
      const x = camera.position.x + halfW + 2 - ((time.current * lane.speed * (0.8 + world.tempo * 0.4) + lane.phase * 4) % span);
      mesh.position.set(x, lane.y, 0.5);
      mesh.scale.set(1.2 + strength * 2.2, 0.035, 1);
      mat.opacity = 0.12 + 0.3 * strength;
    });

    const b = beam.current;
    const core = beamCore.current;
    if (b && core) {
      const active = world.beam !== null;
      b.visible = core.visible = active;
      if (world.beam) {
        const { beam } = world;
        // Il raggio resta dov'è partito (Zoltraak, Frieren, Kamehameha) e si assottiglia mentre si spegne.
        const u = beam.life / beam.lifeMax;
        const thickness = beam.thickness * (0.25 + 0.75 * u);
        const x = beam.x + beam.length / 2;
        const z = laneZ(beam.lane) + 0.6;
        const colors = BEAM_COLORS[beam.color];
        (b.material as MeshBasicMaterial).color.set(colors[0]);
        b.position.set(x, beam.y, z);
        b.scale.set(beam.length, thickness, 1);
        core.position.set(x, beam.y, z + 0.01);
        core.scale.set(beam.length, thickness * 0.35, 1);
      }
    }
  });

  return (
    <>
      {LINES.map((i) => (
        <mesh key={i} ref={(el) => { lines.current[i] = el; }} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial ref={(el) => { lineMats.current[i] = el; }} color="#e2e8f0" transparent opacity={0.2} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={beam} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.65} depthWrite={false} />
      </mesh>
      <mesh ref={beamCore} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.95} depthWrite={false} />
      </mesh>
    </>
  );
}
