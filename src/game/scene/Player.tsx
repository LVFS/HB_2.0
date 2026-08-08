import { useEffect, useRef, useState } from 'react';
import { RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

// Vettori condivisi per il movimento del giocatore.
const velocity = new Vector3();
const direction = new Vector3();
const forward = new Vector3(0, 0, -1);
const backward = new Vector3(0, 0, 1);
const left = new Vector3(-1, 0, 0);
const right = new Vector3(1, 0, 0);

// Registriamo i tasti premuti in un Set globale.
const keys = new Set<string>();

function handleKeyDown(event: KeyboardEvent) {
  keys.add(event.key.toLowerCase());
}

function handleKeyUp(event: KeyboardEvent) {
  keys.delete(event.key.toLowerCase());
}

export function Player() {
  // body è un riferimento al corpo fisico del giocatore nella scena.
  const body = useRef<any>(null);
  const [onGround, setOnGround] = useState(true);

  useEffect(() => {
    // Ascoltiamo i tasti premuti e rilasciati dal giocatore.
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame(() => {
    // useFrame viene chiamato ad ogni fotogramma di render 3D.
    if (!body.current) return;

    const speed = keys.has('shift') ? 6.8 : 3.2;
    direction.set(0, 0, 0);

    if (keys.has('w') || keys.has('arrowup')) direction.add(forward);
    if (keys.has('s') || keys.has('arrowdown')) direction.add(backward);
    if (keys.has('a') || keys.has('arrowleft')) direction.add(left);
    if (keys.has('d') || keys.has('arrowright')) direction.add(right);

    // Salto solo se il giocatore è a terra.
    if (keys.has(' ' ) && onGround) {
      body.current.setLinvel({ x: 0, y: 6.5, z: 0 });
      setOnGround(false);
    }

    if (direction.length() > 0) {
      direction.normalize().multiplyScalar(speed);
      velocity.copy(direction);
      velocity.y = 0;
      body.current.setLinvel({ x: velocity.x, y: body.current.linvel().y, z: velocity.z });
    }
  });

  return (
    <RigidBody
      ref={body}
      colliders="ball"
      restitution={0.1}
      friction={1}
      position={[0, 1.4, 8]}
      onCollisionEnter={() => setOnGround(true)}
    >
      {/* Il giocatore è rappresentato come una sfera visuale 3D */}
      <mesh castShadow>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshStandardMaterial color="#fde68a" metalness={0.1} roughness={0.7} />
      </mesh>
    </RigidBody>
  );
}
