import { CUTSCENES } from '@/data/cutscenes/registry';
import type { CutsceneId } from '@/data/cutscenes/types';
import { StoryboardCutscene } from './StoryboardCutscene';

interface CutscenePlayerProps {
  id: CutsceneId;
  /** Chiamata UNA volta sola, a fine o saltando (a prescindere dal ramo usato). */
  onFinished: () => void;
  enabled?: boolean;
}

/**
 * Il punto di sostituzione fra «motion comic» e video (FASE 11, sez. 4b): le fasi montano questo e non `StoryboardCutscene`
 * direttamente. Se per l'id esiste un `video` nel registro il ramo video lo riprodurrà; finché quel ramo non c'è (si scrive
 * quando arriva il primo file da provare) si usa SEMPRE lo storyboard, che è anche il ripiego se un video non si carica.
 */
export function CutscenePlayer({ id, onFinished, enabled = true }: CutscenePlayerProps) {
  const entry = CUTSCENES[id];
  return <StoryboardCutscene key={id} set={entry.storyboard} onFinished={onFinished} enabled={enabled} />;
}
