import { useGLTF } from '@react-three/drei';
import type { ObjectMap } from '@react-three/fiber';
import type { GLTF } from 'three-stdlib';
import { BASE_MODEL_URL, JAB_MODEL_URL } from './characterConfig';

useGLTF.preload(BASE_MODEL_URL);
useGLTF.preload(JAB_MODEL_URL);

type CharacterGltf = GLTF & ObjectMap;

/** Personaggio, bind pose, faccia "scema": recitazione iniziale. */
export function useBaseCharacter(): CharacterGltf {
  return useGLTF(BASE_MODEL_URL);
}

/** Personaggio, bind pose, faccia "seria": dallo scatto verso il muro in poi. */
export function useJabCharacter(): CharacterGltf {
  return useGLTF(JAB_MODEL_URL);
}
