import { Suspense, lazy, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Cloud, Clouds, Environment, Lightformer, Sky, Text } from '@react-three/drei';
import gsap from 'gsap';
import type { MeshBasicMaterial } from 'three';
import { useSfx } from '@/hooks/useSfx';
import { Wall } from './wall/Wall';
import {
  GATE_FRONT_Z,
  GATE_ORIGIN,
  VARIANT_IMPACT_DELAY,
  getVariantOrigin,
  type BreakVariant
} from './wall/wallConfig';
import type { MenuPhase } from './menuPhase';
import type { IntroVariant } from './character/characterConfig';

// Rapier (~2 MB) vive solo qui dentro: finché il portone è intatto non serve.
// Viene precaricato appena l'intro finisce, così al click è già in memoria.
const WallShatter = lazy(() =>
  import('./wall/WallShatter').then((module) => ({ default: module.WallShatter }))
);

// I due modelli del personaggio (~1.9 MB in tutto) seguono la stessa logica:
// non servono finché non si preme "Gioca".
const CharacterIntro = lazy(() =>
  import('./character/CharacterIntro').then((module) => ({ default: module.CharacterIntro }))
);

/**
 * Texture di una nuvola, generata al volo con un canvas invece di scaricarla
 * da un CDN esterno: `<Cloud>` usato standalone (senza un `<Clouds texture=
 * ...>` che lo avvolga) va di default su un URL drei-assets su githack.com —
 * soggetto a errori di rete/rate limit (429) che mandavano in crash l'intero
 * `<Canvas>` (l'errore non gestito risale fino all'`ErrorBoundary` di R3F).
 * Un cerchio sfumato basta: da lontano, ferme (`speed=0`), le nuvole sono
 * un dettaglio di sfondo, non serve una texture fotorealistica — e uguale
 * per tutt'e tre le `<Cloud>`, quindi generata una volta sola a livello di
 * modulo, non a ogni render.
 */
function createCloudTexture(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return canvas.toDataURL();
}

const CLOUD_TEXTURE = createCloudTexture();

/**
 * Inquadrature della camera, in coordinate mondo (Three, dopo la conversione
 * dagli assi Blender: vedi commento in `wallConfig.ts`).
 */
const SHOTS = {
  // Si parte alta e lontana sulla strada: la camera "scende e si avvicina",
  // ed è quello che fa leggere la scala del muro (50 unità di altezza).
  introStart: { x: 0, y: 8, z: 40 },
  // Inquadratura bassa vicino al cartello, validata in Blender.
  introEnd: { x: 0.5, y: 1.55, z: -3 },
  break: { x: 0, y: 4, z: -60 },
  // Finale: oltre il varco appena aperto, in quota — vedi `throughGap` sotto.
  throughGap: { x: 0, y: 22, z: GATE_ORIGIN[2] - 55 }
};
const LOOK = {
  introStart: { x: 0, y: 25, z: -115 },
  introEnd: { x: 3.5, y: 18, z: -95 },
  throughGap: { x: 0, y: 40, z: GATE_ORIGIN[2] - 90 }
  // `break` non è qui: dipende da `impactY` (casuale a ogni rottura), viene
  // costruito al volo in `CameraDirector` con `getVariantOrigin`.
};

const INTRO_DURATION = 4.2;
const BREAK_DURATION = 3;
/** Quanto si resta sulla scena dopo che i detriti sono per aria. */
const BREAK_TAIL = 0.5;
/**
 * Finale: la camera attraversa il varco appena aperto e sale di quota,
 * mentre lo schermo sfuma a bianco (vedi `onWhiteout`) prima del taglio a
 * "Seleziona livello" — `MenuScene`/`App` tengono l'overlay bianco vivo
 * ANCHE dopo il cambio schermata (l'attuale schermata sparisce di colpo,
 * l'overlay no), altrimenti lo sfumato non avrebbe nulla da coprire nel
 * fotogramma del taglio.
 */
