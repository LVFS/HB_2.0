import { useEffect, useState } from 'react';
import { Howler } from 'howler';
import { useSettingsStore } from '@/store/settingsStore';

/** Ogni quanto ricontrollare l'AudioContext condiviso — lo sblocco è un
 * evento raro (al più una volta a sessione), non serve controllarlo a ogni
 * fotogramma. */
const POLL_INTERVAL_MS = 250;
/** Margine di grazia prima che l'avviso possa comparire: la stragrande
 * maggioranza delle sessioni sblocca l'audio nel primo istante (click/
 * tasto/tocco sono comunque richiesti altrove nell'app, es. "premi un
 * tasto per iniziare" nel menu) — senza questo margine il banner
 * lampeggerebbe per una frazione di secondo anche in quei casi normali,
 * prima di sparire subito da solo: rumore visivo per niente. */
const GRACE_MS = 2000;

/**
 * Vero quando c'è audio che l'utente vuole sentire (musica o effetti
 * attivi nelle impostazioni) ma l'AudioContext condiviso di Howler risulta
 * ancora sospeso — bloccato dalla policy di autoplay del browser, che
 * richiede un'interazione "attendibile" (click/tasto/tocco) prima di poter
 * riprodurre audio. Un bottone del controller NON conta come interazione
 * attendibile per nessun browser (l'API Gamepad non ha un evento nativo a
 * cui il browser possa appoggiarsi) — se la sessione avviene solo tramite
 * controller, questo resta vero indefinitamente finché non arriva
 * un'interazione di altro tipo.
 *
 * Non sblocca nulla lui stesso: Howler ascolta già da sé click/tasto/tocco
 * sul documento e sblocca l'audio in automatico alla prima occasione —
 * qui ci si limita a ESPORRE lo stato, per poter mostrare un avviso.
 */
export function useAudioUnlockHint(): boolean {
  const musicEnabled = useSettingsStore((state) => state.musicEnabled);
  const sfxEnabled = useSettingsStore((state) => state.sfxEnabled);
  const audioWanted = musicEnabled || sfxEnabled;

  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!audioWanted) {
      setLocked(false);
      return;
    }

    let graceElapsed = false;
    const graceTimeout = window.setTimeout(() => {
      graceElapsed = true;
    }, GRACE_MS);

    const check = () => {
      const stillLocked = Howler.ctx?.state !== 'running';
      setLocked(stillLocked && graceElapsed);
    };
    const intervalId = window.setInterval(check, POLL_INTERVAL_MS);

    return () => {
      window.clearTimeout(graceTimeout);
      window.clearInterval(intervalId);
    };
  }, [audioWanted]);

  return locked;
}
