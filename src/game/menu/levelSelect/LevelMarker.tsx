import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { Group, Vector3 } from 'three';
import type { LevelInfo } from '@/data/levels';

interface LevelMarkerProps {
  level: LevelInfo;
  position: [number, number, number];
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

/**
 * Il marker di un livello sul piano-mappa: un pin quando la camera è
 * lontana, il modello 3D (oggi il cilindro placeholder, in futuro un
 * modello Blender) quando ci si avvicina — scambio automatico legato alla
 * distanza camera↔marker (letta ogni fotogramma), non a un bottone o a una
 * fase separata: uno zoom continuo sullo stesso punto.
 */
export function LevelMarker({ level, position }: LevelMarkerProps) {
  const groupRef = useRef<Group>(null);
  const pinRef = useRef<Group>(null);
  const modelRef = useRef<Group>(null);
  // Riusata ogni frame invece di allocarne una nuova: getWorldPosition la
  // riempie, non la sostituisce.
  const worldPos = useRef(new Vector3());

  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    groupRef.current.getWorldPosition(worldPos.current);
    const closeup = camera.position.distanceTo(worldPos.current) < CLOSEUP_DISTANCE;
    if (pinRef.current) pinRef.current.visible = !closeup;
    if (modelRef.current) modelRef.current.visible = closeup;
  });

  return (
    <group ref={groupRef} position={position}>
      <group ref={pinRef}>
        <mesh position={[0, 1, 0]}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial color={level.color} emissive={level.color} emissiveIntensity={0.45} />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1, 8]} />
          <meshStandardMaterial color={level.color} />
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
