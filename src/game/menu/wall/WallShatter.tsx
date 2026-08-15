import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import type { RigidBodyType } from '@dimforge/rapier3d-compat';
import { Mesh } from 'three';
import { SOLID_COVER_PREFIX, useBreakableShards, useEnvironmentGltf } from './environmentModel';
import { planBreak } from './breakPatterns';
import { AFFECT_RADIUS, VARIANT_IMPACT_DELAY, getVariantOrigin, type BreakVariant } from './wallConfig';

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
  /** Altezza del punto d'impatto, generata una volta per rottura da `MenuScene`. */
  impactY: number;
  debug?: boolean;
}

/**
 * Il tratto di muro che si rompe, dentro l'ambientazione ferma.
 *
 * Struttura in tre tempi:
 *   1. i pezzi vicini all'impatto nascono FIXED, cioè immobili e a costo
 *      quasi zero;
 *   2. una variante di rottura decide chi colpire, con che impulso e con
 *      quanto ritardo (funzione pura, vive in breakPatterns/);
 *   3. un cursore in useFrame libera i pezzi mano a mano che scade il loro
 *      ritardo, trasformandoli in DYNAMIC e applicando l'impulso.
 *
 * L'intero muro (portone + pannelli + contrafforti) è frantumato in Blender,
 * ma qui si tiene fisico solo ciò che ricade entro `AFFECT_RADIUS`
 * dall'origine: il resto — anche se geometricamente "rompibile" — resta
 * scenografia statica insieme a strada, cartello, case, torri.
 */
export function WallShatter({ variant, impactY, debug = false }: WallShatterProps) {
  const { scene } = useEnvironmentGltf();
  const allShards = useBreakableShards();
  const origin = useMemo(() => getVariantOrigin(variant, impactY), [variant, impactY]);

  const shards = useMemo(() => {
    const [ox, , oz] = origin;
    const radius = AFFECT_RADIUS[variant];
    // `.index` va riassegnato sulla posizione nel sotto-insieme filtrato: è
    // quello che usano sia `bodiesRef.current[i]` (popolato in ordine da
    // `shards.map`) sia `kick.index` prodotto da `planBreak`. Lasciando
    // l'indice globale (0..217, posizione nel catalogo completo) i due
    // andrebbero fuori sincrono appena il filtro esclude anche un solo pezzo.
    return allShards
      .filter((shard) => Math.hypot(shard.position[0] - ox, shard.position[2] - oz) <= radius)
      .map((shard, index) => ({ ...shard, index }));
  }, [allShards, variant, origin]);

  // Stessa scena di `Wall`, ma capovolta rispetto a lei sulle coperture
  // solide: qui le `Solid_*` restano SEMPRE nascoste (la rottura è iniziata,
  // le crepe si possono vedere) e i frammenti fuori raggio d'impatto restano
  // visibili come scenografia — con le loro crepe, che a questo punto sono
  // corrette da vedere. Le mesh COINVOLTE in questa rottura sono nascoste
  // anche qui: i frammenti fisici prendono il loro posto, altrimenti si
  // vedrebbero doppi sotto ai detriti.
  const staticScene = useMemo(() => {
    const affectedNames = new Set(shards.map((shard) => shard.name));
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if (object.name.startsWith(SOLID_COVER_PREFIX) || affectedNames.has(object.name)) {
        object.visible = false;
        return;
      }
      object.castShadow = true;
      object.receiveShadow = true;
    });
    return clone;
  }, [scene, shards]);

  // Il piano di rottura si calcola una volta sola: a `impactY` fissato è deterministico.
  const kicks = useMemo(
    () => planBreak(variant, { chunks: shards, origin }),
    [variant, shards, origin]
  );

  const bodiesRef = useRef<(RapierRigidBody | null)[]>([]);

  // Cursore sulla lista ordinata per ritardo + orologio locale.
  const elapsed = useRef(0);
  const nextKick = useRef(0);
  const lastDespawnCheck = useRef(0);

  useFrame((_, delta) => {
    const bodies = bodiesRef.current;
    if (!bodies.length) return;

    // delta è già limitato da R3F, ma con un tab in background può arrivare
    // un salto enorme: senza questo tetto l'onda d'urto partirebbe tutta
    // insieme al rientro nella scheda.
    elapsed.current += Math.min(delta, 0.05);

    // Il portone non incassa subito: aspetta lo stesso istante d'impatto che
    // usano camera e audio, così il colpo e la rottura coincidono.
    const clock = elapsed.current - VARIANT_IMPACT_DELAY[variant];

    // Un solo while sulla lista ordinata: nessuna scansione di tutti i pezzi
    // a ogni fotogramma.
    while (nextKick.current < kicks.length && kicks[nextKick.current].delay <= clock) {
      const kick = kicks[nextKick.current];
      nextKick.current += 1;

      const body = bodies[kick.index];
      if (!body) continue;

      // Da immobile a soggetto alla fisica. È il momento esatto in cui il
      // pezzo smette di essere decorazione e diventa un detrito.
      body.setBodyType(RIGID_BODY_DYNAMIC, true);
      body.applyImpulse({ x: kick.impulse[0], y: kick.impulse[1], z: kick.impulse[2] }, true);
      body.applyTorqueImpulse({ x: kick.torque[0], y: kick.torque[1], z: kick.torque[2] }, true);
    }

    // Detriti finiti fuori scena: addormentarli toglie il costo di simularli.
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

  return (
    <>
      <primitive object={staticScene} />

      <Physics gravity={[0, -18, 0]} debug={debug}>
        {/* Terreno su cui atterrano i detriti: solo collisione, nessuna mesh
            (quella vera è nell'ambientazione sopra). Bounds misurati sul
            Ground_Base Blender (X ±70, Y -50..170) convertiti in Three. */}
        <CuboidCollider args={[70, 0.5, 110]} position={[0, -0.5, -60]} />

        {shards.map((shard, i) => (
          <RigidBody
            key={shard.index}
            ref={(body) => {
              bodiesRef.current[i] = body;
            }}
            type="fixed"
            // Cell Fracture (e i pezzi del portone, per forma) produce volumi
            // convessi: per una forma convessa l'inviluppo hull è la forma
            // esatta. Mai `trimesh` su corpi dinamici: instabile e lentissimo.
            colliders="hull"
            position={shard.position}
            linearDamping={0.12}
            angularDamping={0.35}
          >
            <mesh geometry={shard.geometry} material={shard.material} castShadow receiveShadow />
          </RigidBody>
        ))}
      </Physics>
    </>
  );
}
