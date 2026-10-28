import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, Vector3 } from 'three';
import type { Group, Mesh, OrthographicCamera } from 'three';
import { PuppetFigure } from './PuppetFigure';
import type { TunnelWindowKind } from './tunnelConfig';
import type { TunnelWorld } from './tunnelState';

/** Dimensioni della finestra (unità di mondo) e distanza dai bordi dello schermo. */
const WIDTH = 3.6;
const HEIGHT = 2.2;
const MARGIN_RIGHT = 0.3;
/** Spazio lasciato in alto per le barre della HUD. */
const MARGIN_TOP = 1.45;
/** Davanti a tutto il resto della scena (camera ortografica a z = 20). */
const Z = 10;
const PUPPET_SCALE = 0.38;
/** Punto di appoggio della finestra, riusato a ogni frame. */
const anchor = new Vector3();

function drawLabel(text: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.beginPath();
    ctx.roundRect(4, 8, 504, 64, 14);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(40, 40, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 66, 42);
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * La finestra sulla marionetta: quando un evento la tiene fuori scena, in alto a
 * destra si apre un piccolo riquadro che mostra cosa sta facendo (in sella allo
 * scooter che si stacca, o alla leva che libera il masso). Ancorata alla camera,
 * davanti a tutto; si apre e si chiude con una piccola animazione. Solo resa: la
 * apre e la chiude `world.window` (`tunnelEvents.ts`). Segnaposto a tinte unite.
 */
export function PuppetWindow({ world }: { world: TunnelWorld }) {
  const camera = useThree((state) => state.camera) as OrthographicCamera;
  const size = useThree((state) => state.size);
  const root = useRef<Group>(null);
  const detach = useRef<Group>(null);
  const boulder = useRef<Group>(null);
  const reality = useRef<Group>(null);
  const karaoke = useRef<Group>(null);
  const notes = useRef<(Mesh | null)[]>([]);
  const orb = useRef<Mesh>(null);
  const bolts = useRef<(Mesh | null)[]>([]);
  const scooter = useRef<Group>(null);
  const wheels = useRef<(Mesh | null)[]>([]);
  const puffs = useRef<(Mesh | null)[]>([]);
  const ticks = useRef<(Mesh | null)[]>([]);
  const lever = useRef<Group>(null);
  const rock = useRef<Mesh>(null);
  const openness = useRef(0);
  const lastKind = useRef<TunnelWindowKind>('detach');
  const clock = useRef(0);

  const labels = useMemo(
    () => ({ detach: drawLabel('CHECCO SI STACCA!'), boulder: drawLabel('CHECCO TIRA LA LEVA!'), reality: drawLabel('CHECCO ALTERA LA REALTÀ!'), karaoke: drawLabel('CHECCO CANTA!'), dark: drawLabel('…') }),
    []
  );
  useEffect(
    () => () => {
      labels.detach.dispose();
      labels.boulder.dispose();
      labels.reality.dispose();
      labels.karaoke.dispose();
      labels.dark.dispose();
    },
    [labels]
  );
  const label = useRef<Mesh>(null);

  useFrame((_, rawDelta) => {
    const g = root.current;
    if (!g) return;
    const delta = Math.min(rawDelta, 0.05);
    const win = world.window;
    openness.current += ((win.open ? 1 : 0) - openness.current) * Math.min(1, 10 * delta);
    if (!win.open && openness.current < 0.02) openness.current = 0;
    g.visible = openness.current > 0;
    if (!g.visible) return;
    clock.current += delta;
    if (win.kind) lastKind.current = win.kind;

    const halfW = size.width / 2 / camera.zoom;
    const halfH = size.height / 2 / camera.zoom;
    // Ancorata alla CAMERA (che è inclinata): si posa in coordinate dello schermo, a Z davanti all'obiettivo, e ne copia l'orientamento.
    camera.updateMatrixWorld();
    anchor.set(halfW - WIDTH / 2 - MARGIN_RIGHT, halfH - MARGIN_TOP - HEIGHT / 2, -Z).applyMatrix4(camera.matrixWorld);
    g.position.copy(anchor);
    g.quaternion.copy(camera.quaternion);
    g.scale.setScalar(0.2 + 0.8 * openness.current);

    const kind = lastKind.current;
    if (detach.current) detach.current.visible = kind === 'detach';
    if (boulder.current) boulder.current.visible = kind === 'boulder';
    if (reality.current) reality.current.visible = kind === 'reality';
    if (karaoke.current) karaoke.current.visible = kind === 'karaoke';
    const mat = label.current?.material as { map: CanvasTexture | null; needsUpdate: boolean } | undefined;
    if (mat && mat.map !== labels[kind]) {
      mat.map = labels[kind];
      mat.needsUpdate = true;
    }

    const t = clock.current;
    // Linee di velocità dietro la scena: scorrono sempre verso sinistra.
    ticks.current.forEach((tick, i) => {
      if (!tick) return;
      const x = WIDTH / 2 - ((t * (2.4 + (i % 3)) + i * 0.7) % (WIDTH + 0.6)) + 0.3;
      tick.position.set(x, -0.2 + (i - 2.5) * 0.17, 0.03);
    });

    if (kind === 'detach' && scooter.current) {
      // Impennata e sobbalzi: lo scooter fugge verso destra.
      scooter.current.position.set(Math.sin(t * 1.4) * 0.14, Math.sin(t * 9) * 0.025, 0.04);
      scooter.current.rotation.z = 0.16 + Math.sin(t * 5) * 0.015;
      wheels.current.forEach((wheel) => {
        if (wheel) wheel.rotation.z = -t * 18;
      });
      puffs.current.forEach((puff, i) => {
        if (!puff) return;
        const u = (t * 1.8 + i * 0.33) % 1;
        puff.position.set(-0.78 - u * 0.8, -0.05 + u * 0.18, -0.01);
        puff.scale.setScalar(0.06 + u * 0.16);
        (puff.material as { opacity: number }).opacity = 0.6 * (1 - u);
      });
    }
    if (kind === 'karaoke') {
      // Checco canta: ondeggia con il microfono e le note musicali salgono dal suo pubblico.
      notes.current.forEach((note, i) => {
        if (!note) return;
        const u = (t * 0.7 + i * 0.33) % 1;
        note.position.set(-0.1 + i * 0.55 + Math.sin(t * 3 + i) * 0.1, -0.5 + u * 1.2, 0.05);
        note.scale.setScalar(0.5 + 0.4 * (1 - u));
        (note.material as { opacity: number }).opacity = 1 - u;
      });
    }
    if (kind === 'reality') {
      // Checco carica un'onda viola fra le braccia alzate: la sfera cresce e i fulmini ruotano.
      const grow = Math.min(1, win.t / 1.8);
      if (orb.current) {
        orb.current.scale.setScalar((0.25 + 0.75 * grow) * (1 + 0.08 * Math.sin(t * 18)));
      }
      bolts.current.forEach((bolt, i) => {
        if (!bolt) return;
        bolt.rotation.z = t * 3 + (i * Math.PI) / 3;
        bolt.scale.set(0.2 + 0.8 * grow, 1, 1);
      });
    }
    if (kind === 'boulder') {
      // Checco tira la leva (dopo un secondo di attesa) e in fondo il masso comincia a rotolare.
      const pull = Math.min(1, Math.max(0, (win.t - 0.9) / 0.6));
      if (lever.current) lever.current.rotation.z = 0.9 - 1.8 * pull;
      const grow = Math.min(1, Math.max(0, (win.t - 1.5) / 1.4));
      if (rock.current) {
        rock.current.scale.setScalar(0.25 + 0.75 * grow);
        rock.current.rotation.z = -win.t * 5;
        rock.current.position.set(0.95 - grow * 0.2, -0.5 + 0.2 * grow, 0.04);
      }
    }
  });

  return (
    <group ref={root} visible={false}>
      <mesh>
        <planeGeometry args={[WIDTH + 0.14, HEIGHT + 0.14]} />
        <meshBasicMaterial color="#facc15" />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshBasicMaterial color="#0b1220" />
      </mesh>
      <mesh position={[0, -HEIGHT / 2 + 0.28, 0.02]}>
        <planeGeometry args={[WIDTH, 0.56]} />
        <meshBasicMaterial color="#1f2d3b" />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} ref={(el) => { ticks.current[i] = el; }}>
          <planeGeometry args={[0.5, 0.025]} />
          <meshBasicMaterial color="#94a3b8" transparent opacity={0.4} />
        </mesh>
      ))}

      {/* Checco che si stacca: la marionetta su uno scooter rosso in impennata. */}
      <group ref={detach}>
        <group ref={scooter}>
          <mesh position={[0, -0.5, 0]}>
            <planeGeometry args={[1.1, 0.2]} />
            <meshBasicMaterial color="#dc2626" />
          </mesh>
          <mesh position={[0.5, -0.32, 0]} rotation={[0, 0, -0.3]}>
            <planeGeometry args={[0.07, 0.45]} />
            <meshBasicMaterial color="#cbd5e1" />
          </mesh>
          {[-0.42, 0.46].map((x, i) => (
            <mesh key={x} ref={(el) => { wheels.current[i] = el; }} position={[x, -0.66, 0.01]}>
              <ringGeometry args={[0.06, 0.2, 14]} />
              <meshBasicMaterial color="#e5e7eb" />
            </mesh>
          ))}
          <group position={[-0.1, -0.4, 0.02]} scale={PUPPET_SCALE}>
            <PuppetFigure strings={false} />
          </group>
          {[0, 1, 2].map((i) => (
            <mesh key={i} ref={(el) => { puffs.current[i] = el; }}>
              <circleGeometry args={[1, 12]} />
              <meshBasicMaterial color="#e5e7eb" transparent opacity={0.5} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Il masso: Checco tira la leva e in fondo la palla comincia a rotolare. */}
      <group ref={boulder} visible={false}>
        <group position={[-0.95, -0.77, 0.02]} scale={PUPPET_SCALE}>
          <PuppetFigure strings={false} />
        </group>
        <mesh position={[-0.35, -0.65, 0.02]}>
          <planeGeometry args={[0.5, 0.1]} />
          <meshBasicMaterial color="#475569" />
        </mesh>
        <group ref={lever} position={[-0.35, -0.6, 0.03]}>
          <mesh position={[0, 0.3, 0]}>
            <planeGeometry args={[0.07, 0.6]} />
            <meshBasicMaterial color="#cbd5e1" />
          </mesh>
          <mesh position={[0, 0.62, 0]}>
            <circleGeometry args={[0.1, 12]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
        </group>
        <mesh ref={rock}>
          <circleGeometry args={[0.45, 20]} />
          <meshBasicMaterial color="#5b6472" />
        </mesh>
      </group>

      {/* Karaoke: Checco con il microfono, il pubblico (tre sagome) e le note che salgono. */}
      <group ref={karaoke} visible={false}>
        <group position={[-0.7, -0.78, 0.02]} scale={PUPPET_SCALE}>
          <PuppetFigure strings={false} />
        </group>
        <mesh position={[-0.35, -0.42, 0.03]} rotation={[0, 0, -0.6]}>
          <planeGeometry args={[0.05, 0.4]} />
          <meshBasicMaterial color="#9ca3af" />
        </mesh>
        <mesh position={[-0.24, -0.25, 0.04]}>
          <circleGeometry args={[0.08, 10]} />
          <meshBasicMaterial color="#f43f5e" />
        </mesh>
        {[0.55, 0.95, 1.35].map((x) => (
          <mesh key={x} position={[x, -0.78, 0.01]}>
            <planeGeometry args={[0.28, 0.4]} />
            <meshBasicMaterial color="#111827" />
          </mesh>
        ))}
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} ref={(el) => { notes.current[i] = el; }} position={[0, 0, 0.05]}>
            <circleGeometry args={[0.1, 10]} />
            <meshBasicMaterial color={i % 2 === 0 ? '#fb923c' : '#facc15'} transparent opacity={0.9} />
          </mesh>
        ))}
      </group>

      {/* L'attacco: Checco con le braccia alzate e l'onda viola che si carica sopra di lui. */}
      <group ref={reality} visible={false}>
        <group position={[-0.5, -0.78, 0.02]} scale={PUPPET_SCALE}>
          <PuppetFigure strings={false} />
        </group>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[-0.5 + side * 0.2, -0.28, 0.03]} rotation={[0, 0, -side * 0.5]}>
            <planeGeometry args={[0.07, 0.42]} />
            <meshBasicMaterial color="#cdb892" />
          </mesh>
        ))}
        <mesh ref={orb} position={[-0.5, 0.18, 0.04]}>
          <circleGeometry args={[0.38, 24]} />
          <meshBasicMaterial color="#c026d3" transparent opacity={0.9} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} ref={(el) => { bolts.current[i] = el; }} position={[-0.5, 0.18, 0.05]}>
            <planeGeometry args={[1, 0.06]} />
            <meshBasicMaterial color="#f5d0fe" transparent opacity={0.85} />
          </mesh>
        ))}
        <mesh position={[0.85, -0.55, 0.03]}>
          <planeGeometry args={[0.9, 0.5]} />
          <meshBasicMaterial color="#7e22ce" transparent opacity={0.25} />
        </mesh>
      </group>

      <mesh ref={label} position={[-WIDTH / 2 + 1.05, HEIGHT / 2 - 0.2, 0.05]}>
        <planeGeometry args={[1.9, 0.3]} />
        <meshBasicMaterial transparent />
      </mesh>
    </group>
  );
}
