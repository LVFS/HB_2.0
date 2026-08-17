import { Component, Suspense, useEffect, useMemo, useRef, type ComponentRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, MapControls, useTexture } from '@react-three/drei';
import { CanvasTexture, RepeatWrapping } from 'three';
import gsap from 'gsap';
import { getLevelMapImageUrl, type LevelInfo } from '@/data/levels';
import { LevelMarker } from './LevelMarker';
import { imageOffsetToPlanePosition, projectToImageOffset } from './mapProjection';

/** Unità mondo per lato di UNA tile della griglia con cui è generata
 * l'immagine statica (vedi `scripts/generate-map-images.mjs`): il piano
 * finale è `PLANE_SIZE_PER_TILE * level.mapGrid` unità, l'immagine finale
 * `TILE_SIZE_PX * level.mapGrid` pixel — griglie diverse per livello (Silì
 * resta a 3, Oristano/Cagliari a 5) danno piani di dimensioni diverse, vedi
 * `getMapGeometry`. */
const PLANE_SIZE_PER_TILE = 12;
const TILE_SIZE_PX = 640;

// Rapporti tarati a vista sul livello di riferimento (Silì, mapGrid=3,
// PLANE_SIZE=36: 27/36, 21/36, 38/36≈1.05, 40/36≈1.11, 90/36=2.5) e poi
// tenuti come FORMULA invece che numeri fissi — bug reale già preso tre
// volte in questa sessione dimenticando di riscalare camera/nebbia insieme
// a PLANE_SIZE quando cambiava; ora che PLANE_SIZE varia per livello
// (mapGrid diverso), la formula previene la quarta ricorrenza.
const CAMERA_FAR_Y_RATIO = 27 / 36;
const CAMERA_FAR_Z_RATIO = 21 / 36;
const MAX_DISTANCE_RATIO = 1.05;
const FOG_NEAR_RATIO = 40 / 36;
const FOG_FAR_RATIO = 2.5;
/** Margine (unità mondo) tenuto tra il bordo del piano e il punto più
 * lontano a cui il pan può portare `controls.target` — vedi il clamp in
 * `CameraRig`. */
const PAN_MARGIN = 3;

const CAMERA_FAR_TARGET = [0, 0, 0] as const;
// Target ad altezza ~1 (non a terra): guarda il marker/modello, non i suoi
// piedi — con un target a y=0 e la camera a soli 2-3 unità di distanza,
// l'angolo era troppo ripido dall'alto e si vedeva perlopiù il piano sotto
// invece del modello (bug reale scovato a schermo, non un dettaglio). Non
// dipende da `level`/`PLANE_SIZE` apposta: il modello/pin restano a
// dimensione reale fissa, questa è l'inquadratura ravvicinata su di loro,
// non sul piano.
const CAMERA_NEAR = { position: [0, 2.1, 4.6] as const, target: [0, 1, 0] as const };

interface MapGeometry {
  planeSize: number;
  imageSize: number;
  cameraFarPosition: readonly [number, number, number];
  maxDistance: number;
  fogNear: number;
  fogFar: number;
}

/** Tutte le grandezze che dipendono dalla dimensione del piano-mappa di
 * QUESTO livello, derivate da `level.mapGrid` — un solo posto dove
 * PLANE_SIZE e tutto ciò che ne dipende (immagine, camera, nebbia, limite
 * di pan) restano coerenti tra loro, invece di costanti sparse da
 * ricordarsi di aggiornare insieme. */
function getMapGeometry(level: LevelInfo): MapGeometry {
  const planeSize = PLANE_SIZE_PER_TILE * level.mapGrid;
  return {
    planeSize,
    imageSize: TILE_SIZE_PX * level.mapGrid,
    cameraFarPosition: [0, planeSize * CAMERA_FAR_Y_RATIO, planeSize * CAMERA_FAR_Z_RATIO],
    maxDistance: planeSize * MAX_DISTANCE_RATIO,
    fogNear: planeSize * FOG_NEAR_RATIO,
    fogFar: planeSize * FOG_FAR_RATIO
  };
}

interface MapPlaneProps {
  level: LevelInfo;
  planeSize: number;
}

/** Il piano texturizzato con la mappa statica — SOLO il piano: se l'immagine
 * manca (non ancora generata, vedi `scripts/generate-map-images.mjs`),
 * questo componente lancia (`useTexture` sospende via Suspense e rilancia
 * l'errore di caricamento) ed è `MapPlaneErrorBoundary` sotto a prendersene
 * cura — il marker vive fuori apposta, non dipende dalla texture e non deve
 * sparire insieme a lei. */
