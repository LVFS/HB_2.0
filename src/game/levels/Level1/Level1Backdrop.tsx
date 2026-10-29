import { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { NearestFilter } from 'three';
import { BACKDROP_BOTTOM_Y, BACKDROP_HEIGHT, BACKDROP_WIDTH } from './level1Config';

const BACKDROP_URL = `${import.meta.env.BASE_URL}sprites/backgrounds/ariston_ingresso.webp`;
/** Dietro a tutto (personaggi z=0, navicella z=-0.5). */
const BACKDROP_Z = -5;

/**
 * Lo sfondo dell'esterno: UNA immagine statica (la strada dell'Ariston, dai garage all'incrocio), ferma nel mondo — il «parallasse» è la
 * camera che scorre. Pixel art: `NearestFilter`, niente mipmap. Il bordo sinistro è X = 0; il bordo inferiore sta a `BACKDROP_BOTTOM_Y`
 * così il marciapiede combacia con `GROUND_Y`.
 */
export function Level1Backdrop() {
  const base = useTexture(BACKDROP_URL);
  const texture = useMemo(() => {
    const clone = base.clone();
    clone.magFilter = NearestFilter;
    clone.minFilter = NearestFilter;
    clone.generateMipmaps = false;
    clone.needsUpdate = true;
    return clone;
  }, [base]);

  return (
    <mesh position={[BACKDROP_WIDTH / 2, BACKDROP_BOTTOM_Y + BACKDROP_HEIGHT / 2, BACKDROP_Z]}>
      <planeGeometry args={[BACKDROP_WIDTH, BACKDROP_HEIGHT]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}
