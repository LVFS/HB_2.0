import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { eveDrawPosition, type SpazioWorld } from './spazioState';

interface WorldProps {
  world: SpazioWorld;
}

/** Il razzo di Checco (stesso aspetto segnaposto della fuga nel tunnel), inclinato lungo la direzione di volo. */
export function CheccoRocket({ world }: WorldProps) {
  const group = useRef<Group>(null);
  const flame = useRef<Mesh>(null);

  useFrame(() => {
    const { rocket } = world;
    const g = group.current;
    if (!g) return;
    g.visible = rocket.visible;
    g.position.set(rocket.x, rocket.y, -1);
    g.rotation.z = rocket.rot;
    if (flame.current) {
      const flicker = 0.85 + 0.25 * Math.sin(world.time * 40);
      flame.current.scale.set(0.5, Math.max(0.01, rocket.flame * 1.3 * flicker), 1);
      flame.current.position.set(0, -1.45 - rocket.flame * 0.6, 0);
    }
  });

  return (
    <group ref={group} scale={0.85}>
      <mesh position={[0, 0, -0.1]}>
        <circleGeometry args={[0.9, 24]} />
        <meshBasicMaterial color="#fb923c" transparent opacity={0.22} />
      </mesh>
      <mesh>
        <planeGeometry args={[0.9, 2.8]} />
        <meshBasicMaterial color="#e5e7eb" />
      </mesh>
      <mesh position={[0, 1.7, 0]} rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[0.64, 0.64]} />
        <meshBasicMaterial color="#dc2626" />
      </mesh>
      <mesh position={[0, 0.5, 0.02]}>
        <planeGeometry args={[0.34, 0.34]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.6, -1.1, -0.01]}>
          <planeGeometry args={[0.45, 0.8]} />
          <meshBasicMaterial color="#dc2626" />
        </mesh>
      ))}
      <mesh ref={flame}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#f59e0b" />
      </mesh>
    </group>
  );
}

