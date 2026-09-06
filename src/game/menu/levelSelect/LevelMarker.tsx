import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Text, useAnimations } from '@react-three/drei';
import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
  type Material
} from 'three';
import gsap from 'gsap';
import type { LevelInfo } from '@/data/levels';
import { useCinemaAristonGltf } from './cinemaAristonModel';
import { primeAtStart, playOnce } from './playOnce';

const DUST_PUFF_COUNT = 5;
/** Nomi degli oggetti onda d'urto/polvere nel file del Cinema Ariston —
 * NON vengono più fatti partire (vedi sotto il perché) ma restano comunque
 * presenti nella scena esportata: nascosti esplicitamente invece di
 * lasciarli alla loro posa di riposo (che dipende dal fotogramma su cui
 * si trovava Blender al momento dell'export, fragile — stessa lezione
 * imparata con la capsula in `CapsuleSequence.tsx`). */
const CINEMA_GROUND_EFFECT_NAMES = [
  'Impact_Shockwave',
  ...Array.from({ length: DUST_PUFF_COUNT }, (_, i) => `Dust_Puff_${i}`)
];

interface LevelMarkerProps {
  level: LevelInfo;
  position: [number, number, number];
  /** `true` quando la camera è già dollata sul marker (livello scelto) —
   * disattiva l'interazione sul pin: a quel punto è comunque nascosto dallo
   * scambio per distanza sotto, ma il raycasting di Three.js non rispetta
   * `visible` di per sé (quirk noto), quindi il guard va messo a mano negli
   * handler, non solo lasciato alla visibilità. */
  focused: boolean;
  /** Click/conferma sul pin — stesso effetto di scegliere questo livello
   * dall'elenco 2D (vedi `LevelSelectScene.handleSelectLevel`). */
  onSelect: () => void;
}

/** Sotto questa distanza dalla camera, il marker mostra il modello invece
 * del pin. Deve stare comodamente sopra la distanza camera↔marker di
 * `CAMERA_NEAR` in `LevelMapScene.tsx` (~5, fissa) e sotto quella di
 * `CAMERA_FAR` — quest'ultima ora è proporzionale a `PLANE_SIZE` (quindi
 * diversa per livello, vedi `getMapGeometry`), ma la PIÙ PICCOLA tra tutti
 * i livelli è quella con `mapGrid` minimo (oggi Silì, invariato, ~34) —
 * finché resta la più piccola, questa soglia va bene per tutti. Alzata da
 * 6.5 a 12 su richiesta esplicita (si vuole vedere il modello da un po'
 * più lontano, non solo a ridosso della camera ravvicinata) — resta
 * comunque ben sotto 34, quindi non rischia di far sparire il pin durante
 * il pan libero sulla mappa. Non scalata insieme al piano apposta: il
 * modello resta a dimensione reale fissa, non cresce con l'area di mappa
 * visibile. */
const CLOSEUP_DISTANCE = 12;

/** Durata del piccolo "scatto" di conferma prima di avviare davvero
 * `onSelect` — dà peso alla scelta invece di passare dritti alla camera che
 * si muove, invece di un salto secco allo zoom. */
const CONFIRM_DELAY = 0.18;

/** Il modello del Cinema Ariston è modellato a scala reale (~16m di
 * larghezza) in `assets/blender/cinema_ariston.blend` — l'inquadratura
 * ravvicinata (`CAMERA_NEAR` in `LevelMapScene.tsx`) è invece tarata sul
 * vecchio cilindro placeholder (alto 2.4 unità). Questo fattore lo riporta
 * a una taglia comparabile senza ritoccare la camera; è il primo numero da
 * rivedere se in futuro si rifinisce l'inquadratura a vista. */
const CINEMA_MODEL_SCALE = 0.28;

function isEmissiveMaterial(material: Material | null): material is MeshStandardMaterial {
  return !!material && 'emissiveIntensity' in material;
}

/** Il cilindro placeholder di sempre — INVARIATO, usato per ogni livello
 * che non ha ancora un modello vero (oggi Silì e Cagliari). */
function PlaceholderModel({ level }: { level: LevelInfo }) {
  return (
    <>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[1.2, 1.2, 2.4, 32]} />
        <meshStandardMaterial color={level.color} emissive={level.color} emissiveIntensity={0.25} />
      </mesh>
      <Text position={[0, 2.8, 0]} fontSize={0.4} color="#f8fafc" anchorX="center" anchorY="middle">
        {level.name}
      </Text>
    </>
  );
}

