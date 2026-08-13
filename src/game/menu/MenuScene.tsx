import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { MainMenuOverlay } from './MainMenuOverlay';
import { MainMenuSceneAnimation } from './MainMenuSceneAnimation';

const DOOR_ANIMATION_MS = 1400;

export function MenuScene() {
  const setScreen = useGameStore((state) => state.setScreen);
  const [introComplete, setIntroComplete] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  function handlePlay() {
    setDoorOpen(true);
    // Diamo al portone il tempo di aprirsi prima di cambiare schermata.
    timeoutRef.current = window.setTimeout(() => setScreen('levelSelect'), DOOR_ANIMATION_MS);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="scene-shell">
      <MainMenuSceneAnimation onIntroComplete={() => setIntroComplete(true)} doorOpen={doorOpen} />

      <MainMenuOverlay onPlay={handlePlay} doorOpen={doorOpen} introComplete={introComplete} />
    </div>
  );
}
