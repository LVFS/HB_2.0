import type { MutableRefObject, RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { isInsideZone } from './interactZone';
import type { PlayerPosition } from './Player2D';
import {
  ARISTON_DOOR_HALF_WIDTH,
  ARISTON_DOOR_PROMPT_ROW_PX,
  ARISTON_DOOR_X,
  BACKDROP_BOTTOM_Y,
  BACKDROP_HEIGHT_PX,
  BACKDROP_PX_PER_UNIT
} from './level1Config';

const DOOR_ZONE = { centerX: ARISTON_DOOR_X, halfWidth: ARISTON_DOOR_HALF_WIDTH };
const PROMPT_WORLD_Y = BACKDROP_BOTTOM_Y + (BACKDROP_HEIGHT_PX - ARISTON_DOOR_PROMPT_ROW_PX) / BACKDROP_PX_PER_UNIT;
const projected = new Vector3();

interface DoorPromptDriverProps {
  playerPositionRef: MutableRefObject<PlayerPosition>;
  /** Scritto ogni frame: D è dentro la zona della porta (lo legge la pressione di «interagisci»). */
  inZoneRef: MutableRefObject<boolean>;
  /** Scritto ogni frame: D è davanti alla porta (a prescindere da `enabled`, anche durante la dissolvenza): serve a non far saltare il pad. */
  nearDoorRef: MutableRefObject<boolean>;
  promptRef: RefObject<HTMLDivElement>;
  /** `false` dopo l'attivazione: il suggerimento sparisce e la zona non vale più. */
  enabled: boolean;
}

/**
 * Dentro il Canvas: a ogni frame calcola se D è nella zona della porta e sposta il suggerimento HTML sul punto di schermo sopra la
 * porta (proiezione della camera), mostrandolo solo se D è dentro. Niente `setState` a 60 fps: scrive su un ref e su `style`/`dataset`.
 */
export function DoorPromptDriver({ playerPositionRef, inZoneRef, nearDoorRef, promptRef, enabled }: DoorPromptDriverProps) {
  useFrame(({ camera, size }) => {
    const nearDoor = isInsideZone(playerPositionRef.current.x, DOOR_ZONE);
    const inZone = enabled && nearDoor;
    nearDoorRef.current = nearDoor;
    inZoneRef.current = inZone;
    const element = promptRef.current;
    if (!element) return;
    const visible = String(inZone);
    if (element.dataset.visible !== visible) element.dataset.visible = visible;
    if (!inZone) return;
    projected.set(ARISTON_DOOR_X, PROMPT_WORLD_Y, 0).project(camera);
    element.style.left = `${((projected.x + 1) / 2) * size.width}px`;
    element.style.top = `${((1 - projected.y) / 2) * size.height}px`;
  });
  return null;
}
