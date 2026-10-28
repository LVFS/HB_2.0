import type { CutsceneEntry, CutsceneId } from './types';
import { LEVEL1_POSTBOSS } from './level1_postboss';
import { LEVEL1_PREBOSS } from './level1_preboss';

/**
 * Il registro delle cutscene (FASE 11, sez. 4b): le fasi non montano `StoryboardCutscene` direttamente ma `CutscenePlayer`,
 * che guarda qui. Oggi c'è solo lo `storyboard` (motion comic); quando arriveranno le cinematiche video basterà aggiungere un
 * `video: { src }` alla voce giusta, senza toccare le fasi.
 */
export const CUTSCENES: Record<CutsceneId, CutsceneEntry> = {
  preboss: { storyboard: LEVEL1_PREBOSS },
  postboss: { storyboard: LEVEL1_POSTBOSS }
};
