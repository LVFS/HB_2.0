import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture } from 'three';
import type { Mesh, MeshBasicMaterial } from 'three';
import { PROJECTILE_HALF_SIZE } from '../BossArena/arenaConfig';
import { laneScale, laneZ } from './tunnelLanes';
import type { TunnelWorld } from './tunnelState';

/** Una nota musicale (♪) nel colore dato, con il bordo scuro: così si legge sullo sfondo del tunnel. */
function drawNote(color: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.strokeStyle = '#10131a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(22, 46, 13, 10, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(33, 44);
    ctx.lineTo(33, 8);
    ctx.lineTo(52, 18);
    ctx.lineTo(33, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

const MAX_PROJECTILES = 12;
const SLOTS = Array.from({ length: MAX_PROJECTILES }, (_, i) => i);

/**
 * Proiettili lanciati dalla marionetta: arancio = parabile (la parata lo
 * rimanda), giallo = non parabile e basso (si salta), azzurro = rimandato
 * contro di lei. Le note del karaoke hanno la stessa regola dei colori ma
 * la forma di una nota musicale. Pool di mesh fisse aggiornate ogni frame da
 * `world.arena.projectiles`.
 */
export function TunnelProjectiles({ world }: { world: TunnelWorld }) {
  const meshes = useRef<(Mesh | null)[]>([]);
  const mats = useRef<(MeshBasicMaterial | null)[]>([]);
  const time = useRef(0);
  const textures = useMemo(() => ({ orange: drawNote('#fb923c'), yellow: drawNote('#facc15') }), []);
  useEffect(
    () => () => {
      textures.orange.dispose();
      textures.yellow.dispose();
    },
    [textures]
  );

  useFrame((_, rawDelta) => {
    if (world.arena.hitStop > 0) return;
    time.current += Math.min(rawDelta, 0.05);
    SLOTS.forEach((slot) => {
      const mesh = meshes.current[slot];
      const mat = mats.current[slot];
      if (!mesh || !mat) return;
      const proj = world.arena.projectiles[slot];
      mesh.visible = proj !== undefined;
      if (!proj) return;
      // Un proiettile rimandato vola verso la marionetta nella via di D; gli altri nella via da cui sono partiti.
      const lane = proj.owner === 'player' ? world.lane.pos : (proj.lane ?? world.lane.pos);
      const noteMap = proj.note && proj.owner === 'boss' ? (proj.unparryable ? textures.yellow : textures.orange) : null;
      if (mat.map !== noteMap) {
        mat.map = noteMap;
        mat.needsUpdate = true;
      }
      mesh.position.set(proj.x, proj.y * laneScale(lane), laneZ(lane) + 0.3);
      mesh.scale.setScalar(laneScale(lane) * (noteMap ? 1.7 : 1));
      mesh.rotation.z = noteMap ? Math.sin(time.current * 9) * 0.25 : time.current * 14;
      mat.color.set(noteMap ? '#ffffff' : proj.owner === 'player' ? '#7dd3fc' : proj.unparryable ? '#facc15' : '#fb923c');
    });
  });

  return (
    <>
      {SLOTS.map((slot) => (
        <mesh key={slot} ref={(el) => { meshes.current[slot] = el; }} visible={false}>
          <planeGeometry args={[PROJECTILE_HALF_SIZE * 2.2, PROJECTILE_HALF_SIZE * 2.2]} />
          <meshBasicMaterial ref={(el) => { mats.current[slot] = el; }} transparent />
        </mesh>
      ))}
    </>
  );
}
