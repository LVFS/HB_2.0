import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  InstancedRigidBodies,
  Physics,
  type RapierRigidBody
} from '@react-three/rapier';
import type { RigidBodyType } from '@dimforge/rapier3d-compat';
import type { InstancedMesh } from 'three';
import { wallChunks } from './buildWallChunks';
import { applyChunkInstances } from './chunkInstances';
import { planBreak } from './breakPatterns';
import {
  CHUNK_COUNT,
  VARIANT_IMPACT_DELAY,
  VARIANT_ORIGIN,
  WALL,
  type BreakVariant
} from './wallConfig';

/**
 * RigidBodyType.Dynamic.
 *
 * Il valore è ricopiato invece di importare l'enum da
 * `@dimforge/rapier3d-compat`: quell'import è di soli tipi (sparisce alla
 * compilazione) perché importarlo come VALORE fa finire nel bundle una seconda
 * copia del motore fisico, 2 MB di WebAssembly già presenti nel chunk di
 * @react-three/rapier.
 */
const RIGID_BODY_DYNAMIC = 0 as RigidBodyType;

/** Sotto questa quota un detrito non si vede più: lo mettiamo a dormire. */
const DESPAWN_Y = -14;
/** Ogni quanti secondi controllare i detriti da spegnere. */
const DESPAWN_INTERVAL = 1;

interface WallShatterProps {
  variant: BreakVariant;
  debug?: boolean;
}

/**
 * Il muro che si rompe.
 *
 * Struttura in tre tempi:
 *   1. i blocchi nascono FIXED, cioè immobili e a costo quasi zero: sono
 *      identici, come posizione, a quelli di <Wall />, quindi lo scambio non
 *      si vede;
 *   2. una variante di rottura decide chi colpire, con che impulso e con
 *      quanto ritardo (funzione pura, vive in breakPatterns/);
 *   3. un cursore in useFrame libera i blocchi mano a mano che scade il loro
 *      ritardo, trasformandoli in DYNAMIC e applicando l'impulso.
 *
 * Da qui in poi non decidiamo più niente: dove finiscono i detriti lo stabilisce
 * il motore fisico.
 */
export function WallShatter({ variant, debug = false }: WallShatterProps) {
  const bodiesRef = useRef<(RapierRigidBody | null)[]>(null);
  const meshRef = useRef<InstancedMesh>(null);

  // Il piano di rottura si calcola una volta sola: è deterministico.
  const kicks = useMemo(
    () => planBreak(variant, { chunks: wallChunks, origin: VARIANT_ORIGIN[variant] }),
    [variant]
  );

  // Cursore sulla lista ordinata per ritardo + orologio locale.
  const elapsed = useRef(0);
  const nextKick = useRef(0);
  const lastDespawnCheck = useRef(0);

  // Rapier posiziona i corpi, ma i colori delle istanze restano affar nostro.
  useEffect(() => {
    if (meshRef.current) applyChunkInstances(meshRef.current, wallChunks);
  }, []);

  const instances = useMemo(
    () =>
      wallChunks.map((chunk) => ({
        key: chunk.index,
        position: chunk.position
      })),
    []
  );

  useFrame((_, delta) => {
    const bodies = bodiesRef.current;
    if (!bodies) return;

    // delta è già limitato da R3F, ma con un tab in background può arrivare
    // un salto enorme: senza questo tetto l'onda d'urto partirebbe tutta
    // insieme al rientro nella scheda.
    elapsed.current += Math.min(delta, 0.05);

    // Il muro non incassa subito: aspetta lo stesso istante d'impatto che
    // usano camera e audio, così il colpo del pugno e la rottura coincidono.
    const clock = elapsed.current - VARIANT_IMPACT_DELAY[variant];

    // Un solo while sulla lista ordinata: nessuna scansione dei 176 blocchi
    // a ogni fotogramma.
    while (nextKick.current < kicks.length && kicks[nextKick.current].delay <= clock) {
      const kick = kicks[nextKick.current];
      nextKick.current += 1;

      const body = bodies[kick.index];
      if (!body) continue;

      // Da immobile a soggetto alla fisica. È il momento esatto in cui il
      // blocco smette di essere decorazione e diventa un detrito.
      body.setBodyType(RIGID_BODY_DYNAMIC, true);
      body.applyImpulse({ x: kick.impulse[0], y: kick.impulse[1], z: kick.impulse[2] }, true);
      body.applyTorqueImpulse({ x: kick.torque[0], y: kick.torque[1], z: kick.torque[2] }, true);
    }

    // Detriti finiti fuori scena: addormentarli toglie il costo di simularli.
    // Nota: NON toglie il costo di disegnarli, perché un InstancedMesh disegna
    // sempre tutte le sue istanze. Per quello servirebbe portarli a scala 0.
    lastDespawnCheck.current += delta;
    if (lastDespawnCheck.current >= DESPAWN_INTERVAL) {
      lastDespawnCheck.current = 0;
      for (const body of bodies) {
        if (body && !body.isSleeping() && body.translation().y < DESPAWN_Y) {
          body.sleep();
        }
      }
    }
  });

  const [chunkW, chunkH, chunkD] = wallChunks[0].size;

  return (
    <Physics gravity={[0, -18, 0]} debug={debug}>
      {/* Terreno su cui atterrano i detriti: solo collisione, nessuna mesh.
          Il pavimento che si vede è nella scena, non qui. Un collider
          dichiarato fuori da un RigidBody diventa un corpo fisso del mondo. */}
      <CuboidCollider args={[110, 0.5, 110]} position={[0, -0.5, WALL.center[2] / 2]} />

      <InstancedRigidBodies
        ref={bodiesRef}
        instances={instances}
        // Tutti immobili all'inizio: diventano dinamici uno alla volta.
        type="fixed"
        // "cuboid" genera un collider a scatola per istanza. Per blocchi
        // squadrati è esatto ed è la forma più economica che esista.
        colliders="cuboid"
        // Smorzamento: senza, i detriti scivolano sul terreno per sempre e
        // non si addormentano mai.
        linearDamping={0.12}
        angularDamping={0.35}
      >
        <instancedMesh
          ref={meshRef}
          args={[undefined!, undefined!, CHUNK_COUNT]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[chunkW, chunkH, chunkD]} />
          <meshStandardMaterial roughness={0.95} metalness={0} />
        </instancedMesh>
      </InstancedRigidBodies>
    </Physics>
  );
}
