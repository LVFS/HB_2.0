import { useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three';
import type { LevelInfo } from '@/data/levels';

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
 * finché resta la più piccola, questa soglia va bene per tutti. Non scalata
 * insieme al piano apposta: il modello resta a dimensione reale fissa, non
 * cresce con l'area di mappa visibile. */
const CLOSEUP_DISTANCE = 6.5;

/** Durata del piccolo "scatto" di conferma prima di avviare davvero
 * `onSelect` — dà peso alla scelta invece di passare dritti alla camera che
 * si muove, invece di un salto secco allo zoom. */
const CONFIRM_DELAY = 0.18;

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

  const [hovered, setHovered] = useState(false);

  const emissiveColor = useMemo(() => new Color(level.color), [level.color]);

  useFrame(({ camera }, delta) => {
    if (!groupRef.current) return;
    groupRef.current.getWorldPosition(worldPos.current);
    const closeup = camera.position.distanceTo(worldPos.current) < CLOSEUP_DISTANCE;
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
        <mesh position={[0, 1.1, 0]} castShadow>
          <cylinderGeometry args={[1.2, 1.2, 2.4, 32]} />
          <meshStandardMaterial color={level.color} emissive={level.color} emissiveIntensity={0.25} />
        </mesh>
        <Text position={[0, 2.8, 0]} fontSize={0.4} color="#f8fafc" anchorX="center" anchorY="middle">
          {level.name}
        </Text>
      </group>
    </group>
  );
}
