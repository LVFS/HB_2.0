import { useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type MeshBasicMaterial } from 'three';
import { useOverlap } from '@/game/render2d/useOverlap';
import type { AABB } from '@/game/render2d/collision';
import type { PlayerPosition } from './Player2D';
import { GROUND_Y, PLAYER_HEIGHT, PLAYER_WIDTH } from './level1Config';

const OBSTACLE: AABB = { x: 4, y: GROUND_Y + 0.6, halfWidth: 0.6, halfHeight: 0.6 };
const COLOR_IDLE = new Color('#f97373');
const COLOR_OVERLAP = new Color('#4ade80');

interface DemoObstacleProps {
  playerPositionRef: MutableRefObject<PlayerPosition>;
}

/**
 * Non è gameplay vero: dimostra che `useOverlap`/`aabbOverlap` (Fase 1 del
 * piano, vedi docs/PIANO_LIVELLO1_2D.md) funzionano end-to-end prima di
 * costruirci sopra trigger/pickup/hitbox veri (Fase 2 e oltre). Da rimuovere
 * quando arriva il primo contenuto reale al suo posto.
 */
export function DemoObstacle({ playerPositionRef }: DemoObstacleProps) {
  const material = useRef<MeshBasicMaterial>(null);
  const overlapping = useRef(false);

  useOverlap(
    () => ({
      x: playerPositionRef.current.x,
      y: playerPositionRef.current.y + PLAYER_HEIGHT / 2,
      halfWidth: PLAYER_WIDTH / 2,
      halfHeight: PLAYER_HEIGHT / 2
    }),
    () => OBSTACLE,
    {
      onEnter: () => {
        overlapping.current = true;
      },
      onExit: () => {
        overlapping.current = false;
      }
    }
  );

  useFrame(() => {
    material.current?.color.copy(overlapping.current ? COLOR_OVERLAP : COLOR_IDLE);
  });

  return (
    <mesh position={[OBSTACLE.x, OBSTACLE.y, 0]}>
      <planeGeometry args={[OBSTACLE.halfWidth * 2, OBSTACLE.halfHeight * 2]} />
      <meshBasicMaterial ref={material} color={COLOR_IDLE} />
    </mesh>
  );
}