const THROUGH_GAP_DURATION = 2.4;
/** Quanto dura in questo componente prima che il bianco copra tutto (il
 * CSS dell'overlay ha una sua transizione da 0.5s: qui serve solo un
 * margine perché quella transizione faccia in tempo a completarsi). */
const WHITEOUT_RAMP = 0.7;

interface DirectorProps {
  phase: MenuPhase;
  variant: BreakVariant;
  impactY: number;
  onIntroComplete: () => void;
  /**
   * Incrementato da `MenuScene` a ogni "premi qualcosa" ricevuto mentre la
   * fase è ancora `'intro'`: un contatore, non un booleano, perché ogni
   * pressione deve poter far scattare l'effetto sotto anche se il valore
   * precedente non è cambiato di stato (un booleano rimasto `true` non
   * ritriggererebbe un secondo `useEffect`).
   */
  skipIntroToken: number;
  /** Fade to white finale, prima del taglio a "Seleziona livello". */
  onWhiteout: (active: boolean) => void;
  onBreakComplete: () => void;
}

/**
 * Il regista della sequenza: possiede la camera e la timeline GSAP.
 *
 * Divisione dei ruoli, ed è la parte che conta:
 *   - GSAP guida ciò che ha una durata decisa da noi (camera, scossone, cue
 *     audio, in futuro il personaggio);
 *   - Rapier guida ciò che deve sembrare non scritto (i detriti);
 *   - React decide solo QUALE fase è attiva, non i fotogrammi.
 * Se si mescolano, si finisce a combattere contro uno dei tre.
 */
