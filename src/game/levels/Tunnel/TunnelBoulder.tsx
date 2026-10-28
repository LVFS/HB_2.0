import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { BOULDER } from './tunnelConfig';
import type { TunnelWorld } from './tunnelState';

const SPOKES = [0, 1, 2, 3];
/** Pezzi di polvere dietro il masso: quanti e quanto stanno distanti l'uno dall'altro. */
const DUST = [0, 1, 2, 3, 4];

/**
 * Il masso dell'evento B: una palla d'acciaio che rotola alle spalle di D
 * (Indiana Jones, ma con le borchie). Solo resa — `world.boulder` dice se è in
 * scena, a che distanza e quanto è ruotato. Segnaposto a tinte unite.
 */
export function TunnelBoulder({ world }: { world: TunnelWorld }) {
  const group = useRef<Group>(null);
  const spinner = useRef<Group>(null);
  const dust = useRef<(Mesh | null)[]>([]);
  const dustMats = useRef<(MeshBasicMaterial | null)[]>([]);
  const time = useRef(0);

  useFrame((_, rawDelta) => {
    const g = group.current;
    if (!g) return;
    const { boulder, arena } = world;
    g.visible = boulder.active;
    if (!boulder.active) return;
    if (arena.hitStop > 0) return;
    time.current += Math.min(rawDelta, 0.05);
    // Sobbalza leggermente: pesa tonnellate ma rimbalza sulle crepe del pavimento.
    g.position.set(arena.player.x - boulder.dist, BOULDER.radius + Math.abs(Math.sin(time.current * 9)) * 0.06, 0.2);
    if (spinner.current) spinner.current.rotation.z = -boulder.spin;
    DUST.forEach((i) => {
      const mesh = dust.current[i];
      const mat = dustMats.current[i];
      if (!mesh || !mat) return;
      // Nuvolette di polvere che salgono e si disperdono dietro il masso.
      const u = (time.current * 1.6 + i * 0.2) % 1;
      mesh.position.set(-BOULDER.radius - u * 2.4, -BOULDER.radius + 0.3 + u * 0.9 + (i % 2) * 0.2, 0.1);
      mesh.scale.setScalar(0.3 + u * 0.7);
      mat.opacity = 0.55 * (1 - u);
    });
  });

  return (
    <group ref={group} visible={false}>
      <group ref={spinner}>
        <mesh>
          <circleGeometry args={[BOULDER.radius, 32]} />
          <meshBasicMaterial color="#5b6472" />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <ringGeometry args={[BOULDER.radius * 0.82, BOULDER.radius, 32]} />
          <meshBasicMaterial color="#2b303a" />
        </mesh>
        {SPOKES.map((i) => (
          <mesh key={i} position={[0, 0, 0.02]} rotation={[0, 0, (i * Math.PI) / 4]}>
            <planeGeometry args={[BOULDER.radius * 1.9, 0.14]} />
            <meshBasicMaterial color="#8a93a3" />
          </mesh>
        ))}
        {/* Borchie ai bordi. */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={i} position={[Math.cos((i * Math.PI) / 3) * BOULDER.radius * 0.9, Math.sin((i * Math.PI) / 3) * BOULDER.radius * 0.9, 0.03]}>
            <circleGeometry args={[0.14, 10]} />
            <meshBasicMaterial color="#cbd5e1" />
          </mesh>
        ))}
      </group>
      {DUST.map((i) => (
        <mesh key={i} ref={(el) => { dust.current[i] = el; }}>
          <circleGeometry args={[1, 14]} />
          <meshBasicMaterial ref={(el) => { dustMats.current[i] = el; }} color="#9ca3af" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
