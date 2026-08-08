import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export function LoadingScreen() {
  const setScreen = useGameStore((state) => state.setScreen);

  useEffect(() => {
    const timeout = window.setTimeout(() => setScreen('game'), 1400);
    return () => window.clearTimeout(timeout);
  }, [setScreen]);

  return (
    <section className="loading-screen">
      <h1>Caricamento in corso...</h1>
      <p>Prepara il viaggio: il mondo sta emergendo tra neve, vento e magia nordica.</p>
      <div className="status-row">
        <span className="status-pill">Caricamento 42%</span>
        <span className="status-pill">Aspetta solo un momento</span>
      </div>
    </section>
  );
}
