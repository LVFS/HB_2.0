import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useLevelStore, type LevelPhase } from '@/store/levelStore';
import { useRunStatsStore } from '@/store/runStatsStore';

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
const DEV_TARGETS: Record<string, LevelPhase> = {
  F9: 'boss_fase1', // arena del boss
  F8: 'cammino_libero_ariston', // fuori dall'Ariston
  F7: 'boss_fase2_tunnel', // tunnel dell'inseguimento
  F6: 'dialogo_pre_boss', // cutscene pre-boss
  F2: 'inseguimento_spaziale_cutscene', // spazio (apertura → supporto → cannone → distruzione)
  F3: 'dialogo_finale', // finale a terra
  F4: 'schermata_punteggio' // punteggio e titoli di coda, con statistiche d'esempio
};

/** Statistiche di una run verosimile (17 min, qualche colpo, QTE così così) per provare la schermata del punteggio. */
const SAMPLE_RUN_STATS = () => ({
  startedAt: Date.now() - 17 * 60 * 1000,
  finishedAt: null,
  hitsTaken: 9,
  qte: { bossCoop: true, barrage: 0.78, support: 0.9, cannon: 0.85 },
  curiosities: ['wish:cuore', 'cameo:eve', 'cat', 'pickup:bean'],
  activities: []
});

export function useDevBossShortcut(): void {
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = DEV_TARGETS[event.key];
      if (!target) return;
      event.preventDefault();
      useGameStore.getState().setScreen('game');
      // F4 (punteggio): riempie le statistiche con valori d'esempio, per vedere la schermata senza giocare tutto.
      if (event.key === 'F4') useRunStatsStore.setState(SAMPLE_RUN_STATS());
      // F6 (pre-boss): il video si vede una volta a partita, qui si rimette «non visto» per poterlo rivedere.
      if (event.key === 'F6') useLevelStore.setState((state) => ({ seenCutscenes: state.seenCutscenes.filter((id) => id !== 'preboss_sala1') }));
      // F3 (finale a terra): senza l'esito dello spazio il dialogo prende le righe «di ripiego».
      if (event.key === 'F3') useLevelStore.getState().setSpaceResult({ support: 0.8, cannon: 1 });
      useLevelStore.getState().setPhase(target);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
