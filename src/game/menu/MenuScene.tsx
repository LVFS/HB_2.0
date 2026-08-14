import { useCallback, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { MainMenuOverlay } from './MainMenuOverlay';
import { MainMenuSceneAnimation } from './MainMenuSceneAnimation';
import type { MenuPhase } from './menuPhase';
import type { BreakVariant } from './wall/wallConfig';

/**
 * Orchestratore della schermata iniziale.
 *
 * Non disegna nulla di suo: tiene la fase corrente e la passa ai due figli,
 * la scena 3D e l'overlay HTML. Tutta la coreografia (camera, audio, fisica)
 * sta dentro la scena; qui restano solo le transizioni di stato.
 */
export function MenuScene() {
  const setScreen = useGameStore((state) => state.setScreen);

  const [phase, setPhase] = useState<MenuPhase>('intro');
  const [variant, setVariant] = useState<BreakVariant>('radial');

  // useCallback non è decorativo: queste funzioni finiscono nelle dipendenze
  // degli effetti che costruiscono le timeline GSAP. Se cambiassero a ogni
  // render, la timeline verrebbe distrutta e ricreata di continuo e
  // l'animazione ripartirebbe da capo.
  const handleIntroComplete = useCallback(() => {
    setPhase((current) => (current === 'intro' ? 'ready' : current));
  }, []);

  const handlePlay = useCallback(() => {
    setPhase((current) => (current === 'ready' ? 'breaking' : current));
  }, []);

  // La timeline è finita: il muro è giù, si passa oltre.
  const handleBreakComplete = useCallback(() => {
    setScreen('levelSelect');
  }, [setScreen]);

  return (
    <div className="scene-shell">
      <MainMenuSceneAnimation
        phase={phase}
        variant={variant}
        onIntroComplete={handleIntroComplete}
        onBreakComplete={handleBreakComplete}
      />

      <MainMenuOverlay
        phase={phase}
        variant={variant}
        onVariantChange={setVariant}
        onPlay={handlePlay}
      />
    </div>
  );
}
