import { useCallback, useEffect, useRef } from 'react';
import { CutscenePlayer } from '@/game/cutscenes/CutscenePlayer';
import { useLevelStore } from '@/store/levelStore';

interface SceneManagerPreBossProps {
  /** Accende il whiteout globale (`App.tsx`) prima di entrare nell'arena. */
  onWhiteout: (active: boolean) => void;
}

/**
 * Cutscene pre-boss (`dialogo_pre_boss`, FASE 11): l'ingresso nella Sala 1 raccontato dai disegni dello storyboard
 * (`data/cutscenes/level1_preboss.ts`). Nessun gameplay: a fine (o saltando con Esc/Invio tenuto) whiteout e poi `boss_fase1`,
 * dove Eve entra già a terra — che combacia con i disegni 4-6. Il passaggio è IDEMPOTENTE: `CutscenePlayer` chiama
 * `onFinished` una volta sola, e qui un ref protegge anche da un rimontaggio.
 */
export function SceneManagerPreBoss({ onWhiteout }: SceneManagerPreBossProps) {
  const timer = useRef<number | undefined>(undefined);
  const done = useRef(false);

  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    },
    []
  );

  const handleFinished = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onWhiteout(true);
    // Lo stesso 550 ms degli altri passaggi: il bianco ha già coperto lo schermo quando la scena cambia.
    timer.current = window.setTimeout(() => useLevelStore.getState().setPhase('boss_fase1'), 550);
  }, [onWhiteout]);

  return (
    <div className="scene-shell">
      <CutscenePlayer id="preboss" onFinished={handleFinished} />
    </div>
  );
}