/** La navicella di Eve (rivolta a destra): fiamma del motore, scorticature quando è colpita, orbe di carica del cannone. */
export function EveShip({ world }: WorldProps) {
  const group = useRef<Group>(null);
  const flame = useRef<Mesh>(null);
  const scorch = useRef<Mesh>(null);
  const orb = useRef<Mesh>(null);

  useFrame(() => {
    const { eve } = world;
    const g = group.current;
    if (!g) return;
    g.visible = eve.visible;
    const pos = eveDrawPosition(world);
    g.position.set(pos.x, pos.y, -0.5);
    g.rotation.z = eve.rot;
    if (flame.current) {
      const flicker = 0.8 + 0.3 * Math.sin(world.time * 45);
      flame.current.scale.set(Math.max(0.01, eve.thrust * 0.9 * flicker), 0.3, 1);
      flame.current.position.set(-1.15 - eve.thrust * 0.4, 0, 0);
    }
    if (scorch.current) (scorch.current.material as MeshBasicMaterial).opacity = Math.min(0.75, eve.smoke * 0.75);
    if (orb.current) {
      // L'orbe: cresce con la carica del cannone, e durante lo sparo resta acceso finché c'è il raggio.
      const charge = world.cannon.meter?.charge ?? 0;
      const size = world.stage === 'destruction' ? 0.3 + world.beam.power * 0.45 : world.stage === 'cannon' ? charge * 0.55 : 0;
      orb.current.visible = size > 0.02;
      orb.current.scale.setScalar(Math.max(0.01, size));
    }
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={flame}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
      {/* Fusoliera, muso, ala e cabina. */}
      <mesh>
        <planeGeometry args={[2.1, 0.62]} />
        <meshBasicMaterial color="#e2e8f0" />
      </mesh>
      <mesh position={[1.2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <circleGeometry args={[0.42, 3]} />
        <meshBasicMaterial color="#e2e8f0" />
      </mesh>
      <mesh position={[-0.35, -0.2, -0.01]} rotation={[0, 0, 0.35]}>
        <planeGeometry args={[1.2, 0.18]} />
        <meshBasicMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[-0.4, 0.4, -0.01]} rotation={[0, 0, -0.35]}>
        <planeGeometry args={[0.9, 0.16]} />
        <meshBasicMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[0.55, 0.08, 0.02]}>
        <circleGeometry args={[0.2, 16]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
      <mesh ref={scorch} position={[-0.45, 0.05, 0.03]} scale={[0.62, 0.3, 1]}>
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial color="#111827" transparent opacity={0} />
      </mesh>
      <mesh ref={orb} position={[1.5, 0, 0.05]} visible={false}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color="#c4b5fd" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

const TURRET_OFFSETS = [-1.95, -0.65, 0.65, 1.95];

/** La nave madre: una grossa sagoma a tinte unite in due metà (si separano alla distruzione), con le torrette che si illuminano prima di sparare. */
export function MotherShip({ world }: WorldProps) {
  const group = useRef<Group>(null);
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const turrets = useRef<Array<Mesh | null>>([]);
  const burn = useRef<Array<Mesh | null>>([]);

  useFrame(() => {
    const { mother } = world;
    const g = group.current;
    if (!g) return;
    g.visible = mother.visible;
    g.position.set(mother.x, mother.y, -2);
    const split = mother.split;
    if (left.current) {
      left.current.position.set(-split * 2.6, -split * 0.9, 0);
      left.current.rotation.z = split * 0.55;
    }
    if (right.current) {
      right.current.position.set(split * 2.6, -split * 0.5, 0);
      right.current.rotation.z = -split * 0.4;
    }
    turrets.current.forEach((mesh) => {
      if (mesh) (mesh.material as MeshBasicMaterial).opacity = 0.15 + mother.glow * 0.85;
    });
    burn.current.forEach((mesh) => {
      if (mesh) (mesh.material as MeshBasicMaterial).opacity = mother.burn * 0.7;
    });
  });

  const half = (side: -1 | 1, index: number) => (
    <group ref={side === -1 ? left : right}>
      <mesh scale={[3.1, 1.05, 1]}>
        <circleGeometry args={[1, 40, side === -1 ? Math.PI / 2 : -Math.PI / 2, Math.PI]} />
        <meshBasicMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0, 0.5, 0.01]} scale={[1.9, 0.7, 1]}>
        <circleGeometry args={[1, 32, side === -1 ? Math.PI / 2 : -Math.PI / 2, Math.PI]} />
        <meshBasicMaterial color="#374151" />
      </mesh>
      {[0.45, 1.1, 1.75].map((x) => (
        <mesh key={x} position={[side * x, 0.1, 0.02]}>
          <circleGeometry args={[0.09, 8]} />
          <meshBasicMaterial color="#fde68a" />
        </mesh>
      ))}
      <mesh
        ref={(mesh) => {
          burn.current[index] = mesh;
        }}
        position={[0, 0, 0.03]}
        scale={[2.7, 0.85, 1]}
      >
        <circleGeometry args={[1, 24, side === -1 ? Math.PI / 2 : -Math.PI / 2, Math.PI]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0} />
      </mesh>
    </group>
  );

  return (
    <group ref={group}>
      {half(-1, 0)}
      {half(1, 1)}
      {TURRET_OFFSETS.map((x, i) => (
        <group key={x} position={[x, -1.05, 0.04]}>
          <mesh>
            <planeGeometry args={[0.32, 0.4]} />
            <meshBasicMaterial color="#111827" />
          </mesh>
          <mesh
            ref={(mesh) => {
              turrets.current[i] = mesh;
            }}
            position={[0, -0.28, 0.01]}
          >
            <circleGeometry args={[0.2, 12]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.15} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Il raggio del cannone: dalla navicella alla nave madre, con nucleo bianco e alone. */
export function CannonBeam({ world }: WorldProps) {
  const glow = useRef<Mesh>(null);
  const core = useRef<Mesh>(null);

  useFrame(() => {
    const { beam, mother } = world;
    const visible = beam.power > 0.01;
    if (glow.current) glow.current.visible = visible;
    if (core.current) core.current.visible = visible;
    if (!visible) return;
    const from = eveDrawPosition(world);
    const startX = from.x + 1.5;
    const dx = mother.x - startX;
    const dy = mother.y - from.y;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    for (const [mesh, thickness] of [
      [glow.current, beam.width * beam.power],
      [core.current, beam.width * 0.35 * beam.power]
    ] as const) {
      if (!mesh) continue;
      mesh.position.set(startX + dx / 2, from.y + dy / 2, 0.1);
      mesh.rotation.z = angle;
      mesh.scale.set(length, Math.max(0.01, thickness), 1);
    }
  });

  return (
    <group>
      <mesh ref={glow} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.55} />
      </mesh>
      <mesh ref={core} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

const BOLT_POOL = 4;
const RING_POOL = 10;
const PUFF_POOL = 16;

/** Colpi della nave madre, anelli degli impatti/esplosioni, sbuffi di fumo e il bagliore bianco a tutto campo: pool fisse, nessuna allocazione per frame. */
export function SpaceFx({ world }: WorldProps) {
  const bolts = useRef<Array<Mesh | null>>([]);
  const rings = useRef<Array<Mesh | null>>([]);
  const puffs = useRef<Array<Mesh | null>>([]);
  const flash = useRef<Mesh>(null);

  useFrame(() => {
    bolts.current.forEach((mesh, i) => {
      if (!mesh) return;
      const bolt = world.bolts[i];
      mesh.visible = !!bolt;
      if (!bolt) return;
      const u = Math.min(1, bolt.t);
      const x = bolt.fromX + (bolt.toX - bolt.fromX) * u;
      const y = bolt.fromY + (bolt.toY - bolt.fromY) * u;
      mesh.position.set(x, y, 0.15);
      mesh.rotation.z = Math.atan2(bolt.toY - bolt.fromY, bolt.toX - bolt.fromX);
    });
    let ringIndex = 0;
    let puffIndex = 0;
    for (const burst of world.bursts) {
      const pool = burst.kind === 'ring' ? rings.current : puffs.current;
      const mesh = pool[burst.kind === 'ring' ? ringIndex++ : puffIndex++];
      if (!mesh) continue;
      const u = burst.age / burst.life;
      mesh.visible = true;
      mesh.position.set(burst.x, burst.y, 0.2);
      mesh.scale.setScalar(burst.size * (burst.kind === 'ring' ? 0.2 + u : 0.5 + u * 0.8));
      const material = mesh.material as MeshBasicMaterial;
      material.color.set(burst.color);
      material.opacity = (1 - u) * (burst.kind === 'ring' ? 0.9 : 0.55);
    }
    for (; ringIndex < RING_POOL; ringIndex += 1) if (rings.current[ringIndex]) rings.current[ringIndex]!.visible = false;
    for (; puffIndex < PUFF_POOL; puffIndex += 1) if (puffs.current[puffIndex]) puffs.current[puffIndex]!.visible = false;
    if (flash.current) {
      flash.current.visible = world.flash > 0.01;
      (flash.current.material as MeshBasicMaterial).opacity = world.flash;
    }
  });

  return (
    <group>
      {Array.from({ length: BOLT_POOL }, (_, i) => (
        <mesh
          key={`bolt${i}`}
          ref={(mesh) => {
            bolts.current[i] = mesh;
          }}
          visible={false}
        >
          <planeGeometry args={[0.7, 0.16]} />
          <meshBasicMaterial color="#f87171" />
        </mesh>
      ))}
      {Array.from({ length: RING_POOL }, (_, i) => (
        <mesh
          key={`ring${i}`}
          ref={(mesh) => {
            rings.current[i] = mesh;
          }}
          visible={false}
        >
          <ringGeometry args={[0.8, 1, 32]} />
          <meshBasicMaterial color="#ffffff" transparent />
        </mesh>
      ))}
      {Array.from({ length: PUFF_POOL }, (_, i) => (
        <mesh
          key={`puff${i}`}
          ref={(mesh) => {
            puffs.current[i] = mesh;
          }}
          visible={false}
        >
          <circleGeometry args={[0.3, 12]} />
          <meshBasicMaterial color="#475569" transparent />
        </mesh>
      ))}
      <mesh ref={flash} position={[0, 0, 5]} visible={false}>
        <planeGeometry args={[80, 60]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthTest={false} />
      </mesh>
    </group>
  );
}
