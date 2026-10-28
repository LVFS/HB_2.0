import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture } from 'three';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { cameoById, type Cameo } from '@/data/tunnelCameos';
import { CAMEO_CAST } from './tunnelConfig';
import { laneScale, laneZ } from './tunnelLanes';
import type { TunnelWorld } from './tunnelState';

const MAX_MEMBERS = 4;
const MEMBER_SLOTS = Array.from({ length: MAX_MEMBERS }, (_, i) => i);

function drawTag(text: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.beginPath();
    ctx.roundRect(4, 8, 376, 48, 12);
    ctx.fill();
    ctx.fillStyle = '#e9d5ff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.length > 26 ? `${text.slice(0, 25)}…` : text, 192, 34);
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** Fumetto con la battuta, a capo automatico (al massimo tre righe). */
function drawBubble(text: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 176;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.font = 'bold 34px sans-serif';
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > 456 && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
    const shown = lines.slice(0, 3);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#10131a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 128, 24);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(220, 134);
    ctx.lineTo(250, 168);
    ctx.lineTo(270, 134);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#10131a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const top = 72 - ((shown.length - 1) * 40) / 2;
    shown.forEach((entry, i) => ctx.fillText(entry, 256, top + i * 40));
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

interface Textures {
  tag: CanvasTexture;
  bubble: CanvasTexture;
}

/**
 * I cameo della modalità shonen (`src/data/tunnelCameos.ts`): uno (o più, i Gentleman) alla volta sopra la via più lontana, con il
 * nome e la battuta nel fumetto. Figure a tinte unite che cambiano colore per personaggio; Luffy (Gear 5) si stira e rimbalza come
 * un cartone, la Going Merry è una nave che spara. Solo resa: scelta e effetto (`castCameo`) stanno in `tunnelReality.ts`.
 */
export function CameoCast({ world }: { world: TunnelWorld }) {
  const figures = useRef<(Group | null)[]>([]);
  const bodyMats = useRef<(MeshBasicMaterial | null)[]>([]);
  const accentMats = useRef<(MeshBasicMaterial | null)[]>([]);
  const hairMats = useRef<(MeshBasicMaterial | null)[]>([]);
  const swords = useRef<(Mesh | null)[]>([]);
  const staffs = useRef<(Group | null)[]>([]);
  const ship = useRef<Group>(null);
  const shipHullMat = useRef<MeshBasicMaterial>(null);
  const shipSailMat = useRef<MeshBasicMaterial>(null);
  const puffs = useRef<(Mesh | null)[]>([]);
  const aura = useRef<Mesh>(null);
  const portalCore = useRef<Mesh>(null);
  const portalOuter = useRef<Mesh>(null);
  const portalInner = useRef<Mesh>(null);
  const tag = useRef<Mesh>(null);
  const tagMat = useRef<MeshBasicMaterial>(null);
  const bubble = useRef<Mesh>(null);
  const bubbleMat = useRef<MeshBasicMaterial>(null);
  const shown = useRef<string | null>(null);
  const cache = useRef(new Map<string, Textures>());
  const time = useRef(0);

  useEffect(() => {
    const textures = cache.current;
    return () => {
      textures.forEach((entry) => {
        entry.tag.dispose();
        entry.bubble.dispose();
      });
      textures.clear();
    };
  }, []);

  const texturesFor = (cameo: Cameo): Textures => {
    let entry = cache.current.get(cameo.id);
    if (!entry) {
      entry = { tag: drawTag(cameo.members.map((member) => member.name).join(' · ')), bubble: drawBubble(cameo.line) };
      cache.current.set(cameo.id, entry);
    }
    return entry;
  };

  useFrame((_, rawDelta) => {
    if (world.arena.hitStop > 0) return;
    time.current += Math.min(rawDelta, 0.05);
    const t = time.current;
    const { mode, arena } = world;
    const cameo = mode.id === 'anime' && mode.finale === 'none' && mode.cameoId && mode.cameoT < CAMEO_CAST.stay ? cameoById(mode.cameoId) : undefined;
    const isShip = cameo?.style === 'ship';
    const isToon = cameo?.style === 'toon';
    const lane = CAMEO_CAST.lane;
    const s = laneScale(lane);
    const z = laneZ(lane) + 0.3;

    // Cambio di cameo: colori dei personaggi, nome e fumetto.
    if (cameo && shown.current !== cameo.id) {
      shown.current = cameo.id;
      cameo.members.forEach((member, i) => {
        bodyMats.current[i]?.color.set(member.body);
        accentMats.current[i]?.color.set(member.accent);
        hairMats.current[i]?.color.set(member.hair);
        const sword = swords.current[i];
        if (sword) sword.visible = member.prop === 'sword';
        const staff = staffs.current[i];
        if (staff) staff.visible = member.prop === 'staff';
      });
      shipHullMat.current?.color.set(cameo.members[0].body);
      shipSailMat.current?.color.set(cameo.members[0].accent);
      const textures = texturesFor(cameo);
      if (tagMat.current) {
        tagMat.current.map = textures.tag;
        tagMat.current.needsUpdate = true;
      }
      if (bubbleMat.current) {
        bubbleMat.current.map = textures.bubble;
        bubbleMat.current.needsUpdate = true;
      }
    }
    if (!cameo) shown.current = null;

    // Il PORTALE: si apre all'arrivo (cresce e poi si richiude) e riappare quando l'ospite se ne va. In mezzo l'ospite esce e rientra.
    const stayT = mode.cameoT;
    const grow = (x: number, rise: number, total: number): number => (x < 0 || x > total ? 0 : x < rise ? x / rise : 1 - (x - rise) / (total - rise));
    const portalScale = cameo || (mode.id === 'anime' && mode.cameoId && stayT < CAMEO_CAST.stay + 0.1)
      ? Math.max(grow(stayT, 0.45, CAMEO_CAST.portal), grow(stayT - (CAMEO_CAST.stay - CAMEO_CAST.leave), 0.35, CAMEO_CAST.leave))
      : 0;
    const emerge = cameo ? Math.min(1, Math.max(0, (stayT - 0.25) / 0.4), Math.max(0, (CAMEO_CAST.stay - CAMEO_CAST.leave * 0.5 - stayT) / 0.3)) : 0;
    const centerX = arena.player.x + CAMEO_CAST.offsetX;
    const bob = Math.sin(t * 2.6) * 0.15;
    const baseY = 3.1 + bob;
    const count = cameo && !isShip && emerge > 0 ? cameo.members.length : 0;

    MEMBER_SLOTS.forEach((i) => {
      const figure = figures.current[i];
      if (!figure) return;
      figure.visible = i < count;
      if (i >= count) return;
      const offset = (i - (count - 1) / 2) * 1.15;
      figure.position.set(centerX + offset, baseY * s, z);
      // Luffy (Gear 5): si schiaccia e si stira come un cartone; gli altri ondeggiano appena.
      const wobble = isToon ? 0.3 * Math.sin(t * 13) : 0.02 * Math.sin(t * 3 + i);
      // Quando aiuta, l'ospite fa un piccolo balzo (allyFlash).
      const pop = (1 + Math.max(0, mode.allyFlash) * 0.5) * emerge;
      figure.scale.set(s * (1 + wobble) * pop, s * (1 - wobble * 0.8) * pop, 1);
      figure.rotation.z = isToon ? 0.12 * Math.sin(t * 9) : 0;
    });
    // Il portale: anello esterno e interno che ruotano in senso opposto e un nucleo scuro.
    const portalOn = portalScale > 0.01;
    const portalPos = (obj: Group | Mesh | null, z0: number): void => {
      if (!obj) return;
      obj.visible = portalOn;
      obj.position.set(centerX, baseY * s, z0);
      obj.scale.setScalar(Math.max(0.001, portalScale * 1.7 * s));
    };
    portalPos(portalCore.current, z - 0.08);
    portalPos(portalOuter.current, z - 0.06);
    portalPos(portalInner.current, z - 0.04);
    if (portalOuter.current) portalOuter.current.rotation.z = t * 3;
    if (portalInner.current) portalInner.current.rotation.z = -t * 4.5;
    if (aura.current) {
      aura.current.visible = isToon && emerge > 0.5;
      if (isToon) {
        aura.current.position.set(centerX, baseY * s, z - 0.05);
        aura.current.scale.setScalar(s * (1.1 + 0.25 * Math.sin(t * 8)));
      }
    }

    // La Going Merry: una nave che spara; durante il lampo dell'incantesimo escono le cannonate.
    const boat = ship.current;
    if (boat) {
      boat.visible = isShip && emerge > 0;
      if (isShip) {
        boat.position.set(centerX + 0.6, (baseY - 0.2 + Math.sin(t * 3) * 0.12) * s, z);
        boat.rotation.z = Math.sin(t * 2.2) * 0.05;
        boat.scale.setScalar(s * Math.max(0.001, emerge));
      }
      puffs.current.forEach((puff, i) => {
        if (!puff) return;
        const burst = isShip ? Math.max(0, mode.allyFlash / 0.45) : 0;
        puff.visible = burst > 0;
        if (burst > 0) {
          puff.position.set(1.6 + (1 - burst) * (2.2 + i * 0.7), 0.1 - i * 0.05, 0.1);
          puff.scale.setScalar(0.3 + (1 - burst) * 0.5);
          (puff.material as MeshBasicMaterial).opacity = burst;
        }
      });
    }

    // Nome e fumetto sopra le teste (o sopra la nave).
    const top = (isShip ? 2.5 : 1.55) * s;
    if (tag.current) {
      tag.current.visible = cameo !== undefined && emerge > 0.9;
      tag.current.position.set(centerX, baseY * s + top, z + 0.02);
      tag.current.scale.setScalar(s);
    }
    if (bubble.current) {
      bubble.current.visible = cameo !== undefined && emerge > 0.9;
      bubble.current.position.set(centerX, baseY * s + top + 1.05 * s, z + 0.03);
      bubble.current.scale.setScalar(s);
    }
  });

  return (
    <>
      <mesh ref={portalCore} visible={false}>
        <circleGeometry args={[0.95, 28]} />
        <meshBasicMaterial color="#1e0b3a" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh ref={portalOuter} visible={false}>
        <ringGeometry args={[0.95, 1.2, 28, 1, 0, Math.PI * 1.6]} />
        <meshBasicMaterial color="#c4b5fd" transparent opacity={0.95} depthWrite={false} />
      </mesh>
      <mesh ref={portalInner} visible={false}>
        <ringGeometry args={[0.6, 0.78, 24, 1, 0, Math.PI * 1.3]} />
        <meshBasicMaterial color="#f0abfc" transparent opacity={0.95} depthWrite={false} />
      </mesh>
      <mesh ref={aura} visible={false}>
        <circleGeometry args={[1.3, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      {MEMBER_SLOTS.map((i) => (
        <group key={i} ref={(el) => { figures.current[i] = el; }} visible={false}>
          <mesh position={[0, 0.1, -0.02]}>
            <planeGeometry args={[0.86, 0.62]} />
            <meshBasicMaterial ref={(el) => { hairMats.current[i] = el; }} color="#111827" />
          </mesh>
          <mesh position={[0, -0.25, 0]}>
            <planeGeometry args={[0.8, 1.25]} />
            <meshBasicMaterial ref={(el) => { bodyMats.current[i] = el; }} color="#6b7280" />
          </mesh>
          <mesh position={[0, -0.5, 0.01]}>
            <planeGeometry args={[0.82, 0.16]} />
            <meshBasicMaterial ref={(el) => { accentMats.current[i] = el; }} color="#e5e7eb" />
          </mesh>
          <mesh position={[0, 0.62, 0.01]}>
            <planeGeometry args={[0.48, 0.48]} />
            <meshBasicMaterial color="#f3d9c4" />
          </mesh>
          <mesh position={[0, 0.92, 0.02]}>
            <planeGeometry args={[0.56, 0.2]} />
            <meshBasicMaterial color="#111827" transparent opacity={0.25} />
          </mesh>
          <mesh position={[-0.12, 0.64, 0.03]}>
            <planeGeometry args={[0.07, 0.1]} />
            <meshBasicMaterial color="#10131a" />
          </mesh>
          <mesh position={[0.12, 0.64, 0.03]}>
            <planeGeometry args={[0.07, 0.1]} />
            <meshBasicMaterial color="#10131a" />
          </mesh>
          <mesh ref={(el) => { swords.current[i] = el; }} position={[0.62, -0.05, 0.02]} rotation={[0, 0, -0.35]} visible={false}>
            <planeGeometry args={[0.09, 1.5]} />
            <meshBasicMaterial color="#e2e8f0" />
          </mesh>
          <group ref={(el) => { staffs.current[i] = el; }} position={[0.62, -0.1, 0.02]} visible={false}>
            <mesh rotation={[0, 0, -0.1]}>
              <planeGeometry args={[0.07, 1.9]} />
              <meshBasicMaterial color="#92400e" />
            </mesh>
            <mesh position={[-0.1, 0.98, 0.01]}>
              <circleGeometry args={[0.2, 14]} />
              <meshBasicMaterial color="#a5f3fc" />
            </mesh>
          </group>
        </group>
      ))}
      <group ref={ship} visible={false}>
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[3.4, 0.7]} />
          <meshBasicMaterial ref={shipHullMat} color="#a16207" />
        </mesh>
        <mesh position={[0, 0.4, 0.01]}>
          <planeGeometry args={[3.6, 0.14]} />
          <meshBasicMaterial color="#7c2d12" />
        </mesh>
        <mesh position={[-0.2, 1.5, -0.01]}>
          <planeGeometry args={[0.12, 2.6]} />
          <meshBasicMaterial color="#78350f" />
        </mesh>
        <mesh position={[-0.2, 1.7, 0]}>
          <planeGeometry args={[1.8, 1.7]} />
          <meshBasicMaterial ref={shipSailMat} color="#f8fafc" />
        </mesh>
        <mesh position={[1.7, 0.55, 0.01]}>
          <circleGeometry args={[0.3, 12]} />
          <meshBasicMaterial color="#f8fafc" />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} ref={(el) => { puffs.current[i] = el; }} visible={false}>
            <circleGeometry args={[1, 12]} />
            <meshBasicMaterial color="#fb923c" transparent opacity={0.9} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <mesh ref={tag} visible={false}>
        <planeGeometry args={[2.4, 0.4]} />
        <meshBasicMaterial ref={tagMat} transparent depthWrite={false} />
      </mesh>
      <mesh ref={bubble} visible={false}>
        <planeGeometry args={[3.6, 1.24]} />
        <meshBasicMaterial ref={bubbleMat} transparent depthWrite={false} />
      </mesh>
    </>
  );
}
