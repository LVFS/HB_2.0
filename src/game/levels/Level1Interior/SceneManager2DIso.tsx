import { Suspense, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { useOverlap } from '@/game/render2d/useOverlap';
import type { AABB } from '@/game/render2d/collision';
import { useLevelStore } from '@/store/levelStore';
import { LEVEL1_TRIGGERS_PLACEHOLDER } from '@/data/level1/triggers';
import { InteriorLevelGeometry } from './InteriorLevelGeometry';
import { PlayerIso, type PlayerPositionIso } from './PlayerIso';
import { useFollowCameraXZ } from './useFollowCameraXZ';
import { useLevelGeometry } from './ldtk/useLevelGeometry';
import type { LevelDoor } from './ldtk/parseLevelGeometry';
import {
  ISO_CAMERA_AZIMUTH,
  ISO_CAMERA_DISTANCE,
  ISO_CAMERA_ELEVATION,
  ISO_CAMERA_FOLLOW_SMOOTHING,
  ISO_CAMERA_ZOOM,
  ISO_PLAYER_HALF_SIZE,
  WORLD_UNIT_PER_CELL
} from './interiorConfig';
import styles from './SceneManager2DIso.module.css';

/** Livello LDtk in cui si entra sempre venendo da fuori (le tre porte con
 *  `targetLevel: 'esterno'` vivono tutte qui, vedi il piano di handoff). */
const ENTRY_LEVEL = 'Piano_terra';
/** Valore sentinella nei dati LDtk: non è un `Level` vero, dice al codice di
 *  uscire del tutto dal modo isometrico (vedi il piano di handoff, §2). */
const EXTERIOR_TARGET = 'esterno';
/** `Level` LDtk della stanza del boss: attraversarne la porta avvia
 *  `boss_fase1` invece di caricare la stanza isometrica. */
const BOSS_ROOM_LEVEL = 'Sala_boss';

interface SceneManager2DIsoProps {
  /** Accende il whiteout globale (`App.tsx`) — stesso identico meccanismo
   *  di `SceneManager2D.handleReachAriston`, usato qui in uscita invece che
   *  in entrata. */
  onWhiteout: (active: boolean) => void;
}

function CameraRig({ playerPositionRef }: { playerPositionRef: MutableRefObject<PlayerPositionIso> }) {
  useFollowCameraXZ(() => playerPositionRef.current, {
    distance: ISO_CAMERA_DISTANCE,
    azimuth: ISO_CAMERA_AZIMUTH,
    elevation: ISO_CAMERA_ELEVATION,
    smoothing: ISO_CAMERA_FOLLOW_SMOOTHING
  });
  return null;
}

interface DoorTriggerProps {
  door: LevelDoor;
  playerPositionRef: MutableRefObject<PlayerPositionIso>;
  onEnter: () => void;
}

/**
 * Zona di teletrasporto invisibile su una porta. Riusa `useOverlap`
 * (render2d/, pensato per X/Y del modo laterale) passando X/Z al posto di
 * X/Y — è generico su due assi qualsiasi, funziona identico (vedi il piano
 * di handoff). Un componente per porta, non un `.map` con l'hook dentro:
 * ogni istanza chiama `useOverlap` una volta sola, le regole degli hook
 * restano rispettate anche se il NUMERO di porte cambia da livello a
 * livello.
 */
function DoorTrigger({ door, playerPositionRef, onEnter }: DoorTriggerProps) {
  const doorBox: AABB = useMemo(
    () => ({
      x: door.col * WORLD_UNIT_PER_CELL,
      y: door.row * WORLD_UNIT_PER_CELL, // "y" qui è la Z di mondo, vedi sopra
      halfWidth: (door.widthCells * WORLD_UNIT_PER_CELL) / 2,
      halfHeight: (door.heightCells * WORLD_UNIT_PER_CELL) / 2
    }),
    [door]
  );

  useOverlap(
    () => ({
      x: playerPositionRef.current.x,
      y: playerPositionRef.current.z,
      halfWidth: ISO_PLAYER_HALF_SIZE,
      halfHeight: ISO_PLAYER_HALF_SIZE
    }),
    () => doorBox,
    { onEnter }
  );

  return null;
}

interface IsoLevelContentProps {
  levelIdentifier: string;
  playerPositionRef: MutableRefObject<PlayerPositionIso>;
  onDoorEnter: (targetLevel: string) => void;
}

/**
 * Contenuto di UN Level LDtk: geometria + player + porte, tutti derivati
 * dallo STESSO `parseLevelGeometry` chiamato qui (stesso hook usato
 * internamente da `InteriorLevelGeometry` — `useLdtkProject` è cache-keyed
 * per URL, quindi non è un secondo fetch di rete, vedi `useLevelGeometry.ts`).
 * Calcolarlo qui invece che riceverlo da un callback tiene spawn/porte
 * disponibili SUBITO, nello stesso render in cui `PlayerIso` li legge per la
 * sua posizione iniziale — leggerli un frame dopo (approccio scartato
 * durante la scrittura) lascerebbe il giocatore fermo al fallback sbagliato.
 */
function IsoLevelContent({ levelIdentifier, playerPositionRef, onDoorEnter }: IsoLevelContentProps) {
  const geometry = useLevelGeometry(levelIdentifier);

  const floorSet = useMemo(() => {
    const set = new Set<string>();
    geometry.floorCells.forEach((cell) => set.add(`${cell.col},${cell.row}`));
    return set;
  }, [geometry]);

  const isFloorCell = (worldX: number, worldZ: number) =>
    floorSet.has(`${Math.floor(worldX / WORLD_UNIT_PER_CELL)},${Math.floor(worldZ / WORLD_UNIT_PER_CELL)}`);

  const spawn = geometry.playerSpawn ?? { col: 1, row: 1 };

  return (
    <>
      <InteriorLevelGeometry levelIdentifier={levelIdentifier} />
      <PlayerIso
        positionRef={playerPositionRef}
        isFloorCell={isFloorCell}
        initialX={spawn.col * WORLD_UNIT_PER_CELL}
        initialZ={spawn.row * WORLD_UNIT_PER_CELL}
      />
      {geometry.doors.map((door, index) => (
        <DoorTrigger
          key={index}
          door={door}
          playerPositionRef={playerPositionRef}
          onEnter={() => onDoorEnter(door.targetLevel)}
        />
      ))}
    </>
  );
}

/**
 * Orchestratore del modo isometrico (vedi FASE5_INTERNO_ISOMETRICO.md):
 * analogo a `SceneManager2D` ma per l'interno dell'Ariston. `currentLevel`
 * è stato locale (quale `Level` LDtk è montato ora) — non serve in
 * `levelStore` globale, è un dettaglio di QUESTA modalità, stesso principio
 * già seguito ovunque nel progetto (fase/schermata globale in gameStore,
 * dettaglio locale nel componente che lo usa).
 */
export function SceneManager2DIso({ onWhiteout }: SceneManager2DIsoProps) {
  const [currentLevel, setCurrentLevel] = useState(ENTRY_LEVEL);
  const playerPositionRef = useRef<PlayerPositionIso>({ x: 0, z: 0 });

  // Stesso pattern di `SceneManager2D.handleReachAriston`/
  // `LevelSelectScene.handleSequenceComplete`: whiteout acceso subito, il
  // cambio di fase vero (che smonta questo componente e rimonta
  // `SceneManager2D`) arriva 0.55s dopo, quando il bianco ha già coperto lo
  // schermo. `lateralSpawnX` va scritto PRIMA del cambio fase: è quello che
  // `SceneManager2D` legge al proprio mount per sapere dove far riapparire D
  // (vedi il commento su `lateralSpawnX` in `levelStore.ts`).
  const handleExitToExterior = () => {
    useLevelStore.getState().setLateralSpawnX(LEVEL1_TRIGGERS_PLACEHOLDER.aristonExitX);
    onWhiteout(true);
    window.setTimeout(() => useLevelStore.getState().setPhase('cammino_libero_ariston'), 550);
  };

  // Entrare in `Sala_boss` non mostra più la stanza isometrica: parte la cutscene
  // pre-boss (`dialogo_pre_boss`, i disegni dello storyboard) che a sua volta, a fine
  // o saltata, avvia il combattimento (`boss_fase1`, arena laterale).
  const handleEnterBossArena = () => {
    onWhiteout(true);
    window.setTimeout(() => useLevelStore.getState().setPhase('dialogo_pre_boss'), 550);
  };

  const handleDoorEnter = (targetLevel: string) => {
    if (targetLevel === EXTERIOR_TARGET) {
      handleExitToExterior();
      return;
    }
    if (targetLevel === BOSS_ROOM_LEVEL) {
      handleEnterBossArena();
      return;
    }
    setCurrentLevel(targetLevel);
  };

  return (
    <div className="scene-shell">
      <Canvas>
        <color attach="background" args={['#1a1a1a']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 20, 10]} intensity={0.8} />
        <OrthographicCamera makeDefault zoom={ISO_CAMERA_ZOOM} near={0.1} far={200} />
        <CameraRig playerPositionRef={playerPositionRef} />

        <Suspense fallback={null}>
          {/* `key` sul livello: al cambio di Level si rimonta tutto da zero
              (geometria, player, porte) invece di riconciliare stato vecchio
              con dati nuovi — più semplice e corretto per un cambio così
              raro (un attraversamento di porta), vedi il piano di handoff. */}
          <IsoLevelContent
            key={currentLevel}
            levelIdentifier={currentLevel}
            playerPositionRef={playerPositionRef}
            onDoorEnter={handleDoorEnter}
          />
        </Suspense>
      </Canvas>

      <div className={styles.hint}>
        <span className={styles.hintPill}>WASD / frecce per muoverti</span>
      </div>
    </div>
  );
}
