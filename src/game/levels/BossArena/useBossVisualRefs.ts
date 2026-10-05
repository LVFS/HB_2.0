import { useRef } from 'react';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import type { BossVisualRefs } from './bossRender';

/** Le ref delle mesh del boss: le usa il frame (`bossRender.ts`) e le attacca `BossVisuals`. */
export function useBossVisualRefs(): BossVisualRefs {
  return {
    group: useRef<Group>(null),
    bodyMat: useRef<MeshBasicMaterial>(null),
    slash: useRef<Mesh>(null),
    slashDebug: useRef<Mesh>(null),
    shieldMesh: useRef<Mesh>(null),
    shieldMat: useRef<MeshBasicMaterial>(null),
    marionetteGroup: useRef<Group>(null),
    warningMesh: useRef<Mesh>(null),
    warningMat: useRef<MeshBasicMaterial>(null),
    teleportMarker: useRef<Mesh>(null),
    zoneMesh: useRef<Mesh>(null),
    zoneColumn: useRef<Mesh>(null)
  };
}
