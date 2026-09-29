import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useLevelGeometry } from './ldtk/useLevelGeometry';
import type { GridCell } from './ldtk/parseLevelGeometry';
import { InteriorProps } from './InteriorProps';
import {
  FLOOR_TEXTURE_URL,
  WALL_COLOR_LOWER,
  WALL_COLOR_UPPER,
  WALL_HEIGHT_LOWER,
  WALL_HEIGHT_UPPER,
  WORLD_UNIT_PER_CELL
} from './interiorConfig';

export interface InteriorLevelGeometryProps {
  /** Identificatore del `Level` LDtk da renderizzare (es. "Piano_terra"). */
  levelIdentifier: string;
}

/**
 * Scrive le matrici di un `InstancedMesh` una sola volta al mount/cambio
 * celle — le celle di un livello LDtk sono fisse, non c'è nulla da animare
 * qui (a differenza dei detriti del muro del menu, che sono fisici).
 *
 * La rotazione (se serve, es. per sdraiare un piano) va passata qui e
 * "cotta" nella matrice di OGNI istanza, mai messa sul `rotation` del
 * `<instancedMesh>` stesso: quella dell'oggetto si comporrebbe PRIMA della
 * traslazione per-istanza, ruotando anche le posizioni già calcolate in
 * world space (bug reale scovato a schermo: il pavimento finiva "in piedi",
 * proiettato lungo Y invece che disteso su X/Z).
 */
function useCellInstances(
  meshRef: RefObject<THREE.InstancedMesh>,
  cells: GridCell[],
  y: number,
  rotationX = 0
): void {
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4().makeRotationX(rotationX);
    cells.forEach((cell, index) => {
      matrix.setPosition(
        (cell.col + 0.5) * WORLD_UNIT_PER_CELL,
        y,
        (cell.row + 0.5) * WORLD_UNIT_PER_CELL
      );
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [meshRef, cells, y, rotationX]);
}

/**
 * Muri e pavimento generati da codice a partire dal layer IntGrid `Walls` di
 * un Level LDtk (vedi docs/FASE5_INTERNO_ISOMETRICO.md) — nessun modello
 * Blender, si itera e si rivede in secondi ogni volta che la piantina
 * cambia. Non possiede la camera né le luci di scena: quelle sono compito di
 * chi monta questo componente (stesso principio "un oggetto ha un padrone").
 */
export function InteriorLevelGeometry({ levelIdentifier }: InteriorLevelGeometryProps) {
  const geometry = useLevelGeometry(levelIdentifier);

  const floorTexture = useTexture(FLOOR_TEXTURE_URL);

  const floorRef = useRef<THREE.InstancedMesh>(null);
  const wallLowerRef = useRef<THREE.InstancedMesh>(null);
  const wallUpperRef = useRef<THREE.InstancedMesh>(null);

  useCellInstances(floorRef, geometry.floorCells, 0, -Math.PI / 2);
  useCellInstances(wallLowerRef, geometry.wallCells, WALL_HEIGHT_LOWER / 2);
  useCellInstances(wallUpperRef, geometry.wallCells, WALL_HEIGHT_LOWER + WALL_HEIGHT_UPPER / 2);

  return (
    <group>
      <instancedMesh ref={floorRef} args={[undefined, undefined, geometry.floorCells.length]}>
        <planeGeometry args={[WORLD_UNIT_PER_CELL, WORLD_UNIT_PER_CELL]} />
        <meshBasicMaterial map={floorTexture} />
      </instancedMesh>

      <instancedMesh ref={wallLowerRef} args={[undefined, undefined, geometry.wallCells.length]}>
        <boxGeometry args={[WORLD_UNIT_PER_CELL, WALL_HEIGHT_LOWER, WORLD_UNIT_PER_CELL]} />
        <meshStandardMaterial color={WALL_COLOR_LOWER} />
      </instancedMesh>

      <instancedMesh ref={wallUpperRef} args={[undefined, undefined, geometry.wallCells.length]}>
        <boxGeometry args={[WORLD_UNIT_PER_CELL, WALL_HEIGHT_UPPER, WORLD_UNIT_PER_CELL]} />
        <meshStandardMaterial color={WALL_COLOR_UPPER} />
      </instancedMesh>

      <InteriorProps props={geometry.props} />
    </group>
  );
}
