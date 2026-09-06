import { useGLTF } from '@react-three/drei';
import type { ObjectMap } from '@react-three/fiber';
import type { GLTF } from 'three-stdlib';

/** Capsula stile "Stellar Blade" per la sequenza d'ingresso al livello:
 * `Capsule_Root` porta l'action `Capsule_Descent` (discesa + schiacciamento
 * elastico all'impatto), più `Shockwave_Pulse` e `ImpactDust_*_Puff` sugli
 * oggetti a terra — vedi `assets/blender/capsula_stellar.blend`. Le tre
 * famiglie di action sono fatte partire separatamente dal codice (vedi
 * `CapsuleSequence.tsx`), non contando sul tempo assoluto dei singoli clip
 * esportati per restare sincronizzate tra loro. */
export const CAPSULE_STELLAR_MODEL_URL = `${import.meta.env.BASE_URL}models/capsula-stellar.glb`;

useGLTF.preload(CAPSULE_STELLAR_MODEL_URL);

export function useCapsulaStellarGltf(): GLTF & ObjectMap {
  return useGLTF(CAPSULE_STELLAR_MODEL_URL);
}
