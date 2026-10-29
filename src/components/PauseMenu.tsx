import { useRef, useState } from 'react';
import { useTapAction } from '@/input/useInputHooks';
import { usePadNavLayer } from '@/input/padNav';
import { useGameStore } from '@/store/gameStore';
import { usePauseStore } from '@/store/pauseStore';
import ui from '@/styles/ui.module.css';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './ConfirmDialog.module.css';
import { PadHints } from './PadHints';
import { SettingsPanelContent } from './SettingsPanel';

/**
 * Menu di pausa dentro il gioco (`screen === 'game'`): un tocco di Esc/Options ferma tutto (`pauseStore`: GSAP, input e `<Canvas>`)
 * e apre questo pannello; lo stesso tasto (o «Riprendi», o ○/B) riprende. Da qui si cambiano le impostazioni e si esce dal livello
 * (con conferma: i progressi del livello in corso si perdono). Tenere premuto Esc/Options NON mette in pausa: è il salto delle cutscene.
 */
export function PauseMenu() {
  const screen = useGameStore((state) => state.screen);
  const paused = usePauseStore((state) => state.paused);
  const setPaused = usePauseStore((state) => state.setPaused);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const resume = () => {
    setSettingsOpen(false);
    setConfirmExit(false);
    setPaused(false);
  };

  // Un tocco apre la pausa; a pausa attiva la chiude (anche dentro le impostazioni: si riprende e basta).
  useTapAction('pause', () => (paused ? resume() : setPaused(true)), { enabled: screen === 'game', always: true });

  // ○/B: dalle impostazioni torna al menu di pausa, dal menu di pausa riprende (la conferma ha il suo livello sopra).
  usePadNavLayer(panel, paused && !confirmExit, () => (settingsOpen ? setSettingsOpen(false) : resume()));

  const exitLevel = () => {
    resume();
    useGameStore.getState().setScreen('levelSelect');
  };

  if (!paused || screen !== 'game') return null;

  return (
    <>
      <div className={styles.backdrop} role="dialog" aria-label="Pausa" onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.key !== 'Escape' && event.stopPropagation()}>
        <div ref={panel} className={styles.panel}>
          <h2 className={styles.title}>Pausa</h2>
          {settingsOpen ? (
            <>
              <div className={styles.column}>
                <SettingsPanelContent />
              </div>
              <button type="button" className={ui.secondary} data-nav onClick={() => setSettingsOpen(false)}>
                Indietro
              </button>
            </>
          ) : (
            <div className={styles.column}>
              <button type="button" className={ui.primary} data-nav data-nav-default onClick={resume}>
                Riprendi
              </button>
              <button type="button" className={ui.secondary} data-nav onClick={() => setSettingsOpen(true)}>
                Impostazioni
              </button>
              <button type="button" className={ui.secondary} data-nav onClick={() => setConfirmExit(true)}>
                Esci dal livello
              </button>
            </div>
          )}
        </div>
        <PadHints
          items={[
            { actions: ['pause'], label: 'riprendi' },
            { actions: ['back'], label: 'indietro' }
          ]}
        />
      </div>
      {confirmExit && (
        <ConfirmDialog
          title="Uscire dal livello?"
          text="I progressi del livello in corso andranno persi."
          confirmLabel="Esci"
          cancelLabel="Resta"
          onConfirm={exitLevel}
          onCancel={() => setConfirmExit(false)}
        />
      )}
    </>
  );
}
