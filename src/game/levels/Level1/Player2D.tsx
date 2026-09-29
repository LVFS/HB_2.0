import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { CharacterAnimator2D } from '@/game/render2d/CharacterAnimator2D';
import {
  GRAVITY,
  GROUND_Y,
  PLAYER_HEIGHT,
  PLAYER_JUMP_SPEED,
  PLAYER_SPEED,
  WORLD_HALF_WIDTH
} from './level1Config';

// Stesso pattern del `Player.tsx` 3D che questo file sostituisce: i tasti
// premuti vivono in un Set globale del modulo, non in stato React (uno
// setState dentro `useFrame` causerebbe 60 render al secondo).
const keys = new Set<string>();
function handleKeyDown(event: KeyboardEvent) {
  keys.add(event.key.toLowerCase());
}
function handleKeyUp(event: KeyboardEvent) {
  keys.delete(event.key.toLowerCase());
}

/** Posizione "piedi" del giocatore: y = GROUND_Y quando è a terra. */
export interface PlayerPosition {
  x: number;
  y: number;
}

interface Player2DProps {
  /** Scritta ad ogni frame: letta dalla camera e dagli altri sistemi (es.
   *  `DemoObstacle`, `EveCompanion`) senza passare da uno stato React. */
  positionRef: MutableRefObject<PlayerPosition>;
  /** Posizione X di spawn — di default 0, ma `SceneManager2D` la passa
   *  uguale a dove si è fermato il dialogo di apertura (`eveArrivalX`), così
   *  D non "salta" indietro quando il giocatore riprende il controllo. */
  initialX?: number;
}

/**
 * Giocatore 2D: nessuna fisica Rapier (vedi docs/PIANO_LIVELLO1_2D.md —
 * camminare/saltare non sono eventi fisici da simulare, sono scriptati),
 * solo integrazione manuale di gravità/velocità in `useFrame` e un clamp
 * sul pavimento. Visuale: `D0` via `CharacterAnimator2D` (Fase 3), che
 * possiede da solo la posa/lo specchiamento — questo componente non tocca
 * più `scale.x`/texture, gli passa solo `facing`/`state`.
 */
export function Player2D({ positionRef, initialX = 0 }: Player2DProps) {
  const group = useRef<Group>(null);
  const velocityY = useRef(0);
  const onGround = useRef(true);
  const facingLeft = useRef(false);
  // `facing`/`walking` sono le uniche cose che devono passare da uno stato
  // React (cambiano solo quando il valore LOGICO cambia — freccia/tasto
  // premuto o rilasciato — mai una volta a frame): tutto il resto del moto
  // resta su ref/oggetti Three, come sempre in questo progetto.
  const [facing, setFacing] = useState<1 | -1>(1);
  const [walking, setWalking] = useState(false);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      // Senza questo, un tasto premuto durante l'unmount resterebbe
      // "premuto" per sempre nel Set globale.
      keys.clear();
    };
  }, []);

  useFrame((_, delta) => {
    if (!group.current) return;

    let moveX = 0;
    if (keys.has('a') || keys.has('arrowleft')) moveX -= 1;
    if (keys.has('d') || keys.has('arrowright')) moveX += 1;
    if (moveX !== 0 && moveX < 0 !== facingLeft.current) {
      facingLeft.current = moveX < 0;
      setFacing(facingLeft.current ? -1 : 1);
    }
    // setState con lo stesso valore di prima è un no-op economico (React
    // salta il re-render via Object.is) — più semplice che tracciare a
    // parte "è cambiato?" per un booleano che comunque non lo fa quasi mai.
    setWalking(moveX !== 0);

    const nextX = group.current.position.x + moveX * PLAYER_SPEED * delta;
    group.current.position.x = Math.min(WORLD_HALF_WIDTH, Math.max(-WORLD_HALF_WIDTH, nextX));

    // Salto solo se il giocatore è a terra.
    if ((keys.has(' ') || keys.has('w') || keys.has('arrowup')) && onGround.current) {
      velocityY.current = PLAYER_JUMP_SPEED;
      onGround.current = false;
    }

    velocityY.current += GRAVITY * delta;
    let nextY = group.current.position.y + velocityY.current * delta;
    if (nextY <= GROUND_Y) {
      nextY = GROUND_Y;
      velocityY.current = 0;
      onGround.current = true;
    }
    group.current.position.y = nextY;

    positionRef.current.x = group.current.position.x;
    positionRef.current.y = group.current.position.y;
  });

  return (
    <group ref={group} position={[initialX, GROUND_Y, 0]}>
      <CharacterAnimator2D variant="D0" state={walking ? 'walk' : 'idle'} facing={facing} height={PLAYER_HEIGHT} />
    </group>
  );
}
