import { useState } from 'react';
import { GLYPH_SETTINGS, useSettingsStore, type GlyphSetting } from '@/store/settingsStore';
import ui from '@/styles/ui.module.css';
import styles from './SettingsBar.module.css';

const GLYPH_LABELS: Record<GlyphSetting, string> = {
  auto: 'Auto',
  xbox: 'Xbox',
  playstation: 'PlayStation',
  switch: 'Switch',
  keyboard: 'Tastiera'
};

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
  const glyphs = useSettingsStore((state) => state.glyphs);
  const setGlyphs = useSettingsStore((state) => state.setGlyphs);
  const rumble = useSettingsStore((state) => state.rumble);
  const toggleRumble = useSettingsStore((state) => state.toggleRumble);
  const cycleGlyphs = () => setGlyphs(GLYPH_SETTINGS[(GLYPH_SETTINGS.indexOf(glyphs) + 1) % GLYPH_SETTINGS.length]);

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
          {/* Icone dei comandi: Auto segue l'ultimo dispositivo usato; gli altri valori le forzano. */}
          <button className={ui.secondary} onClick={cycleGlyphs}>
            Icone: {GLYPH_LABELS[glyphs]}
          </button>
          <button className={ui.secondary} onClick={toggleRumble}>
            {rumble ? 'Disattiva vibrazione' : 'Attiva vibrazione'}
          </button>
          <label className={ui.pill}>
            {/* `ui.label` e non testo nudo: era l'unica etichetta rimasta in
                minuscolo, in mezzo a un'interfaccia tutta in maiuscoletto. */}
            <span className={ui.label}>Volume</span>
            <input
              className={ui.range}
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
