import { Suspense, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { GameCanvas } from '@/components/GameCanvas';
import { OrthographicCamera } from '@react-three/drei';
import { ParallaxLayer } from '@/game/render2d/ParallaxLayer';
import { useFollowCameraX } from '@/game/render2d/useFollowCameraX';
import { useXTrigger } from '@/game/render2d/useXTrigger';
import { CharacterAnimator2D } from '@/game/render2d/CharacterAnimator2D';
import { useDialogue } from '@/hooks/useDialogue';
import { DialogueBox } from '@/components/DialogueBox';
import { LEVEL1_INTRO_DIALOGUE } from '@/data/dialogues/level1_intro';
import { LEVEL1_TRIGGERS_PLACEHOLDER } from '@/data/level1/triggers';
import { useLevelStore, type LevelPhase } from '@/store/levelStore';
import { Player2D, type PlayerPosition } from './Player2D';
import { EveCompanion } from './EveCompanion';
import { DemoObstacle } from './DemoObstacle';
import {
  CAMERA_EYE_Y,
  CAMERA_FOLLOW_SMOOTHING,
  CAMERA_ZOOM,
  CAMERA_Z,
  GROUND_Y,
  PLAYER_HEIGHT,
  WORLD_HALF_WIDTH
} from './level1Config';
import { ControlsHint } from '@/components/ActionGlyph';
import styles from './SceneManager2D.module.css';

const { eveArrivalX, aristonEntranceX } = LEVEL1_TRIGGERS_PLACEHOLDER;
/** Quanto Eve è già distante da D nella messa in scena del dialogo
 *  d'apertura (i due si guardano, non stanno appiccicati). */
const EVE_STAGING_OFFSET = 1.6;

function CameraRig({ playerPositionRef }: { playerPositionRef: MutableRefObject<PlayerPosition> }) {
  useFollowCameraX(() => playerPositionRef.current.x, {
    offsetY: CAMERA_EYE_Y,
    smoothing: CAMERA_FOLLOW_SMOOTHING
  });
  return null;
}

/* Tre bande impilate (cielo/edifici/marciapiede), ognuna alta solo quanto
   la propria fascia: un layer più vicino è opaco, quindi se coprisse
   l'intero frustum nasconderebbe per sempre quelli dietro (bug scoperto a
   schermo in Fase 1). Larghezza 100 (non 80 come in Fase 1): il mondo si è
   allungato per ospitare i trigger segnaposto della Fase 4 (fino a
   `sala1EntranceX = 30`), un layer più stretto lascerebbe un vuoto quando
   la camera arriva ai bordi. Colori a contrasto alto (prospettiva
   atmosferica) solo per rendere visibile lo scorrimento — verranno
   sostituiti dal concept art Ariston ritagliato in layer (Fase 2/3). */
function Background() {
  return (
    <>
      <ParallaxLayer factor={0.15} z={-12} width={100} height={12} y={5} color="#4a6fa5" />
      <ParallaxLayer factor={0.4} z={-6} width={100} height={6} y={0} color="#243b5c" />
      <ParallaxLayer factor={0.7} z={-2} width={100} height={3} y={-2.5} color="#4a4f5c" />

      {/* Pavimento calpestabile segnaposto. */}
      <mesh position={[0, GROUND_Y - 0.15, 0]}>
        <planeGeometry args={[WORLD_HALF_WIDTH * 2 + 4, 0.3]} />
        <meshBasicMaterial color="#334155" />
      </mesh>
    </>
  );
}

/**
 * D ed Eve già arrivati, fermi, per la cutscene di apertura (Fase 4 del
 * piano, vedi docs/PIANO_LIVELLO1_2D.md) — nessun `Player2D` montato: il
 * giocatore non comanda nulla finché il dialogo non finisce, stesso
 * principio del menu (niente controllo prima della fase `ready`).
 */
function IntroStaging() {
  return (
    <>
      <CharacterAnimator2D variant="D0" state="idle" facing={1} height={PLAYER_HEIGHT} position={[eveArrivalX, GROUND_Y, 0]} />
      <CharacterAnimator2D
        variant="Eve"
        state="idle"
        facing={-1}
        height={PLAYER_HEIGHT}
        position={[eveArrivalX + EVE_STAGING_OFFSET, GROUND_Y, 0]}
      />
    </>
  );
}

interface CamminoLiberoProps {
  playerPositionRef: MutableRefObject<PlayerPosition>;
  onReachAriston: () => void;
}

/** Gameplay vero: D comandabile, Eve che lo segue, verso l'ingresso
 *  dell'Ariston (`aristonEntranceX`, Fase 4 del piano). */
function CamminoLibero({ playerPositionRef, onReachAriston }: CamminoLiberoProps) {
  useXTrigger(() => playerPositionRef.current.x, aristonEntranceX, onReachAriston);

  // `playerPositionRef.current.x` è già `lateralSpawnX` (seminato al mount
  // di `SceneManager2D`, vedi sopra): sia la prima volta (= `eveArrivalX`,
  // dove si è fermato il dialogo d'apertura) sia tornando dall'interno
  // isometrico (= `aristonExitX`), senza bisogno di distinguere i due casi
  // qui.
  return (
    <>
      <Player2D positionRef={playerPositionRef} initialX={playerPositionRef.current.x} />
      <EveCompanion targetPositionRef={playerPositionRef} />
      <DemoObstacle playerPositionRef={playerPositionRef} />
    </>
  );
}

interface Level1Scene2DProps {
  phase: LevelPhase;
  playerPositionRef: MutableRefObject<PlayerPosition>;
  onReachAriston: () => void;
}

function Level1Scene2D({ phase, playerPositionRef, onReachAriston }: Level1Scene2DProps) {
  return (
    <>
      <OrthographicCamera makeDefault position={[0, CAMERA_EYE_Y, CAMERA_Z]} zoom={CAMERA_ZOOM} />
      <CameraRig playerPositionRef={playerPositionRef} />

      <Background />

      {phase === 'intro_dialogo' && <IntroStaging />}
      {phase === 'cammino_libero_ariston' && (
        <CamminoLibero playerPositionRef={playerPositionRef} onReachAriston={onReachAriston} />
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
 * montare: oggi solo `intro_dialogo` (dialogo vero) e
 * `cammino_libero_ariston` (Player2D + IA di compagnia di Eve) hanno
 * contenuto reale — le fasi successive restano un placeholder onesto.
 */
export function SceneManager2D({ onWhiteout }: SceneManager2DProps) {
  const phase = useLevelStore((state) => state.phase);
  const setPhase = useLevelStore((state) => state.setPhase);
  const lateralSpawnX = useLevelStore((state) => state.lateralSpawnX);
  // Seminato su `lateralSpawnX` (di default `eveArrivalX`, dove la cutscene
  // mette in scena D fermo): questo componente smonta del tutto mentre
  // `SceneManager2DIso` è attivo (vedi `App.tsx`), quindi al remount serve
  // un valore che sia sopravvissuto altrove — non può restare solo in un ref
  // locale, vedi il commento su `lateralSpawnX` in `levelStore.ts`.
  const playerPositionRef = useRef<PlayerPosition>({ x: lateralSpawnX, y: GROUND_Y });

  const introDialogue = useDialogue(LEVEL1_INTRO_DIALOGUE, { enabled: phase === 'intro_dialogo' });

  useEffect(() => {
    if (phase === 'intro_dialogo' && introDialogue.isDone) {
      setPhase('cammino_libero_ariston');
    }
  }, [phase, introDialogue.isDone, setPhase]);

  // Whiteout acceso SUBITO, cambio fase vero un istante dopo (0.55s, quando
  // il bianco ha già coperto lo schermo — stessa transizione CSS da 0.5s di
  // `App.module.css`, stesso pattern di `LevelSelectScene.handleSequenceComplete`):
  // altrimenti si vedrebbe il taglio secco fra scorrimento laterale e
  // interno isometrico invece di una dissolvenza.
  const handleReachAriston = () => {
    onWhiteout(true);
    window.setTimeout(() => setPhase('attivita_stupide'), 550);
  };

  return (
    <div className="scene-shell">
      <GameCanvas>
        <Suspense fallback={null}>
          <Level1Scene2D phase={phase} playerPositionRef={playerPositionRef} onReachAriston={handleReachAriston} />
        </Suspense>
      </GameCanvas>

      {phase === 'intro_dialogo' && introDialogue.currentLine && <DialogueBox line={introDialogue.currentLine} />}

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
