import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';

export function MainMenu() {
  const setScreen = useGameStore((state) => state.setScreen);
  const musicEnabled = useSettingsStore((state) => state.musicEnabled);
  const sfxEnabled = useSettingsStore((state) => state.sfxEnabled);
  const toggleMusic = useSettingsStore((state) => state.toggleMusic);
  const toggleSfx = useSettingsStore((state) => state.toggleSfx);
  const setVolume = useSettingsStore((state) => state.setVolume);
  const volume = useSettingsStore((state) => state.volume);

  const status = useMemo(
    () => [
      { label: 'Musica', value: musicEnabled ? 'On' : 'Off' },
      { label: 'Effetti', value: sfxEnabled ? 'On' : 'Off' }
    ],
    [musicEnabled, sfxEnabled]
  );

  return (
    <section className="main-menu">
      <h1>Epic Birthday Quest</h1>
      <p>Inizia l'avventura e scopri i ricordi nascosti. Premi Start per entrare nel mondo 3D.</p>

      {/* Il pulsante Start cambia lo stato globale a 'loading', poi il gioco parte */}
      <div className="menu-actions">
        <button className="primary" onClick={() => setScreen('loading')}>
          Start
        </button>
        <button className="secondary" onClick={toggleMusic}>
          {musicEnabled ? 'Disattiva Musica' : 'Attiva Musica'}
        </button>
        <button className="secondary" onClick={toggleSfx}>
          {sfxEnabled ? 'Disattiva SFX' : 'Attiva SFX'}
        </button>
      </div>

      {/* Regolazione del volume: lo stato viene salvato nel settings store */}
      <div className="settings-panel">
        <label className="status-pill">
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

      {/* Piccola guida per i controlli prima di entrare nel gioco */}
      <div className="hint-panel">
        <p>
          Usa W/A/S/D o le frecce per muoverti. Premi <strong>Space</strong> per saltare.
          Raccogli i frammenti verdi per completare la missione.
        </p>
      </div>

      {/* Stato della musica e degli effetti */}
      <div className="status-row">
        {status.map((item) => (
          <span key={item.label} className="status-pill">
            {item.label}: {item.value}
          </span>
        ))}
      </div>
    </section>
  );
}