function MapPlaneTexture({ level, planeSize }: MapPlaneProps) {
  const texture = useTexture(getLevelMapImageUrl(level));
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[planeSize, planeSize]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

/** Al posto del piano texturizzato se l'immagine non carica: un piano a
 * tinta unita (il colore del livello) invece di mandare in crash l'intero
 * Canvas — stesso spirito tollerante già usato per SFX/video mancanti nel
 * resto del progetto, qui serve un `ErrorBoundary` perché l'errore arriva
 * da un loader che sospende (Suspense), non da un semplice `if` su un URL. */
function MapPlaneFallback({ level, planeSize }: MapPlaneProps) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[planeSize, planeSize]} />
      <meshStandardMaterial color={level.color} />
    </mesh>
  );
}

interface MapPlaneErrorBoundaryState {
  hasError: boolean;
}

/** Gli error boundary devono essere classi: non esiste un hook equivalente.
 * Isolato qui apposta, piccolo e dedicato — non un componente generico
 * riusato altrove, quindi non merita un file suo. */
class MapPlaneErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, MapPlaneErrorBoundaryState> {
  state: MapPlaneErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('Immagine mappa non caricata, uso il piano a tinta unita:', error.message);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function createContourCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0a141c';
    ctx.fillRect(0, 0, 128, 128);
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#16303f' : '#030608';
      const size = Math.random() * 2.2 + 0.4;
      ctx.fillRect(Math.random() * 128, Math.random() * 128, size, size);
    }
    ctx.globalAlpha = 1;
  }
  return canvas;
}

// Generata una volta sola a livello di modulo con un canvas, stesso pattern
// di `CLOUD_TEXTURE` in `MainMenuSceneAnimation.tsx` — nessun asset esterno
// da scaricare, nessun CDN da cui dipendere per un dettaglio di sfondo.
const CONTOUR_CANVAS = createContourCanvas();
/** Quanto è più grande il piano di contorno rispetto al piano-mappa: deve
 * restare ben oltre `fogFar`/`maxDistance` (entrambi proporzionali a
 * `planeSize`) perché il suo bordo non sia mai raggiungibile dalla camera. */
const SKIRT_SIZE_RATIO = 6;
/** Unità mondo per ripetizione della texture di contorno: tiene la "grana"
 * del rumore percettibilmente costante a ogni dimensione di piano, invece
 * di stirare la stessa texture su un'area molto più grande a mapGrid alto. */
const SKIRT_UNITS_PER_TILE = 6;

interface ContourSkirtProps {
  planeSize: number;
}

/**
 * Piano scuro sotto/attorno al piano-mappa: copre il "vuoto" oltre il bordo
 * dell'immagine (altrimenti si vedrebbe la nebbia a nudo dietro un bordo
 * quadrato netto) con una texture generata via canvas, in toni scuri
 * coerenti con la nebbia/sfondo (`#081014`/`#07121d`) — non dipende dal
 * caricamento della mappa (niente Suspense/useTexture: `CanvasTexture` legge
 * il canvas in modo sincrono), quindi resta visibile anche se l'immagine
 * della mappa non carica.
 */
