import { CUTSCENES } from '@/data/cutscenes/registry';
import type { CutsceneId } from '@/data/cutscenes/types';
import { StoryboardCutscene } from './StoryboardCutscene';
import { VideoCutscene } from './VideoCutscene';

interface CutscenePlayerProps {
  id: CutsceneId;
  /** Chiamata UNA volta sola, a fine o saltando (a prescindere dal ramo usato). */
  onFinished: () => void;
  enabled?: boolean;
}

/**
 * Il punto di scelta fra video e «motion comic»: le fasi montano questo e non i componenti direttamente. Se per l'id il registro ha un
 * `video` si riproduce quello (`VideoCutscene`, FASE 15), altrimenti lo storyboard (`StoryboardCutscene`, FASE 11).
 */
export function CutscenePlayer({ id, onFinished, enabled = true }: CutscenePlayerProps) {
  const entry = CUTSCENES[id];
  if (entry.video) return <VideoCutscene key={id} video={entry.video} onFinished={onFinished} enabled={enabled} />;
  if (entry.storyboard) return <StoryboardCutscene key={id} set={entry.storyboard} onFinished={onFinished} enabled={enabled} />;
  return null;
}