function CameraDirector({
  phase,
  variant,
  impactY,
  onIntroComplete,
  skipIntroToken,
  onWhiteout,
  onBreakComplete
}: DirectorProps) {
  const { camera } = useThree();
  const playSfx = useSfx();

  // GSAP anima questi oggetti semplici, NON direttamente camera.position.
  // Motivo: allo scossone sommiamo un offset alla posizione; se GSAP possedesse
  // camera.position, l'offset verrebbe inglobato nel tween e la camera
  // andrebbe alla deriva. Qui invece la posizione finale la ricostruiamo noi
  // a ogni fotogramma, e la sorgente resta pulita.
  const base = useRef({ ...SHOTS.introStart }).current;
  const look = useRef({ ...LOOK.introStart }).current;
  const shake = useRef({ value: 0 }).current;
  // Riferimento imperativo alla timeline dell'intro, per poterla "saltare"
  // da un effetto separato (vedi sotto) senza doverla ricostruire.
  const introTimelineRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    if (phase !== 'intro') return;

    Object.assign(base, SHOTS.introStart);
    Object.assign(look, LOOK.introStart);

    const timeline = gsap.timeline({ onComplete: onIntroComplete });
    timeline
      .to(base, { ...SHOTS.introEnd, duration: INTRO_DURATION, ease: 'power2.out' }, 0)
      .to(look, { ...LOOK.introEnd, duration: INTRO_DURATION, ease: 'power1.inOut' }, 0);
    introTimelineRef.current = timeline;

    // Senza kill(), tornando al menu la vecchia timeline continuerebbe a
    // scrivere sugli stessi oggetti insieme a quella nuova.
    return () => {
      timeline.kill();
      introTimelineRef.current = null;
    };
  }, [phase, base, look, onIntroComplete]);

  // "Premi qualcosa" ricevuto da `MenuScene` mentre il volo di camera è
  // ancora in corso: salta la timeline al suo stato finale invece di farla
  // continuare — la prima pressione durante l'intro serve solo a saltarla,
  // non conta anche come "avvia la partita" (serve una pressione in più,
  // gestita da `MenuScene` una volta che la fase è `'ready'`).
  // `skipIntroToken === 0` è il valore iniziale, prima di qualunque
  // pressione: non deve far scattare nulla al primo render.
  useEffect(() => {
    if (skipIntroToken === 0 || phase !== 'intro') return;
    introTimelineRef.current?.progress(1);
  }, [skipIntroToken, phase]);

  useEffect(() => {
    if (phase !== 'breaking') return;

    // Il momento esatto in cui il muro incassa il colpo. Per la variante
    // "pugno" è più tardi: è il tempo di caricare il colpo.
    const impactAt = VARIANT_IMPACT_DELAY[variant];

    // Stessa origine usata da `WallShatter` per gli impulsi: la camera
    // insegue lo stesso punto colpito, ovunque sia capitato questa volta.
    const [breakX, breakY, breakZ] = getVariantOrigin(variant, impactY);

    // Da qui in poi la camera attraversa il varco e sale di quota: parte
    // dal punto colpito (dove si trova già `look` a fine pull-back), non da
    // un valore fisso, così il finale continua senza scatti da qualunque
    // altezza sia stato colpito il portone questa volta.
    const throughGapStart = BREAK_DURATION + BREAK_TAIL;
    const throughGapEnd = throughGapStart + THROUGH_GAP_DURATION;
    const whiteoutAt = throughGapEnd - WHITEOUT_RAMP;

    const timeline = gsap.timeline({ onComplete: onBreakComplete });
    timeline
      .to(base, { ...SHOTS.break, duration: BREAK_DURATION, ease: 'power2.out' }, 0)
      .to(look, { x: breakX, y: breakY, z: breakZ, duration: BREAK_DURATION, ease: 'power2.out' }, 0)
      // Cue audio: GSAP li piazza sulla linea del tempo come i tween.
      .call(() => playSfx('impact'), undefined, impactAt)
      .call(() => playSfx('rubble', { volume: 0.65 }), undefined, impactAt + 0.35)
      // Scossone: sale in un lampo e si spegne lentamente.
      .to(shake, { value: 1, duration: 0.05 }, impactAt)
      .to(shake, { value: 0, duration: 1.5, ease: 'power2.out' }, impactAt + 0.05)
      // Segmento vuoto: lascia respirare la scena mentre i detriti sono
      // ancora in volo, prima di partire verso il varco.
      .to({}, { duration: BREAK_TAIL }, BREAK_DURATION)
      // Finale: dentro il varco, in quota, verso il bianco.
      .to(base, { ...SHOTS.throughGap, duration: THROUGH_GAP_DURATION, ease: 'power1.in' }, throughGapStart)
      .to(look, { ...LOOK.throughGap, duration: THROUGH_GAP_DURATION, ease: 'power1.in' }, throughGapStart)
      .call(() => onWhiteout(true), undefined, whiteoutAt);

    return () => {
      timeline.kill();
      onWhiteout(false);
    };
  }, [phase, variant, impactY, base, look, shake, playSfx, onWhiteout, onBreakComplete]);

  useFrame(() => {
    // Durante 'punching' la camera ha un padrone diverso (`CharacterIntro`):
    // se continuassimo a scrivere qui sopra, i due si contenderebbero lo
    // stesso `camera.position` a ogni fotogramma.
    if (phase === 'punching') return;

    const amount = shake.value;
    camera.position.set(
      base.x + (Math.random() - 0.5) * amount * 1.6,
      base.y + (Math.random() - 0.5) * amount * 1.2,
      base.z + (Math.random() - 0.5) * amount * 0.8
    );
    camera.lookAt(look.x, look.y, look.z);
  });

  return null;
}

/**
 * Il titolo inciso sul muro, che svanisce quando il muro cede.
 *
 * Mostra il terzo tipo di bersaglio che una timeline GSAP può pilotare, dopo
 * la camera e i cue audio: una proprietà di un materiale. Il punto è che
 * l'opacità NON passa da uno stato React — un setState per fotogramma
 * ridisegnerebbe l'albero 60 volte al secondo. GSAP scrive dritto
 * sull'oggetto Three, e React non se ne accorge nemmeno.
 */
