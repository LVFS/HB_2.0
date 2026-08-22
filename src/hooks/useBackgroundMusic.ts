import { useEffect, useRef } from 'react';
import { Howl } from 'howler';
import { useSettingsStore } from '@/store/settingsStore';

const THEME_SRC = `${import.meta.env.BASE_URL}audio/theme.mp3`;

interface UseBackgroundMusicOptions {
  /** Mette in pausa il tema senza distruggere l'istanza Howl — usato da
   * `App.tsx` mentre è a schermo una schermata con una propria musica
   * (oggi solo `BirthdayScene`, vedi `useBirthdayMusic`), per non farla
   * suonare sovrapposta al tema del menu. */
  muted?: boolean;
}

/**
 * Gestisce la musica di sottofondo seguendo le impostazioni dell'utente.
 * È un hook e non un componente perché non disegna nulla a video.
 */
export function useBackgroundMusic({ muted = false }: UseBackgroundMusicOptions = {}) {
  const musicEnabled = useSettingsStore((state) => state.musicEnabled);
  const volume = useSettingsStore((state) => state.volume);

  // La ref (e non useMemo) è il posto giusto per una risorsa con un ciclo
  // di vita: useMemo può essere ricalcolato da React senza garanzie.
  const themeRef = useRef<Howl | null>(null);

  useEffect(() => {
    const theme = new Howl({
      src: [THEME_SRC],
      loop: true,
      html5: true,
      preload: true
    });
    themeRef.current = theme;

    return () => {
      // Senza unload, il doppio mount di StrictMode lascerebbe
      // un'istanza orfana che continua a suonare.
      theme.unload();
      themeRef.current = null;
    };
  }, []);

  // Play/pause: dipende da musicEnabled E da muted (entrambi devono
  // acconsentire perché il tema suoni).
  useEffect(() => {
    const theme = themeRef.current;
    if (!theme) return;

    if (!musicEnabled || muted) {
      theme.pause();
      return;
    }

    if (!theme.playing()) {
      // Alcuni browser bloccano l'autoplay finché l'utente non interagisce
      // con la pagina: in quel caso il play viene semplicemente ignorato.
      theme.play();
    }
  }, [musicEnabled, muted]);

  // Volume: applicato a parte, senza toccare play/pause.
  useEffect(() => {
    themeRef.current?.volume(volume);
  }, [volume]);
}
