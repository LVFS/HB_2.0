import { useEffect, useRef } from 'react';
import type { InstancedMesh } from 'three';
import { wallChunks } from './buildWallChunks';
import { applyChunkInstances } from './chunkInstances';
import { CHUNK_COUNT } from './wallConfig';

/**
 * Il muro INTATTO: nessuna fisica, nessun corpo rigido, una sola draw call.
 *
 * Tenere separato il muro fermo da quello che esplode non è pignoleria:
 * significa che il menu non ha bisogno di Rapier per essere disegnato, e
 * Rapier pesa circa 2 MB. Finché non premi "Gioca", quel codice non viene
 * nemmeno scaricato.
 */
export function Wall() {
  const meshRef = useRef<InstancedMesh>(null);

  useEffect(() => {
    if (meshRef.current) applyChunkInstances(meshRef.current, wallChunks);
  }, []);

  const [chunkW, chunkH, chunkD] = wallChunks[0].size;

  return (
    <instancedMesh
      ref={meshRef}
      // I primi due argomenti sono geometria e materiale: qui sono `undefined`
      // perché li forniamo come figli JSX, e React Three Fiber li assegna dopo
      // la costruzione. Il `!` serve solo a convincere TypeScript.
      args={[undefined!, undefined!, CHUNK_COUNT]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[chunkW, chunkH, chunkD]} />
      <meshStandardMaterial roughness={0.95} metalness={0} />
    </instancedMesh>
  );
}
