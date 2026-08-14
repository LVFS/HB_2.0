import { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import ui from '@/styles/ui.module.css';
import styles from './MainMenuOverlay.module.css';
import { breakVariantLabels } from './wall/breakPatterns';
import type { BreakVariant } from './wall/wallConfig';
import type { MenuPhase } from './menuPhase';

const VARIANTS = Object.keys(breakVariantLabels) as BreakVariant[];

interface MainMenuProps {
  phase: MenuPhase;
  variant: BreakVariant;
  onVariantChange: (variant: BreakVariant) => void;
  onPlay: () => void;
}

export function MainMenuOverlay({ phase, variant, onVariantChange, onPlay }: MainMenuProps) {
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

  const isBreaking = phase === 'breaking';

  return (
    <div className={ui.panelOverlay}>
      <div className={ui.panel}>
        <div className={ui.title}>Epic Birthday Quest</div>
        <p className={ui.bodyText}>
          Davanti a te c’è il Muro. Abbattilo e la strada verso i livelli sarà aperta.
        </p>

        <div className={styles.buttons}>
          <button className={ui.primary} onClick={onPlay} disabled={phase !== 'ready'}>
            {isBreaking ? 'Il muro sta cedendo...' : 'Gioca'}
          </button>
          <button className={ui.secondary} onClick={() => setScreen('levelSelect')} disabled={isBreaking}>
            Seleziona livello
          </button>
        </div>

        <div className={styles.status}>
          {phase === 'intro' && 'Animazione in corso...'}
          {phase === 'ready' && 'Scegli come abbattere il muro, poi premi Gioca.'}
          {isBreaking && 'Impatto!'}
        </div>

        {/* Selettore della variante di rottura: è il modo più rapido per
            vedere che cambiando SOLO la funzione degli impulsi cambia tutta
            l'animazione, senza toccare la scena. */}
        <div className={styles.variantGroup}>
          <span className={styles.variantLabel}>Tipo di rottura</span>
          <div className={styles.variantRow}>
            {VARIANTS.map((item) => (
              <button
                key={item}
                type="button"
                className={`${styles.variantButton} ${item === variant ? styles.variantActive : ''}`}
                onClick={() => onVariantChange(item)}
                disabled={isBreaking}
              >
                {breakVariantLabels[item]}
              </button>
            ))}
          </div>
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
