import { useEffect, useRef, type RefObject } from 'react';
import { Howler } from 'howler';

/** Quante bande basse (su 64 totali con fftSize=128) mediare — le prime
 * sono dove si sente il "battito", il resto dello spettro non serve qui. */
const BASS_BANDS = 10;
/** Quanto pesa il nuovo campione nella media mobile (0-1): più basso =
 * pulsazione più morbida/lenta, più alto = più nervosa/immediata. */
const SMOOTHING = 0.15;

/**
 * Analisi di AMPIEZZA in tempo reale (non riconoscimento del battito: non
 * sa dove cade la battuta, reagisce solo a quanto è forte il suono in quel
 * momento) su qualunque cosa Howler stia riproducendo, scritta come custom
 * property CSS `--audio-pulse` (0-1) sull'elemento indicato — non nello
 * stato React: un valore che cambia ogni fotogramma non deve ridisegnare
 * l'albero, stessa tecnica già in uso per i contatori GTA e la barra di
 * avanzamento in `BirthdayScene`. La property CASCADE ai discendenti come
 * qualunque custom property CSS: scritta una volta sola sul contenitore
 * della scena, ogni quadro puà leggerla nel proprio `.module.css` con
 * `var(--audio-pulse, 0)` senza bisogno di markup nuovo.
 *
 * Howler instrada l'audio (quando non in modalità `html5`, vedi
 * `useBirthdayMusic`) attraverso `Howler.masterGain`, un nodo Web Audio
 * condiviso da TUTTE le tracce — collegare un `AnalyserNode` lì, senza
 * toccare il collegamento esistente verso l'uscita (`connect()` aggiunge
 * un'uscita, non sostituisce quelle già presenti), dà i dati di ampiezza di
 * qualunque cosa stia suonando in quel momento, senza dover sapere quale
 * traccia specifica è attiva.
 */
export function useAudioPulse(rootRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const smoothedRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    let analyser: AnalyserNode | null = null;
    // Annotato esplicitamente su ArrayBuffer (non il più generico
    // ArrayBufferLike, che include anche SharedArrayBuffer): è ciò che
    // `getByteFrequencyData` si aspetta, vedi il commento sotto dove viene
    // costruito.
    let data: Uint8Array<ArrayBuffer> | null = null;
    let rafId = 0;
    let cancelled = false;

    // Howler crea il proprio AudioContext/masterGain in modo pigro, alla
    // prima riproduzione — se non esistono ancora quando questo hook parte
    // (prima che il primo stinger sia partito), riprova a ogni fotogramma
    // finché non compaiono, invece di rinunciare per sempre.
    function trySetup() {
      if (cancelled) return;
      const ctx = Howler.ctx;
      const masterGain = Howler.masterGain;
      if (!ctx || !masterGain) {
        rafId = requestAnimationFrame(trySetup);
        return;
      }

      analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.6;
      masterGain.connect(analyser);
      // `new Uint8Array(n)` si tipizza come `Uint8Array<ArrayBufferLike>`
      // (potrebbe essere un SharedArrayBuffer), ma `getByteFrequencyData`
      // vuole esplicitamente un `Uint8Array<ArrayBuffer>` — passare un
      // `ArrayBuffer` vero e proprio fissa il tipo generico a monte.
      data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

      tick();
    }

    function tick() {
      if (cancelled || !analyser || !data) return;
      analyser.getByteFrequencyData(data);

      const bands = Math.min(BASS_BANDS, data.length);
      let sum = 0;
      for (let i = 0; i < bands; i++) sum += data[i];
      const raw = sum / bands / 255;

      // Media mobile semplice: senza, il valore scatta a ogni fotogramma
      // invece di "respirare" insieme al suono.
      smoothedRef.current += (raw - smoothedRef.current) * SMOOTHING;
      rootRef.current?.style.setProperty('--audio-pulse', smoothedRef.current.toFixed(3));

      rafId = requestAnimationFrame(tick);
    }

    trySetup();

    // Catturato qui, non riletto da `rootRef.current` dentro il cleanup:
    // per come React gestisce i ref di elementi montati questo non
    // cambierebbe comunque nulla in pratica, ma è quello che il linter si
    // aspetta da un ref "posseduto" da un nodo React.
    const root = rootRef.current;
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      analyser?.disconnect();
      root?.style.setProperty('--audio-pulse', '0');
    };
  }, [enabled, rootRef]);
}
