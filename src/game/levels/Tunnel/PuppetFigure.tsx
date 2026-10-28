import type { Ref } from 'react';
import type { MeshBasicMaterial } from 'three';
import { BOSS_HALF_WIDTH, BOSS_HEIGHT } from '../BossArena/arenaConfig';

/**
 * Il corpo della marionetta di Checco (segnaposto a tinte unite): busto, testa,
 * occhio, snodi scuri e — se `strings` — i fili che salgono dalla testa. Lo
 * usano sia la marionetta che corre davanti a D sia la finestra che la mostra
 * quando è fuori scena. `bodyMaterial` serve a farla lampeggiare di bianco.
 */
export function PuppetFigure({ bodyMaterial, strings = true }: { bodyMaterial?: Ref<MeshBasicMaterial>; strings?: boolean }) {
  return (
    <>
      <mesh position={[0, BOSS_HEIGHT * 0.34, 0]}>
        <planeGeometry args={[BOSS_HALF_WIDTH * 2, BOSS_HEIGHT * 0.68]} />
        <meshBasicMaterial ref={bodyMaterial} color="#cdb892" />
      </mesh>
      <mesh position={[0, BOSS_HEIGHT * 0.83, 0]}>
        <planeGeometry args={[BOSS_HALF_WIDTH * 1.2, BOSS_HALF_WIDTH * 1.2]} />
        <meshBasicMaterial color="#e0b48a" />
      </mesh>
      <mesh position={[BOSS_HALF_WIDTH * 0.25, BOSS_HEIGHT * 0.86, 0.05]}>
        <planeGeometry args={[0.18, 0.1]} />
        <meshBasicMaterial color="#1a1a1a" />
      </mesh>
      {/* Snodi scuri (stesso aspetto della marionetta del finale). */}
      {[0.2, 0.46, 0.62].map((fraction) => (
        <mesh key={fraction} position={[0, BOSS_HEIGHT * fraction, 0.06]}>
          <planeGeometry args={[BOSS_HALF_WIDTH * 2, 0.07]} />
          <meshBasicMaterial color="#2b1d12" />
        </mesh>
      ))}
      {strings &&
        [-0.34, 0, 0.34].map((x) => (
          <mesh key={x} position={[x, BOSS_HEIGHT + 4, 0.02]}>
            <planeGeometry args={[0.035, 8]} />
            <meshBasicMaterial color="#e5e7eb" transparent opacity={0.75} />
          </mesh>
        ))}
    </>
  );
}
