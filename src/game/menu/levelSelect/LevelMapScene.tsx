import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ComponentRef,
  type MutableRefObject,
  type ReactNode
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, MapControls, Stars, Text, useTexture } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { BufferAttribute, CanvasTexture, DoubleSide, ExtrudeGeometry, RepeatWrapping, Shape, ShapeGeometry, type BufferGeometry } from 'three';
import gsap from 'gsap';
import { getLevelMapImageUrl, levels, type LevelInfo } from '@/data/levels';
import { CapsuleSequence } from './CapsuleSequence';
import { LevelMarker } from './LevelMarker';
import { imageOffsetToPlanePosition, projectToImageOffset } from './mapProjection';

/** Unità mondo per lato di UNA tile della griglia con cui è generata
 * l'immagine statica (vedi `scripts/generate-map-images.mjs`): il piano
 * (quadrato) su cui è mappata la texture è `PLANE_SIZE_PER_TILE *
 * level.mapGrid` unità, l'immagine finale `TILE_SIZE_PX * level.mapGrid`
 * pixel — griglie diverse per livello (Silì resta a 3, Oristano/Cagliari a
 * 5) danno mappe di dimensioni diverse, vedi `getMapGeometry`. Il piano
 * resta un concetto "quadrato" solo per la matematica di UV/proiezione —
 * la geometria VISIBILE è l'isola frastagliata sotto (`buildIslandGeometry`),
 * un ritaglio di quel quadrato, non il quadrato stesso. */
const PLANE_SIZE_PER_TILE = 12;
const TILE_SIZE_PX = 640;

// Rapporti tarati a vista sul livello di riferimento (Silì, mapGrid=3,
// PLANE_SIZE=36: 27/36, 21/36, 38/36≈1.05) e poi tenuti come FORMULA invece
// che numeri fissi — bug reale già preso tre volte in questa sessione
// dimenticando di riscalare camera/nebbia insieme a PLANE_SIZE quando
// cambiava; ora che PLANE_SIZE varia per livello (mapGrid diverso), la
// formula previene la quarta ricorrenza.
const CAMERA_FAR_Y_RATIO = 27 / 36;
const CAMERA_FAR_Z_RATIO = 21 / 36;
const MAX_DISTANCE_RATIO = 1.05;
/** Margine (unità mondo) tenuto tra il bordo frastagliato dell'isola e il
 * punto più lontano a cui il pan può portare `controls.target` — vedi il
 * clamp radiale in `CameraRig`. Più largo di quando il limite era un
 * quadrato pieno: un'inquadratura storta vicino a una punta frastagliata
 * mostrerebbe più facilmente il "bordo grezzo" della roccia. */
const PAN_MARGIN = 5;

const CAMERA_FAR_TARGET = [0, 0, 0] as const;
// Target ad altezza ~1 (non a terra): guarda il marker/modello, non i suoi
// piedi — con un target a y=0 e la camera a soli 2-3 unità di distanza,
// l'angolo era troppo ripido dall'alto e si vedeva perlopiù il piano sotto
// invece del modello (bug reale scovato a schermo, non un dettaglio). Non
// dipende da `level`/`PLANE_SIZE` apposta: il modello/pin restano a
// dimensione reale fissa, questa è l'inquadratura ravvicinata su di loro,
// non sul piano.
const CAMERA_NEAR = { position: [0, 2.1, 4.6] as const, target: [0, 1, 0] as const };

/**
 * Angolo polare (dall'asse verticale) implicito in `CAMERA_NEAR`: con
 * `position=[0,2.1,4.6]` e `target=[0,1,0]`, l'offset è `[0,1.1,4.6]` —
 * `acos(1.1/|offset|) ≈ 76.55°`, qualche grado SOPRA il vecchio
 * `maxPolarAngle` di `MapControls` (75°, `Math.PI/2.4`). Bug reale scovato a
 * schermo (non solo teorico): `MapControls.update()` ri-clampa SEMPRE
 * l'angolo polare della camera dalla sua posizione attuale, a prescindere
 * da `enableRotate`/`enabled` (che bloccano solo l'input utente, non
 * `update()` stesso — vedi il commento su `CameraRig` più sotto per lo
 * stesso principio) — ogni fotogramma in cui il volo GSAP verso
 * `CAMERA_NEAR` era concluso e `controls.update()` girava di nuovo, la
 * camera veniva silenziosamente ritirata dentro il limite di 75°,
 * allontanandola dall'inquadratura voluta (a vista: mappa visibile dietro
 * l'edificio invece dell'inquadratura stretta, nei casi peggiori una deriva
 * abbastanza ampia da mostrare quasi solo il piano). `MAX_POLAR_ANGLE` tiene
 * i due valori coerenti tra loro invece di lasciarli scollegati come prima —
 * margine di ~3° oltre l'angolo di `CAMERA_NEAR`, non esatto: un margine
 * risicato ririschierebbe lo stesso bug alla prossima modifica di uno dei
 * due senza l'altro.
 */
const CAMERA_NEAR_POLAR_ANGLE = Math.acos(
  (CAMERA_NEAR.position[1] - CAMERA_NEAR.target[1]) /
    Math.hypot(
      CAMERA_NEAR.position[1] - CAMERA_NEAR.target[1],
      CAMERA_NEAR.position[2] - CAMERA_NEAR.target[2]
    )
);
const MAX_POLAR_ANGLE = CAMERA_NEAR_POLAR_ANGLE + (3 * Math.PI) / 180;

interface MapGeometry {
  planeSize: number;
  imageSize: number;
  cameraFarPosition: readonly [number, number, number];
  maxDistance: number;
}

/** Tutte le grandezze che dipendono dalla dimensione del piano-mappa di
 * QUESTO livello, derivate da `level.mapGrid` — un solo posto dove
 * PLANE_SIZE e tutto ciò che ne dipende (immagine, camera, limite di pan)
 * restano coerenti tra loro, invece di costanti sparse da ricordarsi di
 * aggiornare insieme. */
