import { useCallback, useEffect, useRef } from 'react';
import { CutscenePlayer } from '@/game/cutscenes/CutscenePlayer';
import { useLevelStore } from '@/store/levelStore';

/**
 * Cutscene pre-boss (`dialogo_pre_boss`): l'ingresso nella Sala 1 raccontato dal video `preboss_sala1` (FASE 15). Nessun gameplay.
 * L'ultimo fotogramma del video ha già le posizioni di partenza dell'arena (D a sinistra, Eve a terra al centro, Checco a destra): a
 * fine o saltando, dissolvenza al nero (la fa `VideoCutscene`) e poi `boss_fase1`, dove Eve entra già a terra. Si vede UNA volta a
 * partita (`levelStore.seenCutscenes`): se per qualunque motivo si rientra, si va dritti all'arena. Il passaggio è IDEMPOTENTE.
 */
export function SceneManagerPreBoss() {
  const done = useRef(false);
  const alreadySeen = useLevelStore.getState().seenCutscenes.includes('preboss_sala1');

  const goToArena = useCallback(() => {
    if (done.current) return;
    done.current = true;
    useLevelStore.getState().markCutsceneSeen('preboss_sala1');
    useLevelStore.getState().setPhase('boss_fase1');
  }, []);

  useEffect(() => {
    if (alreadySeen) goToArena();
  }, [alreadySeen, goToArena]);

  if (alreadySeen) return null;
  return (
    <div className="scene-shell">
      <CutscenePlayer id="preboss_sala1" onFinished={goToArena} />
    </div>
  );
}
