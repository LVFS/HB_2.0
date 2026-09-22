import { useCallback, useEffect, useState } from 'react';
import { HomeButton } from '@/components/HomeButton';
import { SettingsBar } from '@/components/SettingsBar';
import { getWorldLevel, levels } from '@/data/levels';
import { useSfx } from '@/hooks/useSfx';
import { useGameStore } from '@/store/gameStore';
import { useProgressStore } from '@/store/progressStore';
import ui from '@/styles/ui.module.css';
import { prefetchLevel1Assets } from '../assetPreload';
import { CAPSULE_TIMING } from './capsuleConfig';
import { CloudTransition, type FlightDirection } from './CloudTransition';
import { LevelListOverlay } from './LevelListOverlay';
import { LevelMapScene } from './LevelMapScene';
import styles from './LevelSelectScene.module.css';

/** Livello mostrato all'ingresso, prima di qualunque scelta: `order === 1`
 * è sempre sbloccato per costruzione (vedi `isLevelUnlocked`), quindi non
 * serve leggere lo store per calcolarlo. */
const FIRST_LEVEL_ID = levels.find((level) => level.order === 1)?.id ?? levels[0].id;

interface LevelSelectSceneProps {
  /** Fade to white di chiusura sequenza — vive in `App`, vedi lì il
   * perché (stesso meccanismo già usato da `MenuScene`, esteso qui per
   * coprire il taglio verso `SceneManager` alla fine della sequenza
   * capsula). */
  onWhiteout: (active: boolean) => void;
}

/**
 * Orchestratore della selezione livelli: un'unica scena 3D sempre visibile
 * (`LevelMapScene`) con l'elenco livelli sovrapposto all'inizio, non al
 * posto di uno schermo nero — nessun taglio secco tra "guardare l'elenco" e
 * "vedere la mappa". Possiede solo la fase e le transizioni di stato,
 * stessa filosofia di `MenuScene.tsx`.
 */
