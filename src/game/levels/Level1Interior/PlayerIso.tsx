import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { CharacterAnimator2D } from '@/game/render2d/CharacterAnimator2D';
import { PLAYER_HEIGHT } from '@/game/levels/Level1/level1Config';
import { ISO_CAMERA_AZIMUTH, ISO_PLAYER_SPEED } from './interiorConfig';

// Stesso pattern di `Player2D.tsx` (Set globale del modulo per i tasti
// premuti, non stato React — un `setState` dentro `useFrame` causerebbe 60
// render al secondo). Set separato apposta: questo componente e `Player2D`
// non sono mai montati insieme (modo laterale ed isometrico si escludono a
// vicenda), duplicare qui è più semplice che condividerlo fra due scene che
// non coesistono mai.
const keys = new Set<string>();
function handleKeyDown(event: KeyboardEvent) {
  keys.add(event.key.toLowerCase());
}
function handleKeyUp(event: KeyboardEvent) {
  keys.delete(event.key.toLowerCase());
}

/** Posizione del giocatore sul pavimento (Y sempre 0: niente salto in
 *  questo modo, vedi FASE5_INTERNO_ISOMETRICO.md). */
export interface PlayerPositionIso {
  x: number;
  z: number;
}

interface PlayerIsoProps {
  /** Scritta ad ogni frame: letta dalla camera e dai trigger delle porte
   *  senza passare da uno stato React. */
  positionRef: MutableRefObject<PlayerPositionIso>;
  /** Vero se la cella (in coordinate mondo, non ancora arrotondate) è
   *  calpestabile — collisione a griglia semplice, un asse alla volta (vedi
   *  sotto), non muri veri: basta a non far uscire il giocatore dalla
   *  piantina disegnata in LDtk. */
  isFloorCell: (worldX: number, worldZ: number) => boolean;
  initialX: number;
  initialZ: number;
}

/**
 * Giocatore del modo isometrico (vedi FASE5_INTERNO_ISOMETRICO.md): stesso
 * principio di `Player2D` (niente Rapier, integrazione manuale in
 * `useFrame`), ma il movimento è un vettore X/Z invece di X + salto. Riusa
 * `CharacterAnimator2D` (stessi sprite D0, nessuna arte nuova) — lo
 * specchiamento resta legato solo al movimento orizzontale (X), come nel
 * modo laterale: le pose non coprono davvero le 8 direzioni (vedi il piano
 * di handoff, "da confermare col codice"), quindi un movimento puramente in
 * Z non cambia `facing` — semplificazione onesta per questa prima passata,
 * non una svista.
 */
export function PlayerIso({ positionRef, isFloorCell, initialX, initialZ }: PlayerIsoProps) {
  const group = useRef<Group>(null);
  const facingLeft = useRef(false);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [walking, setWalking] = useState(false);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      keys.clear();
    };
  }, []);

  useFrame((_, delta) => {
    if (!group.current) return;

    let moveX = 0;
    let moveZ = 0;
    if (keys.has('a') || keys.has('arrowleft')) moveX -= 1;
    if (keys.has('d') || keys.has('arrowright')) moveX += 1;
    if (keys.has('w') || keys.has('arrowup')) moveZ -= 1;
    if (keys.has('s') || keys.has('arrowdown')) moveZ += 1;

    const length = Math.hypot(moveX, moveZ);
    if (length > 0) {
      moveX /= length;
      moveZ /= length;
    }

    if (moveX !== 0 && moveX < 0 !== facingLeft.current) {
      facingLeft.current = moveX < 0;
      setFacing(facingLeft.current ? -1 : 1);
    }
    setWalking(length > 0);

    const step = ISO_PLAYER_SPEED * delta;
    const { x, z } = group.current.position;
    const nextX = x + moveX * step;
    const nextZ = z + moveZ * step;

    // Collisione a griglia, un asse alla volta: si scivola lungo un muro
    // invece di bloccarsi in diagonale contro di esso.
    if (isFloorCell(nextX, z)) {
      group.current.position.x = nextX;
    }
    if (isFloorCell(group.current.position.x, nextZ)) {
      group.current.position.z = nextZ;
    }

    positionRef.current.x = group.current.position.x;
    positionRef.current.z = group.current.position.z;
  });

  return (
    <group ref={group} position={[initialX, 0, initialZ]} rotation={[0, ISO_CAMERA_AZIMUTH, 0]}>
      <CharacterAnimator2D variant="D0" state={walking ? 'walk' : 'idle'} facing={facing} height={PLAYER_HEIGHT} />
    </group>
  );
}
