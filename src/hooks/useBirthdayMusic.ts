import { useEffect, useRef } from 'react';
import { Howl } from 'howler';
import { useSettingsStore } from '@/store/settingsStore';
import { MUSIC_START_SECONDS, TIMINGS, type TableauId } from '@/game/birthday/birthdayConfig';

/**
 * Uno stinger musicale per quadro della sequenza di auguri.
 *
 * I file NON sono ancora nel repository: finché non li aggiungi in
 * `public/audio/birthday/{quadro}.mp3` (bloodborne.mp3, godofwar.mp3,
 * hollowknight.mp3, expedition.mp3, residentevil.mp3, gta.mp3), la sequenza
 * scorre silenziosa — stesso trattamento tollerante di `useSfx`
 * (`onloaderror: () => {}`). I quadri durano pochi secondi ciascuno: non
 * c'è spazio per un tema che si sviluppa, funzionano meglio brevi stinger
 * (un accordo, 2-4 note) — l'eccezione è `gta`, che resta a schermo 5
 * secondi pieni ed è l'unico dove un motivo più lungo ha il tempo di
 * respirare.
 */
const BIRTHDAY_MUSIC_SOURCES: Record<TableauId, string> = {
  bloodborne: 'audio/birthday/bloodborne.mp3',
  godOfWar: 'audio/birthday/godofwar.mp3',
  hollowKnight: 'audio/birthday/hollowknight.mp3',
  expedition: 'audio/birthday/expedition.mp3',
  residentEvil: 'audio/birthday/residentevil.mp3',
  gta: 'audio/birthday/gta.mp3'
};

function getOrCreateSound(cache: Map<TableauId, Howl>, id: TableauId): Howl {
  let sound = cache.get(id);
  if (!sound) {
    sound = new Howl({
      src: [`${import.meta.env.BASE_URL}${BIRTHDAY_MUSIC_SOURCES[id]}`],
      html5: false,
      preload: true,
      // Senza handler, un file mancante finisce come errore non gestito.
      onloaderror: () => {}
    });
    cache.set(id, sound);
  }
  return sound;
}

/**
 * Crossfade musicale guidato dal quadro attivo (`SEQUENCE[activeIndex]` in
 * `BirthdayScene`, che chiama questo hook a ogni suo cambio) — un `Howl` per
 * traccia, creato pigro alla prima richiesta e tenuto in cache, non tutti
 * precaricati insieme. Le durate di fade sono le stesse di `TIMINGS`
 * (birthdayConfig.ts) usate per la dissolvenza visiva: audio e immagine
 * restano sincronizzati senza duplicare i tempi in due posti. Lo skip
 * (`handleSkip` in `BirthdayScene`, che salta `activeIndex` direttamente
 * all'ultimo quadro) non ha bisogno di gestione speciale: per l'hook è solo
 * un altro cambio di `activeTableauId`, reagisce allo stesso modo.
 */
export function useBirthdayMusic(activeTableauId: TableauId) {
  const musicEnabled = useSettingsStore((state) => state.musicEnabled);
  const volume = useSettingsStore((state) => state.volume);

  const cache = useRef(new Map<TableauId, Howl>());
  const currentIdRef = useRef<TableauId | null>(null);

  // I valori correnti in una ref: l'effetto sotto reagisce SOLO al cambio
  // di `activeTableauId` (il crossfade deve scattare quando cambia il
  // quadro, non quando l'utente tocca il volume) — leggerli da qui invece
  // che catturarli nella closure evita di doverli aggiungere alle
  // dipendenze.
  const settings = useRef({ musicEnabled, volume });
  settings.current = { musicEnabled, volume };

  useEffect(() => {
    const sounds = cache.current;
    return () => {
      sounds.forEach((sound) => sound.unload());
      sounds.clear();
      currentIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    const previousId = currentIdRef.current;
    if (previousId === activeTableauId) return;
    currentIdRef.current = activeTableauId;

    if (previousId) {
      const outgoing = cache.current.get(previousId);
      if (outgoing?.playing()) {
        const fadeOutMs = Math.max(TIMINGS[previousId].fadeOut * 1000, 1);
        outgoing.fade(outgoing.volume(), 0, fadeOutMs);
        outgoing.once('fade', () => outgoing.stop());
      }
    }

    if (!settings.current.musicEnabled) return;

    const incoming = getOrCreateSound(cache.current, activeTableauId);
    const fadeInMs = Math.max(TIMINGS[activeTableauId].fadeIn * 1000, 1);
    incoming.volume(0);
    incoming.play();
    incoming.fade(0, settings.current.volume, fadeInMs);

    const startAt = MUSIC_START_SECONDS[activeTableauId];
    if (startAt) {
      const applySeek = () => incoming.seek(startAt);
      if (incoming.state() === 'loaded') applySeek();
      else incoming.once('load', applySeek);
    }
  }, [activeTableauId]);

  // Volume: applicato a ogni traccia ancora in riproduzione (inclusa una
  // eventualmente a metà dissolvenza in uscita), stesso principio di
  // `useBackgroundMusic`.
  useEffect(() => {
    cache.current.forEach((sound) => {
      if (sound.playing()) sound.volume(volume);
    });
  }, [volume]);

  // Interruttore musica: ferma/riprende la traccia corrente senza
  // riavviare il crossfade, che dipende solo da `activeTableauId`.
  useEffect(() => {
    const currentId = currentIdRef.current;
    if (!currentId) return;
    const current = cache.current.get(currentId);
    if (!current) return;

    if (!musicEnabled) {
      current.stop();
      return;
    }
    if (!current.playing()) {
      current.volume(volume);
      current.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reagisce solo al toggle di musicEnabled, non a ogni cambio di volume (già gestito dall'effetto sopra)
  }, [musicEnabled]);
}
