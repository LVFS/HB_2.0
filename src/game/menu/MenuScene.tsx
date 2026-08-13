import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { MainMenuOverlay } from './MainMenuOverlay';
import MainmenuSceneAnimation from './MainMenuSceneAnimation';


export function MenuScene() {
  const setScreen = useGameStore((state) => state.setScreen);
  useSettingsStore((state) => console.log(state));
  const [introComplete, setIntroComplete] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  function handlePlay() {
    setDoorOpen(true);
    timeoutRef.current = window.setTimeout(() => setScreen('levelSelect'), 1400);
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
      <MainmenuSceneAnimation setIntroComplete={setIntroComplete} doorOpen={doorOpen} />

      <MainMenuOverlay onPlay={handlePlay} doorOpen={doorOpen} introComplete={introComplete} />
    </div>
  );
}
