import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { Box3, Group, Vector3 } from 'three';
import { useSfx } from '@/hooks/useSfx';
import { GATE_FRONT_Z } from '../wall/wallConfig';
import { useBaseCharacter, useJabCharacter } from './characterModel';
import { SAITAMA_TIMING, type IntroVariant } from './characterConfig';

// Il "lag smoothing" di GSAP (attivo di default) ammortizza gli scatti
// quando un fotogramma tarda oltre 500ms: se ne fa carico rallentando la
// timeline invece di saltare avanti. Per una cinematica one-shot come questa
// è la scelta sbagliata — durante il caricamento dei due modelli o su
// hardware lento, la sequenza finirebbe al rallentatore invece di recuperare
// il tempo perso. `0` disattiva l'ammortizzamento: la timeline insegue
// sempre il tempo reale.
gsap.ticker.lagSmoothing(0);

/**
 * Dove sta il personaggio prima di scattare: vicino a dove la camera si
 * ferma a fine intro (SHOTS.introEnd in MainMenuSceneAnimation.tsx, z≈-3),
 * un poco più avanti verso il cartello (z≈-10) — ben visibile
 * nell'inquadratura "ready" esistente, sul lato della strada.
 */
const STAND_POSITION = { x: 2.2, y: 0, z: -6 };

/**
 * Camera del piede: bassa e MOLTO vicina — a ~1.2 unità dal soggetto, non le
 * ~2.1 di prima, altrimenti su un personaggio alto ~1.7 non si legge come
 * primo piano ma come inquadratura media qualunque.
 */
const FOOT_SHOT = { x: STAND_POSITION.x + 0.75, y: 0.22, z: STAND_POSITION.z + 0.85 };
const FOOT_LOOK = { x: STAND_POSITION.x, y: 0.12, z: STAND_POSITION.z };

/**
 * Camera del volto: altezza occhi (Z testa validata in Blender ≈1.5-1.6),
 * a ~1.7 unità di distanza — intima, non un mezzo busto.
 */
const FACE_SHOT = { x: STAND_POSITION.x + 1.0, y: 1.58, z: STAND_POSITION.z + 1.35 };
const FACE_LOOK = { x: STAND_POSITION.x, y: 1.53, z: STAND_POSITION.z };

/**
 * Inquadratura di richiamo al taglio dal video all'impatto: se il video
 * (vedi `onLeapVideo`) manca ancora, la scena 3D deve comunque avere
 * un'inquadratura sensata pronta davanti al muro, non restare bloccata
 * sull'ultimo fotogramma dell'anticipazione.
 */
const IMPACT_REVEAL_SHOT = { x: 0, y: 3.5, z: -95 };
const IMPACT_REVEAL_LOOK = { x: 0, y: 3, z: GATE_FRONT_Z };

/**
 * Dove il personaggio ricompare quando il video finisce, davanti al muro —
 * stesso punto usato prima da `Personaggio_Salto`/dallo scatto cinematico —
 * e da dove riparte per entrare nel varco dopo l'impatto.
 */
const IMPACT_POSITION = { x: 0, y: 0, z: GATE_FRONT_Z + 2 };
const ENTER_GAP_Z = GATE_FRONT_Z - 6;

/**
 * Rotazione massima durante la battuta, in radianti (~14°) — su tutto il
 * gruppo Base (niente scheletro: vedi commento più sotto sull'export).
 */
const HEAD_TURN_MAX = 0.24;

/**
 * Rotazione (attorno a Y) per girare il personaggio dalla posa "in scena,
 * rivolto verso la camera dell'intro/battuta" a "rivolto verso il muro". Se
 * in futuro si cambia il modello e il fronte di default non è più +Z,
 * questo è il primo numero da ricontrollare.
 */
const TURN_TO_WALL = Math.PI;

/**
 * Altezza bersaglio del personaggio in piedi, in unità mondo.
 *
 * `Personaggio_Base`/`Jab` hanno un genitore con scale=100 nel file Blender:
 * in Blender sembra ininfluente perché l'armatura in bind pose deforma la
 * mesh "sopra" quel genitore e il viewport mostra il risultato già corretto
 * — ma l'export .glb non porta con sé quella correzione, e Three.js renderizza
 * la trasformazione grezza: un personaggio largo/alto ~100-150 unità, fuori
 * schermo o comunque non dove ci si aspetta. Non essendoci un fattore di
 * scala pulito e costante da hardcodare (dipende da come l'armatura deforma
 * quello specifico export), la correzione si misura e si applica a runtime
 * — vedi l'effetto sotto.
 */