function ContourSkirt({ planeSize }: ContourSkirtProps) {
  const skirtSize = planeSize * SKIRT_SIZE_RATIO;
  const texture = useMemo(() => {
    const tex = new CanvasTexture(CONTOUR_CANVAS);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    const repeats = Math.max(4, Math.round(skirtSize / SKIRT_UNITS_PER_TILE));
    tex.repeat.set(repeats, repeats);
    return tex;
  }, [skirtSize]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
      <planeGeometry args={[skirtSize, skirtSize]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

interface CameraRigProps {
  level: LevelInfo;
  /** `true` quando la camera deve essere vicina al marker (livello scelto
   * dall'elenco), `false` per l'inquadratura d'insieme. */
  focused: boolean;
}

/**
 * Camera con due padroni che si alternano, mai insieme — stesso principio
 * di `CameraDirector`/`CharacterIntro` nel menu: GSAP possiede la camera
 * SOLO durante il dolly (in scrittura ogni fotogramma finché l'animazione
 * dura), `MapControls` la possiede il resto del tempo (pan/zoom liberi
 * dell'utente). L'handoff è esplicito: `isAnimating` decide chi scrive, e
 * `controls.enabled` segue la stessa bandiera per non lasciare che un
 * drag dell'utente inizi a metà dolly. Il clamp del pan (sotto, fuori
 * dall'`if`) gira SOLO quando `isAnimating` è `false`, per lo stesso
 * motivo: non deve mai contendere la camera al dolly GSAP.
 */
function CameraRig({ level, focused }: CameraRigProps) {
  const { camera } = useThree();
  const controlsRef = useRef<ComponentRef<typeof MapControls>>(null);
  const isAnimating = useRef(false);
  const geometry = useMemo(() => getMapGeometry(level), [level]);
  const anim = useRef({
    x: geometry.cameraFarPosition[0],
    y: geometry.cameraFarPosition[1],
    z: geometry.cameraFarPosition[2],
    tx: CAMERA_FAR_TARGET[0],
    ty: CAMERA_FAR_TARGET[1],
    tz: CAMERA_FAR_TARGET[2]
  });

  useEffect(() => {
    const dest = focused ? CAMERA_NEAR : { position: geometry.cameraFarPosition, target: CAMERA_FAR_TARGET };
    isAnimating.current = true;
    const tween = gsap.to(anim.current, {
      x: dest.position[0],
      y: dest.position[1],
      z: dest.position[2],
      tx: dest.target[0],
      ty: dest.target[1],
      tz: dest.target[2],
      duration: 1.1,
      ease: 'power2.inOut',
      onComplete: () => {
        isAnimating.current = false;
      }
    });

    return () => {
      tween.kill();
    };
  }, [focused, geometry]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    controls.enabled = !isAnimating.current;
    if (isAnimating.current) {
      camera.position.set(anim.current.x, anim.current.y, anim.current.z);
      controls.target.set(anim.current.tx, anim.current.ty, anim.current.tz);
    }
    controls.update();

    if (!isAnimating.current) {
      // Non lasciare che il pan porti la camera oltre il bordo del
      // piano-mappa: clamp rigido di `target` (e di `camera.position` con
      // lo stesso delta, per non alterare distanza/angolo di vista).
      const limit = geometry.planeSize / 2 - PAN_MARGIN;
      const clampedX = Math.min(Math.max(controls.target.x, -limit), limit);
      const clampedZ = Math.min(Math.max(controls.target.z, -limit), limit);
      const dx = clampedX - controls.target.x;
      const dz = clampedZ - controls.target.z;
      if (dx !== 0 || dz !== 0) {
        controls.target.x = clampedX;
        controls.target.z = clampedZ;
        camera.position.x += dx;
        camera.position.z += dz;
      }
    }
  });

  return (
    <MapControls
      ref={controlsRef}
      enableRotate={false}
      screenSpacePanning={false}
      minDistance={2}
      maxDistance={geometry.maxDistance}
      maxPolarAngle={Math.PI / 2.4}
    />
  );
}

interface LevelMapSceneProps {
  level: LevelInfo;
  focused: boolean;
}

/**
 * Scena 3D unica per la selezione livelli: piano-mappa (texture statica) +
 * marker (pin o modello, a seconda della distanza) + camera con dolly
 * GSAP/MapControls. Sostituisce la vecchia coppia `LevelMap`/
 * `LevelCloseupScene` — un solo spazio 3D invece di un widget DOM e un
 * Canvas separati da tenere sincronizzati.
 */
export function LevelMapScene({ level, focused }: LevelMapSceneProps) {
  const geometry = useMemo(() => getMapGeometry(level), [level]);

  // Indipendente dalla texture: il marker deve comparire anche se
  // l'immagine della mappa non è ancora stata generata.
  const offset = projectToImageOffset(level.coordinates, level.coordinates, level.zoom);
  const markerPosition = imageOffsetToPlanePosition(offset, geometry.planeSize, geometry.imageSize);

  return (
    <Canvas shadows camera={{ position: geometry.cameraFarPosition, fov: 50 }}>
      {/* near/far della nebbia sono proporzionali a PLANE_SIZE (vedi
          `getMapGeometry`): il punto più lontano raggiungibile dalla
          camera cresce con `maxDistance` (anch'esso proporzionale), quindi
          la nebbia deve restare oltre quel punto per ogni livello, non solo
          per quello con cui è stata tarata a vista in origine (bug reale
          scovato a schermo la prima volta con questi numeri: sembrava un
          problema di texture, era solo la nebbia troppo vicina). */}
      <fog attach="fog" args={['#081014', geometry.fogNear, geometry.fogFar]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 10, 6]} intensity={1.2} castShadow />

      {/* Ambient/riflessi via cubemap procedurale, non un preset HDR esterno
          — stesso motivo del resto del progetto (vedi CLAUDE.md, "Bundle/
          performance"). */}
      <Suspense fallback={null}>
        <Environment resolution={64}>
          <Lightformer form="rect" intensity={1.8} color="#3fa9d8" position={[-8, 7, 5]} scale={[8, 5, 1]} />
          <Lightformer form="rect" intensity={1} color="#0b2233" position={[8, 6, -5]} scale={[10, 6, 1]} />
        </Environment>

        <MapPlaneErrorBoundary fallback={<MapPlaneFallback level={level} planeSize={geometry.planeSize} />}>
          <MapPlaneTexture level={level} planeSize={geometry.planeSize} />
        </MapPlaneErrorBoundary>
      </Suspense>

      {/* Fuori dal Suspense apposta: texture sincrona (CanvasTexture, non
          useTexture), deve restare visibile anche se la mappa sopra non
          carica — stesso principio del marker sotto. */}
      <ContourSkirt planeSize={geometry.planeSize} />

      <LevelMarker level={level} position={markerPosition} />

      <CameraRig level={level} focused={focused} />
    </Canvas>
  );
}
