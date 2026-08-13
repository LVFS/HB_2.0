import { RigidBody } from '@react-three/rapier';
import { fragments } from '@/data/fragments';
import { useGameStore } from '@/store/gameStore';

export function Fragments() {
  const collectFragment = useGameStore((state) => state.collectFragment);
  const collectedFragmentIds = useGameStore((state) => state.collectedFragmentIds);

  return (
    <group>
      {fragments.map((fragment) => {
        // Un frammento già raccolto sparisce dalla scena: così non può
        // essere contato una seconda volta passandoci sopra di nuovo.
        if (collectedFragmentIds.includes(fragment.id)) return null;

        return (
          <RigidBody
            key={fragment.id}
            type="fixed"
            position={fragment.position}
            colliders="ball"
            // `sensor` è indispensabile: senza, Rapier genera collisioni
            // fisiche e non emette mai onIntersectionEnter.
            sensor
            onIntersectionEnter={() => collectFragment(fragment.id)}
          >
            <mesh castShadow>
              <icosahedronGeometry args={[0.5, 1]} />
              <meshStandardMaterial
                color={fragment.color}
                emissive={fragment.color}
                emissiveIntensity={0.35}
                roughness={0.3}
              />
            </mesh>
          </RigidBody>
        );
      })}
    </group>
  );
}
