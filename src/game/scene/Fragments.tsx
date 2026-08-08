import { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { RigidBody } from '@react-three/rapier';

// I dati di ogni frammento sono usati sia per il pannello di anteprima
// sia per creare gli oggetti nella scena 3D.
export const fragmentData = [
  { label: 'Cristallo del bosco', color: '#86efac' },
  { label: 'Nucleo d’acqua', color: '#7dd3fc' },
  { label: 'Lama di ghiaccio', color: '#c7d2fe' },
  { label: 'Fiamma aurora', color: '#fb7185' },
  { label: 'Seme di memoria', color: '#fcd34d' }
] as const;

// Posizioni fisse dove compariranno i frammenti nella scena 3D.
const fragmentPositions = [
  [-5, 0.6, -2],
  [4, 0.6, -4],
  [-2, 0.6, 5],
  [3, 0.6, 3],
  [0, 0.6, -8]
] as const;

export function Fragments() {
  const addFragment = useGameStore((state) => state.addFragment);
  const fragmentsFound = useGameStore((state) => state.fragmentsFound);

  // useMemo evita di ricreare l'array ad ogni render, perché i frammenti sono fissi.
  const items = useMemo(
    () =>
      fragmentData.map((fragment, index) => ({
        position: fragmentPositions[index],
        key: `fragment-${index}`,
        color: fragment.color
      })),
    []
  );

  return (
    <group>
      {items.map((item, index) => (
        <RigidBody
          key={item.key}
          type="fixed"
          position={item.position}
          colliders="ball"
          onIntersectionEnter={() => {
            // Quando il giocatore entra in contatto con un frammento,
            // aumentiamo il conteggio e lo mostriamo nell'HUD.
            if (fragmentsFound < fragmentData.length) {
              addFragment();
            }
          }}
        >
          <mesh castShadow>
            <icosahedronGeometry args={[0.5, 1]} />
            <meshStandardMaterial color={item.color} emissive={item.color} emissiveIntensity={0.35} roughness={0.3} />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}
