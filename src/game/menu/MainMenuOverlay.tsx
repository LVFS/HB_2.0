import { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import ui from '@/styles/ui.module.css';
import styles from './MainMenuOverlay.module.css';

interface MainMenuProps {
  onPlay: () => void;
  doorOpen: boolean;
  introComplete: boolean;
}

export function MainMenuOverlay({ onPlay, doorOpen, introComplete }: MainMenuProps) {
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
    <div className={ui.panelOverlay}>
      <div className={ui.panel}>
        <div className={ui.title}>Epic Birthday Quest</div>
        <p className={ui.bodyText}>
          Parti in una corsa attraverso un’isola misteriosa e raggiungi il grande portone che apre la strada ai livelli.
        </p>
        <div className={styles.buttons}>
          <button className={ui.primary} onClick={onPlay} disabled={!introComplete || doorOpen}>
            {doorOpen ? 'Apro il portone...' : 'Gioca'}
          </button>
          <button className={ui.secondary} onClick={() => setScreen('levelSelect')}>
            Seleziona livello
          </button>
        </div>
        <div className={styles.status}>
          {introComplete ? 'Menu pronto. Clicca Gioca per aprire il portone.' : 'Animazione in corso...'}
        </div>
        <div className={styles.settingsPanel}>
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
          <div className={styles.statusRow}>
            {status.map((item) => (
              <span key={item.label} className={ui.pill}>
                {item.label}: {item.value}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