export function LevelSelectScene({ onWhiteout }: LevelSelectSceneProps) {
  const setScreen = useGameStore((state) => state.setScreen);
  const setSelectedLevel = useGameStore((state) => state.setSelectedLevel);
  const resetProgress = useGameStore((state) => state.resetProgress);
  const completedLevelIds = useProgressStore((state) => state.completedLevelIds);
  const playSfx = useSfx();

  // Precarica il CODICE della schermata di gioco NON appena si entra qui,
  // non solo al click su "Avvia livello": da qui in poi l'utente può restare
  // a guardare l'elenco/la mappa per un tempo qualunque, tutto tempo "gratis"
  // per scaricare in background — vedi `assetPreload.ts` per il dettaglio
  // (incluso il motivo per cui il motore fisico Rapier vero non si precarica
  // da qui con un secondo `import()` diretto). Le mappe delle tre città non
  // servono più un prefetch dedicato qui: con tutte le isole permanentemente
  // montate da `LevelMapScene` (vedi Fase 2 del piano isole multiple), il
  // `useTexture` di ciascuna parte già durante il primo render di questa
  // schermata, prima ancora che questo effetto giri.
  useEffect(() => {
    prefetchLevel1Assets();
  }, []);

  const [displayedLevelId, setDisplayedLevelId] = useState(FIRST_LEVEL_ID);
  // `false`: inquadratura d'insieme, elenco livelli sopra. `true`: camera
  // dollata sul marker scelto, elenco nascosto — vedi `LevelMapScene`
  // (`CameraRig`) per chi possiede davvero la camera nei due casi.
  const [focused, setFocused] = useState(false);
  // Incrementato a ogni VERO cambio di mondo — fa partire solo la scia di
  // stelle (`CloudTransition`, ormai senza velo/nuvole, vedi lì), una
  // spinta visiva che accompagna il volo della camera tra un'isola e
  // l'altra (`CameraRig` in `LevelMapScene.tsx`) senza più coprirlo: con
  // tutte e tre le isole permanentemente montate (Fase 2 del piano isole
  // multiple), il cambio città non ha più nulla da nascondere dietro un
  // velo — è immediato, la coda trigger/coperto/pulito che serviva a
  // coordinarsi con quel velo non serve più.
  const [cloudTrigger, setCloudTrigger] = useState(0);
  // Verso dell'ultimo volo avviato — le isole sono disposte a stella
  // secondo la loro posizione REALE reciproca (vedi `islandLayout.ts`), non
  // più in fila per `order`, ma il senso "avanti/indietro" nel percorso
  // resta comunque quello dell'`order` (Oristano→Silì→Cagliari): confrontare
  // l'`order` del livello di partenza e di arrivo basta a sapere se si sta
  // progredendo o tornando indietro; `CloudTransition` usa questo per
  // scegliere un'animazione delle stelle visibilmente diversa (altrimenti
  // il rientro sembrerebbe identico all'andata).
  const [flightDirection, setFlightDirection] = useState<FlightDirection>('forward');

  const displayedLevel = levels.find((level) => level.id === displayedLevelId) ?? levels[0];

  /**
   * Cambia SOLO la città mostrata sulla mappa 3D — riusata sia da chi
   * sceglie un mondo (`handleSelectWorld`, niente zoom) sia da chi sceglie
   * un livello vero (`handleSelectLevel`, che ci aggiunge lo zoom). Il
   * cambio è immediato: `CameraRig` interpola comunque via GSAP dalla
   * posizione attuale a quella della nuova isola, quindi non serve
   * nascondere nulla nel frattempo — è proprio quel volo che questo piano
   * vuole rendere visibile.
   */
  const changeDisplayedCity = useCallback((levelId: string) => {
    setDisplayedLevelId((current) => {
      if (current !== levelId) {
        const currentOrder = levels.find((level) => level.id === current)?.order ?? 0;
        const nextOrder = levels.find((level) => level.id === levelId)?.order ?? 0;
        setFlightDirection(nextOrder < currentOrder ? 'backward' : 'forward');
        setCloudTrigger((n) => n + 1);
      }
      return levelId;
    });
  }, []);

  /** Pulsante "mondo": cambia la città mostrata, non tocca lo zoom — vedi
   * "Parte 1" del piano. */
  const handleSelectWorld = useCallback(
    (worldId: string) => {
      const level = getWorldLevel(worldId);
      if (level) changeDisplayedCity(level.id);
    },
    [changeDisplayedCity]
  );

  /** Selezione di un livello vero (elenco o marker 3D): cambia città E fa
   * partire lo zoom, nello stesso istante — nessuna attesa di un velo che
   * copra il cambio, il cambio è già immediato (vedi `changeDisplayedCity`). */
  const handleSelectLevel = useCallback(
    (levelId: string) => {
      changeDisplayedCity(levelId);
      setFocused(true);
    },
    [changeDisplayedCity]
  );

  // `true` dal click su "Avvia livello" fino al taglio vero e proprio:
  // nasconde elenco/controlli/angolo in alto per lasciare la scena pulita
  // durante la sequenza capsula-impatto-zoom (Parte E, "Stellar Blade").
  const [launching, setLaunching] = useState(false);
  const [launchTrigger, setLaunchTrigger] = useState(0);
  const [flashActive, setFlashActive] = useState(false);
  // Blur CSS sul canvas per il push-in finale — non si spegne da sola
  // (a differenza di `flashActive`): la scena si smonta poco dopo per il
  // cambio schermata, non serve un timeout di ritorno.
  const [outroBlurActive, setOutroBlurActive] = useState(false);
  // Blur+zoom CSS più leggero, acceso/spento da `CameraRig` stesso (via
  // `onFlightChange`, inoltrato da `LevelMapScene`) per OGNI dolly GSAP —
  // cambio mondo, focus su un marker, ritorno all'elenco — non solo il
  // volo tra isole: richiesto esplicitamente come rinforzo visivo del
  // movimento, specialmente ora che le isole sono più distanti tra loro
  // (vedi `ISLAND_GAP` in `islandLayout.ts`).
  const [isFlying, setIsFlying] = useState(false);

  /** Avvolge `setIsFlying`: oltre ad accendere/spegnere il blur, fa partire
   * l'SFX "warp" esattamente all'inizio del movimento (mai al suo termine,
   * `flying` passa a `false` due volte per ogni ciclo — non c'è bisogno di
   * un suono anche in chiusura, il fruscio sintetizzato ha già una coda
   * che sfuma da sola, vedi `scripts/generate-warp-whoosh.mjs`). */
  const handleFlightChange = useCallback(
    (flying: boolean) => {
      setIsFlying(flying);
      if (flying) playSfx('warp');
    },
    [playSfx]
  );

  /** Fa partire la sequenza — non cambia schermata subito: quello lo fa
   * `handleSequenceComplete`, a sequenza (capsula + impatto + pausa)
   * conclusa. Un contatore, non un booleano: un secondo "Avvia livello"
   * nella stessa sessione (improbabile ma non impossibile con `launching`
   * come guard) deve poter far ripartire l'effetto in `CapsuleSequence`
   * anche se il valore logico "sto lanciando" non cambierebbe da solo. */
  const handleStartLevel = useCallback(() => {
    if (launching) return;
    setLaunching(true);
    setLaunchTrigger((n) => n + 1);
  }, [launching]);

  const handleImpactFlash = useCallback(() => {
    setFlashActive(true);
    window.setTimeout(() => setFlashActive(false), CAPSULE_TIMING.flashDuration * 1000);
  }, []);

  const handleOutroBlur = useCallback(() => {
    setOutroBlurActive(true);
  }, []);

  /** Sequenza conclusa: accende il whiteout globale (`App.tsx`) e cambia
   * davvero schermata un istante dopo, quando il bianco ha già coperto lo
   * schermo (la sua transizione CSS dura 0.5s, vedi `App.module.css`). */
  const handleSequenceComplete = useCallback(() => {
    onWhiteout(true);
    window.setTimeout(() => {
      setSelectedLevel(displayedLevel.id);
      resetProgress();
      setScreen('game');
    }, 550);
  }, [displayedLevel, setSelectedLevel, resetProgress, setScreen, onWhiteout]);

  return (
    <div className="scene-shell">
      <div
        className={`${styles.canvasWrapper} ${outroBlurActive ? styles.canvasWrapperBlurred : ''} ${
          isFlying ? styles.canvasWrapperFlying : ''
        }`}
      >
        <LevelMapScene
          level={displayedLevel}
          focused={focused}
          onActivateMarker={handleSelectLevel}
          launchTrigger={launchTrigger}
          onImpactFlash={handleImpactFlash}
          onOutroBlur={handleOutroBlur}
          onSequenceComplete={handleSequenceComplete}
          onFlightChange={handleFlightChange}
        />
      </div>

      <div className={`${styles.impactFlash} ${flashActive ? styles.impactFlashActive : ''}`} />

      {!launching &&
        (focused ? (
          <div className={styles.controls}>
            <button className={ui.secondary} onClick={() => setFocused(false)}>
              Elenco livelli
            </button>
            <button className={ui.primary} onClick={handleStartLevel}>
              Avvia livello
            </button>
          </div>
        ) : (
          <LevelListOverlay
            completedLevelIds={completedLevelIds}
            activeWorldId={displayedLevel.worldId}
            onSelect={handleSelectLevel}
            onSelectWorld={handleSelectWorld}
          />
        ))}

      {!launching && (
        <div className={styles.topRightBar}>
          <HomeButton onClick={() => setScreen('menu')} />
          <SettingsBar />
        </div>
      )}

      <CloudTransition trigger={cloudTrigger} direction={flightDirection} />
    </div>
  );
}
