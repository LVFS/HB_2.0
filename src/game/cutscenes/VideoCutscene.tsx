import { useCallback, useEffect, useRef, useState } from 'react';
import { SkipCutscene } from '@/components/SkipCutscene';
import type { CutsceneVideo } from '@/data/cutscenes/types';
import { useAnyInput } from '@/hooks/useAnyInput';
import { usePadNavLayer } from '@/input/padNav';
import { usePauseStore } from '@/store/pauseStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUiStore } from '@/store/uiStore';
import ui from '@/styles/ui.module.css';
import styles from './VideoCutscene.module.css';

/** Dopo questo tempo senza che il video parta (o riparta dopo uno stallo) si offre «Riprova / Salta» invece di aspettare in eterno. */
const LOAD_TIMEOUT_MS = 15000;
/** Dissolvenza al nero a fine video (o saltando) prima di passare la mano alla scena successiva. */
const FADE_OUT_MS = 600;

type Phase = 'loading' | 'playing' | 'blocked' | 'error';

interface VideoCutsceneProps {
  video: CutsceneVideo;
  /** Chiamata UNA volta sola, a fine video o saltando (dopo la dissolvenza). */
  onFinished: () => void;
  enabled?: boolean;
}

/**
 * Cinematica video a tutto schermo (FASE 15): `<video>` con sfondo nero e `object-fit: contain`, sottotitoli WebVTT (attivabili dalle
 * impostazioni), salto con `SkipCutscene` (tastiera e pad), musica di sottofondo in pausa e video in pausa se il gioco va in pausa.
 * Regole delle cutscene del progetto: `finish()` è IDEMPOTENTE (fine, salto e rimontaggio passano da lì, `onFinished` scatta una volta sola)
 * e nessun soft-lock — mentre carica c'è un indicatore; se il browser blocca l'autoplay si chiede un tasto; se non carica entro
 * `LOAD_TIMEOUT_MS` (o dà errore) compaiono «Riprova» e «Salta». Percorsi con `BASE_URL`: il deploy è su `/HB_2.0/`.
 */
