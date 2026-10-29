import { useEffect, useRef } from 'react';
import { usePadNavLayer } from '@/input/padNav';
import { useUiStore } from '@/store/uiStore';
import ui from '@/styles/ui.module.css';
import { SettingsPanelContent } from './SettingsPanel';
import styles from './SettingsBar.module.css';

/** Esc deve arrivare al gestore dell'input (apre e chiude il pannello); gli altri tasti restano qui. */
const stopUnlessEscape = (event: { key: string; stopPropagation: () => void }) => {
  if (event.key !== 'Escape') event.stopPropagation();
};

/**
 * Icona impostazioni sempre presente in un angolo + pannellino a comparsa,
 * pensata per essere riusata così com'è in più schermate (menu, selezione
 * livello) — non conosce fasi/stato di nessuna scena specifica, solo gli
 * store. Chi la monta decide QUANDO mostrarla (es. `MenuScene` la nasconde
 * durante `punching`/`breaking`). Dentro il gioco le impostazioni stanno
 * nel menu di pausa (`PauseMenu`).
 *
 * Aperto/chiuso sta in `uiStore.settingsOpen`, così lo apre anche il
 * controller (Options) e lo chiude ○/B: finché è aperto è un livello di
 * navigazione da pad (`usePadNavLayer`).
 *
 * `stopPropagation` su tutto il contenitore: senza, un click o un tasto
 * premuto qui dentro (anche solo per muovere lo slider del volume con le
 * frecce) risalirebbe fino a `window` e farebbe scattare `useAnyInput`
 * altrove nell'app (es. "premi un tasto per iniziare" nel menu) insieme
 * all'interazione con le impostazioni. Non basta però fermare la
 * propagazione: un `<button>` cliccato resta a fuoco finché non lo si
 * sposta altrove, e un fuoco rimasto qui dentro intercetterebbe (e
 * inghiottirebbe) anche una pressione successiva che non ha più niente a
 * che fare con le impostazioni — per questo il bottone si sfoca da solo
 * subito dopo il click.
 */
export function SettingsBar() {
  const open = useUiStore((state) => state.settingsOpen);
  const setOpen = useUiStore((state) => state.setSettingsOpen);
  const panel = useRef<HTMLDivElement>(null);
  usePadNavLayer(panel, open, () => setOpen(false));

  // Uscendo dalla schermata il pannello non resta «aperto» per la prossima.
  useEffect(() => () => setOpen(false), [setOpen]);

  return (
    <div
      className={styles.container}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={stopUnlessEscape}
    >
      <button
        type="button"
        className={`${ui.secondary} ${styles.toggle}`}
        onClick={(event) => {
          setOpen(!open);
          event.currentTarget.blur();
        }}
      >
        Impostazioni
      </button>

      {open && (
        <div ref={panel} className={styles.panel}>
          <SettingsPanelContent />
        </div>
      )}
    </div>
  );
}
