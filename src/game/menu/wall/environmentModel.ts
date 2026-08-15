import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { ObjectMap } from '@react-three/fiber';
import { Mesh, Vector3, type BufferGeometry, type Material } from 'three';
import type { GLTF } from 'three-stdlib';
import { MODEL_URL } from './wallConfig';

/**
 * Prefissi dei nomi mesh in Blender per tutti i pezzi POTENZIALMENTE
 * rompibili: ante e telaio del portone, pannelli del muro, contrafforti.
 * "Potenzialmente" perché non tutti diventano fisici a ogni rottura — vedi
 * `AFFECT_RADIUS` in `wallConfig.ts` e il filtro in `WallShatter.tsx`: solo i
 * pezzi vicini all'origine dell'impatto prendono vita, il resto del muro
 * (anche se geometricamente già frantumato in Blender) resta scenografia
 * statica. `WallFiller_*`, l'estensione decorativa ai margini della scena,
 * resta apposta fuori da questa lista: non è mai rompibile.
 */
export const SHARD_PREFIXES = ['Gate_Door_', 'Gate_LowerBlock', 'WallPanel_', 'Buttress_'];

/** Nome-prefisso vero: true se la mesh è uno dei pezzi frantumati sopra. */
export function isShardMeshName(name: string): boolean {
  return SHARD_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/**
 * Prefisso delle "coperture solide": una copia intera, senza crepe, di ogni
 * pezzo frantumato (ante, bande, telaio sopra al portone, pannelli,
 * contrafforti). Il muro intatto (`Wall.tsx`) mostra queste al posto dei
 * frammenti — altrimenti le crepe di Cell Fracture si vedrebbero già a muro
 * fermo, prima di qualunque rottura. `WallShatter.tsx` fa l'esatto contrario:
 * nasconde sempre le coperture solide e mostra i frammenti (fissi o fisici).
 */
export const SOLID_COVER_PREFIX = 'Solid_';

export interface WallChunk {
  index: number;
  /** Nome della mesh in Blender: serve a nascondere il pezzo giusto nella scena statica. */
  name: string;
  /** Rango per altezza crescente (0 = pezzo più in basso): usato da `collapse`. */
  row: number;
  /** Centro del pezzo in coordinate mondo (Three). */
  position: [number, number, number];
  geometry: BufferGeometry;
  material: Material | Material[];
  /** Variazione 0..1, deterministica: vedi nota su `hashNoise`. */
  shade: number;
}

/**
 * Rumore pseudo-casuale ma DETERMINISTICO a partire da un indice.
 *
 * Serve solo a variare torque/nudge tra un pezzo e l'altro (i colori sono
 * già dipinti nei materiali esportati da Blender, qui non c'entrano).
 */
function hashNoise(index: number): number {
  const x = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

useGLTF.preload(MODEL_URL);

/** Carica l'ambientazione completa (strada, cartello, case, muro, portone). */
export function useEnvironmentGltf(): GLTF & ObjectMap {
  return useGLTF(MODEL_URL);
}

/**
 * Estrae TUTTI i pezzi rompibili (portone + pannelli + contrafforti) dalla
 * scena caricata. Chi tra questi diventa effettivamente fisico in una
 * rottura specifica lo decide `WallShatter` filtrando per distanza
 * dall'origine — qui si limita a raccogliere il catalogo completo.
 *
 * `getWorldPosition`, non `.position`: le mesh possono essere annidate dentro
 * gruppi nell'export glTF e la posizione locale non basterebbe.
 */
export function useBreakableShards(): WallChunk[] {
  const { scene } = useEnvironmentGltf();

  return useMemo(() => {
    const worldPos = new Vector3();
    const found: { mesh: Mesh; position: [number, number, number] }[] = [];

    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if (!isShardMeshName(object.name)) return;
      object.getWorldPosition(worldPos);
      found.push({ mesh: object, position: [worldPos.x, worldPos.y, worldPos.z] });
    });

    const rowOf = new Map<Mesh, number>(
      [...found]
        .sort((a, b) => a.position[1] - b.position[1])
        .map((entry, rank) => [entry.mesh, rank])
    );

    return found.map((entry, index) => ({
      index,
      name: entry.mesh.name,
      row: rowOf.get(entry.mesh) ?? 0,
      position: entry.position,
      geometry: entry.mesh.geometry,
      material: entry.mesh.material,
      shade: hashNoise(index)
    }));
  }, [scene]);
}
