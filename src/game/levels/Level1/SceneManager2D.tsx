import { Suspense, useEffect, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { GameCanvas } from '@/components/GameCanvas';
import { OrthographicCamera } from '@react-three/drei';
import { useFollowCameraX } from '@/game/render2d/useFollowCameraX';
import { useActionPress } from '@/input/useInputHooks';
import { CharacterAnimator2D } from '@/game/render2d/CharacterAnimator2D';
import { CutscenePlayer } from '@/game/cutscenes/CutscenePlayer';
import { LEVEL1_TRIGGERS_PLACEHOLDER } from '@/data/level1/triggers';
import { useLevelStore, type LevelPhase } from '@/store/levelStore';
import { Player2D, type PlayerPosition } from './Player2D';
import { EveCompanion } from './EveCompanion';
import { Level1Backdrop } from './Level1Backdrop';
import { Spaceship } from './Spaceship';
import { DoorPrompt } from './DoorPrompt';
import { DoorPromptDriver } from './DoorPromptDriver';
import {
  BACKDROP_WIDTH,
  CAMERA_EYE_Y,
  CAMERA_FOLLOW_SMOOTHING,
  CAMERA_VIEW_HEIGHT,
  CAMERA_Z,
  GROUND_Y,
  PLAYER_HEIGHT
} from './level1Config';
import { ControlsHint } from '@/components/ActionGlyph';
import styles from './SceneManager2D.module.css';

const { startX, eveStartX } = LEVEL1_TRIGGERS_PLACEHOLDER;

/** Zoom che fa entrare nello schermo `CAMERA_VIEW_HEIGHT` unità di altezza (scala uniforme: niente stretching). */
function zoomForHeight(screenHeight: number): number {
  return screenHeight / CAMERA_VIEW_HEIGHT;
}

/** La camera non esce dall'immagine: X limitata in modo che i bordi dello schermo restino dentro lo sfondo. */
function clampCameraX(x: number, screenWidth: number, zoom: number): number {
  const halfView = screenWidth / zoom / 2;
  if (halfView >= BACKDROP_WIDTH / 2) return BACKDROP_WIDTH / 2;
  return Math.min(BACKDROP_WIDTH - halfView, Math.max(halfView, x));
}

function CameraRig({ playerPositionRef }: { playerPositionRef: MutableRefObject<PlayerPosition> }) {
  const size = useThree((state) => state.size);
  const zoom = zoomForHeight(size.height);
  useFollowCameraX(() => clampCameraX(playerPositionRef.current.x, size.width, zoom), {
    offsetY: CAMERA_EYE_Y,
    smoothing: CAMERA_FOLLOW_SMOOTHING
  });
  return null;
}

/**
 * D ed Eve già in posizione (sul marciapiede, rivolti verso il cinema), fermi, dietro il video d'apertura (Fase 4 del
 * piano, vedi docs/PIANO_LIVELLO1_2D.md) — nessun `Player2D` montato: il
 * giocatore non comanda nulla finché il dialogo non finisce, stesso
 * principio del menu (niente controllo prima della fase `ready`).
 */
function IntroStaging() {
  return (
    <>
      <CharacterAnimator2D variant="D0" state="idle" facing={-1} height={PLAYER_HEIGHT} position={[startX, GROUND_Y, 0]} />
      <CharacterAnimator2D variant="Eve" state="idle" facing={-1} height={PLAYER_HEIGHT} position={[eveStartX, GROUND_Y, 0]} />
    </>
  );
}

interface CamminoLiberoProps {
  playerPositionRef: MutableRefObject<PlayerPosition>;
  inZoneRef: MutableRefObject<boolean>;
  nearDoorRef: MutableRefObject<boolean>;
  promptRef: RefObject<HTMLDivElement>;
  /** `false` dopo che si è premuto «Entra»: il suggerimento sparisce. */
  doorEnabled: boolean;
  /** Eve è ancora con D (non lo è più dopo il primo ingresso nell'Ariston). */
  eveWithParty: boolean;
}

/** Gameplay vero: D comandabile, Eve che lo segue; l'ingresso nell'Ariston è sulla porta centrale (`DoorPromptDriver` + pressione di
 *  «interagisci» in `SceneManager2D`). */
function CamminoLibero({ playerPositionRef, inZoneRef, nearDoorRef, promptRef, doorEnabled, eveWithParty }: CamminoLiberoProps) {
  // `playerPositionRef.current.x` è già `lateralSpawnX` (seminato al mount di `SceneManager2D`): sia la prima volta (= `startX`) sia
  // tornando dall'interno isometrico (= `aristonExitX`), senza bisogno di distinguere i due casi qui — salvo il verso in cui guardano:
  // all'inizio verso il cinema (sinistra), uscendo dalla porta verso la strada (destra).
  const facing = playerPositionRef.current.x === startX ? -1 : 1;
  return (
    <>
      <Player2D
        positionRef={playerPositionRef}
        initialX={playerPositionRef.current.x}
        initialFacing={facing}
        suppressPadJumpRef={nearDoorRef}
      />
      {eveWithParty && (
        <EveCompanion
          targetPositionRef={playerPositionRef}
          initialX={facing === -1 ? eveStartX : undefined}
          initialDirection={facing}
        />
      )}
      <DoorPromptDriver
        playerPositionRef={playerPositionRef}
        inZoneRef={inZoneRef}
        nearDoorRef={nearDoorRef}
        promptRef={promptRef}
        enabled={doorEnabled}
      />
    </>
  );
}

interface Level1Scene2DProps extends CamminoLiberoProps {
  phase: LevelPhase;
}

function Level1Scene2D({ phase, playerPositionRef, inZoneRef, nearDoorRef, promptRef, doorEnabled, eveWithParty }: Level1Scene2DProps) {
  const size = useThree((state) => state.size);
  const zoom = zoomForHeight(size.height);
  // Solo al mount: la camera parte già centrata su D/Eve (poi la segue `CameraRig`), non vola dall'angolo.
  const [startCameraX] = useState(() => clampCameraX(playerPositionRef.current.x, size.width, zoom));
  return (
    <>
      <OrthographicCamera makeDefault position={[startCameraX, CAMERA_EYE_Y, CAMERA_Z]} zoom={zoom} />
      <CameraRig playerPositionRef={playerPositionRef} />

      <Level1Backdrop />
      <Spaceship />

      {phase === 'intro_dialogo' && <IntroStaging />}
      {phase === 'cammino_libero_ariston' && (
        <CamminoLibero
          playerPositionRef={playerPositionRef}
          inZoneRef={inZoneRef}
          nearDoorRef={nearDoorRef}
          promptRef={promptRef}
          doorEnabled={doorEnabled}
          eveWithParty={eveWithParty}
        />
      )}
      {/* Le fasi oltre `cammino_libero_ariston` non hanno ancora contenuto
          (vedi "Ordine consigliato", Fase 4 del piano) — il messaggio vive
          nell'overlay HTML sotto, qui sopra resta solo il fondale. */}
    </>
  );
}

interface SceneManager2DProps {
  /** Accende il whiteout globale (`App.tsx`) prima di entrare nell'interno
   *  isometrico — stesso meccanismo già usato per i cambi schermata (menu→
   *  selezione livelli): qui il "cambio schermata" è solo un cambio di
   *  `phase`, ma il taglio va comunque coperto. */
  onWhiteout: (active: boolean) => void;
}

/**
 * Scena di gioco del Livello 1 in 2D a scorrimento laterale (vedi
 * docs/PIANO_LIVELLO1_2D.md): stesso `<GameCanvas>` R3F di sempre, camera
 * ortografica invece che prospettica, niente Rapier — collisioni a mano via
 * `@/game/render2d`. La macchina a stati (`levelStore`, Fase 4) decide cosa
 * montare: oggi solo `intro_dialogo` (video d'apertura) e
 * `cammino_libero_ariston` (Player2D + IA di compagnia di Eve) hanno
 * contenuto reale — le fasi successive restano un placeholder onesto.
 */
export function SceneManager2D({ onWhiteout }: SceneManager2DProps) {
  const phase = useLevelStore((state) => state.phase);
  const setPhase = useLevelStore((state) => state.setPhase);
  const lateralSpawnX = useLevelStore((state) => state.lateralSpawnX);
  const eveWithParty = useLevelStore((state) => state.eveWithParty);
  // Seminato su `lateralSpawnX` (di default `startX`, dove D e Eve partono davanti al cinema): questo componente smonta del tutto
  // mentre `SceneManager2DIso` è attivo (vedi `App.tsx`), quindi al remount serve un valore che sia sopravvissuto altrove — non può
  // restare solo in un ref locale, vedi il commento su `lateralSpawnX` in `levelStore.ts`.
  const playerPositionRef = useRef<PlayerPosition>({ x: lateralSpawnX, y: GROUND_Y });

  // L'apertura del livello è il video `intro_level1` (che racconta tutto il dialogo d'apertura): a fine o saltando si cammina. Una volta a partita.
  const introSeen = useLevelStore((state) => state.seenCutscenes.includes('intro_level1'));
  // Il video chiude con una dissolvenza al nero: la scena ne esce con una dissolvenza inversa (solo dopo il video, non tornando dall'interno).
  const [fadingIn, setFadingIn] = useState(false);
  const handleIntroFinished = () => {
    useLevelStore.getState().markCutsceneSeen('intro_level1');
    setFadingIn(true);
    setPhase('cammino_libero_ariston');
  };
  useEffect(() => {
    if (phase === 'intro_dialogo' && introSeen) setPhase('cammino_libero_ariston');
  }, [phase, introSeen, setPhase]);

  // Whiteout acceso SUBITO, cambio fase vero un istante dopo (0.55s, quando
  // il bianco ha già coperto lo schermo — stessa transizione CSS da 0.5s di
  // `App.module.css`, stesso pattern di `LevelSelectScene.handleSequenceComplete`):
  // altrimenti si vedrebbe il taglio secco fra scorrimento laterale e
  // interno isometrico invece di una dissolvenza.
  // Eve se ne va da Checco appena D entra: sparisce sotto il bianco, e fuori non c'è più nemmeno quando D riesce.
  const handleEnterAriston = () => {
    onWhiteout(true);
    window.setTimeout(() => {
      useLevelStore.getState().setEveWithParty(false);
      setPhase('attivita_stupide');
    }, 550);
  };

  // Ingresso sulla porta centrale: «interagisci» con D nella zona (la calcola `DoorPromptDriver`). UNA sola attivazione; in pausa il
  // gestore dell'input non consegna le pressioni, e fuori da `cammino_libero_ariston` (video, interno) l'ascolto è spento.
  const inZoneRef = useRef(false);
  const nearDoorRef = useRef(false);
  const promptRef = useRef<HTMLDivElement>(null);
  const [entering, setEntering] = useState(false);
  const enteringRef = useRef(false);
  useActionPress(
    (action) => {
      if (action !== 'interact' || !inZoneRef.current || enteringRef.current) return;
      enteringRef.current = true;
      setEntering(true);
      handleEnterAriston();
    },
    { enabled: phase === 'cammino_libero_ariston' }
  );

  return (
    <div className="scene-shell">
      {/* `flat`: niente tone mapping, i colori della pixel art restano quelli del file. */}
      <GameCanvas flat>
        <Suspense fallback={null}>
          <Level1Scene2D
            phase={phase}
            playerPositionRef={playerPositionRef}
            inZoneRef={inZoneRef}
            nearDoorRef={nearDoorRef}
            promptRef={promptRef}
            doorEnabled={!entering}
            eveWithParty={eveWithParty}
          />
        </Suspense>
      </GameCanvas>

      <DoorPrompt promptRef={promptRef} />

      {phase === 'intro_dialogo' && !introSeen && <CutscenePlayer id="intro_level1" onFinished={handleIntroFinished} />}
      {phase === 'cammino_libero_ariston' && fadingIn && <div className={styles.fadeIn} onAnimationEnd={() => setFadingIn(false)} />}

      {phase === 'cammino_libero_ariston' && (
        <div className={styles.hint}>
          <span className={styles.hintPill}>
            <ControlsHint
              items={[
                { actions: ['left', 'right'], label: 'muoviti' },
                { actions: ['jump'], label: 'salta' }
              ]}
            />
          </span>
        </div>
      )}
    </div>
  );
}