function WallTitle({ phase, y }: { phase: MenuPhase; y: number }) {
  const materialRef = useRef<MeshBasicMaterial>(null);

  useEffect(() => {
    if (phase !== 'breaking' || !materialRef.current) return;

    const material = materialRef.current;
    const tween = gsap.to(material, {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.in',
      delay: VARIANT_IMPACT_DELAY.radial
    });

    return () => {
      tween.kill();
      material.opacity = 1;
    };
  }, [phase]);

  return (
    <Text
      position={[0, y, GATE_FRONT_Z + 0.5]}
      fontSize={6}
      letterSpacing={0.08}
      color="#e8eef8"
      outlineWidth={0.03}
      outlineColor="#0b1220"
      anchorX="center"
      anchorY="middle"
    >
      EPIC BIRTHDAY QUEST
      <meshBasicMaterial ref={materialRef} transparent color="#e8eef8" toneMapped={false} />
    </Text>
  );
}

interface MainMenuSceneAnimationProps {
  phase: MenuPhase;
  variant: BreakVariant;
  /** Altezza del punto d'impatto per questa rottura, casuale a ogni "Gioca". */
  impactY: number;
  /** Quale coreografia del personaggio usare in questo giro. */
  introVariant: IntroVariant;
  onIntroComplete: () => void;
  /** Incrementato a ogni "premi qualcosa" ricevuto durante l'intro — vedi `CameraDirector`. */
  skipIntroToken: number;
  /** Chiamato nel fotogramma in cui il pugno tocca il muro: fa scattare `breaking`. */
  onPunchImpact: () => void;
  /** Chiamato quando parte/finisce il fade to white di chiusura sequenza. */
  onWhiteout: (active: boolean) => void;
  /** Chiamato per mostrare/nascondere il video del salto (vedi `CharacterIntro`). */
  onLeapVideo: (active: boolean) => void;
  onBreakComplete: () => void;
}

