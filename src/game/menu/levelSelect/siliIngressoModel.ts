import { useGLTF } from '@react-three/drei';
import type { ObjectMap } from '@react-three/fiber';
import type { GLTF } from 'three-stdlib';

/** Modello Blender dello scorcio d'ingresso a Silì (fila di case, cancello,
 * garage, marciapiede — non un singolo edificio come il Cinema Ariston, uno
 * scorcio di strada intero, ~36×26×7.4 unità reali) — mesh statiche, nessuna
 * animazione. Vedi `assets/blender/sili_ingresso.blend` per il sorgente. */
export const SILI_INGRESSO_MODEL_URL = `${import.meta.env.BASE_URL}models/sili-ingresso.glb`;

useGLTF.preload(SILI_INGRESSO_MODEL_URL);

export function useSiliIngressoGltf(): GLTF & ObjectMap {
  return useGLTF(SILI_INGRESSO_MODEL_URL);
}