function getMapGeometry(level: LevelInfo): MapGeometry {
  const planeSize = PLANE_SIZE_PER_TILE * level.mapGrid;
  return {
    planeSize,
    imageSize: TILE_SIZE_PX * level.mapGrid,
    cameraFarPosition: [0, planeSize * CAMERA_FAR_Y_RATIO, planeSize * CAMERA_FAR_Z_RATIO],
    maxDistance: planeSize * MAX_DISTANCE_RATIO
  };
}

// --- Isola frastagliata -----------------------------------------------
//
// Il contorno non è un asset: è calcolato, sommando 3 sinusoidi di
// frequenza/fase diverse al raggio attorno a un centro (una forma di
// "rumore" a bassa frequenza, non spuntoni indipendenti punto per punto —
// quelli darebbero una stella, non un'isola). La fase di ogni armonica è
// seminata sull'id del livello (`getIslandProfile`), quindi il contorno è
// deterministico per livello: stesso livello, stesso identico contorno a
// ogni render, ma diverso da un livello all'altro. Essendo `r(angle) > 0`
// per costruzione (il moltiplicatore minimo resta ben sopra 0, vedi somma
// ampiezze sotto), il poligono è "stellato" rispetto all'origine per
// definizione: non può mai autointersecarsi.

const ISLAND_HARMONICS = [
  { freq: 2, amp: 0.16 },
  { freq: 3, amp: 0.1 },
  { freq: 5, amp: 0.06 }
];
/** Raggio base dell'isola, come frazione di `planeSize` — scelto così che
 * anche al picco di tutte le armoniche insieme (moltiplicatore ~1.32) il
 * raggio risultante resti sotto 0.5*planeSize: oltre quella soglia la UV
 * (rimappata sul quadrato pieno, vedi `remapUVsToSquare`) uscirebbe dalla
 * texture reale e mostrerebbe un bordo ripetuto/stirato invece della mappa
 * vera. */
const ISLAND_BASE_RADIUS_RATIO = 0.34;
const ISLAND_BELLY_DEPTH_RATIO = 0.16;
/** Spessore della "gonna" di transizione terra→roccia, appena sotto il
 * coperchio — abbastanza sottile da restare un dettaglio del bordo, non
 * un terzo strato che si nota come tale. */
const TRANSITION_DEPTH_RATIO = 0.04;
const ISLAND_SEGMENTS = 28;
/** Spessore minimo tra strati adiacenti (coperchio→gonna→pancia), solo per
 * evitare che i tappi piatti di due `ExtrudeGeometry`/`ShapeGeometry`
 * coincidano ESATTAMENTE sullo stesso piano (z-fighting): non è uno
 * spessore "vero", è un margine tecnico. */
const SEAM_GAP = 0.05;

interface IslandProfile {
  baseRadius: number;
  phases: number[];
}

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** PRNG deterministico (mulberry32) seminato sull'id del livello: stesso id
 * = stessa sequenza, ogni volta — è ciò che rende il contorno stabile tra
 * un render e l'altro senza doverlo salvare da qualche parte. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getIslandProfile(level: LevelInfo, baseRadius: number): IslandProfile {
  const rng = mulberry32(hashSeed(level.id));
  return { baseRadius, phases: ISLAND_HARMONICS.map(() => rng() * Math.PI * 2) };
}

/** Raggio dell'isola a un dato angolo — unica fonte di verità usata sia per
 * costruire il contorno geometrico (`buildIslandShape`) sia per il clamp
 * del pan in `CameraRig`: usare la stessa formula in entrambi i posti
 * evita che i due si disallineino (stessa classe di bug già presa più
 * volte in questo file quando camera/nebbia/piano non erano derivati dalla
 * stessa fonte). */
function islandRadiusAt(angle: number, profile: IslandProfile): number {
  let multiplier = 1;
  ISLAND_HARMONICS.forEach((harmonic, i) => {
    multiplier += harmonic.amp * Math.sin(angle * harmonic.freq + profile.phases[i]);
  });
  return profile.baseRadius * multiplier;
}

