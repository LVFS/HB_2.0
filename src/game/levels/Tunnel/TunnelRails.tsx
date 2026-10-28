import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color } from 'three';
import type { Mesh, MeshBasicMaterial } from 'three';
import { MOOD_PALETTE, TUNNEL_LANE_Z, TUNNEL_LANES, TUNNEL_RAIL, TUNNEL_VIEW_MAX_WIDTH } from './tunnelConfig';
import type { TunnelWorld } from './tunnelState';

/** Quante tacche per binario: coprono la finestra più larga, con un margine. */
const TICKS_PER_RAIL = Math.ceil((TUNNEL_VIEW_MAX_WIDTH + 12) / TUNNEL_RAIL.tickSpacing) + 2;
const LANES = Array.from({ length: TUNNEL_LANES }, (_, i) => i);
const TICKS = Array.from({ length: TICKS_PER_RAIL }, (_, i) => i);
/** Il pavimento parte poco dietro la via lontana e arriva ben oltre quella vicina (fino al bordo basso dello schermo). */
const FLOOR_FAR_Z = TUNNEL_LANE_Z[0] - 2.5;
const FLOOR_NEAR_Z = 14;
const FLOOR_DEPTH = FLOOR_NEAR_Z - FLOOR_FAR_Z;
const FLOOR_CENTER_Z = (FLOOR_NEAR_Z + FLOOR_FAR_Z) / 2;
/** Colore del binario per via: la lontana fredda, la vicina calda (aiuta a leggere la profondità). */
const RAIL_COLORS = ['#5b7a99', '#8aa6bf', '#b7c4d1'] as const;
const TICK_COLORS = ['#34485c', '#4a6580', '#6a86a3'] as const;
const FLAT = -Math.PI / 2;
const NORMAL_GLOW = new Color('#7dd3fc');
const THREAT_GLOW = new Color('#f43f5e');
const floorColor = new Color();
const floorPart = new Color();

/**
 * Le tre ringhiere su cui D scivola: un pavimento piatto che copre le vie, un binario per via e le
 * tacche che scorrono sul binario alla velocità del mondo (danno il senso della velocità). I piani
 * sono posati in orizzontale: con la camera inclinata si leggono come fasce a profondità diverse.
 * Sono separati di pochi centesimi in quota: la profondità ortografica è lineare, quindi non c'è z-fighting.
 * Solo resa; segue la camera in X come il resto dello sfondo.
 */
export function TunnelRails({ world }: { world: TunnelWorld }) {
  const camera = useThree((state) => state.camera);
  const floor = useRef<Mesh>(null);
  const rails = useRef<(Mesh | null)[]>([]);
  const ticks = useRef<(Mesh | null)[][]>(LANES.map(() => []));
  const highlight = useRef<(Mesh | null)[]>([]);

  useFrame(() => {
    const camX = camera.position.x;
    if (floor.current) {
      floor.current.position.x = camX;
      // Il pavimento prende l'atmosfera della modalità in corso.
      floorColor.setRGB(0, 0, 0);
      MOOD_PALETTE.floor.forEach((hex, i) => {
        if (world.mood[i] > 0.001) floorColor.add(floorPart.set(hex).multiplyScalar(world.mood[i]));
      });
      (floor.current.material as MeshBasicMaterial).color.copy(floorColor);
    }
    rails.current.forEach((rail) => {
      if (rail) rail.position.x = camX;
    });
    // Le tacche stanno ferme nel mondo (a multipli esatti di `tickSpacing`) e il binario scorre sotto la camera.
    const first = Math.floor((camX - (TUNNEL_VIEW_MAX_WIDTH / 2 + 6)) / TUNNEL_RAIL.tickSpacing);
    LANES.forEach((lane) => {
      ticks.current[lane].forEach((tick, i) => {
        if (tick) tick.position.x = (first + i) * TUNNEL_RAIL.tickSpacing;
      });
      // La via di D si accende leggermente: dice "sei qui" anche quando D è in aria.
      const glow = highlight.current[lane];
      if (glow) {
        glow.position.x = camX;
        // Una via sotto l'onda di Checco lampeggia di rosso; altrimenti si accende solo quella di D.
        const threatened = world.wave !== null && world.wave.lanes.includes(lane);
        const material = glow.material as MeshBasicMaterial;
        material.color.copy(threatened ? THREAT_GLOW : NORMAL_GLOW);
        material.opacity = threatened ? 0.28 + 0.2 * Math.sin(performance.now() / 70) ** 2 : Math.max(0, 0.22 - Math.abs(world.lane.pos - lane) * 0.3);
      }
    });
  });

  return (
    <>
      {/* Pavimento: una lastra piatta sotto tutte le vie. */}
      <mesh ref={floor} position={[0, -0.08, FLOOR_CENTER_Z]} rotation={[FLAT, 0, 0]}>
        <planeGeometry args={[TUNNEL_VIEW_MAX_WIDTH + 24, FLOOR_DEPTH]} />
        <meshBasicMaterial color="#16222f" />
      </mesh>
      {LANES.map((lane) => {
        const z = TUNNEL_LANE_Z[lane];
        return (
          <group key={lane}>
            {/* Fascia della via, che si illumina per quella occupata da D. */}
            <mesh
              ref={(el) => {
                highlight.current[lane] = el;
              }}
              position={[0, -0.05, z]}
              rotation={[FLAT, 0, 0]}
            >
              <planeGeometry args={[TUNNEL_VIEW_MAX_WIDTH + 24, TUNNEL_RAIL.depth * 3.2]} />
              <meshBasicMaterial color="#7dd3fc" transparent opacity={0.1} depthWrite={false} />
            </mesh>
            {/* Il binario. */}
            <mesh
              ref={(el) => {
                rails.current[lane] = el;
              }}
              position={[0, -0.02, z]}
              rotation={[FLAT, 0, 0]}
            >
              <planeGeometry args={[TUNNEL_VIEW_MAX_WIDTH + 24, TUNNEL_RAIL.depth]} />
              <meshBasicMaterial color={RAIL_COLORS[lane]} />
            </mesh>
            {TICKS.map((i) => (
              <mesh
                key={i}
                ref={(el) => {
                  ticks.current[lane][i] = el;
                }}
                position={[0, 0.0, z]}
                rotation={[FLAT, 0, 0]}
              >
                <planeGeometry args={[0.7, TUNNEL_RAIL.depth * 0.5]} />
                <meshBasicMaterial color={TICK_COLORS[lane]} />
              </mesh>
            ))}
          </group>
        );
      })}
    </>
  );
}
