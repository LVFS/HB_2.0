import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Mesh } from 'three';

export interface ParallaxLayerProps {
  /** 0 = fondale lontano, quasi immobile rispetto alla camera. 1 = si
   *  muove esattamente come il primo piano (nessun parallasse). */
  factor: number;
  /** Profondità Z del layer (più negativo = più lontano dalla camera). */
  z: number;
  width: number;
  height: number;
  y?: number;
  color?: string;
}

/**
 * Layer di sfondo a scorrimento parallasse (vedi docs/PIANO_LIVELLO1_2D.md,
 * Fase 1). Segue la posizione X della camera moltiplicata per `factor`,
 * letta direttamente da `useThree` in `useFrame` — niente prop che cambia
 * ogni fotogramma da un genitore (che costringerebbe a uno state React a
 * 60fps): la camera stessa è già la fonte di verità del parallasse.
 *
 * Oggi è un piano a tinta unita (segnaposto, vedi Fase 5 del piano): quando
 * arriverà il concept art della strada Ariston ritagliato in layer, questo
 * componente va esteso con una texture (`useTexture`), non riscritto.
 */
export function ParallaxLayer({ factor, z, width, height, y = 0, color = '#1e293b' }: ParallaxLayerProps) {
  const mesh = useRef<Mesh>(null);
  const camera = useThree((state) => state.camera);

  useFrame(() => {
    if (!mesh.current) return;
    mesh.current.position.x = camera.position.x * factor;
  });

  return (
    <mesh ref={mesh} position={[camera.position.x * factor, y, z]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}