function buildIslandShape(profile: IslandProfile): Shape {
  const shape = new Shape();
  for (let i = 0; i <= ISLAND_SEGMENTS; i++) {
    const angle = (i / ISLAND_SEGMENTS) * Math.PI * 2;
    const r = islandRadiusAt(angle, profile);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

/** `ShapeGeometry`/`ExtrudeGeometry` generano di base UV normalizzate sul
 * bounding box della shape stessa — sbagliato qui: il piano deve restare
 * mappato sul quadrato PIENO (`planeSize`) usato per generare la texture
 * (vedi `scripts/generate-map-images.mjs`) e per proiettare il marker
 * (`mapProjection.ts`), altrimenti la mappa risulterebbe stirata/
 * disallineata rispetto al marker non appena il contorno smette di essere
 * un quadrato perfetto. */
function remapUVsToSquare(geometry: BufferGeometry, planeSize: number) {
  const position = geometry.attributes.position;
  const half = planeSize / 2;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = (position.getX(i) + half) / planeSize;
    uv[i * 2 + 1] = (position.getY(i) + half) / planeSize;
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
}

interface IslandGeometry {
  profile: IslandProfile;
  capGeometry: BufferGeometry;
  transitionGeometry: BufferGeometry;
  bellyGeometry: BufferGeometry;
}

/** Coperchio (`ShapeGeometry`, mappato con la texture della mappa), una
 * sottile "gonna" di transizione terra→roccia e la pancia rocciosa vera e
 * propria sotto — tutte e tre dalla STESSA shape, impilate lungo la stessa
 * direzione verticale: riusare lo stesso contorno per tutte garantisce che
 * combacino esattamente sul bordo, nessuna cucitura visibile tra uno
 * strato e l'altro. */
function buildIslandGeometry(level: LevelInfo, planeSize: number): IslandGeometry {
  const profile = getIslandProfile(level, planeSize * ISLAND_BASE_RADIUS_RATIO);
  const shape = buildIslandShape(profile);

  const capGeometry = new ShapeGeometry(shape);
  remapUVsToSquare(capGeometry, planeSize);

  // Profondità NEGATIVA apposta: `ExtrudeGeometry` estrude lungo +Z locale,
  // che con la rotazione del gruppo (-90° su X: locale (x,y,z) -> mondo
  // (x,z,-y)) mappa a +Y di MONDO, cioè verso l'ALTO — l'opposto di quello
  // che serve per una pancia che pende sotto il coperchio. Un `depth`
  // negativo estrude verso -Z locale invece (mondo -Y, verso il basso),
  // SENZA la complicazione di una scala negativa a livello di mesh (che
  // richiederebbe ragionare su come Three.js reinterpreta winding/normali
  // per un oggetto specchiato) — qui è solo un parametro diverso passato
  // allo stesso algoritmo, quindi winding e normali restano corretti sin
  // dalla costruzione.
  // Bevel disattivato apposta su ENTRAMBE le estrusioni sotto:
  // `ExtrudeGeometry` lo applica spostando il contorno di una quantità
  // fissa perpendicolare al bordo, ma il contorno dell'isola (somma di
  // armoniche) è "stellato" (mai autointersecante) ma NON convesso — nei
  // tratti concavi il bevel rientra rispetto al contorno esatto, quindi il
  // bordo superiore finiva più all'interno del bordo esatto del coperchio
  // sopra: da lato/dal basso la mappa sembrava "staccata" dalla roccia
  // (bug reale scovato a schermo). Con bevel disattivato il contorno di
  // ogni strato combacia ESATTAMENTE con quello del coperchio (stessa
  // shape, nessun inset).
  const transitionDepth = planeSize * TRANSITION_DEPTH_RATIO;
  const transitionGeometry = new ExtrudeGeometry(shape, {
    depth: -transitionDepth,
    bevelEnabled: false,
    steps: 1
  });

  const bellyDepth = planeSize * ISLAND_BELLY_DEPTH_RATIO;
  const bellyGeometry = new ExtrudeGeometry(shape, {
    depth: -bellyDepth,
    bevelEnabled: false,
    steps: 1
  });

  return { profile, capGeometry, transitionGeometry, bellyGeometry };
}

interface IslandCapProps {
  level: LevelInfo;
  geometry: BufferGeometry;
}

/** Il coperchio texturizzato con la mappa statica — SOLO il coperchio: se
 * l'immagine manca (non ancora generata, vedi
 * `scripts/generate-map-images.mjs`), questo componente lancia (`useTexture`
 * sospende via Suspense e rilancia l'errore di caricamento) ed è
 * `IslandCapErrorBoundary` sotto a prendersene cura — il marker e la pancia
 * rocciosa vivono fuori apposta, non dipendono dalla texture e non devono
 * sparire insieme a lei. */
function IslandCapTexture({ level, geometry }: IslandCapProps) {
  const texture = useTexture(getLevelMapImageUrl(level));
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

/** Al posto del coperchio texturizzato se l'immagine non carica: tinta
 * unita (il colore del livello) invece di mandare in crash l'intero
 * Canvas — stesso spirito tollerante già usato per SFX/video mancanti nel
 * resto del progetto, qui serve un `ErrorBoundary` perché l'errore arriva
 * da un loader che sospende (Suspense), non da un semplice `if` su un URL. */
function IslandCapFallback({ level, geometry }: IslandCapProps) {
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={level.color} />
    </mesh>
  );
}

interface IslandCapErrorBoundaryState {
  hasError: boolean;
}

/** Gli error boundary devono essere classi: non esiste un hook equivalente.
 * Isolato qui apposta, piccolo e dedicato — non un componente generico
 * riusato altrove, quindi non merita un file suo. */
class IslandCapErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, IslandCapErrorBoundaryState> {
  state: IslandCapErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('Immagine mappa non caricata, uso il coperchio a tinta unita:', error.message);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

interface SceneErrorBoundaryState {
  error: Error | null;
}

/**
 * Rete di sicurezza per un'eccezione JS REALE durante il render della scena
 * (non il solo caricamento della texture mappa, quello lo copre già
 * `IslandCapErrorBoundary` sopra): senza un boundary qui, un errore in
 * qualunque figlio del `<Canvas>` risale fino a React e lascia la scena
 * vuota IN SILENZIO — esattamente il sintomo "sparisce tutto" senza nessuna
 * indicazione del perché. Mostra un avviso VISIBILE (non un blank screen) e
 * logga lo stack completo in console: necessario per diagnosticare la causa
 * reale la prossima volta che si presenta, invece di ipotizzare al buio.
 */
class SceneErrorBoundary extends Component<{ children: ReactNode }, SceneErrorBoundaryState> {
  state: SceneErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('LevelMapScene: errore di render nella scena 3D —', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <group>
          <mesh>
            <planeGeometry args={[6, 2]} />
            <meshBasicMaterial color="#3a0d0d" />
          </mesh>
          <Text position={[0, 0, 0.01]} fontSize={0.35} color="#ff8080" anchorX="center" anchorY="middle" maxWidth={5.5}>
            {`Errore nella scena 3D: ${this.state.error.message}`}
          </Text>
        </group>
      );
    }
    return this.props.children;
  }
}

interface HiddenCityTextureProps {
  level: LevelInfo;
}

/**
 * Monta (invisibile) la texture della mappa di un'altra città, nello STESSO
 * `<Canvas>`/contesto WebGL di questa scena — precompilarla in un contesto
 * diverso non servirebbe a nulla, ogni Canvas ha il proprio WebGLRenderer.
 * `visible={false}` ma presente nell'albero: `gl.compile` traversa TUTTI i
 * mesh (non solo quelli visibili, vedi la sua implementazione in Three.js),
 * quindi trova comunque questo e ne compila lo shader/carica la texture in
 * GPU — quando l'utente cambia davvero città (`CloudTransition`) il primo
 * render del coperchio vero non paga più quel costo. Vedi
 * `docs/PIANO_CARICAMENTO_ASSET.md`, Fase 4.
 */
function HiddenCityTexture({ level }: HiddenCityTextureProps) {
  const texture = useTexture(getLevelMapImageUrl(level));
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    gl.compile(scene, camera);
  }, [texture, gl, scene, camera]);

  return (
    <mesh visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

interface CityTexturePrewarmProps {
  currentLevelId: string;
}

/**
 * Riscalda la GPU per le mappe delle città NON mostrate ora — un mesh
 * invisibile per città, ciascuno nel proprio `Suspense` scoped (una mappa
 * non ancora arrivata da `assetPreload.ts` non deve bloccare le altre né la
 * scena visibile).
 */
function CityTexturePrewarm({ currentLevelId }: CityTexturePrewarmProps) {
  return (
    <>
      {levels
        .filter((level) => level.id !== currentLevelId)
        .map((level) => (
          <Suspense key={level.id} fallback={null}>
            <HiddenCityTexture level={level} />
          </Suspense>
        ))}
    </>
  );
}

function createRockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#39332c';
    ctx.fillRect(0, 0, 128, 128);
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#564a3c' : '#211c17';
      const size = Math.random() * 3 + 0.6;
      ctx.fillRect(Math.random() * 128, Math.random() * 128, size, size);
    }
    ctx.globalAlpha = 1;
  }
  return canvas;
}

