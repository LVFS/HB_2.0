import { useCallback, useEffect, useRef } from 'react';
import { Howl } from 'howler';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Gli effetti sonori disponibili.
 *
 * `impact` e `rubble` NON sono ancora nel repository: finché non li aggiungi
 * in `public/audio/sfx/`, `play()` non fa nulla e Howler segnala un errore di
 * caricamento una volta sola. Il resto della sequenza funziona lo stesso.
 *
 * `chainsaw` invece c'è, ed è un file SINTETIZZATO: motore a due tempi
 * (dente di sega più armoniche, con uno scoppio per giro), rumore della
 * catena filtrato, e i giri che calano di brutto nell'istante del taglio —
 * è quel calo, non il rumore, a far sentire che la lama sta mordendo
 * qualcosa. È panoramizzato da sinistra a destra per seguire la lama che
 * attraversa lo schermo, e la sua linea del tempo combacia con quella
 * dell'animazione (taglio a 0.40s, passata finita a 0.95s), quindi va
 * fatto partire insieme allo sweep. È un segnaposto dignitoso, non un
 * campione vero: sostituendo il file con una registrazione della stessa
 * durata non serve toccare altro.
 */
const SFX_SOURCES = {
  impact: 'audio/sfx/wall-impact.mp3',
  rubble: 'audio/sfx/rubble.mp3',
  chainsaw: 'audio/sfx/chainsaw.wav',
  // I tre tempi dell'uscita di Bloodborne: il colpo che parte, il tonfo del
  // colpo che va a segno, e il finale che arriva mezzo secondo dopo. Vanno
  // aggiunti in `public/audio/sfx/`; finché non ci sono, la scena scorre
  // muta e non succede nient'altro.
  gunshot: 'audio/sfx/gunshot.mp3',
  parry: 'audio/sfx/parry.mp3',
  riposte: 'audio/sfx/riposte.mp3',
  // I tre tempi dell'uscita di God of War: il lancio (che contiene anche
  // l'impatto, non sono due file separati), il gelo che si propaga, e lo
  // strappo finale.
  throw_axe: 'audio/sfx/throw_axe.mp3',
  frost_axe: 'audio/sfx/frost_axe.mp3',
  retrieve_axe: 'audio/sfx/retrieve_axe.mp3',
  // L'uscita di Expedition: un unico file che contiene sia la carica
  // dell'attacco sia il colpo che cancella — non due suoni separati.
  simon_erase: 'audio/sfx/simon_erase.mp3',
  // I due tempi dell'uscita di Hollow Knight, in DUE file distinti (non uno
  // solo come `simon_erase`): l'incantesimo che si carica mentre il
  // Cavaliere parte nel dash, poi l'impatto quando arriva sul testo.
  heroSpell: 'audio/sfx/hero_spell.wav',
  heroImpact: 'audio/sfx/hero_impact.wav'
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
function createSound(src: string): Howl {
  return new Howl({
    src: [`${import.meta.env.BASE_URL}${src}`],
    html5: false,
    preload: true,
    // Senza handler, un file mancante finisce come errore non gestito.
    onloaderror: () => {}
  });
}

/**
 * @param warmUp suoni da scaricare subito invece che al primo `play()`.
 *   Serve quando il momento in cui il suono deve partire è preciso: senza,
 *   l'`Howl` nasce nell'istante della riproduzione e su una connessione
 *   lenta il file inizia a scaricare proprio allora, quindi il suono arriva
 *   in ritardo sull'immagine. In locale non si vede mai. Passare una
 *   costante di modulo, non un array letterale, o l'effetto riparte a ogni
 *   render.
 */
export function useSfx(warmUp?: readonly SfxName[]) {
  const sfxEnabled = useSettingsStore((state) => state.sfxEnabled);
  const volume = useSettingsStore((state) => state.volume);

  const cache = useRef(new Map<SfxName, Howl>());

  useEffect(() => {
    if (!warmUp) return;
    warmUp.forEach((name) => {
      if (!cache.current.has(name)) cache.current.set(name, createSound(SFX_SOURCES[name]));
    });
  }, [warmUp]);

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
      sound = createSound(SFX_SOURCES[name]);
      cache.current.set(name, sound);
    }

    sound.volume(settings.current.volume * (options?.volume ?? 1));
    sound.rate(options?.rate ?? 1);
    sound.play();
  }, []);
}
