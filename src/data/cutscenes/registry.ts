import type { CutsceneEntry, CutsceneId } from './types.ts';
import { LEVEL1_POSTBOSS } from './level1_postboss.ts';

/**
 * Il registro delle cutscene: le fasi non montano il componente direttamente ma `CutscenePlayer`, che guarda qui e sceglie fra
 * video (`VideoCutscene`, FASE 15) e storyboard (`StoryboardCutscene`, FASE 11). I master dei video NON stanno nel repo: qui ci sono
 * le versioni ricompresse a 720p e i sottotitoli `.vtt` in `public/video/cutscenes/`. Niente alias `@/`: lo legge Node nei test.
 */
export const CUTSCENES: Record<CutsceneId, CutsceneEntry> = {
  intro_level1: { video: { src: 'video/cutscenes/intro_level1.mp4', subtitles: 'video/cutscenes/intro_level1.vtt' } },
  preboss_sala1: { video: { src: 'video/cutscenes/preboss_sala1.mp4', subtitles: 'video/cutscenes/preboss_sala1.vtt' } },
  postboss: { storyboard: LEVEL1_POSTBOSS }
};
