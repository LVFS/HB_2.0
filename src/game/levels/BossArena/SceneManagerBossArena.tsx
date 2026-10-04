import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { ArenaHud } from '@/components/ArenaHud';
import { useArenaStore } from '@/store/arenaStore';
import { useLevelStore } from '@/store/levelStore';
import { ArenaBackdrop } from './ArenaBackdrop';
import { ArenaThreats } from './ArenaThreats';
import { BossChecco } from './BossChecco';
import { DamageNumbers } from './DamageNumbers';
import { EveArena } from './EveArena';
import { PlayerArena } from './PlayerArena';
import { PlayerShotsLayer } from './PlayerShotsLayer';
import { createArenaWorld, type ArenaWorld } from './arenaState';
import {
  ARENA_CAMERA_EDGE_MARGIN,
  ARENA_CAMERA_SMOOTHING,
  ARENA_HALF_WIDTH,
  ARENA_CAMERA_EYE_Y,
  ARENA_CAMERA_Z,
  ARENA_CAMERA_ZOOM,
  BOSS_MAX_HP,
  PLAYER_MAX_HP,
  POSTURE_MAX
} from './arenaConfig';
import styles from './SceneManagerBossArena.module.css';

/**
 * Camera dell'arena: insegue il punto medio fra giocatore e boss (così entrambi
 * restano in vista in un'arena più larga dello schermo), con un clamp ai bordi
 * perché non esca mai a mostrare il vuoto oltre il fondale. Stessa idea di
 * `useFollowCameraX` (livello esterno), ma con un bersaglio a due punti. Qui la
 * camera non ha altri registi, quindi si scrive `camera.position` direttamente.
 */
function ArenaCameraRig({ world }: { world: ArenaWorld }) {
  const camera = useThree((state) => state.camera);
  const viewportWidth = useThree((state) => state.size.width);

  useFrame(() => {
    const midpoint = (world.player.x + world.boss.x) / 2;
    const halfView = viewportWidth / 2 / ARENA_CAMERA_ZOOM;
    const limit = ARENA_HALF_WIDTH + ARENA_CAMERA_EDGE_MARGIN - halfView;
    const target = limit > 0 ? Math.min(limit, Math.max(-limit, midpoint)) : 0;
    camera.position.x += (target - camera.position.x) * ARENA_CAMERA_SMOOTHING;
  });
  return null;
}

interface SceneManagerBossArenaProps {
  /** Accende il whiteout globale (`App.tsx`) prima di lasciare l'arena. */
  onWhiteout: (active: boolean) => void;
}

/**
 * Arena del boss (`boss_fase1`, vedi il piano di combattimento): scorrimento
 * laterale come `SceneManager2D`, ma su un palco piccolo e chiuso con camera
 * fissa — un combattimento con parry si legge a schermo intero, non ha
 * bisogno di inseguire il giocatore. Contiene giocatore, Checco, Eve, lo
 * sfondo e la HUD. `world` è l'unico oggetto mutabile che i tre personaggi si
 * scambiano ogni frame (mai stato React); `runId` rimonta tutto da zero dopo
 * una sconfitta.
 *
 * Fine del combattimento: vittoria (Checco fugge) → `transizione_seconda_spada`,
 * come da narrazione originale; sconfitta → si ricomincia l'arena.
 */
export function SceneManagerBossArena({ onWhiteout }: SceneManagerBossArenaProps) {
  const [runId, setRunId] = useState(0);
  const world = useMemo(() => {
    void runId;
    return createArenaWorld();
  }, [runId]);

  useEffect(() => {
    useArenaStore.getState().reset(PLAYER_MAX_HP, BOSS_MAX_HP, POSTURE_MAX);
    // Solo in sviluppo: il mondo esposto su `window` permette di provare
    // esiti/round senza giocare un intero combattimento (es. da console
    // `__arenaWorld.boss.hp = 60`). Sparisce nella build pubblicata.
    if (import.meta.env.DEV) {
      const debugWindow = window as unknown as { __arenaWorld?: unknown; __arenaStore?: unknown };
      debugWindow.__arenaWorld = world;
      debugWindow.__arenaStore = useArenaStore;
    }
  }, [world]);

  const handleVictory = () => {
    onWhiteout(true);
    window.setTimeout(() => useLevelStore.getState().setPhase('transizione_seconda_spada'), 550);
  };
  const handleDefeat = () => setRunId((id) => id + 1);
  const powerUp = useArenaStore((state) => state.powerUp);

  return (
    <div className="scene-shell">
      <Canvas>
        <Suspense fallback={null}>
          <OrthographicCamera
            makeDefault
            position={[0, ARENA_CAMERA_EYE_Y, ARENA_CAMERA_Z]}
            zoom={ARENA_CAMERA_ZOOM}
          />
          <ArenaCameraRig world={world} />
          <ArenaBackdrop key={runId} />
          <EveArena key={`eve-${runId}`} world={world} />
          <BossChecco key={`boss-${runId}`} world={world} onVictory={handleVictory} onDefeat={handleDefeat} />
          <ArenaThreats key={`threats-${runId}`} world={world} />
          <PlayerArena key={`player-${runId}`} world={world} />
          <PlayerShotsLayer key={`shots-${runId}`} world={world} />
          <DamageNumbers key={`damage-${runId}`} world={world} />
        </Suspense>
      </Canvas>

      <ArenaHud />

      <div className={styles.hint}>
        <span className={styles.hintPill}>
          A/D muovi · Spazio salta (anche doppio) · J attacca · {powerUp ? 'K spara (para)' : 'K para'} · Shift schiva · R cura
          · E abilità{powerUp ? ' · Q berserk (furia piena)' : ''} · F richiama Eve
          {import.meta.env.DEV ? ' · 1/2/3 anteprima colpo/barcollo/parata' : ''}
        </span>
      </div>
    </div>
  );
}
