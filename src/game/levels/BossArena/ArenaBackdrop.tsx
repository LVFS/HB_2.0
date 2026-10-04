import { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { CanvasTexture } from 'three';
import type { MeshBasicMaterial } from 'three';
import { useArenaStore, type ArenaBackdropId } from '@/store/arenaStore';
import { ARENA_GROUND_Y, ARENA_HALF_WIDTH } from './arenaConfig';

const CROSSFADE_DURATION = 0.7;

/** Textures dello schermo generate al volo via `<canvas>` (nessun asset da
 *  scaricare, come già per le nuvole del menu): segnaposto finché non ci
 *  saranno i fotogrammi veri dei due film. */
function makeScreenTexture(kind: ArenaBackdropId): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    if (kind === 'sala') {
      ctx.fillStyle = '#0d0a18';
      ctx.fillRect(0, 0, 512, 256);
    } else if (kind === 'buen_camino') {
      // Tramonto sul cammino: cielo caldo, sole, colline in ombra.
      const sky = ctx.createLinearGradient(0, 0, 0, 256);
      sky.addColorStop(0, '#f6b26b');
      sky.addColorStop(1, '#b8501a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = '#ffe7a3';
      ctx.beginPath();
      ctx.arc(360, 130, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a2410';
      ctx.beginPath();
      ctx.moveTo(0, 256);
      ctx.lineTo(0, 190);
      ctx.quadraticCurveTo(130, 140, 260, 200);
      ctx.quadraticCurveTo(380, 160, 512, 205);
      ctx.lineTo(512, 256);
      ctx.fill();
    } else if (kind === 'bloodborne') {
      // Bloodborne (placeholder): notte gotica color sangue, luna enorme,
      // guglie e lampioni in controluce. Da sostituire col video/asset veri.
      const sky = ctx.createLinearGradient(0, 0, 0, 256);
      sky.addColorStop(0, '#3a0d16');
      sky.addColorStop(1, '#0b0407');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 512, 256);
      const halo = ctx.createRadialGradient(330, 90, 10, 330, 90, 120);
      halo.addColorStop(0, 'rgba(231, 201, 192, 0.55)');
      halo.addColorStop(1, 'rgba(231, 201, 192, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = '#e7c9c0';
      ctx.beginPath();
      ctx.arc(330, 90, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#050204';
      // Skyline di guglie.
      const spires: [number, number, number][] = [
        [20, 70, 40], [70, 120, 28], [105, 50, 44], [160, 100, 30],
        [215, 60, 38], [290, 130, 26], [400, 85, 40], [450, 55, 46]
      ];
      for (const [x, top, width] of spires) {
        ctx.beginPath();
        ctx.moveTo(x, 256);
        ctx.lineTo(x, top + 30);
        ctx.lineTo(x + width / 2, top - 30);
        ctx.lineTo(x + width, top + 30);
        ctx.lineTo(x + width, 256);
        ctx.fill();
      }
      ctx.fillRect(0, 214, 512, 42);
      // Lampioni.
      ctx.fillStyle = '#f2b95e';
      for (const x of [60, 190, 330, 470]) ctx.fillRect(x, 176, 5, 5);
      ctx.fillStyle = '#050204';
      for (const x of [60, 190, 330, 470]) ctx.fillRect(x + 2, 180, 1, 36);
    } else {
      // "Altro film" (placeholder): notte blu con luna e qualche stella.
      const sky = ctx.createLinearGradient(0, 0, 0, 256);
      sky.addColorStop(0, '#173d7d');
      sky.addColorStop(1, '#070d1c');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = '#e8f0ff';
      for (let i = 0; i < 40; i += 1) {
        ctx.fillRect((i * 97) % 512, (i * 53) % 170, 2, 2);
      }
      ctx.beginPath();
      ctx.arc(150, 80, 28, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Scenografia dell'arena: lo schermo del cinema (da cui esce Checco, vedi
 * `dialogo_pre_boss`), pavimento e pilastri ai capi del palco. Lo schermo
 * cambia col film in corso: due piani sovrapposti, quello davanti sale in
 * opacità e poi passa dietro — stessa tecnica del crossfade D0→D1 in
 * `CharacterAnimator2D`, applicata allo sfondo. Lo sfondo attuale viene da
 * `useArenaStore.backdrop`.
 */
export function ArenaBackdrop() {
  const backdrop = useArenaStore((state) => state.backdrop);
  const textures = useMemo(
    () => ({
      sala: makeScreenTexture('sala'),
      buen_camino: makeScreenTexture('buen_camino'),
      altro_film: makeScreenTexture('altro_film'),
      bloodborne: makeScreenTexture('bloodborne')
    }),
    []
  );
  useEffect(() => () => Object.values(textures).forEach((t) => t.dispose()), [textures]);

  const bottomMat = useRef<MeshBasicMaterial>(null);
  const topMat = useRef<MeshBasicMaterial>(null);
  const shown = useRef<ArenaBackdropId>('sala');

  useEffect(() => {
    const top = topMat.current;
    const bottom = bottomMat.current;
    if (!top || !bottom || backdrop === shown.current) return;
    top.map = textures[backdrop];
    top.opacity = 0;
    top.needsUpdate = true;
    const tween = gsap.to(top, {
      opacity: 1,
      duration: CROSSFADE_DURATION,
      ease: 'power1.inOut',
      onComplete: () => {
        bottom.map = textures[backdrop];
        bottom.needsUpdate = true;
        top.opacity = 0;
        shown.current = backdrop;
      }
    });
    return () => {
      tween.kill();
    };
  }, [backdrop, textures]);

  return (
    <>
      <mesh position={[0, 3, -6]}>
        <planeGeometry args={[ARENA_HALF_WIDTH * 2 + 8, 10]} />
        <meshBasicMaterial color="#1b1230" />
      </mesh>
      {/* Schermo del cinema: cornice chiara + due superfici sovrapposte. */}
      <mesh position={[0, 3.2, -5.5]}>
        <planeGeometry args={[ARENA_HALF_WIDTH * 2 + 1, 5.6]} />
        <meshBasicMaterial color="#d8d3e8" />
      </mesh>
      <mesh position={[0, 3.2, -5.4]}>
        <planeGeometry args={[ARENA_HALF_WIDTH * 2 + 0.6, 5.2]} />
        <meshBasicMaterial ref={bottomMat} map={textures.sala} />
      </mesh>
      <mesh position={[0, 3.2, -5.3]}>
        <planeGeometry args={[ARENA_HALF_WIDTH * 2 + 0.6, 5.2]} />
        <meshBasicMaterial ref={topMat} map={textures.sala} transparent opacity={0} />
      </mesh>

      <mesh position={[0, ARENA_GROUND_Y - 0.4, 0]}>
        <planeGeometry args={[ARENA_HALF_WIDTH * 2 + 4, 0.8]} />
        <meshBasicMaterial color="#3b2a52" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (ARENA_HALF_WIDTH + 1.2), 1.6, -1]}>
          <planeGeometry args={[0.9, 3.6]} />
          <meshBasicMaterial color="#2a1e3d" />
        </mesh>
      ))}
    </>
  );
}
