import { useCallback, useEffect, useRef, useState } from 'react';
import { SettingsBar } from '@/components/SettingsBar';
import { useAnyInput } from '@/hooks/useAnyInput';
import { useGameStore } from '@/store/gameStore';
import { prefetchLevelSelectAssets } from './assetPreload';
import { MainMenuOverlay } from './MainMenuOverlay';
import { MainMenuSceneAnimation } from './MainMenuSceneAnimation';
import styles from './MenuScene.module.css';
import type { MenuPhase } from './menuPhase';
import { LEAP_VIDEO_URL, randomIntroVariant, type IntroVariant } from './character/characterConfig';
import { randomImpactY, type BreakVariant } from './wall/wallConfig';

interface MenuSceneProps {
  /** Fade to white di chiusura sequenza — vive in `App`, vedi lì il perché. */
  onWhiteout: (active: boolean) => void;
}

/**
 * Orchestratore della schermata iniziale.
 *
 * Non disegna nulla di suo: tiene la fase corrente e la passa ai due figli,
 * la scena 3D e l'overlay HTML. Tutta la coreografia (camera, audio, fisica)
 * sta dentro la scena; qui restano solo le transizioni di stato.
 */
export function MenuScene({ onWhiteout }: MenuSceneProps) {
  const setScreen = useGameStore((state) => state.setScreen);

  const [phase, setPhase] = useState<MenuPhase>('intro');
  const [variant, setVariant] = useState<BreakVariant>('radial');
  // Punto d'impatto di questa rottura: rigenerato a ogni "Gioca" così non è
  // mai lo stesso. Il valore iniziale non conta, non è mai letto prima di
  // `handlePlay`.
  const [impactY, setImpactY] = useState<number>(() => randomImpactY());
  // Quale coreografia del personaggio usare in questo giro: pescata dal pool
  // a ogni "Gioca" (per ora il pool ha una sola voce, ma la struttura regge
  // già più varianti — vedi `characterConfig.ts`). Il valore iniziale non
  // conta, non è mai letto prima di `handleStart`.
  const [introVariant, setIntroVariant] = useState<IntroVariant>(() => randomIntroVariant());
  // Video del salto, guidato da `CharacterIntro` (SAITAMA_TIMING.leapVideo):
  // un semplice booleano, non un ref — cambia una manciata di volte per
  // sequenza, non a ogni fotogramma, quindi lo stato React va benissimo qui
  // (a differenza di camera/posizioni, quelli sì restano fuori da React).
  const [leapVideo, setLeapVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Incrementato a ogni "premi qualcosa" ricevuto mentre la fase è ancora
  // 'intro': un contatore (non un booleano) perché ogni pressione deve
  // poter far scattare l'effetto in `CameraDirector` anche se il valore
  // precedente non cambia di "stato" — vedi lì per il dettaglio.
  const [skipIntroToken, setSkipIntroToken] = useState(0);

  // useCallback non è decorativo: queste funzioni finiscono nelle dipendenze
  // degli effetti che costruiscono le timeline GSAP. Se cambiassero a ogni
  // render, la timeline verrebbe distrutta e ricreata di continuo e
  // l'animazione ripartirebbe da capo.
  const handleIntroComplete = useCallback(() => {
    setPhase((current) => (current === 'intro' ? 'ready' : current));
  }, []);

  // Precarica gli asset della schermata successiva NON appena l'utente può
  // vederli arrivare — non prima (in `'intro'` competerebbe per banda con
  // gli asset critici di QUESTA schermata, ingresso-oristano.glb in testa,
  // rallentando il primo caricamento vero) — e comunque con largo anticipo:
  // da qui a `screen: 'levelSelect'` restano le fasi `punching`/`breaking`
  // (diversi secondi di coreografia), tempo "gratis" per il download. Vedi
  // `assetPreload.ts` per il dettaglio (dynamic import + `requestIdleCallback`).
  useEffect(() => {
    if (phase !== 'ready') return;
    prefetchLevelSelectAssets();
  }, [phase]);

  // Non più legato al click di un bottone "Gioca": parte la sequenza
  // cinematica del personaggio, che a sua volta innesca `breaking`
  // esattamente nel fotogramma dell'impatto — vedi `handlePunchImpact`.
  const handleStart = useCallback(() => {
    setIntroVariant(randomIntroVariant());
    setPhase((current) => (current === 'ready' ? 'punching' : current));
  }, []);

  // Una pressione qualsiasi (tastiera/mouse/touch/gamepad — vedi
  // `useAnyInput`) fa cose diverse a seconda della fase: durante `'intro'`
  // salta il volo di camera al suo punto d'arrivo (una pressione in più
  // servirà comunque per avviare davvero, una volta in `'ready'`); durante
  // `'ready'` avvia la sequenza. Nelle altre fasi l'hook è disattivato
  // (`enabled` sotto), quindi qui non serve nemmeno controllarle.
  useAnyInput(
    () => {
      if (phase === 'intro') {
        setSkipIntroToken((n) => n + 1);
      } else if (phase === 'ready') {
        handleStart();
      }
    },
    { enabled: phase === 'intro' || phase === 'ready' }
  );

  // Chiamato da `CharacterIntro` nell'istante in cui il pugno tocca il muro.
  // La sequenza del personaggio, per ora, ha un solo esito narrativo: il
  // pugno sfonda il muro. Forziamo quindi la variante a 'punch' — non è
  // l'utente a scegliere più qui, è la coreografia a deciderlo.
  const handlePunchImpact = useCallback(() => {
    setVariant('punch');
    setImpactY(randomImpactY());
    setPhase((current) => (current === 'punching' ? 'breaking' : current));
  }, []);

  // La timeline è finita: il muro è giù, si passa oltre. A quel punto il
  // bianco (in `App`) è già a piena opacità — vedi `CameraDirector`, che lo
  // accende con abbastanza anticipo perché la transizione CSS faccia in
  // tempo a completarsi prima di questo taglio.
  const handleBreakComplete = useCallback(() => {
    setScreen('levelSelect');
  }, [setScreen]);

  // Play/pause del video del salto: un `<video>` è HTML puro, non può stare
  // dentro `<Canvas>` (R3F non sa montare elementi DOM) — vive qui, un
  // livello sopra `CharacterIntro`, che si limita ad accendere/spegnere
  // `leapVideo` a tempo debito sulla sua timeline GSAP.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (leapVideo) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [leapVideo]);

  // Stessa regola già usata per disabilitare i vecchi controlli: dalla
  // sequenza del personaggio in poi non si torna indietro.
  const isCommitted = phase === 'punching' || phase === 'breaking';

  return (
    <div className="scene-shell">
      <MainMenuSceneAnimation
        phase={phase}
        variant={variant}
        impactY={impactY}
        introVariant={introVariant}
        onIntroComplete={handleIntroComplete}
        skipIntroToken={skipIntroToken}
        onPunchImpact={handlePunchImpact}
        onWhiteout={onWhiteout}
        onLeapVideo={setLeapVideo}
        onBreakComplete={handleBreakComplete}
      />

      <MainMenuOverlay phase={phase} />

      {!isCommitted && (
        <div className={styles.settingsAnchor}>
          <SettingsBar />
        </div>
      )}

      {/* Se il file non esiste ancora (vedi `LEAP_VIDEO_URL`), l'errore di
          caricamento è silenzioso e l'overlay resta semplicemente invisibile
          — stesso trattamento tollerante di `useSfx` per gli MP3 assenti. */}
      <video
        ref={videoRef}
        src={LEAP_VIDEO_URL}
        className={`${styles.leapVideo} ${leapVideo ? styles.leapVideoActive : ''}`}
        muted
        playsInline
        onError={() => {}}
      />
    </div>
  );
}
