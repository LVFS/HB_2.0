import type { MutableRefObject } from 'react';
import type { MeshBasicMaterial } from 'three';
import { Sprite2D } from './Sprite2D';
import { getCharacterSpriteUrl } from './characterSprites';
import type { CharacterPose, CharacterVariant } from './characterSprites';
import { CHARACTER_DEFAULT_HEIGHT } from './characterAnimConfig';

export interface Character2DProps {
  variant: CharacterVariant;
  pose: CharacterPose;
  /** 1 = rivolto a destra, -1 = rivolto a sinistra (specchiato via scale). */
  facing: 1 | -1;
  height?: number;
  /** Quota dei PIEDI, stessa convenzione di `Player2D`. */
  position?: [number, number, number];
  materialRef?: MutableRefObject<MeshBasicMaterial | null>;
}

/**
 * Personaggio "cutout" a swap di pose intere (Fase 3a del piano, vedi
 * docs/PIANO_LIVELLO1_2D.md): le 4 pose per variante (`D0`/`D1`/`Eve`) sono
 * illustrazioni composite ritagliate dalle turnaround sheet, non un rig a
 * pezzi separati (torso/braccio/gamba indipendenti) — quello richiederebbe
 * arte prodotta a pezzi isolati, non estraibile da queste (vedi il piano,
 * Fase 3b). Riusabile sia per `D0`/`D1` sia per `Eve`, stesso componente.
 */
export function Character2D({
  variant,
  pose,
  facing,
  height = CHARACTER_DEFAULT_HEIGHT,
  position = [0, 0, 0],
  materialRef
}: Character2DProps) {
  return (
    <group position={position}>
      {/* Il piano è alzato di metà altezza: `position` (i piedi) resta la
          quota calpestabile, senza compensare l'offset visivo a monte. */}
      <Sprite2D
        textureUrl={getCharacterSpriteUrl(variant, pose)}
        height={height}
        flipX={facing < 0}
        position={[0, height / 2, 0]}
        materialRef={materialRef}
      />
    </group>
  );
}