/**
 * Il modello vero del Cinema Ariston: fa partire `Grow_Landing` (crescita
 * dal suolo con rimbalzo) non appena il gruppo diventa il modello
 * ravvicinato attivo (`closeupRef`, che segue la stessa distanza
 * camera↔marker letta dal genitore — un solo punto di verità, non una
 * seconda misura indipendente). L'edificio NON ha una propria onda d'urto/
 * polvere: quel linguaggio visivo resta un segnale esclusivo
 * dell'atterraggio della capsula (`CapsuleSequence.tsx`), per non
 * confonderlo con la crescita dell'edificio — i due oggetti esistono
 * ancora nel file esportato ma restano nascosti (vedi sotto). Un neon che
 * "respira" sull'insegna ARISTON è sempre attivo (idle); al passaggio del
 * mouse le lettere si accendono in sequenza (stagger) invece della
 * modulazione morbida, insieme alla striscia/sigillo ciano — un'animazione
 * diversa dall'idle, come da piano.
 */
interface CinemaAristonModelProps {
  /** Il genitore (`LevelMarker`) scrive qui la funzione da richiamare
   * quando il marker entra in modalità ravvicinata — chiamata in modo
   * SINCRONO dentro il `useFrame` del genitore, prima di rendere visibile
   * il gruppo. Un ref-verso-funzione, non un booleano controllato in un
   * secondo `useFrame` qui dentro: React Three Fiber non garantisce in che
   * ordine vengano eseguiti gli `useFrame` di genitore e figlio nello
   * stesso fotogramma, e affidarsi a quell'ordine causava davvero un lampo
   * dell'edificio già cresciuto per un fotogramma (visto a schermo)
   * uscendo e rientrando nello stesso livello: il gruppo diventava
   * visibile PRIMA che il riavvio dell'animazione avesse effetto. Qui il
   * genitore chiama direttamente questa funzione, quindi l'ordine è
   * garantito dalla lettura del codice, non da un'assunzione su R3F. */
  onCloseupEnterRef: MutableRefObject<(() => void) | null>;
}

function CinemaAristonModel({ onCloseupEnterRef }: CinemaAristonModelProps) {
  const { scene, animations } = useCinemaAristonGltf();
  const { actions, mixer } = useAnimations(animations, scene);
  const elapsed = useRef(0);
  const hoverAmount = useRef(0);
  const [hovered, setHovered] = useState(false);

  const letterMeshes = useMemo(() => {
    const found: Mesh[] = [];
    scene.traverse((object) => {
      if (object instanceof Mesh && object.name.startsWith('Letter_')) found.push(object);
    });
    return found;
  }, [scene]);

  const cyanMeshes = useMemo(() => {
    const found: Mesh[] = [];
    scene.traverse((object) => {
      if (object instanceof Mesh && (object.name === 'Cyan_Strip' || object.name.startsWith('Rune_'))) {
        found.push(object);
      }
    });
    return found;
  }, [scene]);

  // Innesca `Grow_Landing` al proprio fotogramma di partenza, in pausa,
  // prima di qualunque crescita vera — senza, Three.js mostrerebbe la posa
  // "di riposo" del file esportato (l'ultimo fotogramma renderizzato in
  // Blender prima dell'export, non necessariamente il primo) invece
  // dell'edificio non ancora cresciuto. L'onda d'urto/polvere dell'edificio
  // NON partono più (restano un segnale esclusivo dell'atterraggio della
  // capsula, vedi `CapsuleSequence.tsx`) — i loro oggetti si nascondono
  // esplicitamente qui sotto invece di essere innescati.
  useEffect(() => {
    primeAtStart(actions['Grow_Landing']);
    scene.traverse((object) => {
      if (CINEMA_GROUND_EFFECT_NAMES.includes(object.name)) object.visible = false;
    });
  }, [actions, scene]);

  // Registra la funzione che il genitore richiama in modo sincrono
  // all'ingresso in modalità ravvicinata — vedi il commento sul tipo
  // `CinemaAristonModelProps.onCloseupEnterRef` sopra per il perché non
  // basta più un semplice controllo di un ref booleano in un `useFrame`
  // qui dentro. `playOnce` riavvia l'action da capo (senza, Three.js la
  // ripeterebbe all'infinito per default); `mixer.update(0)` subito dopo
  // forza l'applicazione della posa di partenza PRIMA che il genitore
  // renda visibile il gruppo, nello stesso fotogramma.
  useEffect(() => {
    onCloseupEnterRef.current = () => {
      playOnce(actions['Grow_Landing']);
      mixer.update(0);
    };
    return () => {
      onCloseupEnterRef.current = null;
    };
  }, [actions, mixer, onCloseupEnterRef]);

  useFrame((_, delta) => {

    elapsed.current += delta;
    const hoverTarget = hovered ? 1 : 0;
    hoverAmount.current += (hoverTarget - hoverAmount.current) * Math.min(1, delta * 6);

    const idlePulse = 0.5 + Math.sin(elapsed.current * 1.6) * 0.35;
    const letterIntensity = idlePulse + hoverAmount.current * 2.2;
    for (const mesh of letterMeshes) {
      const material = mesh.material as Material;
      if (isEmissiveMaterial(material)) material.emissiveIntensity = letterIntensity;
    }
    for (const mesh of cyanMeshes) {
      const material = mesh.material as Material;
      if (!isEmissiveMaterial(material)) continue;
      const base = mesh.name === 'Cyan_Strip' ? 2.5 : 0.35;
      material.emissiveIntensity = base + hoverAmount.current * 3;
    }
  });

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
    // Stagger: le lettere si accendono in sequenza invece della sola
    // modulazione morbida dell'idle — un'animazione diversa, non solo più
    // intensa, come chiesto dal piano.
    letterMeshes.forEach((mesh, index) => {
      const material = mesh.material as Material;
      if (!isEmissiveMaterial(material)) return;
      gsap.fromTo(material, { emissiveIntensity: 3.2 }, { emissiveIntensity: 1, duration: 0.35, delay: index * 0.04 });
    });
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(false);
  };

  return (
    <primitive
      object={scene}
      scale={CINEMA_MODEL_SCALE}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    />
  );
}

