import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color } from 'three';
import type { Mesh, MeshBasicMaterial } from 'three';
import { MOOD_PALETTE, TUNNEL_CAMERA_PITCH, TUNNEL_VIEW_MAX_WIDTH } from './tunnelConfig';
import type { TunnelWorld } from './tunnelState';

/**
 * Tunnel infinito in parallasse: ogni strato è un piccolo gruppo di mesh che si
 * ricicla (un elemento che esce a sinistra riappare a destra) leggendo la X
 * della camera, come `ParallaxLayer`. Segnaposto a tinte unite, nessun asset:
 * fondo scuro, costole dell'arco, tubature e lampade a intervalli. Il pavimento e i
 * binari sono in `TunnelRails`.
 *
 * La camera è inclinata verso il basso: un oggetto lontano (z < 0) apparirebbe più in alto del
 * previsto. Le quote degli strati sono quindi date come ALTEZZA SULLO SCHERMO e convertite in
 * quota di mondo (`worldY`), così lo sfondo sta dove lo si vuole a prescindere dall'inclinazione.
 */

interface Layer {
  id: 'ribs' | 'columns' | 'lamps';
  /** Fattore di parallasse: 0 = fermo con lo schermo, 1 = fermo nel mondo. */
  factor: number;
  /** Distanza fra un elemento e il successivo, in unità di mondo. */
  spacing: number;
  /** Quota SULLO SCHERMO del centro (0 = piedi di D sulla via centrale), profondità Z, dimensioni e colore. */
  screenY: number;
  z: number;
  width: number;
  height: number;
  color: string;
  opacity?: number;
}

const LAYERS: Layer[] = [
  // Costole dell'arco: grandi e lente, sullo sfondo.
  { id: 'ribs', factor: 0.35, spacing: 7, screenY: 3.4, z: -7, width: 0.9, height: 13, color: '#131c27' },
  // Colonne più vicine.
  { id: 'columns', factor: 0.6, spacing: 5.5, screenY: 2.8, z: -5, width: 0.6, height: 9, color: '#1a2633' },
  // Lampade al soffitto.
  { id: 'lamps', factor: 0.8, spacing: 4.5, screenY: 6.1, z: -3, width: 0.5, height: 0.14, color: '#f2d98d', opacity: 0.4 }
];

const COS = Math.cos(TUNNEL_CAMERA_PITCH);
const SIN = Math.sin(TUNNEL_CAMERA_PITCH);
/** Quota di mondo che, vista dalla camera inclinata, finisce a `screenY` sullo schermo per un oggetto a profondità `z`. */
const worldY = (screenY: number, z: number) => (screenY + z * SIN) / COS;

/** Mezza larghezza visibile al massimo (l'inquadratura è fissa: vedi `TUNNEL_VIEW_MAX_WIDTH`), con un margine. */
const VISIBLE_HALF = TUNNEL_VIEW_MAX_WIDTH / 2 + 4;

function layerCount(layer: Layer): number {
  return Math.ceil((VISIBLE_HALF * 2) / layer.spacing) + 2;
}

/** Colore di una voce della palette secondo i pesi delle tre atmosfere (normale, Buen Camino, shonen). */
const mixed = new Color();
const part = new Color();
function paletteColor(entry: readonly [string, string, string], mood: readonly number[], into: Color): Color {
  into.setRGB(0, 0, 0);
  entry.forEach((hex, i) => {
    if (mood[i] > 0.001) into.add(part.set(hex).multiplyScalar(mood[i]));
  });
  return into;
}

export function TunnelBackdrop({ world }: { world: TunnelWorld }) {
  const camera = useThree((state) => state.camera);
  const wall = useRef<Mesh>(null);
  const pipe = useRef<Mesh>(null);
  const meshes = useRef<Record<string, (Mesh | null)[]>>({});

  useFrame(() => {
    const camX = camera.position.x;
    if (wall.current) wall.current.position.x = camX;
    if (pipe.current) pipe.current.position.x = camX;
    // Atmosfera: i colori seguono i pesi di world.mood (normale / Buen Camino / shonen).
    (wall.current?.material as MeshBasicMaterial | undefined)?.color.copy(paletteColor(MOOD_PALETTE.wall, world.mood, mixed));
    (pipe.current?.material as MeshBasicMaterial | undefined)?.color.copy(paletteColor(MOOD_PALETTE.pipe, world.mood, mixed));
    for (const layer of LAYERS) {
      const pool = meshes.current[layer.id] ?? [];
      const y = worldY(layer.screenY, layer.z);
      const color = paletteColor(MOOD_PALETTE[layer.id], world.mood, mixed);
      // Elemento k a X = k*spacing + camX*(1-factor): il primo visibile è il più piccolo k
      // il cui X sta dentro la finestra.
      const k0 = Math.ceil((camX * layer.factor - VISIBLE_HALF) / layer.spacing);
      pool.forEach((mesh, i) => {
        if (!mesh) return;
        mesh.position.set((k0 + i) * layer.spacing + camX * (1 - layer.factor), y, layer.z);
        (mesh.material as MeshBasicMaterial).color.copy(color);
      });
    }
  });

  return (
    <>
      {/* Parete di fondo e tubatura continua. */}
      <mesh ref={wall} position={[0, worldY(2.5, -9), -9]}>
        <planeGeometry args={[TUNNEL_VIEW_MAX_WIDTH * 2, 26 / COS]} />
        <meshBasicMaterial color="#0a1017" />
      </mesh>
      <mesh ref={pipe} position={[0, worldY(5.6, -6), -6]}>
        <planeGeometry args={[TUNNEL_VIEW_MAX_WIDTH * 2, 0.28 / COS]} />
        <meshBasicMaterial color="#1b2a38" />
      </mesh>
      {LAYERS.map((layer) => (
        <group key={layer.id}>
          {Array.from({ length: layerCount(layer) }, (_, i) => (
            <mesh
              key={i}
              ref={(el) => {
                (meshes.current[layer.id] ||= [])[i] = el;
              }}
            >
              <planeGeometry args={[layer.width, layer.height / COS]} />
              <meshBasicMaterial color={layer.color} transparent={layer.opacity !== undefined} opacity={layer.opacity ?? 1} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}
