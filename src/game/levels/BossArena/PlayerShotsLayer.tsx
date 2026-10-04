import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, MeshBasicMaterial } from 'three';
import type { ArenaWorld } from './arenaState';
import { ARENA_PLAYER_HEIGHT, GUN_HEIGHT } from './arenaConfig';
import { updateShots } from './playerShots';

const MAX_TRACERS = 4;
const MAX_WAVES = 4;
const MAX_RINGS = 8;
const SLOTS_TRACERS = Array.from({ length: MAX_TRACERS }, (_, i) => i);
const SLOTS_WAVES = Array.from({ length: MAX_WAVES }, (_, i) => i);
const SLOTS_RINGS = Array.from({ length: MAX_RINGS }, (_, i) => i);

/**
 * Colpi a distanza del potenziamento Bloodborne e relativi effetti: logica
 * (`updateShots`) e resa nello stesso posto, a pool di mesh fisse come
 * `ArenaThreats`. Disegna anche gli oggetti d'equipaggiamento segnaposto (la
 * pistola, l'asta e la lama della carica) e l'alone del berserk — da sostituire
 * con gli asset veri.
 */
export function PlayerShotsLayer({ world }: { world: ArenaWorld }) {
  const tracerMeshes = useRef<(Mesh | null)[]>([]);
  const waveMeshes = useRef<(Mesh | null)[]>([]);
  const waveMats = useRef<(MeshBasicMaterial | null)[]>([]);
  const ringMeshes = useRef<(Mesh | null)[]>([]);
  const ringMats = useRef<(MeshBasicMaterial | null)[]>([]);
  const gunMesh = useRef<Mesh>(null);
  const auraMesh = useRef<Mesh>(null);
  const auraMat = useRef<MeshBasicMaterial>(null);
  const staffMesh = useRef<Mesh>(null);
  const bladeMesh = useRef<Mesh>(null);
  const time = useRef(0);

  useFrame((_, rawDelta) => {
    if (world.hitStop > 0 || world.over) return;
    const delta = Math.min(rawDelta, 0.05);
    time.current += delta;
    const player = world.player;

    updateShots(world, delta);
    for (let i = world.fx.length - 1; i >= 0; i -= 1) {
      world.fx[i].life -= delta;
      if (world.fx[i].life <= 0) world.fx.splice(i, 1);
    }

    // --- resa: tracce della pistola ---
    SLOTS_TRACERS.forEach((slot) => {
      const mesh = tracerMeshes.current[slot];
      if (!mesh) return;
      const shot = world.shots.filter((s) => s.kind === 'tracer')[slot];
      mesh.visible = shot !== undefined;
      if (!shot || shot.x2 === undefined) return;
      mesh.position.set((shot.x + shot.x2) / 2, shot.y, 0.35);
      mesh.scale.set(Math.abs(shot.x2 - shot.x), 1, 1);
    });

    // --- onde (fendente celeste e onda d'urto) ---
    SLOTS_WAVES.forEach((slot) => {
      const mesh = waveMeshes.current[slot];
      const mat = waveMats.current[slot];
      if (!mesh || !mat) return;
      const shot = world.shots.filter((s) => s.kind !== 'tracer')[slot];
      mesh.visible = shot !== undefined;
      if (!shot) return;
      const shock = shot.kind === 'shock';
      mesh.position.set(shot.x, shot.y, 0.35);
      mesh.scale.set(shock ? 1.6 : 1, shock ? 2.6 : 1.5, 1);
      mat.color.set(shock ? '#ef4444' : '#7dd3fc');
      mat.opacity = 0.75 + 0.2 * Math.sin(time.current * 40);
    });

    // --- cerchi che si espandono ---
    SLOTS_RINGS.forEach((slot) => {
      const mesh = ringMeshes.current[slot];
      const mat = ringMats.current[slot];
      if (!mesh || !mat) return;
      const fx = world.fx[slot];
      mesh.visible = fx !== undefined;
      if (!fx) return;
      const u = 1 - fx.life / fx.lifeMax;
      mesh.position.set(fx.x, fx.y, 0.3);
      mesh.scale.set(fx.radius * u, fx.radius * u * 0.6, 1);
      mat.color.set(fx.color);
      mat.opacity = 0.9 * (1 - u);
    });

    // --- equipaggiamento segnaposto ---
    const bloodborne = world.powerUp === 'bloodborne';
    const finisher = world.finisher;
    if (gunMesh.current) {
      gunMesh.current.visible = bloodborne && !finisher;
      gunMesh.current.position.set(player.x + player.facing * 0.5, player.y + GUN_HEIGHT, 0.2);
    }
    if (auraMesh.current && auraMat.current) {
      auraMesh.current.visible = player.berserk;
      auraMesh.current.position.set(player.x, player.y + ARENA_PLAYER_HEIGHT / 2, -0.05);
      auraMat.current.opacity = 0.22 + 0.1 * Math.sin(time.current * 14);
    }
    if (staffMesh.current && bladeMesh.current) {
      staffMesh.current.visible = bladeMesh.current.visible = finisher !== null;
      if (finisher) {
        const side = finisher.dir;
        const swing =
          finisher.phase === 'launch'
            ? -0.9 + (finisher.t / 0.3) * 1.8
            : finisher.phase === 'slam'
              ? 0.9 - (finisher.t / 0.16) * 1.4
              : 0.2;
        staffMesh.current.position.set(finisher.playerX + side * 0.55, finisher.playerY + 1.1, 0.25);
        staffMesh.current.rotation.z = -side * swing;
        // La lama sulla cima dell'asta: assemblata in falce da "hang" in poi.
        const scythe = finisher.phase === 'hang' || finisher.phase === 'slam' || finisher.phase === 'recover';
        bladeMesh.current.position.set(
          staffMesh.current.position.x + Math.sin(side * swing) * 1.15,
          staffMesh.current.position.y + Math.cos(swing) * 1.15,
          0.3
        );
        bladeMesh.current.rotation.z = -side * swing + (scythe ? side * 1.1 : 0);
        bladeMesh.current.scale.set(scythe ? 1.6 : 1, 1, 1);
      }
    }
  });

  return (
    <>
      {SLOTS_TRACERS.map((slot) => (
        <mesh key={`tracer-${slot}`} ref={(el) => (tracerMeshes.current[slot] = el)} visible={false}>
          <planeGeometry args={[1, 0.07]} />
          <meshBasicMaterial color="#fff6c8" />
        </mesh>
      ))}
      {SLOTS_WAVES.map((slot) => (
        <mesh key={`wave-${slot}`} ref={(el) => (waveMeshes.current[slot] = el)} visible={false}>
          <planeGeometry args={[0.35, 1]} />
          <meshBasicMaterial ref={(el) => (waveMats.current[slot] = el)} color="#7dd3fc" transparent opacity={0.8} />
        </mesh>
      ))}
      {SLOTS_RINGS.map((slot) => (
        <mesh key={`ring-${slot}`} ref={(el) => (ringMeshes.current[slot] = el)} visible={false}>
          <ringGeometry args={[0.9, 1, 40]} />
          <meshBasicMaterial ref={(el) => (ringMats.current[slot] = el)} color="#ffffff" transparent opacity={0.8} />
        </mesh>
      ))}
      {/* Pistola segnaposto, sempre in mano nel potenziamento Bloodborne. */}
      <mesh ref={gunMesh} visible={false}>
        <planeGeometry args={[0.5, 0.14]} />
        <meshBasicMaterial color="#27272a" />
      </mesh>
      {/* Alone rosso del berserk. */}
      <mesh ref={auraMesh} visible={false}>
        <planeGeometry args={[1.6, 2.5]} />
        <meshBasicMaterial ref={auraMat} color="#ef4444" transparent opacity={0.25} />
      </mesh>
      {/* Asta e lama della carica (segnaposto): la lama si fa falce a metà sequenza. */}
      <mesh ref={staffMesh} visible={false}>
        <planeGeometry args={[0.1, 2.3]} />
        <meshBasicMaterial color="#3f3f46" />
      </mesh>
      <mesh ref={bladeMesh} visible={false}>
        <planeGeometry args={[0.9, 0.16]} />
        <meshBasicMaterial color="#7dd3fc" />
      </mesh>
    </>
  );
}
