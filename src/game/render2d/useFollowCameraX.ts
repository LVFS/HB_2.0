import { useFrame, useThree } from '@react-three/fiber';

interface UseFollowCameraXOptions {
  /** Quota Y fissa della camera (non insegue il bersaglio in verticale). */
  offsetY?: number;
  /** Quota Z fissa della camera, se va impostata qui invece che a monte. */
  z?: number;
  /** 0 = insegue istantaneamente, verso 1 = molto morbido. */
  smoothing?: number;
}

/**
 * Fa inseguire alla camera attiva la coordinata X di un bersaglio (il
 * giocatore, in genere) con uno smorzamento lineare — stesso principio del
 * `useFrame` che ricostruisce `camera.position` nel menu (vedi CLAUDE.md,
 * "un oggetto ha un solo padrone"): qui la camera non ha un altro regista,
 * quindi può scriverci sopra direttamente, niente offset da sommare.
 *
 * `getTargetX` è una funzione e non un numero perché il bersaglio vive in
 * un ref aggiornato ad ogni frame (mai uno state React per un valore che
 * cambia 60 volte al secondo).
 */
export function useFollowCameraX(
  getTargetX: () => number,
  { offsetY, z, smoothing = 0.15 }: UseFollowCameraXOptions = {}
) {
  const camera = useThree((state) => state.camera);

  useFrame(() => {
    const targetX = getTargetX();
    camera.position.x += (targetX - camera.position.x) * smoothing;
    if (offsetY !== undefined) camera.position.y = offsetY;
    if (z !== undefined) camera.position.z = z;
  });
}
