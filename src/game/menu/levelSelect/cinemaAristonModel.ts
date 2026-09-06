import { useGLTF } from '@react-three/drei';
import type { ObjectMap } from '@react-three/fiber';
import type { GLTF } from 'three-stdlib';

/** Modello Blender del Cinema Ariston (edificio statico, nessuno scheletro),
 * con due action a livello di oggetto: `Grow_Landing` (crescita dal suolo
 * con rimbalzo elastico) su `CinemaAriston_Root`, più `Shockwave_Pulse` e
 * `Dust_Puff_*_Drift` per l'onda d'urto/polvere all'assestamento — vedi
 * `assets/blender/cinema_ariston.blend` per il sorgente. */
export const CINEMA_ARISTON_MODEL_URL = `${import.meta.env.BASE_URL}models/cinema-ariston.glb`;

useGLTF.preload(CINEMA_ARISTON_MODEL_URL);

export function useCinemaAristonGltf(): GLTF & ObjectMap {
  return useGLTF(CINEMA_ARISTON_MODEL_URL);
}
