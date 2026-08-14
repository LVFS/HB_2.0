import { useCallback, useEffect, useRef } from 'react';
import { Howl } from 'howler';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Gli effetti sonori disponibili.
 *
 * I file NON sono ancora nel repository: finché non li aggiungi in
 * `public/audio/sfx/`, `play()` non fa nulla e Howler segnala un errore di
 * caricamento una volta sola. Il resto della sequenza funziona lo stesso.
 */
const SFX_SOURCES = {
  impact: 'audio/sfx/wall-impact.mp3',
  rubble: 'audio/sfx/rubble.mp3'
} as const;

export type SfxName = keyof typeof SFX_SOURCES;

/**
 * Suoni brevi e ripetibili, distinti dalla musica di sottofondo.
 *
 * Differenze rispetto a useBackgroundMusic:
 *  - html5: false, perché per i suoni corti serve Web Audio (latenza bassa);
 *  - le istanze si creano alla prima riproduzione e restano in cache;
 *  - il volume segue quello globale ma legge `sfxEnabled` invece di
 *    `musicEnabled`.
 */
export function useSfx() {
  const sfxEnabled = useSettingsStore((state) => state.sfxEnabled);
  const volume = useSettingsStore((state) => state.volume);

  const cache = useRef(new Map<SfxName, Howl>());

  // I valori correnti in una ref: play() viene chiamata dentro una timeline
  // GSAP, che ha catturato la funzione al momento della creazione. Senza le
  // ref leggerebbe i valori vecchi.
  const settings = useRef({ sfxEnabled, volume });
  settings.current = { sfxEnabled, volume };

  useEffect(() => {
    const sounds = cache.current;
    return () => {
      sounds.forEach((sound) => sound.unload());
      sounds.clear();
    };
  }, []);

  return useCallback((name: SfxName, options?: { volume?: number; rate?: number }) => {
    if (!settings.current.sfxEnabled) return;

    let sound = cache.current.get(name);
    if (!sound) {
      sound = new Howl({
        src: [`${import.meta.env.BASE_URL}${SFX_SOURCES[name]}`],
        html5: false,
        preload: true,
        // Senza handler, un file mancante finisce come errore non gestito.
        onloaderror: () => {}
      });
      cache.current.set(name, sound);
    }

    sound.volume(settings.current.volume * (options?.volume ?? 1));
    sound.rate(options?.rate ?? 1);
    sound.play();
  }, []);
}