const CHARACTER_TARGET_HEIGHT = 1.72;

interface CharacterIntroProps {
  variant: IntroVariant;
  /** Chiamato nel fotogramma esatto in cui il pugno tocca il muro. */
  onImpact: () => void;
  /**
   * Chiamato per mostrare/nascondere il video del salto (se il file esiste:
   * vedi `characterConfig.ts`/`LEAP_VIDEO_URL`). Il componente 3D non
   * disegna il `<video>` — è un elemento HTML, non renderizzabile dentro
   * `<Canvas>` — chi possiede l'overlay (`MenuScene`) lo mostra/nasconde in
   * risposta a questa callback, stesso pattern già usato per il whiteout.
   */
  onLeapVideo: (active: boolean) => void;
}

/**
 * La sequenza cinematica del personaggio: piede → volto → battuta → cambio
 * espressione → si gira verso il muro → video del salto → impatto.
 *
 * Un solo oggetto possiede la camera qui dentro (questo componente), esattamente
 * come `CameraDirector` la possiede nelle altre fasi — si escludono a vicenda
 * per fase, non si scrivono mai addosso: `ownsCamera` smette di scrivere sulla
 * camera nel fotogramma dell'impatto, così `CameraDirector` può prendere il
 * controllo pulito per il finale (attraversamento del varco, whiteout) senza
 * che i due si contendano `camera.position` nello stesso fotogramma. Il
 * cambio Base/Jab è un nascondi/mostra su due gruppi sempre montati, non uno
 * smontaggio React: evita che due GLTF diversi si ricarichino a metà sequenza.
 *
 * Nessun ciclo di corsa, nemmeno finto: con solo due pose statiche (niente
 * scheletro/mixer, vedi sotto) tradurre il personaggio verso il muro si
 * legge sempre come un pattinare sul ghiaccio, qualunque trucco di camera
 * ci si metta sopra. Il "come" il personaggio arrivi al muro lo racconta il
 * video del salto (`onLeapVideo`), non la scena 3D: dall'anticipazione si
 * taglia dritti al video, e dal video dritti all'impatto.
 */