/**
 * Il marker di un livello sul piano-mappa: da lontano un beacon/cristallo
 * (`pinRef`, sotto), da vicino il modello 3D (oggi il cilindro placeholder,
 * `modelRef` — INVARIATO, non toccato in questo giro) — scambio automatico
 * legato alla distanza camera↔marker (letta ogni fotogramma), non a un
 * bottone o a una fase separata.
 *
 * Il pin è interattivo (mouse: hover + click) con tre momenti distinti:
 * riposo (rotazione+fluttuazione continue, sempre attive), hover (si
 * aggiunge alla rotazione di riposo: scala su, bagliore più intenso, anello
 * a terra più marcato) e conferma (un breve scatto di scala/bagliore prima
 * di chiamare `onSelect`, non un salto secco allo zoom). La conferma da
 * controller passa invece dal ciclo mondo/conferma di `LevelListOverlay`
 * (L1/R1 + ✕/A): con un solo marker visibile alla volta per mondo, non
 * serve ancora un vero fuoco da joystick DENTRO la scena 3D — se in futuro
 * un mondo avrà più marker, è lì che andrà aggiunto un secondo ciclo.
 */
export function LevelMarker({ level, position, focused, onSelect }: LevelMarkerProps) {
  const groupRef = useRef<Group>(null);
  const pinRef = useRef<Group>(null);
  const modelRef = useRef<Group>(null);
  const crystalRef = useRef<Mesh>(null);
  const crystalMaterialRef = useRef<MeshStandardMaterial>(null);
  const ringMaterialRef = useRef<MeshBasicMaterial>(null);
  // Riusata ogni frame invece di allocarne una nuova: getWorldPosition la
  // riempie, non la sostituisce.
  const worldPos = useRef(new Vector3());
  const elapsed = useRef(0);
  // Eased 0..1 verso l'hover — evita uno scatto secco quando il mouse entra/esce.
  const hoverAmount = useRef(0);
  // `null` = nessuna conferma in corso; altrimenti tempo trascorso dal click.
  const confirmElapsed = useRef<number | null>(null);
  // `closeup` del fotogramma precedente, per rilevare il fronte di salita
  // (appena entrato in modalità ravvicinata) invece di ricontrollarlo ogni
  // frame in `CinemaAristonModel`.
  const wasCloseupRef = useRef(false);
  // Scritto da `CinemaAristonModel` (unico consumatore oggi): la funzione
  // da richiamare esattamente al fronte di salita, PRIMA di rendere
  // visibile il gruppo — vedi il commento sul tipo in `CinemaAristonModelProps`.
  const onCloseupEnterRef = useRef<(() => void) | null>(null);

  const [hovered, setHovered] = useState(false);

  const emissiveColor = useMemo(() => new Color(level.color), [level.color]);
  const isCinemaAriston = level.id === 'oristano-ariston';

  useFrame(({ camera }, delta) => {
    if (!groupRef.current) return;
    groupRef.current.getWorldPosition(worldPos.current);
    const closeup = camera.position.distanceTo(worldPos.current) < CLOSEUP_DISTANCE;

    // Fronte di salita: richiama SUBITO (sincrono, in questo stesso
    // `useFrame`) l'eventuale animazione di crescita registrata dal figlio
    // — PRIMA di rendere visibile il gruppo qui sotto, cosi' la posa è già
    // quella giusta quando questo fotogramma viene disegnato. Vedi il
    // commento su `onCloseupEnterRef`/`CinemaAristonModelProps` per il bug
    // reale che questo ordine esplicito risolve.
    if (closeup && !wasCloseupRef.current) {
      onCloseupEnterRef.current?.();
    }
    wasCloseupRef.current = closeup;

    if (pinRef.current) pinRef.current.visible = !closeup;
    if (modelRef.current) modelRef.current.visible = closeup;

    elapsed.current += delta;

    // Riposo: rotazione continua + leggera fluttuazione verticale, sempre
    // attive — si nota da fermo che è un punto vivo, non scenografia.
    if (crystalRef.current) {
      crystalRef.current.rotation.y += delta * 0.6;
      crystalRef.current.position.y = 1.6 + Math.sin(elapsed.current * 1.4) * 0.08;
    }

    // Hover: si AGGIUNGE alla rotazione/fluttuazione di riposo, non le sostituisce.
    const hoverTarget = hovered ? 1 : 0;
    hoverAmount.current += (hoverTarget - hoverAmount.current) * Math.min(1, delta * 8);

    // Conferma: un breve scatto sopra lo stato di hover, poi chiama `onSelect`.
    let confirmKick = 0;
    if (confirmElapsed.current !== null) {
      confirmElapsed.current += delta;
      const t = Math.min(1, confirmElapsed.current / CONFIRM_DELAY);
      confirmKick = Math.sin(t * Math.PI);
      if (confirmElapsed.current >= CONFIRM_DELAY) {
        confirmElapsed.current = null;
        onSelect();
      }
    }

    if (crystalRef.current) {
      crystalRef.current.scale.setScalar(1 + hoverAmount.current * 0.18 + confirmKick * 0.45);
    }
    if (crystalMaterialRef.current) {
      crystalMaterialRef.current.emissiveIntensity = 0.5 + hoverAmount.current * 0.9 + confirmKick * 1.6;
    }
    if (ringMaterialRef.current) {
      const pulseSpeed = 2 + hoverAmount.current * 3;
      const pulse = 0.3 + Math.sin(elapsed.current * pulseSpeed) * 0.12;
      ringMaterialRef.current.opacity = Math.min(1, pulse + hoverAmount.current * 0.3 + confirmKick * 0.5);
    }
  });

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (focused) return;
    setHovered(true);
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(false);
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (focused || confirmElapsed.current !== null) return;
    confirmElapsed.current = 0;
  };

  return (
    <group ref={groupRef} position={position}>
      <group ref={pinRef}>
        {/* Fascio verticale: rinforza "punto interattivo" anche quando il
            cristallo è troppo piccolo per notarsi da molto lontano. */}
        <mesh position={[0, 1.15, 0]}>
          <coneGeometry args={[0.16, 2.3, 12, 1, true]} />
          <meshBasicMaterial color={level.color} transparent opacity={0.16} side={DoubleSide} depthWrite={false} />
        </mesh>

        {/* Il cristallo: unico elemento interattivo del pin. */}
        <mesh
          ref={crystalRef}
          position={[0, 1.6, 0]}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        >
          <octahedronGeometry args={[0.32, 0]} />
          <meshStandardMaterial
            ref={crystalMaterialRef}
            color={level.color}
            emissive={emissiveColor}
            emissiveIntensity={0.5}
            roughness={0.25}
            metalness={0.1}
          />
        </mesh>

        {/* Anello a terra, la "base di selezione". */}
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.62, 32]} />
          <meshBasicMaterial
            ref={ringMaterialRef}
            color={level.color}
            transparent
            opacity={0.3}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      <group ref={modelRef} visible={false}>
        {isCinemaAriston ? (
          // Suspense con fallback il placeholder stesso: se il .glb non è
          // ancora arrivato (o fallisce), si vede comunque qualcosa invece
          // di un buco — stesso spirito tollerante già in uso nel progetto
          // per mappa/audio/video mancanti.
          <Suspense fallback={<PlaceholderModel level={level} />}>
            <CinemaAristonModel onCloseupEnterRef={onCloseupEnterRef} />
          </Suspense>
        ) : (
          <PlaceholderModel level={level} />
        )}
      </group>
    </group>
  );
}
