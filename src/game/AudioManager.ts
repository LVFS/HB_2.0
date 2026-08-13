import { useEffect, useMemo } from "react";
import { Howl } from "howler";
import { useSettingsStore } from "../store/settingsStore";

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
        preload: true,
      }),
    [],
  );

  // Effetto 1: gestisce SOLO play/pause in base a musicEnabled
  useEffect(() => {
    console.log("AudioManager: musicEnabled changed to", musicEnabled);
    if (!musicEnabled) {
      theme.pause();
      return;
    }

    if (!theme.playing()) {
      theme.play().catch?.(() => {
        // alcuni browser richiedono un'interazione utente prima di poter avviare l'audio
      });
    }
  }, [musicEnabled, theme]);

  // Effetto 2: gestisce SOLO il volume, senza toccare play/pause
  useEffect(() => {
    console.log("AudioManager: volume changed to", volume);
    theme.volume(volume);
  }, [volume, theme]);

  
  return null;
}