// Generata una volta sola a livello di modulo con un canvas, stesso pattern
// di `CLOUD_TEXTURE` in `MainMenuSceneAnimation.tsx` — nessun asset esterno
// da scaricare per la roccia sotto l'isola.
const ROCK_CANVAS = createRockCanvas();

/** Gradiente verticale terra/erba (in cima, vicino al coperchio) → roccia
 * (in fondo, dove si fonde con `IslandBelly`) — anche a bordo geometrico
 * perfetto (bevel disattivato, contorni identici), il taglio netto tra la
 * foto satellitare sopra e la texture procedurale scura sotto leggeva come
 * due dischi sovrapposti invece che un unico pezzo di terra: questa fascia
 * sottile maschera il cambio di materiale invece di esporlo di colpo. Il
 * generatore di UV di default di `ExtrudeGeometry` per le pareti laterali
 * mappa V lungo la profondità dell'estrusione — un canvas alto e stretto
 * basta, non serve rimappare le UV a mano come per il coperchio (qui non
 * c'è nessuna texture reale con cui restare allineati). */
function createTransitionCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, '#47362b');
    gradient.addColorStop(0.45, '#6b5c3f');
    gradient.addColorStop(0.75, '#4a4534');
    gradient.addColorStop(1, '#39332c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 128);
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#2e2a20' : '#6f7f4c';
      const size = Math.random() * 2 + 0.5;
      ctx.fillRect(Math.random() * 32, Math.random() * 128, size, size);
    }
    ctx.globalAlpha = 1;
  }
  return canvas;
}

const TRANSITION_CANVAS = createTransitionCanvas();

interface IslandTransitionProps {
  geometry: BufferGeometry;
}

/**
 * La sottile "gonna" di transizione terra→roccia, appena sotto il
 * coperchio — stessa shape di coperchio/pancia (vedi `buildIslandGeometry`),
 * texture procedurale a gradiente verticale (non la mappa, non la roccia:
 * un materiale a sé). Sincrona come `IslandBelly`, stesso motivo (resta
 * visibile anche se la mappa sopra non carica).
 */
function IslandTransition({ geometry }: IslandTransitionProps) {
  const texture = useMemo(() => new CanvasTexture(TRANSITION_CANVAS), []);
  // Vedi il commento sulla disposal di `island` in `LevelMapScene`: questo
  // componente viene rimontato per intero a ogni cambio città (il `key`
  // sta sul `<group>` genitore), quindi una `CanvasTexture` NUOVA a ogni
  // montaggio — senza `.dispose()` sulla precedente, un leak dei buffer GPU
  // identico a quello delle geometrie, stessa causa dello stesso bug.
  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  return (
    // `side={DoubleSide}` diagnostico/difensivo: `depth` negativo su
    // `ExtrudeGeometry` è un caso meno comune nella libreria, plausibile
    // che le normali delle pareti laterali risultino invertite rispetto
    // all'aspettativa — con `FrontSide` (default) questo culla proprio le
    // facce rivolte verso la camera, lasciando visibili solo quelle
    // "interne" viste da dentro (massa scura poco illuminata in modo
    // sensato). Costo trascurabile per queste poche mesh a bassa
    // risoluzione. `envMapIntensity` bassa: la cubemap procedurale include
    // due `Lightformer form="ring"` (il bagliore da nebulosa) — su un
    // materiale così scuro/opaco anche un riflesso debole di una forma "ad
    // anello" risalta parecchio (proporzionalmente più visibile su una
    // base quasi nera che su una texture chiara), lasciando anelli
    // sottili ma innaturali sulla superficie. Il coperchio sopra non ne
    // risente (la foto satellitare è di per sé "occupata" abbastanza da
    // non farli notare), ma qui vale la pena smorzarli apposta.
    <mesh geometry={geometry} position={[0, 0, -SEAM_GAP]} castShadow receiveShadow>
      <meshStandardMaterial map={texture} roughness={0.9} metalness={0} side={DoubleSide} envMapIntensity={0.2} />
    </mesh>
  );
}

interface IslandBellyProps {
  geometry: BufferGeometry;
  planeSize: number;
}

