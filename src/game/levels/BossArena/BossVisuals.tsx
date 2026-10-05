import type { BossVisualRefs } from './bossRender';
import { BOSS_HALF_WIDTH, BOSS_HEIGHT } from './arenaConfig';

interface BossVisualsProps {
  refs: BossVisualRefs;
  /** Posizione iniziale (la sposta poi il frame). */
  startX: number;
}

/**
 * Cosa si vede di Checco: corpo segnaposto (corpo, testa e "occhio"), la
 * marionetta del finale, lo scudo del Buen Camino, l'avviso giallo/rosso, la
 * zona elettrica, il marcatore del teletrasporto e la scia/hitbox del colpo.
 * Solo JSX: l'aggiornamento ogni frame sta in `bossVisuals.ts`.
 */
export function BossVisuals({ refs, startX }: BossVisualsProps) {
  return (
    <>
      <group ref={refs.group} position={[startX, 0, 0]}>
        {/* Segnaposto: corpo, testa e "occhio" dal lato in cui guarda. */}
        <mesh position={[0, BOSS_HEIGHT * 0.34, 0]}>
          <planeGeometry args={[BOSS_HALF_WIDTH * 2, BOSS_HEIGHT * 0.68]} />
          <meshBasicMaterial ref={refs.bodyMat} color="#7a4b2a" />
        </mesh>
        <mesh position={[0, BOSS_HEIGHT * 0.83, 0]}>
          <planeGeometry args={[BOSS_HALF_WIDTH * 1.2, BOSS_HALF_WIDTH * 1.2]} />
          <meshBasicMaterial color="#e0b48a" />
        </mesh>
        <mesh position={[BOSS_HALF_WIDTH * 0.25, BOSS_HEIGHT * 0.86, 0.05]}>
          <planeGeometry args={[0.18, 0.1]} />
          <meshBasicMaterial color="#1a1a1a" />
        </mesh>
        {/* Marionetta (finale): snodi scuri sul corpo e fili che salgono dalla
            testa. Segnaposto: solo linee, come il resto del boss. */}
        <group ref={refs.marionetteGroup} visible={false}>
          {[0.2, 0.46, 0.62].map((fraction) => (
            <mesh key={fraction} position={[0, BOSS_HEIGHT * fraction, 0.06]}>
              <planeGeometry args={[BOSS_HALF_WIDTH * 2, 0.07]} />
              <meshBasicMaterial color="#2b1d12" />
            </mesh>
          ))}
          <mesh position={[0, BOSS_HEIGHT * 0.34, 0.06]}>
            <planeGeometry args={[0.07, BOSS_HEIGHT * 0.68]} />
            <meshBasicMaterial color="#2b1d12" />
          </mesh>
          {[-0.34, 0, 0.34].map((x) => (
            <mesh key={x} position={[x, BOSS_HEIGHT + 4, 0.02]}>
              <planeGeometry args={[0.035, 8]} />
              <meshBasicMaterial color="#e5e7eb" transparent opacity={0.75} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Scudo di invulnerabilità (oggetti del Buen Camino ancora in piedi). */}
      <mesh ref={refs.shieldMesh} visible={false}>
        <planeGeometry args={[BOSS_HALF_WIDTH * 3.4, BOSS_HEIGHT * 1.2]} />
        <meshBasicMaterial ref={refs.shieldMat} color="#67e8f9" transparent opacity={0.25} />
      </mesh>
      {/* Avviso giallo per i colpi non parabili (SALTA/SCHIVA) sopra il boss. */}
      <mesh ref={refs.warningMesh} visible={false}>
        <planeGeometry args={[2.3, 1.8]} />
        <meshBasicMaterial ref={refs.warningMat} transparent depthTest={false} />
      </mesh>
      {/* Zona elettrica della tempesta (danno a chi ci resta dentro). */}
      <mesh ref={refs.zoneColumn} visible={false}>
        <planeGeometry args={[1, 6]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.15} />
      </mesh>
      <mesh ref={refs.zoneMesh} visible={false}>
        <planeGeometry args={[1, 0.3]} />
        <meshBasicMaterial color="#e0f2fe" transparent opacity={0.8} />
      </mesh>
      {/* Dove ricomparirà Checco dopo il teletrasporto. */}
      <mesh ref={refs.teleportMarker} visible={false}>
        <planeGeometry args={[1.6, 0.26]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.8} />
      </mesh>

      {/* Il colpo attivo si vede sempre; il rettangolo esatto solo in dev. */}
      <mesh ref={refs.slash} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
      </mesh>
      <mesh ref={refs.slashDebug} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.25} />
      </mesh>
    </>
  );
}
