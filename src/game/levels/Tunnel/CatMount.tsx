import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture } from 'three';
import type { Group, Mesh } from 'three';
import { laneScale, laneZ } from './tunnelLanes';
import type { TunnelWorld } from './tunnelState';

const TUFTS = [0, 1, 2, 3, 4];
const FX = [0, 1, 2];

/** Un'icona disegnata al volo: un cuore (coccole) o una lisca di pesce (pappa). */
function drawFx(kind: 'heart' | 'fish'): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.strokeStyle = '#10131a';
    ctx.lineWidth = 4;
    if (kind === 'heart') {
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(32, 54);
      ctx.bezierCurveTo(4, 34, 10, 8, 32, 22);
      ctx.bezierCurveTo(54, 8, 60, 34, 32, 54);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.ellipse(28, 32, 20, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(46, 32);
      ctx.lineTo(60, 20);
      ctx.lineTo(60, 44);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#10131a';
      ctx.beginPath();
      ctx.arc(16, 29, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Il gatto randagio che D cavalca (placeholder a tinte unite): rossiccio, spelacchiato, con un occhio verde e uno
 * bianco e cieco (con la cicatrice), orecchie a punta, ciuffi di pelo storti e una coda che sventola. Arriva piccolo
 * davanti a D e cresce fino a stargli sotto; le gambe corrono, i cuori salgono alle coccole e i pesci alla pappa.
 * Solo resa: affetto, fame e fine stanno in `tunnelCat.ts`.
 */
export function CatMount({ world }: { world: TunnelWorld }) {
  const root = useRef<Group>(null);
  const tail = useRef<Mesh>(null);
  const legs = useRef<(Mesh | null)[]>([]);
  const head = useRef<Mesh>(null);
  const fx = useRef<(Mesh | null)[]>([]);
  const time = useRef(0);
  const textures = useMemo(() => ({ heart: drawFx('heart'), fish: drawFx('fish') }), []);
  useEffect(
    () => () => {
      textures.heart.dispose();
      textures.fish.dispose();
    },
    [textures]
  );

  useFrame((_, rawDelta) => {
    const g = root.current;
    if (!g) return;
    if (world.arena.hitStop <= 0) time.current += Math.min(rawDelta, 0.05);
    const t = time.current;
    const { cat, arena, lane } = world;
    g.visible = cat.active;
    if (!cat.active) return;
    const player = arena.player;
    const s = laneScale(lane.pos);
    // Piccolo e davanti a D all'inizio; poi cresce e gli si mette sotto.
    const ease = 1 - (1 - cat.grow) ** 3;
    const size = 0.3 + 0.7 * ease;
    g.position.set(player.x + (1 - ease) * 1.6, player.y * s, laneZ(lane.pos) - 0.05);
    g.scale.setScalar(size * s);
    // Corsa: le gambe oscillano a coppie opposte, il corpo sobbalza, la coda sventola.
    g.position.y += Math.abs(Math.sin(t * 12)) * 0.07 * size;
    legs.current.forEach((leg, i) => {
      if (leg) leg.rotation.z = Math.sin(t * 14 + (i % 2) * Math.PI) * 0.7;
    });
    if (tail.current) tail.current.rotation.z = 0.6 + Math.sin(t * 7) * 0.5;
    if (head.current) head.current.rotation.z = Math.sin(t * 3) * 0.05;
    // Cuori (coccole) e pesci (pappa) che salgono e svaniscono.
    fx.current.forEach((mesh, i) => {
      if (!mesh) return;
      const kind = i === 2 ? 'fish' : 'heart';
      const flash = kind === 'heart' ? cat.petFlash : cat.feedFlash;
      mesh.visible = flash > 0;
      if (flash <= 0) return;
      const u = 1 - flash / 0.5;
      mesh.position.set(1.4 + (i - 1) * 0.5, 1.6 + u * 1.6, 0.3);
      mesh.scale.setScalar(0.5 + 0.4 * (1 - u));
      (mesh.material as { opacity: number }).opacity = 1 - u;
    });
  });

  return (
    <group ref={root} visible={false}>
      {/* Coda. */}
      <mesh ref={tail} position={[-1.15, 1.05, -0.02]} rotation={[0, 0, 0.6]}>
        <planeGeometry args={[1.1, 0.2]} />
        <meshBasicMaterial color="#b86a2c" />
      </mesh>
      {/* Gambe (davanti e dietro, due per lato). */}
      {[-0.85, -0.45, 0.55, 0.95].map((x, i) => (
        <mesh key={x} ref={(el) => { legs.current[i] = el; }} position={[x, 0.3, i % 2 === 0 ? -0.03 : 0.03]}>
          <planeGeometry args={[0.26, 0.62]} />
          <meshBasicMaterial color={i % 2 === 0 ? '#9a5522' : '#b86a2c'} />
        </mesh>
      ))}
      {/* Corpo con strisce e chiazze (pelo mancante). */}
      <mesh position={[0, 0.85, 0]}>
        <planeGeometry args={[2.3, 1.0]} />
        <meshBasicMaterial color="#c97b3a" />
      </mesh>
      {[-0.7, -0.15, 0.4].map((x) => (
        <mesh key={x} position={[x, 0.95, 0.01]}>
          <planeGeometry args={[0.12, 0.8]} />
          <meshBasicMaterial color="#8a4b1e" />
        </mesh>
      ))}
      <mesh position={[0.2, 0.55, 0.012]}>
        <planeGeometry args={[0.5, 0.3]} />
        <meshBasicMaterial color="#e8b27e" />
      </mesh>
      <mesh position={[-0.9, 1.1, 0.012]}>
        <planeGeometry args={[0.34, 0.26]} />
        <meshBasicMaterial color="#d9a37a" />
      </mesh>
      {/* Ciuffi storti sul dorso. */}
      {TUFTS.map((i) => (
        <mesh key={i} position={[-0.95 + i * 0.5, 1.42 + (i % 2) * 0.05, 0.015]} rotation={[0, 0, (i % 2 === 0 ? 0.5 : -0.4) + i * 0.1]}>
          <planeGeometry args={[0.1, 0.26]} />
          <meshBasicMaterial color={i % 2 === 0 ? '#c97b3a' : '#8a4b1e'} />
        </mesh>
      ))}
      {/* Testa: orecchie a punta, un occhio verde e uno bianco con la cicatrice, naso e baffi. */}
      <mesh ref={head} position={[1.25, 1.1, 0.02]}>
        <planeGeometry args={[0.95, 0.85]} />
        <meshBasicMaterial color="#c97b3a" />
      </mesh>
      {[0.95, 1.55].map((x, i) => (
        <mesh key={x} position={[x, 1.62, 0.015]} rotation={[0, 0, Math.PI / 4 + (i === 0 ? 0.15 : -0.15)]}>
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial color="#c97b3a" />
        </mesh>
      ))}
      <mesh position={[1.08, 1.17, 0.03]}>
        <circleGeometry args={[0.13, 12]} />
        <meshBasicMaterial color="#84cc16" />
      </mesh>
      <mesh position={[1.08, 1.17, 0.035]}>
        <planeGeometry args={[0.05, 0.2]} />
        <meshBasicMaterial color="#10131a" />
      </mesh>
      <mesh position={[1.45, 1.17, 0.03]}>
        <circleGeometry args={[0.13, 12]} />
        <meshBasicMaterial color="#e5e7eb" />
      </mesh>
      <mesh position={[1.45, 1.17, 0.035]} rotation={[0, 0, -0.6]}>
        <planeGeometry args={[0.04, 0.34]} />
        <meshBasicMaterial color="#7f1d1d" />
      </mesh>
      <mesh position={[1.32, 0.98, 0.03]}>
        <planeGeometry args={[0.14, 0.09]} />
        <meshBasicMaterial color="#f9a8d4" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[1.32 + side * 0.5, 0.97, 0.025]} rotation={[0, 0, side * 0.1]}>
          <planeGeometry args={[0.45, 0.02]} />
          <meshBasicMaterial color="#f3f4f6" />
        </mesh>
      ))}
      {/* Cuori e pesce. */}
      {FX.map((i) => (
        <mesh key={`fx-${i}`} ref={(el) => { fx.current[i] = el; }} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={i === 2 ? textures.fish : textures.heart} transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
