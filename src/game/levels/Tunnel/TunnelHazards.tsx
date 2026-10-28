import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, MeshBasicMaterial } from 'three';
import { laneScale, laneZ } from './tunnelLanes';
import { ARCHER, PILGRIM, REMAINS, TUNNEL_DEBRIS, TUNNEL_TURRET } from './tunnelConfig';
import type { HazardKind, TunnelWorld } from './tunnelState';

const MAX_SLOTS = 40;
const SLOTS = Array.from({ length: MAX_SLOTS }, (_, i) => i);

/** Colore di ogni minaccia: il linguaggio visivo è quello dell'arena — rosso = pericolo da
 *  schivare, legno = ostacolo normale, cassa chiara = si può rompere, ciano = raggio. */
const COLORS: Record<HazardKind, string> = {
  low: '#8b5e3c',
  wall: '#b33a3a',
  crate: '#d0a05a',
  pit: '#010305',
  ray: '#67e8f9',
  debris: '#6b7280',
  guard: '#2f4f8f',
  turret: '#6b7a8c',
  pendulum: '#d4a017',
  paparazzo: '#374151',
  pilgrim: '#7c4a2a',
  archer: '#365314',
  remains: '#4b5563'
};

/**
 * Le minacce del tunnel (ostacoli, voragini, raggi, detriti, guardie): pool di mesh
 * fisse aggiornate ogni frame da `world.hazards` (mai stato React), come
 * `ArenaThreats` per l'arena. Ogni slot ha un corpo e un "marcatore" (il
 * segnale a terra del detrito, il lampeggio del raggio, il berretto della guardia).
 * Ogni minaccia sta nella profondità della sua via (`laneZ`) e in scala (`laneScale`).
 */
