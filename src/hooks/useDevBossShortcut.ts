import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useLevelStore } from '@/store/levelStore';

/**
 * SCORCIATOIA SOLO PER SVILUPPO (`import.meta.env.DEV`: sparisce nella build
 * pubblicata, `vite build` la elimina come codice morto). `F9` porta
 * dritti all'arena del boss (`boss_fase1`) da qualunque schermata, `F8`
 * torna alla camminata fuori dall'Ariston. Serve a provare il
 * combattimento senza rigiocare menu, dialogo e interno ogni volta.
 *
 * Provvisoria: quando non serve più testarlo così, o quando arriverà una
 * selezione dei boss dal menu, va tolta (vedi la sezione "Boss arena" di
 * CLAUDE.md). Il flusso vero è: camminare dentro `Sala_boss`.
 */
export function useDevBossShortcut(): void {
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'F9' && event.key !== 'F8' && event.key !== 'F7' && event.key !== 'F6') return;
      event.preventDefault();
      useGameStore.getState().setScreen('game');
      // F9 arena del boss, F7 tunnel dell'inseguimento, F6 cutscene pre-boss, F8 fuori dall'Ariston.
      const target =
        event.key === 'F9' ? 'boss_fase1' : event.key === 'F7' ? 'boss_fase2_tunnel' : event.key === 'F6' ? 'dialogo_pre_boss' : 'cammino_libero_ariston';
      useLevelStore.getState().setPhase(target);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