/**
 * La "pancia" rocciosa sotto l'isola: estrusa dalla STESSA shape del
 * coperchio (vedi `buildIslandGeometry`), quindi il bordo combacia sempre
 * esattamente, e con una texture procedurale (non la mappa) — non dipende
 * dal caricamento della mappa (niente Suspense/useTexture: `CanvasTexture`
 * legge il canvas in modo sincrono), quindi resta visibile anche se
 * l'immagine della mappa non carica, sostituendo lo stesso ruolo di
 * "qualcosa c'è sempre" che prima aveva il piano di contorno.
 */
function IslandBelly({ geometry, planeSize }: IslandBellyProps) {
  const texture = useMemo(() => {
    const tex = new CanvasTexture(ROCK_CANVAS);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    const repeats = Math.max(3, Math.round(planeSize / 6));
    tex.repeat.set(repeats, repeats);
    return tex;
  }, [planeSize]);
  // Vedi il commento sulla disposal di `island` in `LevelMapScene`: stesso
  // leak di risorse GPU, stessa causa dello stesso bug (funzionava alla
  // prima ripetizione del ciclo cambio-città, si rompeva dalla seconda in
  // poi) — una `CanvasTexture` nuova per ogni cambio `planeSize` (quindi a
  // ogni cambio città, dato che il componente viene anche rimontato per
  // intero) senza mai liberare quella precedente.
  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  // `bellyGeometry` è già estrusa con `depth` NEGATIVO (vedi
  // `buildIslandGeometry`), quindi va verso -Z locale = -Y di mondo (verso
  // il basso) fin dalla costruzione — nessuna scala/riflessione aggiuntiva
  // qui. L'offset parte da sotto la gonna di transizione (`IslandTransition`,
  // spessa `TRANSITION_DEPTH_RATIO * planeSize`), non da sotto il coperchio
  // direttamente: due `SEAM_GAP` (uno per lato della gonna) evitano che i
  // tappi piatti di gonna e pancia coincidano ESATTAMENTE, stesso motivo
  // dello z-fighting già evitato tra coperchio e gonna.
  const offset = -(SEAM_GAP + planeSize * TRANSITION_DEPTH_RATIO + SEAM_GAP);

  return (
    // `side={DoubleSide}`: vedi il commento su `IslandTransition` — stesso
    // sospetto di normali invertite sulle pareti laterali, con `depth`
    // negativo su `ExtrudeGeometry`.
    <mesh geometry={geometry} position={[0, 0, offset]} castShadow receiveShadow>
      <meshStandardMaterial map={texture} roughness={0.95} metalness={0} side={DoubleSide} />
    </mesh>
  );
}

function createPlanetCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(46, 46, 4, 64, 64, 66);
    gradient.addColorStop(0, '#8f9bc9');
    gradient.addColorStop(0.55, '#4b5486');
    gradient.addColorStop(1, '#181c33');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(64, 64, 64, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

const PLANET_CANVAS = createPlanetCanvas();
/** Posizione/raggio FISSI, non proporzionali a `planeSize`: il pianeta è
 * sfondo cosmico, non parte della scala reale del luogo mostrato (stessa
 * scelta di `Stars radius`/`depth` sotto). A distanza 180 (dentro il
 * raggio 280 delle stelle, altrimenti sembrerebbe "oltre" il cielo
 * stellato) con raggio 9, il diametro angolare è ~5.7° — visibile come
 * una luna nel cielo, non un corpo che domina l'inquadratura (un raggio/
 * distanza troppo alti qui erano un bug reale scovato a schermo: il
 * pianeta riempiva quasi tutto il frame). */
const PLANET_POSITION: readonly [number, number, number] = [100, 67, -134];
const PLANET_RADIUS = 9;

/** Un pianeta/luna distante, puramente decorativo — stessa tecnica a
 * canvas del resto (nessun asset scaricato), aggiunge profondità allo
 * sfondo spaziale oltre alle sole stelle. */
function DistantPlanet() {
  const texture = useMemo(() => new CanvasTexture(PLANET_CANVAS), []);
  return (
    <mesh position={PLANET_POSITION}>
      <sphereGeometry args={[PLANET_RADIUS, 24, 24]} />
      <meshStandardMaterial map={texture} emissive="#2a2f52" emissiveIntensity={0.15} />
    </mesh>
  );
}

interface CameraRigProps {
  level: LevelInfo;
  /** `true` quando la camera deve essere vicina al marker (livello scelto
   * dall'elenco), `false` per l'inquadratura d'insieme. */
  focused: boolean;
  /** `true` mentre `CapsuleSequence` possiede la camera per il push-in
   * finale — vedi il commento su `cameraLockedRef` lì. Guard esplicito
   * sul lato opposto, stesso principio di `CameraDirector`/`CharacterIntro`
   * nel menu: appena `true`, questo `useFrame` smette del tutto di
   * leggere/scrivere `controls`/`camera.position`. */
  cameraLockedRef: MutableRefObject<boolean>;
}

/**
 * Camera con due padroni che si alternano, mai insieme — stesso principio
 * di `CameraDirector`/`CharacterIntro` nel menu: GSAP possiede la camera
 * SOLO durante il dolly (in scrittura ogni fotogramma finché l'animazione
 * dura), `MapControls` la possiede il resto del tempo (pan/zoom liberi
 * dell'utente) — ma SOLO quando non si è zoomati su un livello scelto:
 * `focused` disabilita il pan/zoom libero anche a dolly concluso, così una
 * volta scelto un livello la mappa non si sposta più sotto ai piedi
 * dell'utente. L'handoff è esplicito: `isAnimating` decide chi scrive alla
 * camera, `controls.enabled` segue sia `isAnimating` (non deve mai
 * contendere la camera al dolly GSAP) sia `focused` (vedi sopra).
 *
 * Due guard espliciti nel `useFrame`, non uno solo:
 * 1. Durante l'animazione (`isAnimating.current`) esce con un `return`
 *    PRIMA di chiamare `controls.update()`, non solo prima del clamp del
 *    pan: quel metodo ricalcola sempre la geometria sferica di
 *    `MapControls` dalla posizione ATTUALE della camera (incondizionatamente
 *    rispetto a `enabled`, che blocca solo l'input utente) e la ri-clampa
 *    su `minDistance`/`maxDistance` — chiamarlo nello stesso fotogramma in
 *    cui GSAP sta scrivendo la posizione è un secondo regista che tocca la
 *    stessa camera, e con un `maxDistance` appena cambiato (livelli con
 *    `mapGrid` diversi) poteva lasciarla in una posizione degenere a metà
 *    volo.
 * 2. A volo concluso, se `focused` è vero esce SUBITO senza mai chiamare
 *    `controls.update()`: bug reale scovato a schermo (non solo teorico,
 *    e non spiegato da un singolo parametro — `maxPolarAngle` era UNA
 *    causa concreta, vedi `MAX_POLAR_ANGLE`, ma anche dopo averla corretta
 *    la camera continuava a driftare leggermente lontano da `CAMERA_NEAR`
 *    ogni fotogramma in cui `update()` girava a vuoto): la camera non ha
 *    bisogno di NESSUN ricalcolo mentre è ferma a fuoco e l'utente non può
 *    comunque interagire — congelarla del tutto qui elimina la causa alla
 *    radice, qualunque essa sia, invece di rincorrere il singolo parametro
 *    responsabile.
 */
function CameraRig({ level, focused, cameraLockedRef }: CameraRigProps) {
  const { camera } = useThree();
  const controlsRef = useRef<ComponentRef<typeof MapControls>>(null);
  const isAnimating = useRef(false);
  const geometry = useMemo(() => getMapGeometry(level), [level]);
  const islandProfile = useMemo(
    () => getIslandProfile(level, geometry.planeSize * ISLAND_BASE_RADIUS_RATIO),
    [level, geometry.planeSize]
  );
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
    if (cameraLockedRef.current) return;

    const controls = controlsRef.current;
    if (!controls) return;

    controls.enabled = !isAnimating.current && !focused;
    if (isAnimating.current) {
      // GSAP possiede la camera qui: scrive `camera.position`/`controls.target`
      // direttamente. `controls.update()` (sotto) NON va chiamato in questo
      // stesso fotogramma — `OrbitControls`/`MapControls` ricalcola sempre la
      // propria geometria sferica (raggio/angoli) dalla posizione ATTUALE
      // della camera dentro `update()`, incondizionatamente rispetto a
      // `enabled` (che blocca solo gli handler di input, non `update()`
      // stesso) — e la RI-CLAMPA su `minDistance`/`maxDistance`, che nel
      // frattempo può essere già cambiato (nuova `geometry.maxDistance` del
      // livello di arrivo, spesso molto diverso da quello di partenza:
      // Silì/Oristano hanno `mapGrid` diversi). Due registi che scrivono la
      // stessa camera nello stesso fotogramma, esattamente il conflitto che
      // il resto del progetto evita sempre (vedi `CameraDirector`/
      // `CharacterIntro` nel menu) — bug reale: poteva lasciare la camera in
      // una posizione degenere durante il volo (isola/mappa sparite a
      // schermo, a volte con un vero e proprio "Context Lost" della GPU,
      // sintomo tipico di una matrice di camera con valori non validi).
      // `controls.update()` riprende dal fotogramma successivo a
      // `isAnimating.current === false`, quando rilegge una posizione già
      // corretta e stabile (l'arrivo del volo) — nessun ricalcolo perso.
      camera.position.set(anim.current.x, anim.current.y, anim.current.z);
      controls.target.set(anim.current.tx, anim.current.ty, anim.current.tz);
      return;
    }

    // A volo concluso, se `focused` è vero la camera è già esattamente su
    // `CAMERA_NEAR` (l'ultimo fotogramma del ramo sopra l'ha scritta lì) e
    // l'utente non può comunque interagire (`controls.enabled` è già
    // `false`): non c'è alcun input da integrare. Bug reale scovato a
    // schermo (non solo teorico, e non spiegato da un singolo parametro):
    // lasciare `controls.update()` girare comunque, fotogramma dopo
    // fotogramma, poteva allontanare silenziosamente la camera
    // dall'inquadratura voluta — la mappa tornava visibile dietro
    // l'edificio invece dell'inquadratura stretta, a volte con una deriva
    // abbastanza ampia da mostrare quasi solo il piano. Congelare
    // interamente la camera qui (nessun `update()`, nessun clamp del pan)
    // mentre si è a fuoco elimina la causa alla radice, qualunque essa sia,
    // invece di rincorrere il singolo parametro responsabile.
    if (focused) return;

    controls.update();

    // Non lasciare che il pan porti la camera oltre il bordo frastagliato
    // dell'isola: clamp RADIALE (non più un quadrato) contro
    // `islandRadiusAt`, la stessa formula usata per costruire il contorno —
    // applicato a `target` e a `camera.position` con lo stesso delta, per
    // non alterare distanza/angolo di vista. Sempre sicuro qui sotto: si
    // arriva a questo punto solo quando `isAnimating.current` è già `false`
    // (il ramo sopra esce con `return` mentre l'animazione dura).
    const x = controls.target.x;
    const z = controls.target.z;
    const dist = Math.hypot(x, z);
    if (dist > 0) {
      const angle = Math.atan2(z, x);
      const maxDist = Math.max(0, islandRadiusAt(angle, islandProfile) - PAN_MARGIN);
      if (dist > maxDist) {
        const scale = maxDist / dist;
        const clampedX = x * scale;
        const clampedZ = z * scale;
        const dx = clampedX - x;
        const dz = clampedZ - z;
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
      maxPolarAngle={MAX_POLAR_ANGLE}
    />
  );
}

interface LevelMapSceneProps {
  level: LevelInfo;
  focused: boolean;
  /** Click/conferma sul marker (pin) mentre non si è ancora zoomati —
   * stesso effetto di scegliere questo livello dall'elenco 2D. */
  onActivateMarker: () => void;
  /** Contatore: incrementato da "Avvia livello" per far partire la
   * sequenza capsula-impatto-zoom (Parte E del piano "Stellar Blade") —
   * vedi `CapsuleSequence.tsx`. */
  launchTrigger: number;
  onImpactFlash: () => void;
  /** Accende il blur CSS locale per il push-in finale — vedi
   * `CapsuleSequence.tsx` (`onOutroBlur`) e `LevelSelectScene.tsx`. */
  onOutroBlur: () => void;
  onSequenceComplete: () => void;
}

/**
 * Scena 3D unica per la selezione livelli: un'isola frastagliata fluttuante
 * nello spazio (coperchio texturizzato con la mappa statica + pancia
 * rocciosa, stesso contorno per entrambi) + marker (pin o modello, a
 * seconda della distanza) + camera con dolly GSAP/MapControls. Sostituisce
 * la vecchia coppia `LevelMap`/`LevelCloseupScene` — un solo spazio 3D
 * invece di un widget DOM e un Canvas separati da tenere sincronizzati.
 */
export function LevelMapScene({
  level,
  focused,
  onActivateMarker,
  launchTrigger,
  onImpactFlash,
  onOutroBlur,
  onSequenceComplete
}: LevelMapSceneProps) {
  const geometry = useMemo(() => getMapGeometry(level), [level]);
  const island = useMemo(() => buildIslandGeometry(level, geometry.planeSize), [level, geometry.planeSize]);
  // `useMemo` non ha un meccanismo di pulizia integrato per il valore
  // PRECEDENTE quando ricalcola — un `useEffect` con le stesse dipendenze
  // sì (la cleanup riceve la chiusura del render appena sostituito). Bug
  // reale scovato a schermo (non solo teorico, e non probabilistico: si
  // presentava SEMPRE dalla seconda ripetizione del ciclo cambio-città in
  // poi, mai alla prima): ogni cambio città qui sopra costruiva TRE
  // `BufferGeometry` nuove (coperchio/gonna/pancia, `ExtrudeGeometry` con
  // centinaia di vertici) senza mai liberare quelle precedenti — non solo
  // un leak di memoria JS (quello lo avrebbe preso il garbage collector),
  // ma un leak dei BUFFER GPU caricati da Three.js per quelle geometrie,
  // che `.dispose()` è l'unico modo per liberare esplicitamente. Il
  // `key={level.id}` sul gruppo pancia/gonna in Level MapScene (già in
  // questo file, per un bug precedente) rende il problema PEGGIORE, non
  // migliore: forza un rimontaggio completo — e quindi risorse GPU
  // interamente nuove — a ogni cambio città invece di riusare le mesh
  // esistenti.
  useEffect(() => {
    return () => {
      island.capGeometry.dispose();
      island.transitionGeometry.dispose();
      island.bellyGeometry.dispose();
    };
  }, [island]);
  // Condiviso tra `CameraRig` e `CapsuleSequence`, non sollevato a stato:
  // cambia dentro un `useFrame`/timer, mai per un render — vedi i commenti
  // su `cameraLockedRef` in entrambi.
  const cameraLockedRef = useRef(false);

  // Indipendente dalla texture: il marker deve comparire anche se
  // l'immagine della mappa non è ancora stata generata.
  const offset = projectToImageOffset(level.coordinates, level.coordinates, level.zoom);
  const markerPosition = imageOffsetToPlanePosition(offset, geometry.planeSize, geometry.imageSize);

  return (
    <Canvas camera={{ position: geometry.cameraFarPosition, fov: 50 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 10, 6]} intensity={1.2} />
      {/* Luce di riempimento da sotto/di lato, debole e fredda (come un
          riflesso dello spazio/delle stelle) — senza, la pancia rocciosa
          (e la gonna di transizione) ricevono solo `ambientLight` su una
          texture già scura di base: leggevano come una macchia nera piatta
          invece che come roccia texturizzata (bug reale scovato a
          schermo, non geometrico: le isole fluttuanti sono quasi sempre le
          più difficili da illuminare da sotto con una sola luce dall'alto).
          Niente ombre (il costo di una seconda shadow map non serve per un
          riempimento così debole). */}
      <directionalLight position={[-4, -12, 3]} intensity={0.45} color="#5b7fbd" />

      {/* Sfondo spaziale: stelle procedurali di drei (nessun HDR/texture
          scaricata) più un pianeta/luna generato via canvas — stesso
          principio del resto del progetto per evitare CDN esterni. Il
          "vuoto" oltre il bordo frastagliato dell'isola è oggi voluto: è lo
          spazio stesso, non serve più un piano di riempimento a texture
          neutra (superato rispetto alla versione precedente di questa
          scena). */}
      <Stars radius={280} depth={140} count={3200} factor={3.2} saturation={0} fade speed={0.4} />
      <DistantPlanet />

      {/* Ambient/riflessi via cubemap procedurale, non un preset HDR esterno
          — stesso motivo del resto del progetto (vedi CLAUDE.md, "Bundle/
          performance"). Due Lightformer freddi in più (viola/blu) per un
          bagliore da nebulosa, oltre ai due già presenti.

          Suspense SEPARATO da quello della mappa sotto, apposta: `Environment`
          genera la sua cubemap PMREM con un render interno alla prima
          comparsa, un'operazione costosa e delicata (un render dentro al
          render loop) che va fatta una volta sola. Condividere il Suspense
          con `IslandCapTexture` (com'era prima) significava che OGNI cambio
          città, sospendendo per la nuova texture, smontava e rimontava anche
          `Environment` — rigenerando la cubemap ogni volta nel mezzo del
          render loop attivo, lavoro sprecato dato che l'illuminazione non
          dipende dalla città mostrata. `Environment` non dipende da `level`:
          con un Suspense tutto suo monta una volta sola e non si tocca più. */}
      <Suspense fallback={null}>
        <Environment resolution={64}>
          <Lightformer form="rect" intensity={1.8} color="#3fa9d8" position={[-8, 7, 5]} scale={[8, 5, 1]} />
          <Lightformer form="rect" intensity={1} color="#0b2233" position={[8, 6, -5]} scale={[10, 6, 1]} />
          <Lightformer form="ring" intensity={2.2} color="#7c6adf" position={[-30, 20, -35]} scale={[16, 16, 1]} />
          <Lightformer form="ring" intensity={1.4} color="#4d5fd6" position={[26, -6, -30]} scale={[12, 12, 1]} />
        </Environment>
      </Suspense>

      {/* Tutto quello che dipende da `level` sotto un unico `SceneErrorBoundary`:
          se qualcosa lancia un'eccezione al cambio città, un avviso visibile
          (vedi la classe sopra) invece di una scena vuota senza spiegazione. */}
      <SceneErrorBoundary>
        <Suspense fallback={null}>
          <group rotation={[-Math.PI / 2, 0, 0]}>
            {/* `key={level.id}`: senza, `hasError` di questo boundary
                resterebbe `true` per SEMPRE dopo il primo errore di
                caricamento — anche su una città diversa che carica bene —
                dato che il suo stato non si resetta da solo al cambio
                `level`. Con la key, un cambio città rimonta il boundary da
                zero e gli dà una seconda possibilità pulita. */}
            <IslandCapErrorBoundary key={level.id} fallback={<IslandCapFallback level={level} geometry={island.capGeometry} />}>
              <IslandCapTexture level={level} geometry={island.capGeometry} />
            </IslandCapErrorBoundary>
          </group>
        </Suspense>

        {/* Fuori dal Suspense apposta: geometria/texture sincrone (nessuna
            useTexture), deve restare visibile anche se la mappa sopra non
            carica — stesso principio del marker sotto. `key={level.id}`
            come sul coperchio sopra: senza, i due `<mesh>` restano la STESSA
            istanza tra un cambio città e l'altro, e si limitano a ricevere
            una `geometry`/texture diversa in-place — bug reale scovato a
            schermo (non solo teorico): al ritorno su una città già vista la
            pancia/gonna a volte semplicemente non si ridisegnavano più,
            mentre il coperchio (già rimontato via `key`) tornava sempre
            visibile. Con `key`, un cambio città smonta questi due mesh e ne
            monta di nuovi da zero — stesso trattamento del coperchio,
            nessuna asimmetria tra i due strati dello stesso oggetto. */}
        {/* Prefisso `island-`: questo `key` deve restare unico tra i fratelli
            diretti di `SceneErrorBoundary` — `LevelMarker` sotto usa la
            STESSA `level.id` come chiave, React avvisa (ed è un bug vero,
            non solo un warning) se due elementi fratelli condividono la
            stessa key indipendentemente dal tipo. */}
        <group key={`island-${level.id}`} rotation={[-Math.PI / 2, 0, 0]}>
          <IslandTransition geometry={island.transitionGeometry} />
          <IslandBelly geometry={island.bellyGeometry} planeSize={geometry.planeSize} />
        </group>

        {/* `key={level.id}`: stesso motivo del coperchio/pancia sopra.
            Senza, `LevelMarker` resta la STESSA istanza tra un cambio città
            e l'altro — in particolare il suo `wasCloseupRef` (rileva il
            fronte di salita "camera appena entrata in modalità ravvicinata"
            per far partire `Grow_Landing`) resta bloccato a `true` da una
            visita precedente. Bug reale scovato a schermo: tornando su
            Oristano e cliccando per fare zoom, la distanza rientra subito
            sotto soglia ma il fronte di salita non scatta più (era già
            "alto"), quindi l'animazione di crescita del Cinema Ariston non
            parte mai — l'edificio resta nella posa "non cresciuto" di
            `primeAtStart`, invisibile. Con `key`, un cambio città rimonta
            `LevelMarker` da zero e il ref riparte pulito. */}
        <LevelMarker key={`marker-${level.id}`} level={level} position={markerPosition} focused={focused} onSelect={onActivateMarker} />

        <CityTexturePrewarm currentLevelId={level.id} />

        <CameraRig level={level} focused={focused} cameraLockedRef={cameraLockedRef} />
      </SceneErrorBoundary>

      {/* `<Physics>` VUOTO, mai popolato: serve solo a far partire da qui
          l'`import()` interno di `@react-three/rapier` per il motore WASM
          (~2MB), così arriva già caricato quando `SceneManager` (livello di
          gioco) monta il SUO `<Physics>` vero — stesso identico punto
          d'importazione (`suspend-react` condivide la cache per riferimento
          di funzione, non per bytes scaricati), quindi nessun doppione nel
          bundle. Provato prima un `import('@dimforge/rapier3d-compat')`
          diretto da `LevelSelectScene.tsx`: scartato, produceva un secondo
          chunk da 2.2MB invece di condividere quello di `SceneManager` (vedi
          il commento lì). Suspense proprio perché `<Physics>` sospende
          (throw di una promise) finché il WASM non è pronto — innocuo qui,
          non c'è nulla sotto ad aspettare. */}
      <Suspense fallback={null}>
        <Physics>{null}</Physics>
      </Suspense>

      {/* Fuori dal Suspense dell'isola apposta: se il .glb della capsula
          tarda, non deve bloccare il resto della scena — Suspense qui è
          scoped solo a lei. */}
      <Suspense fallback={null}>
        <CapsuleSequence
          trigger={launchTrigger}
          onImpactFlash={onImpactFlash}
          onOutroBlur={onOutroBlur}
          onSequenceComplete={onSequenceComplete}
          cameraLockedRef={cameraLockedRef}
        />
      </Suspense>
    </Canvas>
  );
}
