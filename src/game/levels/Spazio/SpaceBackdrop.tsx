import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, type Group } from 'three';
import { SPACE_STAR_COUNTS, SPACE_STAR_SPEEDS } from './spazioConfig';
import type { SpazioWorld } from './spazioState';

/** Larghezza su cui si ripete ogni strato di stelle (più larga di qualunque finestra: l'inquadratura è 16×9 ma lo schermo no). */
const STAR_SPAN = 44;
const STAR_HALF_HEIGHT = 18;
const STAR_COLORS = ['#64748b', '#cbd5e1', '#ffffff'] as const;
const STAR_SIZES = [1.5, 2, 3] as const;

/** Generatore deterministico: le stelle non cambiano a ogni rimontaggio. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Le posizioni di uno strato, ripetute una volta a destra: scorrendo di `STAR_SPAN` il pattern combacia (scorrimento senza salti). */
function starLayer(count: number, seed: number): BufferGeometry {
  const random = seeded(seed);
  const positions: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = (random() - 0.5) * STAR_SPAN;
    const y = (random() - 0.5) * 2 * STAR_HALF_HEIGHT;
    positions.push(x, y, 0, x + STAR_SPAN, y, 0);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return geometry;
}

interface SpaceBackdropProps {
  world: SpazioWorld;
}

/** Lo spazio: stelle in tre strati di parallasse che scorrono verso sinistra e il pianeta in basso (segnaposto a tinte unite). */
export function SpaceBackdrop({ world }: SpaceBackdropProps) {
  const layers = useRef<Array<Group | null>>([]);
  const offsets = useRef([0, 0, 0]);
  const geometries = useMemo(() => SPACE_STAR_COUNTS.map((count, i) => starLayer(count, 7 + i * 31)), []);
  useLayoutEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    SPACE_STAR_SPEEDS.forEach((speed, i) => {
      offsets.current[i] = (offsets.current[i] + speed * world.scroll * delta) % STAR_SPAN;
      const layer = layers.current[i];
      if (layer) layer.position.x = -offsets.current[i];
    });
  });

  return (
    <group>
      <color attach="background" args={['#05060f']} />

      {geometries.map((geometry, i) => (
        <group
          key={i}
          ref={(group) => {
            layers.current[i] = group;
          }}
          position={[0, 0, -6 + i * 0.4]}
        >
          <points geometry={geometry}>
            <pointsMaterial color={STAR_COLORS[i]} size={STAR_SIZES[i]} sizeAttenuation={false} />
          </points>
        </group>
      ))}

      {/* Pianeta in basso: alone, mare, un paio di continenti. */}
      <group position={[-3.5, -9.7, -4]}>
        <mesh>
          <circleGeometry args={[7.1, 64]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.18} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <circleGeometry args={[6.6, 64]} />
          <meshBasicMaterial color="#1e3a8a" />
        </mesh>
        <mesh position={[-1.6, 5.1, 0.02]} scale={[2.1, 0.75, 1]}>
          <circleGeometry args={[1, 24]} />
          <meshBasicMaterial color="#166534" />
        </mesh>
        <mesh position={[2.6, 4.6, 0.02]} scale={[1.4, 0.55, 1]}>
          <circleGeometry args={[1, 24]} />
          <meshBasicMaterial color="#15803d" />
        </mesh>
      </group>
    </group>
  );
}
