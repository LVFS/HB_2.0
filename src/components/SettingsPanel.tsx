import { useState } from 'react';
import { testRumble } from '@/input/rumble';
import { GLYPH_SETTINGS, useSettingsStore, type GlyphSetting } from '@/store/settingsStore';
import ui from '@/styles/ui.module.css';

const GLYPH_LABELS: Record<GlyphSetting, string> = {
  auto: 'Auto',
  xbox: 'Xbox',
  playstation: 'PlayStation',
  switch: 'Switch',
  keyboard: 'Tastiera'
};

const RUMBLE_MESSAGES = {
  ok: 'Il browser ha eseguito la vibrazione: se non la senti, il controller non la riceve (spesso succede via Bluetooth: prova col cavo).',
  unsupported: 'Il browser non supporta la vibrazione su questo controller.',
  'no-pad': 'Nessun controller rilevato: premi un tasto del pad e riprova.'
} as const;

/**
 * Il contenuto delle impostazioni (musica, effetti, icone, vibrazione, volume): una colonna di elementi `data-nav`, così si
 * naviga anche da controller. Lo ospitano `SettingsBar` (menu e selezione livelli) e `PauseMenu` (dentro il gioco), che
 * decidono contenitore, posizione e livello di navigazione.
 */
export function SettingsPanelContent() {
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
  const [rumbleResult, setRumbleResult] = useState<keyof typeof RUMBLE_MESSAGES | null>(null);
  const cycleGlyphs = () => setGlyphs(GLYPH_SETTINGS[(GLYPH_SETTINGS.indexOf(glyphs) + 1) % GLYPH_SETTINGS.length]);

  return (
    <>
      <button className={ui.secondary} data-nav data-nav-default onClick={toggleMusic}>
        {musicEnabled ? 'Disattiva Musica' : 'Attiva Musica'}
      </button>
      <button className={ui.secondary} data-nav onClick={toggleSfx}>
        {sfxEnabled ? 'Disattiva SFX' : 'Attiva SFX'}
      </button>
      {/* Icone dei comandi: Auto segue l'ultimo dispositivo usato; gli altri valori le forzano. */}
      <button className={ui.secondary} data-nav onClick={cycleGlyphs}>
        Icone: {GLYPH_LABELS[glyphs]}
      </button>
      <button className={ui.secondary} data-nav onClick={toggleRumble}>
        {rumble ? 'Disattiva vibrazione' : 'Attiva vibrazione'}
      </button>
      <button className={ui.secondary} data-nav onClick={() => void testRumble().then(setRumbleResult)}>
        Prova la vibrazione
      </button>
      {rumbleResult && <p className={ui.bodyText}>{RUMBLE_MESSAGES[rumbleResult]}</p>}
      <label className={ui.pill}>
        {/* `ui.label` e non testo nudo: era l'unica etichetta rimasta in minuscolo, in mezzo a un'interfaccia tutta in maiuscoletto. */}
        <span className={ui.label}>Volume</span>
        <input
          className={ui.range}
          data-nav
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
        />
      </label>
    </>
  );
}