export function MainMenuSceneAnimation({
  phase,
  variant,
  impactY,
  introVariant,
  onIntroComplete,
  skipIntroToken,
  onPunchImpact,
  onWhiteout,
  onLeapVideo,
  onBreakComplete
}: MainMenuSceneAnimationProps) {
  // Appena l'intro finisce scarichiamo fisica e personaggio in background:
  // quando l'utente clicca sono già pronti e lo scambio è istantaneo.
  useEffect(() => {
    if (phase === 'ready') {
      void import('./wall/WallShatter');
      void import('./character/CharacterIntro');
    }
  }, [phase]);

  // Altezza del titolo: appoggiato sull'infill grigio sopra la torre del
  // portone (Blender Z≈31, dentro l'intervallo 20.4-34.4 della torre).
  const titleY = 53;

  return (
    <Canvas shadows camera={{ position: [0, 1.5, 52], fov: 55 }} dpr={[1, 1.75]}>
      {/* Cielo procedurale con sole vero (stessa direzione della luce
          direzionale sotto, sennò il sole in cielo e le ombre a terra
          punterebbero in direzioni diverse). Sostituisce il colore piatto di
          sfondo: niente più bordo netto tra "sfondo" e "fog". */}
      <Sky sunPosition={[100, 200, -150]} turbidity={4} rayleigh={1.2} mieCoefficient={0.006} />
      {/* Fog leggera e lontana: prima iniziava a 20 unità dalla camera, così
          vicina da "appannare" quasi subito tutta la scena (la "nebbiolina"
          innaturale). Ora resta invisibile fino a 90 unità e sfuma dolcemente
          fino a 380 — solo il muro più lontano si vela un po', il resto
          (strada, distributore, case) resta nitido. */}
      <fog attach="fog" args={['#bfe1f2', 90, 380]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[40, 80, -60]}
        target-position={[GATE_ORIGIN[0], 15, GATE_ORIGIN[2]]}
        intensity={1.5}
        castShadow
        // Il tronco d'ombra deve coprire l'area intorno al portone: il
        // default coprirebbe appena 10 unità e le ombre sparirebbero quasi
        // ovunque. Era rimasto a ±60 da prima di allargare il muro fino a
        // ±202: oltre quel bordo l'ombra si interrompeva di netto, una riga
        // dritta ben visibile per terra. Risoluzione raddoppiata perché
        // un'area più larga con la stessa mappa 1024 dava ombre a blocchi.
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={70}
        shadow-camera-bottom={-10}
        shadow-camera-far={260}
      />

      {/* Poche nuvole basse, sparse sopra la strada e il muro. Ferme
          (speed=0): l'animazione interna di drei procede a scatti, non vale
          la pena inseguirla per un dettaglio di sfondo che si vede pochi
          secondi. `<Clouds texture>` esplicito: senza, ogni `<Cloud>` si
          avvolgerebbe da solo in un `<Clouds>` col CDN esterno di default
          (vedi `CLOUD_TEXTURE` sopra sul perché va evitato). */}
      <Clouds texture={CLOUD_TEXTURE}>
        <Cloud position={[-40, 55, -20]} bounds={[25, 6, 12]} volume={9} opacity={0.55} speed={0} color="#ffffff" />
        <Cloud position={[35, 62, -70]} bounds={[30, 7, 14]} volume={11} opacity={0.5} speed={0} color="#ffffff" />
        <Cloud position={[-15, 58, -140]} bounds={[28, 6, 12]} volume={10} opacity={0.45} speed={0} color="#ffffff" />
      </Clouds>

      <CameraDirector
        phase={phase}
        variant={variant}
        impactY={impactY}
        onIntroComplete={onIntroComplete}
        skipIntroToken={skipIntroToken}
        onWhiteout={onWhiteout}
        onBreakComplete={onBreakComplete}
      />

      <Suspense fallback={null}>
        {/* Ambient/riflessi via cubemap generata sul momento da qualche
            pannello colorato (`Lightformer`), non da un file `.hdr` esterno:
            il preset "sunset" di prima scaricava `venice_sunset_1k.hdr` da
            raw.githubusercontent.com, che sotto rate limit (429) mandava in
            crash l'intero Canvas. Nessun asset da scaricare = nessun punto
            di rottura di rete, e i toni caldi/freddi restano coerenti con
            `<Sky>`/la luce direzionale già in scena. */}
        <Environment resolution={64}>
          <Lightformer form="rect" intensity={2.2} color="#ffb37e" position={[-30, 20, 15]} scale={[24, 12, 1]} />
          <Lightformer form="rect" intensity={1.4} color="#bfe1f2" position={[30, 25, -15]} scale={[28, 16, 1]} />
          <Lightformer form="ring" intensity={2.5} color="#ffd9a0" position={[0, 10, 35]} scale={12} />
        </Environment>
        <WallTitle phase={phase} y={titleY} />
      </Suspense>

      {(phase === 'punching' || phase === 'breaking') && (
        // Resta montato anche durante 'breaking': il personaggio deve
        // finire di entrare nel varco mentre il muro cede, non sparire di
        // scatto nel fotogramma dell'impatto. Nessun fallback: se i modelli
        // non sono ancora pronti si resta sull'inquadratura 'ready' finché
        // non lo sono, non si vede uno scatto a vuoto.
        <Suspense fallback={null}>
          <CharacterIntro variant={introVariant} onImpact={onPunchImpact} onLeapVideo={onLeapVideo} />
        </Suspense>
      )}

      {phase === 'breaking' ? (
        // Fallback = il portone intatto: se per qualsiasi motivo il codice
        // della fisica non fosse ancora pronto, non si vede un buco ma la
        // scena ferma.
        <Suspense fallback={<Wall />}>
          <WallShatter variant={variant} impactY={impactY} />
        </Suspense>
      ) : (
        // L'ambientazione (strada, cartello, case, muro, portone) arriva dal
        // .glb tramite useGLTF: sospende al primo caricamento, quindi serve
        // il proprio Suspense.
        <Suspense fallback={null}>
          <Wall />
        </Suspense>
      )}
    </Canvas>
  );
}