export function VideoCutscene({ video, onFinished, enabled = true }: VideoCutsceneProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const errorPanel = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [buffering, setBuffering] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [ending, setEnding] = useState(false);
  const [forcedMute, setForcedMute] = useState(false);

  const paused = usePauseStore((state) => state.paused);
  const volume = useSettingsStore((state) => state.volume);
  const subtitles = useSettingsStore((state) => state.subtitles);
  const soundWanted = useSettingsStore((state) => state.musicEnabled || state.sfxEnabled);
  const setVideoPlaying = useUiStore((state) => state.setVideoPlaying);

  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const finished = useRef(false);
  const fadeTimer = useRef<number | undefined>(undefined);
  const watchdog = useRef<number | undefined>(undefined);

  const src = `${import.meta.env.BASE_URL}${video.src}`;
  const subtitlesSrc = video.subtitles ? `${import.meta.env.BASE_URL}${video.subtitles}` : undefined;

  /** Fine (video finito o saltato): dissolvenza al nero e poi `onFinished`. IDEMPOTENTE. */
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    window.clearTimeout(watchdog.current);
    videoRef.current?.pause();
    setEnding(true);
    fadeTimer.current = window.setTimeout(() => onFinishedRef.current(), FADE_OUT_MS);
  }, []);

  // La musica sta ferma per tutta la cinematica; smontando (o a fine) torna da sola.
  useEffect(() => {
    setVideoPlaying(true);
    return () => setVideoPlaying(false);
  }, [setVideoPlaying]);

  useEffect(
    () => () => {
      window.clearTimeout(fadeTimer.current);
      window.clearTimeout(watchdog.current);
      // Solo pausa: NON si toglie il `src` (in StrictMode questo cleanup gira anche fra i due montaggi di sviluppo e lascerebbe il video senza sorgente).
      videoRef.current?.pause();
    },
    []
  );

  /** Se il video non parte (o resta fermo a bufferizzare) per troppo tempo: errore con «Riprova / Salta». */
  const armWatchdog = useCallback(() => {
    window.clearTimeout(watchdog.current);
    watchdog.current = window.setTimeout(() => setPhase('error'), LOAD_TIMEOUT_MS);
  }, []);
  const disarmWatchdog = useCallback(() => window.clearTimeout(watchdog.current), []);

  useEffect(() => {
    if (!enabled) return;
    setPhase('loading');
    armWatchdog();
    return disarmWatchdog;
  }, [enabled, attempt, armWatchdog, disarmWatchdog]);

  const play = useCallback(() => {
    const element = videoRef.current;
    if (!element || finished.current) return;
    element.play().then(
      () => undefined,
      (error: unknown) => {
        const name = (error as { name?: string }).name;
        if (name === 'NotAllowedError') setPhase('blocked');
        else if (name !== 'AbortError') setPhase('error');
      }
    );
  }, []);

  // Audio e sottotitoli seguono le impostazioni.
  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    element.volume = volume;
    element.muted = forcedMute || !soundWanted;
  }, [volume, soundWanted, forcedMute, attempt]);

  const applySubtitles = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;
    for (const track of Array.from(element.textTracks)) track.mode = subtitles ? 'showing' : 'hidden';
  }, [subtitles]);
  useEffect(applySubtitles, [applySubtitles, attempt]);

  // Pausa del gioco: ferma anche il video, e lo fa ripartire alla ripresa.
  useEffect(() => {
    const element = videoRef.current;
    if (!element || phase !== 'playing') return;
    if (paused) element.pause();
    else if (element.paused && !element.ended && !finished.current) play();
  }, [paused, phase, play]);

  // Autoplay bloccato dal browser: un tasto qualsiasi lo sblocca. Col solo pad (che per il browser non è un gesto) si ripiega sul video muto.
  useAnyInput(
    () => {
      const element = videoRef.current;
      if (!element) return;
      element.play().then(
        () => setPhase('playing'),
        () => {
          setForcedMute(true);
          element.muted = true;
          element.play().then(
            () => setPhase('playing'),
            () => setPhase('error')
          );
        }
      );
    },
    { enabled: enabled && phase === 'blocked' }
  );

  const retry = () => {
    setForcedMute(false);
    setAttempt((n) => n + 1);
  };

  // «Riprova / Salta» sono un livello di navigazione da pad (X conferma).
  usePadNavLayer(errorPanel, phase === 'error' && !ending);

  return (
    <div className={styles.root}>
      <video
        key={attempt}
        ref={videoRef}
        className={styles.video}
        src={src}
        playsInline
        preload="auto"
        onLoadedMetadata={applySubtitles}
        onCanPlay={() => {
          disarmWatchdog();
          setBuffering(false);
          if (phase === 'loading') play();
        }}
        onPlaying={() => {
          disarmWatchdog();
          setBuffering(false);
          setPhase('playing');
        }}
        onWaiting={() => {
          if (phase !== 'playing') return;
          setBuffering(true);
          armWatchdog();
        }}
        onEnded={finish}
        onError={() => setPhase('error')}
      >
        {subtitlesSrc && <track kind="subtitles" srcLang="it" label="Italiano" src={subtitlesSrc} default={subtitles} />}
      </video>

      {(phase === 'loading' || buffering) && phase !== 'error' && (
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          Caricamento del video…
        </div>
      )}

      {phase === 'blocked' && (
        <div className={styles.loading} role="status">
          Premi un tasto per iniziare
        </div>
      )}

      {phase === 'error' && !ending && (
        <div className={styles.errorLayer} role="alertdialog" aria-label="Video non disponibile" onPointerDown={(event) => event.stopPropagation()}>
          <div ref={errorPanel} className={styles.errorPanel}>
            <h2 className={styles.errorTitle}>Il video non si carica</h2>
            <p className={styles.errorText}>Controlla la connessione e riprova, oppure salta la scena.</p>
            <div className={styles.errorRow}>
              <button type="button" className={ui.primary} data-nav data-nav-default autoFocus onClick={retry}>
                Riprova
              </button>
              <button type="button" className={ui.secondary} data-nav onClick={finish}>
                Salta
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`${styles.fade} ${ending ? styles.fadeOn : ''}`} />

      {/* Tenere premuto Esc/Invio/Start (o il bottone) salta tutto: vedi `finish`. */}
      <SkipCutscene onSkip={finish} enabled={enabled && phase !== 'error' && !ending} />
    </div>
  );
}
