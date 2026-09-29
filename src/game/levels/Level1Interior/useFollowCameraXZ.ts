import { useFrame, useThree } from '@react-three/fiber';

interface UseFollowCameraXZOptions {
  /** Distanza camera-bersaglio lungo la direzione elevazione/azimuth. */
  distance: number;
  /** Rotazione attorno a Y (0 = dietro sull'asse -Z). */
  azimuth: number;
  /** Inclinazione sul piano orizzontale. */
  elevation: number;
  /** 0 = insegue istantaneamente, verso 1 = molto morbido. */
  smoothing?: number;
}

/**
 * Variante a due assi di `useFollowCameraX` (render2d/): qui il bersaglio si
 * muove su X *e* Z (pavimento dell'interno isometrico, non solo scorrimento
 * laterale), e la camera stessa non sta ferma su un piano ma a un offset
 * sferico fisso (distanza/elevazione/azimuth) dal bersaglio — stesso
 * principio "un oggetto ha un solo padrone": nessun altro regista tocca la
 * camera in questo modo, quindi può scriverci sopra direttamente.
 */
export function useFollowCameraXZ(
  getTarget: () => { x: number; z: number },
  { distance, azimuth, elevation, smoothing = 0.15 }: UseFollowCameraXZOptions
) {
  const camera = useThree((state) => state.camera);

  const offsetX = distance * Math.cos(elevation) * Math.sin(azimuth);
  const offsetY = distance * Math.sin(elevation);
  const offsetZ = distance * Math.cos(elevation) * Math.cos(azimuth);

  useFrame(() => {
    const target = getTarget();
    const desiredX = target.x + offsetX;
    const desiredZ = target.z + offsetZ;
    camera.position.x += (desiredX - camera.position.x) * smoothing;
    camera.position.z += (desiredZ - camera.position.z) * smoothing;
    camera.position.y = offsetY;
    camera.lookAt(target.x, 0, target.z);
  });
}
