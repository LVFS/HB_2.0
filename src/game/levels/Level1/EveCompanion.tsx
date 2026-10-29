import { useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { CharacterAnimator2D } from '@/game/render2d/CharacterAnimator2D';
import type { PlayerPosition } from './Player2D';
import { GROUND_Y, PLAYER_HEIGHT, SIDEWALK_MAX_X, SIDEWALK_MIN_X } from './level1Config';

/** Quanto Eve resta DIETRO D, cioè dalla parte opposta a quella in cui D sta andando. */
const FOLLOW_DISTANCE = 1.3;
/** Smorzamento dell'inseguimento: più lento della camera (0.12 in
 *  `useFollowCameraX`), apposta — Eve deve sentirsi "un passo indietro",
 *  non incollata a D. */
const FOLLOW_SMOOTHING = 0.06;
/** Sotto questo spostamento per fotogramma, Eve è considerata ferma: senza
 *  soglia il lerp non arriva mai esattamente a 0 e resterebbe "in cammino"
 *  all'infinito (decadimento esponenziale, non un valore che si azzera). */
const MOVEMENT_EPSILON = 0.01;
/** Quanto deve camminare D in una nuova direzione prima che Eve passi dall'altra parte: un'esitazione di un passo non la fa girare. */
const SIDE_SWITCH_DISTANCE = 0.8;

interface EveCompanionProps {
  /** Stessa `positionRef` di `Player2D`: letta, mai scritta. */
  targetPositionRef: MutableRefObject<PlayerPosition>;
  /** Dove compare (di default dietro a D). */
  initialX?: number;
  /** Verso in cui D sta andando/guarda all'inizio (-1 = sinistra: Eve sta alla sua destra). */
  initialDirection?: 1 | -1;
}

/**
 * IA di compagnia di Eve (Fase 4 del piano): segui-dietro con un offset
 * smorzato — niente pathfinding, il livello è lineare (vedi
 * docs/PIANO_LIVELLO1_2D.md). Nessuna fisica: stessa integrazione manuale in
 * `useFrame` di `Player2D`/`useFollowCameraX`. Fuori dall'Ariston si cammina nei due versi (la porta sta a sinistra della partenza):
 * «dietro» è rispetto alla direzione in cui D sta andando, non sempre a sinistra.
 */
export function EveCompanion({ targetPositionRef, initialX, initialDirection = 1 }: EveCompanionProps) {
  const group = useRef<Group>(null);
  const direction = useRef<1 | -1>(initialDirection);
  const lastPlayerX = useRef(targetPositionRef.current.x);
  const travelled = useRef(0);
  const [facing, setFacing] = useState<1 | -1>(initialDirection);
  const [walking, setWalking] = useState(false);

  useFrame(() => {
    if (!group.current) return;

    // Direzione di D: si accumula lo spostamento nello stesso verso e solo oltre soglia Eve cambia lato.
    const playerX = targetPositionRef.current.x;
    const step = playerX - lastPlayerX.current;
    lastPlayerX.current = playerX;
    if (step !== 0) {
      const stepSign = step > 0 ? 1 : -1;
      travelled.current = Math.sign(travelled.current) === stepSign ? travelled.current + step : step;
      if (Math.abs(travelled.current) >= SIDE_SWITCH_DISTANCE) direction.current = stepSign;
    }

    const targetX = Math.min(SIDEWALK_MAX_X, Math.max(SIDEWALK_MIN_X, playerX - direction.current * FOLLOW_DISTANCE));
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
    <group ref={group} position={[initialX ?? targetPositionRef.current.x - initialDirection * FOLLOW_DISTANCE, GROUND_Y, 0]}>
      <CharacterAnimator2D variant="Eve" state={walking ? 'walk' : 'idle'} facing={facing} height={PLAYER_HEIGHT} />
    </group>
  );
}
