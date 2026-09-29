import { useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { CharacterAnimator2D } from '@/game/render2d/CharacterAnimator2D';
import type { PlayerPosition } from './Player2D';
import { GROUND_Y, PLAYER_HEIGHT } from './level1Config';

/** Quanto Eve resta DIETRO D (a sinistra: il livello è lineare, si procede
 *  verso destra — vedi docs/PIANO_LIVELLO1_2D.md). */
const FOLLOW_DISTANCE = 1.6;
/** Smorzamento dell'inseguimento: più lento della camera (0.12 in
 *  `useFollowCameraX`), apposta — Eve deve sentirsi "un passo indietro",
 *  non incollata a D. */
const FOLLOW_SMOOTHING = 0.06;
/** Sotto questo spostamento per fotogramma, Eve è considerata ferma: senza
 *  soglia il lerp non arriva mai esattamente a 0 e resterebbe "in cammino"
 *  all'infinito (decadimento esponenziale, non un valore che si azzera). */
const MOVEMENT_EPSILON = 0.01;

interface EveCompanionProps {
  /** Stessa `positionRef` di `Player2D`: letta, mai scritta. */
  targetPositionRef: MutableRefObject<PlayerPosition>;
}

/**
 * IA di compagnia di Eve (Fase 4 del piano): segui-dietro con un offset
 * smorzato verso una posizione dietro D — niente pathfinding, il livello è
 * lineare (vedi docs/PIANO_LIVELLO1_2D.md). Nessuna fisica: stessa
 * integrazione manuale in `useFrame` di `Player2D`/`useFollowCameraX`.
 */
export function EveCompanion({ targetPositionRef }: EveCompanionProps) {
  const group = useRef<Group>(null);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [walking, setWalking] = useState(false);

  useFrame(() => {
    if (!group.current) return;

    const targetX = targetPositionRef.current.x - FOLLOW_DISTANCE;
    const previousX = group.current.position.x;
    group.current.position.x = previousX + (targetX - previousX) * FOLLOW_SMOOTHING;
    group.current.position.y = GROUND_Y;

    const deltaX = group.current.position.x - previousX;
    const moving = Math.abs(deltaX) > MOVEMENT_EPSILON;
    if (moving) {
      const newFacing = deltaX > 0 ? 1 : -1;
      if (newFacing !== facing) setFacing(newFacing);
    }
    // setState con lo stesso valore è un no-op economico (stesso pattern di
    // Player2D), niente bisogno di tracciare "è cambiato?" a parte.
    setWalking(moving);
  });

  return (
    <group ref={group} position={[targetPositionRef.current.x - FOLLOW_DISTANCE, GROUND_Y, 0]}>
      <CharacterAnimator2D
        variant="Eve"
        state={walking ? 'walk' : 'idle'}
        facing={facing}
        height={PLAYER_HEIGHT}
      />
    </group>
  );
}
