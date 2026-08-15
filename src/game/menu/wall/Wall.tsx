import { useEffect, useMemo } from 'react';
import { Mesh } from 'three';
import { isShardMeshName, useEnvironmentGltf } from './environmentModel';

/**
 * L'ambientazione INTATTA: strada, cartello, case, muro e portone chiuso,
 * nessuna fisica.
 *
 * Tenere separata la scena ferma da quella che esplode (`WallShatter`) non è
 * pignoleria: significa che il menu non ha bisogno di Rapier per essere
 * disegnato, e Rapier pesa circa 2 MB. Finché non premi "Gioca", quel codice
 * non viene nemmeno scaricato.
 */
export function Wall() {
  const { scene } = useEnvironmentGltf();

  // Clonato: Wall e WallShatter non sono mai montati insieme, ma clonare
  // evita qualunque rischio di riparentare lo stesso Object3D tra un mount e
  // l'altro, ed è il pattern standard quando lo stesso GLTF serve a più
  // consumatori.
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    cloned.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      // I pezzi frantumati (Cell Fracture) hanno crepe visibili anche da
      // fermi: a muro intatto si nasconde il frammento e si mostra al suo
      // posto la copertura solida `Solid_*`, senza crepe. Vedi
      // `environmentModel.ts`.
      if (isShardMeshName(object.name)) {
        object.visible = false;
        return;
      }
      object.castShadow = true;
      object.receiveShadow = true;
    });
  }, [cloned]);

  return <primitive object={cloned} />;
}
