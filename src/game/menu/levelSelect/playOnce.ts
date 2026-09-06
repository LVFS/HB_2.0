import { LoopOnce, type AnimationAction } from 'three';

/**
 * Fa partire un'action da capo e la ferma al termine, invece del loop
 * infinito di default di Three.js (`AnimationAction.play()` senza
 * `setLoop` ripete per sempre) — usato per ogni action "evento" di questo
 * progetto (crescita edificio, onda d'urto, polvere, discesa capsula):
 * sono tutte pensate per accadere UNA volta quando qualcosa succede nel
 * browser, non per girare in loop come un'ambientazione.
 */
export function playOnce(action: AnimationAction | undefined | null): void {
  if (!action) return;
  action.reset();
  action.setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
}

/**
 * Porta un'action al suo primo fotogramma e la blocca lì in pausa — usato
 * una volta al mount per "innescare" ogni action prima di qualunque
 * trigger reale. Senza, Three.js mostra come posa di riposo qualunque
 * fotogramma fosse attivo in Blender al momento dell'export (qui, per
 * distrazione, un fotogramma a metà sequenza) invece del vero stato di
 * partenza — capsula già a terra e onda d'urto/polvere già visibili anche
 * prima di premere "Avvia livello", invece che nascosti come dovrebbero.
 */
export function primeAtStart(action: AnimationAction | undefined | null): void {
  if (!action) return;
  action.reset();
  action.play();
  action.paused = true;
}
