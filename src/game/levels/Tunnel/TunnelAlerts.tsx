import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture } from 'three';
import type { Mesh, MeshBasicMaterial } from 'three';
import { laneScale, laneZ } from './tunnelLanes';
import { TUNNEL_LANES } from './tunnelConfig';
import type { TunnelWorld } from './tunnelState';

const LANE_SLOTS = Array.from({ length: TUNNEL_LANES }, (_, i) => i);
/** Un attacco offscreen si segnala solo quando è abbastanza vicino da contare (unità davanti a D). */
const ALERT_DISTANCE = 40;
/** Quanto prima del bordo destro sta il segnale. */
const EDGE_INSET = 1.1;
type AlertKind = 'parry' | 'dodge' | 'wave';
const PRIORITY: Record<AlertKind, number> = { wave: 3, dodge: 2, parry: 1 };
const COLORS: Record<AlertKind, string> = { parry: '#fb923c', dodge: '#facc15', wave: '#e879f9' };

/** Una freccia verso sinistra con un punto esclamativo, nel colore dell'attacco. */
function drawAlert(color: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.moveTo(8, 64);
    ctx.lineTo(60, 14);
    ctx.lineTo(120, 14);
    ctx.lineTo(120, 114);
    ctx.lineTo(60, 114);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#10131a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(14, 64);
    ctx.lineTo(60, 20);
    ctx.lineTo(60, 44);
    ctx.lineTo(114, 44);
    ctx.lineTo(114, 84);
    ctx.lineTo(60, 84);
    ctx.lineTo(60, 108);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#10131a';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 88, 66);
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Gli avvisi degli attacchi di Checco ancora fuori dallo schermo: UN segnale per via, sul bordo destro, alla quota
 * della via da cui sta per arrivare l'attacco (arancio = parabile, giallo = da saltare, viola = l'onda). Con più
 * attacchi nella stessa via vince il più urgente, così non c'è confusione. Solo resa: guarda lanci, proiettili e onda.
 */
export function TunnelAlerts({ world }: { world: TunnelWorld }) {
  const meshes = useRef<(Mesh | null)[]>([]);
  const mats = useRef<(MeshBasicMaterial | null)[]>([]);
  const time = useRef(0);
  const textures = useMemo(() => ({ parry: drawAlert(COLORS.parry), dodge: drawAlert(COLORS.dodge), wave: drawAlert(COLORS.wave) }), []);
  useEffect(
    () => () => {
      textures.parry.dispose();
      textures.dodge.dispose();
      textures.wave.dispose();
    },
    [textures]
  );

  useFrame((_, rawDelta) => {
    if (world.arena.hitStop > 0) return;
    time.current += Math.min(rawDelta, 0.05);
    const player = world.arena.player;
    const edge = world.runX + world.view.rightEdge;
    const best: (AlertKind | null)[] = LANE_SLOTS.map(() => null);
    const consider = (lane: number, kind: AlertKind) => {
      const current = best[lane];
      if (lane >= 0 && lane < TUNNEL_LANES && (current === null || PRIORITY[kind] > PRIORITY[current])) best[lane] = kind;
    };

    // Proiettili di Checco ancora oltre il bordo.
    for (const proj of world.arena.projectiles) {
      if (proj.owner !== 'boss' || proj.lane === undefined) continue;
      if (proj.x > edge && proj.x - player.x < ALERT_DISTANCE) consider(proj.lane, proj.unparryable ? 'dodge' : 'parry');
    }
    // Un lancio in preparazione con la marionetta fuori schermo: il segnale parte subito, non quando il proiettile entra.
    if (!world.puppet.onScreen && world.puppet.telegraph > 0) {
      const next = world.throws.find((throwing) => throwing.launchT !== null && world.time < throwing.launchT);
      if (next) consider(next.lane, next.parryable ? 'parry' : 'dodge');
    }
    // L'onda di realtà (occupa TUTTE le vie) finché non entra: un solo segnale, nella via di mezzo, per non fare caos.
    if (world.wave && world.wave.x > edge) consider(Math.floor(TUNNEL_LANES / 2), 'wave');

    LANE_SLOTS.forEach((lane) => {
      const mesh = meshes.current[lane];
      const mat = mats.current[lane];
      if (!mesh || !mat) return;
      const kind = best[lane];
      mesh.visible = kind !== null;
      if (!kind) return;
      const s = laneScale(lane);
      const pulse = 1 + 0.14 * Math.sin(time.current * 16);
      if (mat.map !== textures[kind]) {
        mat.map = textures[kind];
        mat.needsUpdate = true;
      }
      mesh.position.set(edge - EDGE_INSET, 1.1 * s, laneZ(lane) + 0.5);
      mesh.scale.set(1.15 * s * pulse, 1.15 * s * pulse, 1);
    });
  });

  return (
    <>
      {LANE_SLOTS.map((lane) => (
        <mesh key={lane} ref={(el) => { meshes.current[lane] = el; }} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial ref={(el) => { mats.current[lane] = el; }} transparent depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}
