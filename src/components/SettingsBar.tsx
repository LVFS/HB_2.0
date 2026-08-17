import { useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import ui from '@/styles/ui.module.css';
import styles from './SettingsBar.module.css';

/**
 * Icona impostazioni sempre presente in un angolo + pannellino a comparsa,
 * pensata per essere riusata così com'è in più schermate (menu, selezione
 * livello, un futuro menu pausa) — non conosce fasi/stato di nessuna scena
 * specifica, solo `settingsStore`. Chi la monta decide QUANDO mostrarla
 * (es. `MenuScene` la nasconde durante `punching`/`breaking`).
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
  const [open, setOpen] = useState(false);
  const musicEnabled = useSettingsStore((state) => state.musicEnabled);
  const sfxEnabled = useSettingsStore((state) => state.sfxEnabled);
  const toggleMusic = useSettingsStore((state) => state.toggleMusic);
  const toggleSfx = useSettingsStore((state) => state.toggleSfx);
  const setVolume = useSettingsStore((state) => state.setVolume);
  const volume = useSettingsStore((state) => state.volume);

  return (
    <div
      className={styles.container}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={`${ui.secondary} ${styles.toggle}`}
        onClick={(event) => {
          setOpen((v) => !v);
          event.currentTarget.blur();
        }}
      >
        Impostazioni
      </button>

      {open && (
        <div className={styles.panel}>
          <button className={ui.secondary} onClick={toggleMusic}>
            {musicEnabled ? 'Disattiva Musica' : 'Attiva Musica'}
          </button>
          <button className={ui.secondary} onClick={toggleSfx}>
            {sfxEnabled ? 'Disattiva SFX' : 'Attiva SFX'}
          </button>
          <label className={ui.pill}>
            Volume
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
            />
          </label>
        </div>
      )}
    </div>
  );
}
