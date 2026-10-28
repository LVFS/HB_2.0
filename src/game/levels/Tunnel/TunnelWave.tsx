import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { laneScale, laneZ } from './tunnelLanes';
import { REALITY_WAVE, TUNNEL_LANES } from './tunnelConfig';
import type { TunnelWorld } from './tunnelState';

const LANE_SLOTS = Array.from({ length: TUNNEL_LANES }, (_, i) => i);

/**
 * L'onda con cui Checco «altera la realtà»: UN'unica lama di energia viola/rosa che occupa tutte le vie
 * (`world.wave`: un sipario che le unisce più una lama per via, con alone, nucleo bianco e barre che
 * tremano come un glitch). Solo resa: volo, collisioni ed esito stanno in `tunnelReality.ts`.
 */
export function TunnelWave({ world }: { world: TunnelWorld }) {
  const glow = useRef<(Mesh | null)[]>([]);
  const body = useRef<(Mesh | null)[]>([]);
  const core = useRef<(Mesh | null)[]>([]);
  const glitch = useRef<(Mesh | null)[]>([]);
  const curtain = useRef<Mesh>(null);
  const time = useRef(0);

  useFrame((_, rawDelta) => {
    if (world.arena.hitStop > 0) return;
    time.current += Math.min(rawDelta, 0.05);
    const t = time.current;
    const { wave } = world;
    // Il sipario che unisce le tre vie: l'onda è UNA, grande quanto tutte le vie.
    const curtainMesh = curtain.current;
    if (curtainMesh) {
      curtainMesh.visible = wave !== null;
      if (wave) {
        const sMid = laneScale(1);
        const span = (laneZ(TUNNEL_LANES - 1) - laneZ(0)) * 0.42;
        curtainMesh.position.set(wave.x, (REALITY_WAVE.height / 2 + span / 2 - 0.2) * sMid, laneZ(1) + 0.28);
        curtainMesh.scale.set(REALITY_WAVE.width * 1.3 * (1 + 0.05 * Math.sin(t * 30)), (REALITY_WAVE.height + span) * sMid, 1);
      }
    }
    LANE_SLOTS.forEach((lane) => {
      const on = wave !== null && wave.lanes.includes(lane);
      for (const ref of [glow, body, core, glitch]) {
        const mesh = ref.current[lane];
        if (mesh) mesh.visible = on;
      }
      if (!on || !wave) return;
      const s = laneScale(lane);
      const z = laneZ(lane);
      const h = REALITY_WAVE.height;
      const flicker = 1 + 0.07 * Math.sin(t * 40 + lane);
      glow.current[lane]?.position.set(wave.x, (h / 2) * s, z + 0.3);
      glow.current[lane]?.scale.set(REALITY_WAVE.width * 2.4 * s * flicker, h * 1.5 * s, 1);
      body.current[lane]?.position.set(wave.x, (h / 2) * s, z + 0.32);
      body.current[lane]?.scale.set(REALITY_WAVE.width * s, h * s * flicker, 1);
      core.current[lane]?.position.set(wave.x + 0.05, (h / 2) * s, z + 0.34);
      core.current[lane]?.scale.set(REALITY_WAVE.width * 0.4 * s, h * 0.75 * s, 1);
      // Barre di "glitch": scattano su e giù davanti all'onda e la fanno sembrare instabile.
      const bar = glitch.current[lane];
      if (bar) {
        bar.position.set(wave.x - 0.2 + Math.sin(t * 55) * 0.25, (0.25 + ((t * 7 + lane) % 1) * (h - 0.4)) * s, z + 0.36);
        bar.scale.set(REALITY_WAVE.width * 1.6 * s, 0.07 * s, 1);
      }
    });
  });

  return (
    <>
      <mesh ref={curtain} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#d946ef" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      {LANE_SLOTS.map((lane) => (
        <group key={lane}>
          <mesh ref={(el) => { glow.current[lane] = el; }} visible={false}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color="#e879f9" transparent opacity={0.28} depthWrite={false} />
          </mesh>
          <mesh ref={(el) => { body.current[lane] = el; }} visible={false}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color="#c026d3" transparent opacity={0.92} />
          </mesh>
          <mesh ref={(el) => { core.current[lane] = el; }} visible={false}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color="#fdf4ff" />
          </mesh>
          <mesh ref={(el) => { glitch.current[lane] = el; }} visible={false}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.9} />
          </mesh>
        </group>
      ))}
    </>
  );
}
