import { Color, InstancedMesh, Matrix4 } from 'three';
import type { WallChunk } from './buildWallChunks';

// Oggetti riusati tra una chiamata e l'altra: allocarne di nuovi per ogni
// blocco creerebbe centinaia di oggetti temporanei da raccogliere.
const matrix = new Matrix4();
const color = new Color();

const STONE_BASE = '#6f6a63';

/**
 * Scrive posizione e colore di ogni blocco dentro l'InstancedMesh.
 *
 * Un InstancedMesh disegna N copie della stessa geometria in UNA sola
 * draw call: 176 blocchi costano quanto uno. Il prezzo è che le copie non
 * sono oggetti della scena, quindi posizione e colore non si impostano con
 * le prop di React ma scrivendo a mano nei buffer, come qui sotto.
 */
export function applyChunkInstances(mesh: InstancedMesh, chunks: WallChunk[]): void {
  chunks.forEach((chunk, i) => {
    matrix.makeTranslation(chunk.position[0], chunk.position[1], chunk.position[2]);
    mesh.setMatrixAt(i, matrix);

    // Variazione di luminosità per blocco: senza, il muro sembra una texture
    // piatta invece che pietra.
    color.set(STONE_BASE);
    color.multiplyScalar(0.72 + chunk.shade * 0.56);
    mesh.setColorAt(i, color);
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}
