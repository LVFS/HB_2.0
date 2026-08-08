import { RigidBody } from '@react-three/rapier';

export function EnvironmentScene() {
  return (
    <>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[60, 1, 60]} />
          <meshStandardMaterial color="#192135" />
        </mesh>
      </RigidBody>
      <mesh position={[-6, 1.5, -8]} castShadow>
        <coneGeometry args={[2.2, 5, 24]} />
        <meshStandardMaterial color="#5b7ef0" emissive="#152c5f" emissiveIntensity={0.2} roughness={0.7} />
      </mesh>
      <mesh position={[6, 1.5, -10]} castShadow>
        <cylinderGeometry args={[1.2, 1.2, 3.8, 24]} />
        <meshStandardMaterial color="#8ecae6" roughness={0.4} />
      </mesh>
      <mesh position={[-4, 0.7, 5]} rotation={[-Math.PI / 2, 0, 0]}> 
        <torusGeometry args={[2, 0.25, 20, 60]} />
        <meshStandardMaterial color="#d9d9f1" metalness={0.2} roughness={0.5} />
      </mesh>
    </>
  );
}
