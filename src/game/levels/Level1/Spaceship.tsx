import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, type Mesh, type MeshBasicMaterial } from 'three';
import { Sprite2D } from '@/game/render2d/Sprite2D';
import { SHIP_BASE_Y, SHIP_HEIGHT, SHIP_X } from './level1Config';

const SHIP_URL = `${import.meta.env.BASE_URL}sprites/props/navicella.webp`;
const SHIP_PX = { width: 1097, height: 713 };
/** Punto della PNG che poggia sull'asfalto (macerie sotto la punta) e centro del cratere da cui sale il fumo, in pixel della PNG. */
const SHIP_ANCHOR_PX = { x: 300, y: 690 };
const CRATER_PX = { x: 225, y: 630 };
/** Dietro i personaggi (z=0): ci si passa davanti. */
const SHIP_Z = -0.5;

/** Il fumo è tarato per una navicella alta così: altezza e scala degli sbuffi seguono `SHIP_HEIGHT`. */
const SMOKE_REFERENCE_SHIP_HEIGHT = 3.2;
const SMOKE_SIZE = SHIP_HEIGHT / SMOKE_REFERENCE_SHIP_HEIGHT;
const SMOKE_PUFFS = 6;
/** Durata di un ciclo di uno sbuffo (s), quanto sale (u), quanto ondeggia (u), scala di partenza e di arrivo, opacità massima. */
const SMOKE_PERIOD = 3.6;
const SMOKE_RISE = 2.6 * SMOKE_SIZE;
const SMOKE_SWAY = 0.22 * SMOKE_SIZE;
const SMOKE_SCALE_FROM = 0.35 * SMOKE_SIZE;
const SMOKE_SCALE_TO = 1.1 * SMOKE_SIZE;
const SMOKE_OPACITY = 0.42;
const SMOKE_COLOR = '#c4c8d0';

/** Cerchio sfumato generato al volo (nessun file): stesso approccio delle nuvole del menu. */
function createPuffTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

/** Pochi sbuffi grigi che salgono dal cratere e svaniscono, in loop: un solo `useFrame`, nessuno stato React. */
function CraterSmoke({ origin }: { origin: [number, number, number] }) {
  const texture = useMemo(createPuffTexture, []);
  const meshes = useRef<Array<Mesh | null>>([]);
  const materials = useRef<Array<MeshBasicMaterial | null>>([]);

  useFrame(({ clock }) => {
    for (let i = 0; i < SMOKE_PUFFS; i += 1) {
      const mesh = meshes.current[i];
      const material = materials.current[i];
      if (!mesh || !material) continue;
      const age = (clock.elapsedTime / SMOKE_PERIOD + i / SMOKE_PUFFS) % 1;
      mesh.position.set(origin[0] + Math.sin(age * Math.PI * 2 + i * 1.7) * SMOKE_SWAY, origin[1] + age * SMOKE_RISE, origin[2]);
      mesh.scale.setScalar(SMOKE_SCALE_FROM + (SMOKE_SCALE_TO - SMOKE_SCALE_FROM) * age);
      material.opacity = Math.sin(age * Math.PI) * SMOKE_OPACITY;
    }
  });

  return (
    <>
      {Array.from({ length: SMOKE_PUFFS }, (_, i) => (
        <mesh key={i} ref={(node) => (meshes.current[i] = node)} position={origin}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            ref={(node) => (materials.current[i] = node)}
            map={texture}
            color={SMOKE_COLOR}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

/**
 * La navicella schiantata nell'incrocio, con la punta nell'asfalto, e il fumo dal cratere. Non è un ostacolo (nessuna collisione):
 * sta dietro ai personaggi, il solo limite è il bordo del marciapiede (`SIDEWALK_MAX_X`).
 */
export function Spaceship() {
  const width = (SHIP_HEIGHT * SHIP_PX.width) / SHIP_PX.height;
  const unitsPerPx = SHIP_HEIGHT / SHIP_PX.height;
  // Centro della sagoma, ricavato dal punto d'appoggio (X e Y di mondo) e dalla sua posizione nella PNG (Y della PNG va verso il basso).
  const centerX = SHIP_X + (SHIP_PX.width / 2 - SHIP_ANCHOR_PX.x) * unitsPerPx;
  const centerY = SHIP_BASE_Y + (SHIP_ANCHOR_PX.y - SHIP_PX.height / 2) * unitsPerPx;
  const crater: [number, number, number] = [
    centerX + (CRATER_PX.x - SHIP_PX.width / 2) * unitsPerPx,
    centerY + (SHIP_PX.height / 2 - CRATER_PX.y) * unitsPerPx,
    SHIP_Z + 0.1
  ];

  return (
    <>
      <Sprite2D textureUrl={SHIP_URL} width={width} height={SHIP_HEIGHT} position={[centerX, centerY, SHIP_Z]} pixelated />
      <CraterSmoke origin={crater} />
    </>
  );
}