export function TunnelHazards({ world }: { world: TunnelWorld }) {
  const bodies = useRef<(Mesh | null)[]>([]);
  const bodyMats = useRef<(MeshBasicMaterial | null)[]>([]);
  const markers = useRef<(Mesh | null)[]>([]);
  const markerMats = useRef<(MeshBasicMaterial | null)[]>([]);
  const time = useRef(0);

  useFrame((_, rawDelta) => {
    if (world.arena.hitStop > 0) return;
    time.current += Math.min(rawDelta, 0.05);
    SLOTS.forEach((slot) => {
      const body = bodies.current[slot];
      const bodyMat = bodyMats.current[slot];
      const marker = markers.current[slot];
      const markerMat = markerMats.current[slot];
      if (!body || !bodyMat || !marker || !markerMat) return;
      const h = world.hazards[slot];
      body.visible = marker.visible = false;
      if (!h || h.phase === 'spent') return;

      const z = laneZ(h.lane) + 0.1;
      const s = laneScale(h.lane);
      const centerY = (h.kind === 'debris' ? h.y : h.y + h.height / 2) * s;
      bodyMat.color.set(h.flash > 0 ? '#ffffff' : COLORS[h.kind]);
      bodyMat.opacity = 1;

      switch (h.kind) {
        case 'pit':
          // Voragine: striscia scura nel pavimento con il bordo che brilla.
          body.visible = true;
          body.position.set(h.x, -0.12 * s, z - 0.04);
          body.scale.set(h.width * s, 0.32 * s, 1);
          marker.visible = true;
          marker.position.set(h.x, 0.05 * s, z - 0.03);
          marker.scale.set(h.width * s, 0.06, 1);
          markerMat.color.set('#ef4444');
          markerMat.opacity = 0.9;
          break;
        case 'ray': {
          body.visible = true;
          body.position.set(h.x, centerY, z);
          body.scale.set(h.width * s, h.height * s, 1);
          // In attesa lampeggia piano e trasparente; attivo è pieno e luminoso.
          bodyMat.opacity = h.phase === 'active' ? 1 : 0.18 + 0.2 * Math.sin(time.current * 30) ** 2;
          marker.visible = h.phase === 'warn';
          marker.position.set(h.x, 0.05 * s, z - 0.03);
          marker.scale.set(h.width * 1.4 * s, 0.06, 1);
          markerMat.color.set(h.rayHeight === 'high' ? '#facc15' : '#ef4444');
          markerMat.opacity = 0.9;
          break;
        }
        case 'debris': {
          marker.visible = h.phase === 'warn' || h.phase === 'active';
          marker.position.set(h.x, 0.05 * s, z - 0.03);
          marker.scale.set(TUNNEL_DEBRIS.halfSize * 2.2 * s, 0.08, 1);
          markerMat.color.set('#ef4444');
          markerMat.opacity = h.phase === 'warn' ? 0.5 + 0.4 * Math.sin(time.current * 20) ** 2 : 0.9;
          body.visible = h.phase === 'active';
          body.position.set(h.x, centerY, z);
          body.scale.set(h.width * s, h.height * s, 1);
          break;
        }
        case 'pendulum': {
          // Botafumeiro: una catena dal soffitto e il grande incensiere dorato che oscilla attraverso le vie.
          const sz = laneZ(h.swing) + 0.1;
          const ss = laneScale(h.swing);
          const top = (h.y + h.height) * ss;
          body.visible = true;
          body.position.set(h.x, centerY * ss / s, sz);
          body.scale.set(h.width * ss, h.height * ss, 1);
          marker.visible = true;
          marker.position.set(h.x, top + 3.2, sz - 0.02);
          marker.scale.set(0.09, 6.4, 1);
          markerMat.color.set('#9ca3af');
          markerMat.opacity = 0.9;
          break;
        }
        case 'paparazzo': {
          // Il fotografo: sagoma scura con l'obiettivo che lampeggia sempre più in fretta; al lampo, un quadrato bianco.
          body.visible = true;
          body.position.set(h.x, centerY, z);
          body.scale.set(h.width * s, h.height * s, 1);
          marker.visible = true;
          if (h.phase === 'active') {
            marker.position.set(h.x - 0.4, 1.3 * s, z + 0.05);
            marker.scale.set(3.4 * s, 3.4 * s, 1);
            markerMat.color.set('#ffffff');
            markerMat.opacity = Math.max(0, h.flash / 0.3);
          } else {
            const left = Math.max(0, h.t - world.time);
            marker.position.set(h.x - 0.45, 1.25 * s, z + 0.02);
            marker.scale.set(0.3 * s, 0.3 * s, 1);
            markerMat.color.set('#facc15');
            markerMat.opacity = 0.5 + 0.5 * Math.sin(time.current * (10 + 18 * (1 - Math.min(1, left / 1.1)))) ** 2;
          }
          break;
        }
        case 'turret': {
          // Torretta volante dei pellegrini-drone: ondeggia; l'occhio si fa rosso poco prima di sparare.
          const bob = Math.sin(time.current * 3 + h.id) * 0.12;
          const aiming = h.shoot > TUNNEL_TURRET.shootEvery - TUNNEL_TURRET.telegraph;
          body.visible = true;
          body.position.set(h.x, centerY + bob * s, z);
          body.scale.set(h.width * s, h.height * s, 1);
          marker.visible = true;
          marker.position.set(h.x - 0.12 * s, centerY + bob * s, z + 0.01);
          marker.scale.set(0.36 * s, 0.36 * s, 1);
          markerMat.color.set(aiming ? '#ef4444' : '#67e8f9');
          markerMat.opacity = aiming ? 0.6 + 0.4 * Math.sin(time.current * 40) ** 2 : 0.9;
          break;
        }
        case 'pilgrim': {
          // Pellegrino fanatico: mantello marrone e cappello largo; si carica (bianco, il cappello si fa rosso) e poi si scaglia.
          const windingUp = h.phase === 'active' && h.shoot < PILGRIM.windup;
          const lunging = h.phase === 'active' && !windingUp && h.shoot < PILGRIM.windup + PILGRIM.lunge;
          const squash = windingUp ? 1 - 0.12 * Math.sin(time.current * 40) ** 2 : lunging ? 1.18 : 1;
          body.visible = true;
          body.position.set(h.x, centerY, z);
          body.scale.set(h.width * s * (lunging ? 1.2 : 1), h.height * s * squash, 1);
          bodyMat.color.set(windingUp || h.flash > 0 ? '#ffffff' : COLORS.pilgrim);
          marker.visible = true;
          marker.position.set(h.x, (h.y + h.height + 0.08) * s, z + 0.01);
          marker.scale.set(h.width * 1.5 * s, 0.26 * s, 1);
          markerMat.color.set(windingUp ? '#ef4444' : '#d4b483');
          markerMat.opacity = 1;
          if (h.damaged) bodyMat.opacity = 0.35;
          break;
        }
        case 'archer': {
          // Balestriere: mantello verde; la balestra (sul lato di D) diventa rossa poco prima di scoccare.
          const aiming = h.shoot > ARCHER.every - ARCHER.telegraph;
          body.visible = true;
          body.position.set(h.x, centerY, z);
          body.scale.set(h.width * s, h.height * s, 1);
          bodyMat.color.set(h.flash > 0 ? '#ffffff' : COLORS.archer);
          marker.visible = true;
          marker.position.set(h.x - 0.55 * s, (h.y + h.height * 0.62) * s, z + 0.02);
          marker.scale.set(0.8 * s, 0.14 * s, 1);
          markerMat.color.set(aiming ? '#ef4444' : '#a8a29e');
          markerMat.opacity = aiming ? 0.6 + 0.4 * Math.sin(time.current * 40) ** 2 : 1;
          if (h.damaged) bodyMat.opacity = 0.35;
          break;
        }
        case 'remains': {
          // Resti: un mucchio basso a terra che sbiadisce prima di sparire.
          body.visible = true;
          body.position.set(h.x, centerY, z - 0.02);
          body.scale.set(h.width * s, h.height * s, 1);
          bodyMat.opacity = Math.min(0.9, (REMAINS.life - h.shoot) / 1.5);
          break;
        }
        case 'guard':
          // Guardia del cinema: divisa blu con il berretto chiaro (il "marcatore" fa da testa).
          body.visible = true;
          body.position.set(h.x, centerY, z);
          body.scale.set(h.width * s, h.height * s, 1);
          marker.visible = true;
          marker.position.set(h.x, (h.y + h.height + 0.12) * s, z + 0.01);
          marker.scale.set(h.width * 0.8 * s, 0.34 * s, 1);
          markerMat.color.set(h.flash > 0 ? '#ffffff' : '#e5e7eb');
          markerMat.opacity = 1;
          if (h.damaged) bodyMat.opacity = 0.35;
          break;
        default:
          body.visible = true;
          body.position.set(h.x, centerY, z);
          body.scale.set(h.width * s, h.height * s, 1);
          // Un ostacolo che ha già colpito resta in scena, ma spento.
          if (h.damaged) bodyMat.opacity = 0.35;
          break;
      }
    });
  });

  return (
    <>
      {SLOTS.map((slot) => (
        <group key={slot}>
          <mesh ref={(el) => { bodies.current[slot] = el; }} visible={false}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial ref={(el) => { bodyMats.current[slot] = el; }} transparent />
          </mesh>
          <mesh ref={(el) => { markers.current[slot] = el; }} visible={false}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial ref={(el) => { markerMats.current[slot] = el; }} transparent />
          </mesh>
        </group>
      ))}
    </>
  );
}
