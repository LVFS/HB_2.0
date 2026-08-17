import { useGameStore } from '@/store/gameStore';
import ui from '@/styles/ui.module.css';
import styles from './MainMenuOverlay.module.css';
import type { MenuPhase } from './menuPhase';

interface MainMenuOverlayProps {
  phase: MenuPhase;
}

/**
 * Non più un pannello con pulsanti: solo l'invito a premere per iniziare,
 * quando la fase è `'ready'`. L'input vero (tastiera/mouse/touch/gamepad)
 * lo intercetta `useAnyInput` in `MenuScene` — questo componente si limita a
 * mostrare/nascondere il testo in risposta alla fase, non decide nulla.
 *
 * `pointerdown`/`keydown` non vengono fermati qui apposta: un click o un
 * tasto premuto MENTRE compare questo prompt deve proprio arrivare a
 * `window` e far scattare l'avvio — è il comportamento voluto, non un bug
 * da correggere come in `SettingsBar`.
 */
export function MainMenuOverlay({ phase }: MainMenuOverlayProps) {
  const setScreen = useGameStore((state) => state.setScreen);
  // Dalla sequenza del personaggio in poi non si torna indietro: stessa
  // regola già usata prima per disabilitare i controlli del vecchio pannello.
  const isCommitted = phase === 'punching' || phase === 'breaking';

  return (
    <>
      {phase === 'ready' && (
        <div className={styles.prompt}>
          <span className={styles.promptText}>Premi un tasto per iniziare</span>
        </div>
      )}

      {!isCommitted && (
        <button
          type="button"
          className={`${ui.secondary} ${styles.levelSelectLink}`}
          onClick={() => setScreen('levelSelect')}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          Seleziona livello
        </button>
      )}
    </>
  );
}
