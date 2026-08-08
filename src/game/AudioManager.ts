import { useEffect, useMemo } from 'react';
import { Howl } from 'howler';
import { useSettingsStore } from '../store/settingsStore';

export function AudioManager() {
  const musicEnabled = useSettingsStore((state) => state.musicEnabled);
  const volume = useSettingsStore((state) => state.volume);

  const theme = useMemo(
    () =>
      new Howl({
        src: ['/audio/theme.mp3'],
        loop: true,
        volume,
        html5: true,
        preload: true
      }),
    []
  );

  useEffect(() => {
    if (!musicEnabled) {
      theme.pause();
      return;
    }

    if (!theme.playing()) {
      try {
        theme.play();
      } catch (error) {
        // L'audio potrebbe richiedere un'interazione utente prima di partire
        console.warn('Impossibile avviare l\'audio:', error);
      }
    }

    theme.volume(volume);
    return () => theme.pause();
  }, [musicEnabled, theme, volume]);

  return null;
}