export function CharacterIntro({ variant: _variant, onImpact, onLeapVideo }: CharacterIntroProps) {
  const { camera } = useThree();
  const playSfx = useSfx();

  const base = useBaseCharacter();
  const jab = useJabCharacter();

  // Clonati come `Wall`/`WallShatter`: lo stesso GLTF potrebbe tornare a
  // essere richiesto (rimontaggio della fase) e un Object3D non si riparenta
  // due volte senza clonarlo.
  const baseScene = useMemo(() => base.scene.clone(true), [base.scene]);
  const jabScene = useMemo(() => jab.scene.clone(true), [jab.scene]);

  const baseGroupRef = useRef<Group>(null);
  const jabGroupRef = useRef<Group>(null);
  // Gruppo interno che assorbe la correzione di scala/posizione di
  // Base/Jab (vedi commento su `CHARACTER_TARGET_HEIGHT`) — separato dal
  // gruppo esterno, che resta libero di occuparsi solo del posizionamento
  // in scena e della rotazione, senza mescolare le due responsabilità.
  const baseFixRef = useRef<Group>(null);
  const jabFixRef = useRef<Group>(null);

  // Base/Jab arrivano dall'export con un genitore a scala 100x che Blender
  // compensa in viewport (l'armatura deforma "sopra" quella scala) ma che
  // l'export .glb non porta con sé: si misura la vera dimensione a runtime e
  // si corregge una volta sola, invece di indovinare un fattore fisso.
  useEffect(() => {
    for (const ref of [baseFixRef, jabFixRef]) {
      const group = ref.current;
      if (!group) continue;
      const box = new Box3().setFromObject(group);
      const size = new Vector3();
      box.getSize(size);
      if (size.y < 10) continue; // già in scala ragionevole, non toccare

      const scale = CHARACTER_TARGET_HEIGHT / size.y;
      group.scale.setScalar(scale);

      const scaledBox = new Box3().setFromObject(group);
      const center = new Vector3();
      scaledBox.getCenter(center);
      // Ricentra su X/Z, porta i piedi (min Y) a terra: il gruppo esterno
      // può quindi trattare questo come un personaggio "normale" alto
      // CHARACTER_TARGET_HEIGHT, piedi a y=0, centrato sull'asse verticale.
      group.position.x -= center.x;
      group.position.z -= center.z;
      group.position.y -= scaledBox.min.y;
    }
  }, [baseScene, jabScene]);

  // GSAP scrive su questi oggetti semplici, mai su camera.position/rotation
  // direttamente — stesso motivo di `CameraDirector`: `useFrame` ricostruisce
  // il risultato finale ogni volta, la sorgente resta pulita e componibile.
  const camPos = useRef({ ...FOOT_SHOT }).current;
  const camLook = useRef({ ...FOOT_LOOK }).current;
  // Smette di scrivere sulla camera dal fotogramma dell'impatto in poi:
  // da lì la possiede `CameraDirector` (fase `breaking`).
  const ownsCamera = useRef(true);

  // Base/Jab sono mesh statiche "cotte" (senza scheletro: vedi il commento
  // sull'export più sopra), quindi niente più rotazione del solo osso del
  // collo — la "battuta" gira leggermente TUTTO il personaggio.
  const headTurn = useRef({ value: 0 }).current;
  // Rotazione verso il muro (vedi `TURN_TO_WALL`): separata da `headTurn`,
  // che è solo il piccolo cenno della battuta e si esaurisce prima che
  // questa entri in gioco — sommate in `useFrame`, mai in conflitto perché
  // non sono mai entrambe diverse da zero nello stesso momento.
  const charYaw = useRef({ value: 0 }).current;
  // Posizione condivisa da entrambi i gruppi: nessuno dei due è visibile
  // mentre cambia (il personaggio è nascosto durante il video), quindi qui
  // basta un `.set()` istantaneo quando riappare, non un tween.
  const charPos = useRef({ ...STAND_POSITION }).current;
  // Inclinazione dell'anticipazione (caricamento del colpo prima del taglio
  // al video): niente scheletro, quindi la "posa" la simula tutto il
  // gruppo insieme.
  const charTilt = useRef({ x: 0 }).current;

  useEffect(() => {
    // Stato iniziale a ogni montaggio: solo Base visibile, in piedi.
    if (baseGroupRef.current) {
      baseGroupRef.current.visible = true;
      baseGroupRef.current.rotation.y = 0;
    }
    if (jabGroupRef.current) jabGroupRef.current.visible = false;
    Object.assign(camPos, FOOT_SHOT);
    Object.assign(camLook, FOOT_LOOK);
    ownsCamera.current = true;
    headTurn.value = 0;
    charYaw.value = 0;
    Object.assign(charPos, STAND_POSITION);
    charTilt.x = 0;
    onLeapVideo(false);

    const setActiveModel = (which: 'base' | 'jab' | 'none') => {
      if (baseGroupRef.current) baseGroupRef.current.visible = which === 'base';
      if (jabGroupRef.current) jabGroupRef.current.visible = which === 'jab';
    };

    const t = SAITAMA_TIMING;
    // `advance(d)` sposta il cursore avanti di `d` e restituisce il nuovo
    // valore, cioè l'istante in cui QUESTO segmento finisce — non quello in
    // cui inizia. Prima restituiva l'inizio: il segmento "piede" durava
    // zero secondi e ogni fase dopo scivolava all'indietro.
    let cursor = 0;
    const advance = (duration: number) => {
      cursor += duration;
      return cursor;
    };

    const timeline = gsap.timeline();

    // 1) Piede in primo piano: resta fermo per `footHold` secondi.
    const footEnd = advance(t.footHold);

    // 2) Rivelazione volto.
    const faceStart = footEnd;
    const faceEnd = advance(t.faceReveal);
    timeline
      .to(camPos, { ...FACE_SHOT, duration: t.faceReveal, ease: 'power2.out' }, faceStart)
      .to(camLook, { ...FACE_LOOK, duration: t.faceReveal, ease: 'power2.out' }, faceStart);

    // 3) Recitazione: la testa gira, poi torna — il "beat" della battuta.
    const turnStart = faceEnd;
    const turnEnd = advance(t.headTurn);
    timeline
      .to(headTurn, { value: 1, duration: t.headTurn * 0.55, ease: 'power1.inOut' }, turnStart)
      .to(
        headTurn,
        { value: 0, duration: t.headTurn * 0.45, ease: 'power1.in' },
        turnStart + t.headTurn * 0.55
      )
      .call(() => playSfx('impact', { volume: 0.4 }), undefined, turnStart);

    // 4) Cambio espressione: Base (scema) -> Jab (seria), taglio secco.
    const swapAt = turnEnd;
    const swapEnd = advance(t.expressionSwap);
    timeline.call(() => setActiveModel('jab'), undefined, swapAt);

    // 5) Anticipazione + si gira verso il muro: breve caricamento del colpo
    // (principio classico dell'animazione: l'anticipo prima dell'azione) e,
    // nello stesso respiro, il mezzo giro che porta il personaggio a
    // guardare il muro invece della camera.
    const windUpStart = swapEnd;
    const windUpEnd = advance(t.windUp);
    timeline
      .to(charTilt, { x: -0.16, duration: t.windUp, ease: 'power1.in' }, windUpStart)
      .to(charTilt, { x: 0.05, duration: 0.12, ease: 'back.out(2)' }, windUpEnd)
      .to(charYaw, { value: TURN_TO_WALL, duration: t.windUp * 0.7, ease: 'power2.inOut' }, windUpStart);

    // 6) Salto: taglio diretto al video (se il file esiste — vedi
    // `LEAP_VIDEO_URL`), niente scatto/corsa in 3D di mezzo. Il personaggio
    // sparisce qui e ricompare già davanti al muro, in posa Jab, pronto per
    // l'impatto: se il video manca ancora, la scena 3D resta comunque su
    // un'inquadratura sensata (`IMPACT_REVEAL_SHOT`) invece che bloccata
    // sull'anticipazione.
    const leapStart = windUpEnd;
    const leapEnd = advance(t.leapVideo);
    timeline.call(
      () => {
        Object.assign(camPos, IMPACT_REVEAL_SHOT);
        Object.assign(camLook, IMPACT_REVEAL_LOOK);
        Object.assign(charPos, IMPACT_POSITION);
        setActiveModel('none');
        onLeapVideo(true);
      },
      undefined,
      leapStart
    );
    timeline.call(
      () => {
        onLeapVideo(false);
        setActiveModel('jab');
      },
      undefined,
      leapEnd
    );

    // 7) Impatto: il pugno tocca il muro, subito alla fine del video — da
    // qui in poi comanda `breaking` (fisica dei detriti, camera di
    // pull-back e finale: vedi `CameraDirector`). `ownsCamera` passa a
    // `false` nello stesso istante: da qui la camera ha un padrone solo, ed
    // è l'altro.
    const impactAt = leapEnd;
    const impactEnd = advance(t.impact);
    timeline.call(
      () => {
        ownsCamera.current = false;
        onImpact();
      },
      undefined,
      impactAt
    );

    // 8) Ingresso nel varco: il personaggio prosegue oltre il punto
    // d'impatto, dentro l'apertura appena fatta — sparisce dietro ai
    // frammenti del muro, non serve altro trucco di occlusione. La camera
    // qui non è più nostra (vedi sopra): questo segmento muove solo
    // `charPos`, non `camPos`.
    const enterGapStart = impactEnd;
    advance(t.enterGap);
    timeline.to(charPos, { z: ENTER_GAP_Z, duration: t.enterGap, ease: 'power1.in' }, enterGapStart);

    return () => {
      timeline.kill();
      onLeapVideo(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- camPos/camLook/headTurn/charPos/ecc. sono ref stabili, non vanno in dipendenza
  }, [onImpact, onLeapVideo, playSfx]);

  useFrame(() => {
    if (ownsCamera.current) {
      camera.position.set(camPos.x, camPos.y, camPos.z);
      camera.lookAt(camLook.x, camLook.y, camLook.z);
    }

    const yaw = headTurn.value * HEAD_TURN_MAX + charYaw.value;
    if (baseGroupRef.current) {
      baseGroupRef.current.position.set(charPos.x, charPos.y, charPos.z);
      baseGroupRef.current.rotation.y = yaw;
      baseGroupRef.current.rotation.x = charTilt.x;
    }
    if (jabGroupRef.current) {
      jabGroupRef.current.position.set(charPos.x, charPos.y, charPos.z);
      jabGroupRef.current.rotation.y = charYaw.value;
      jabGroupRef.current.rotation.x = charTilt.x;
    }
  });

  return (
    <>
      <group ref={baseGroupRef}>
        <group ref={baseFixRef}>
          <primitive object={baseScene} />
        </group>
      </group>
      <group ref={jabGroupRef} visible={false}>
        <group ref={jabFixRef}>
          <primitive object={jabScene} />
        </group>
      </group>
    </>
  );
}
