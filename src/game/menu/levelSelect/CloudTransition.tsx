import { useEffect, useRef, type CSSProperties } from 'react';
import gsap from 'gsap';
import styles from './CloudTransition.module.css';

/** `'forward'`: si avanza nel percorso (`order` crescente, es. Oristano→
 * Silì) — la scia di stelle di base (verso i bordi, accelerando) si abbina
 * a un volo di camera reale in QUALUNQUE direzione (le isole sono disposte
 * a stella secondo la loro posizione reale reciproca, vedi
 * `islandLayout.ts`, non più tutte lungo un solo asse): l'effetto resta un
 * overlay 2D sullo schermo, indipendente dalla direzione 3D effettiva del
 * volo. `'backward'`: si torna indietro (`order` decrescente) — la scia
 * deve sentirsi visibilmente diversa, non solo "la stessa cosa alla
 * rovescia", altrimenti l'utente non percepisce che il verso di marcia è
 * cambiato. */
export type FlightDirection = 'forward' | 'backward';

interface CloudTransitionProps {
  /**
   * Incrementato per avviare la scia di stelle — un contatore, non un
   * booleano, stesso motivo di `skipIntroToken` in `MenuScene.tsx`: ogni
   * cambio di mondo deve poter far ripartire l'animazione anche se il
   * valore "logico" non cambierebbe. `0` è il valore iniziale, prima di
   * qualunque transizione: non deve far scattare nulla al primo render.
   */
  trigger: number;
  /** Verso del volo appena avviato — vedi `FlightDirection` sopra. Letto
   * solo quando `trigger` cambia (dentro l'effetto), non è un valore
   * animato di per sé. */
  direction: FlightDirection;
}

const STAR_STREAK_COUNT = 40;

interface StarStreakVariant {
  /** Posizione di RIPOSO (dove la stella finisce, ferma), in percentuale —
   * sparsa su TUTTO il riquadro (raggio fino a ~75): deve leggersi come
   * "sfrecciano verso ogni parte dello schermo", non verso un anello
   * stretto. */
  restLeft: number;
  restTop: number;
  /** Angolo (gradi) della striscia: punta dal centro verso questa
   * posizione di riposo, così la traslazione lungo l'asse locale (vedi il
   * JSX) si legge come "sfrecciano VIA dal centro" — l'effetto "velocità
   * di curvatura" classico, non un risucchio verso il centro (che è
   * l'impressione opposta che dava la prima versione). */
  angleDeg: number;
  /** Quanto lontano dal centro parte la stella prima di sfrecciare verso
   * la sua posizione di riposo — più le stelle "vicine" (raggio di riposo
   * grande) partono da più lontano, percorrendo più strada nella STESSA
   * durata: è quello che le fa percepire più veloci delle altre, senza
   * dover variare la durata a mano (la stessa prospettiva di un vero campo
   * stellare attraversato in velocità). */
  travelDistance: number;
  /** Lunghezza (px) della scia — le stelle "vicine" (raggio di riposo
   * grande) hanno anche una scia più lunga, coerente con l'idea che stiano
   * passando più vicine alla camera. */
  length: number;
  /** Spessore (px) della scia — piccola variazione per dare profondità,
   * non tutte identiche. */
  width: number;
  /** Ogni tanto una tonalità calda invece del bianco/ghiaccio dominante —
   * un vero campo stellare non è monocromatico, e la varietà aiuta a
   * leggere l'effetto come "stelle" invece che come linee tutte uguali. */
  warm: boolean;
  /** Sfalsamento di partenza, spalmato su una finestra ampia (non solo i
   * primi ~150ms come nella prima versione): con una sequenza a rapporto
   * aureo (non `index % N`, che crea gruppetti visibili invece di una
   * distribuzione uniforme) le stelle continuano a scattare per gran parte
   * del volo della camera (`CameraRig`, 1.1s), non solo in un lampo
   * iniziale. */
  delay: number;
}

/**
 * `left`/`top` sono percentuali del contenitore, ma relative a due misure
 * diverse (larghezza per `left`, altezza per `top`) — su un riquadro più
 * largo che alto (il caso comune, un gioco 3D in orizzontale) lo STESSO
 * numero di raggio applicato a seno e coseno produce un cerchio "vero" solo
 * in percentuale, non in pixel: schiacciato in verticale. `VERTICAL_SPREAD`
 * compensa amplificando solo la componente verticale, tarato su un
 * rapporto orizzontale/verticale tipico da gioco (~16:9–16:10), non
 * calcolato dinamicamente sulla viewport reale.
 */
const VERTICAL_SPREAD = 1.6;

/** Base (px) della distanza percorsa da ogni stella prima di fermarsi nella
 * sua posizione di riposo — sommata a un termine proporzionale al raggio di
 * riposo (vedi sopra), non un valore fisso uguale per tutte. */
const TRAVEL_DISTANCE_BASE = 480;

const STAR_ICE_COLOR = '#eaf1ff';
const STAR_ICE_GLOW = 'rgba(196, 214, 255, 0.75)';
const STAR_WARM_COLOR = '#ffdfa8';
const STAR_WARM_GLOW = 'rgba(255, 205, 140, 0.7)';

/** Rapporto aureo (coniugato): `(index * φ⁻¹) mod 1` è la sequenza a bassa
 * discrepanza standard per spargere N punti su [0,1) senza gli agglomerati
 * visibili che un `index % N` produce — usata qui solo per il ritardo di
 * ogni stella, non per la sua posizione (quella resta seminata su
 * seno/coseno come il resto del file). */
const GOLDEN_RATIO_CONJUGATE = 0.6180339887498949;

/** Valori deterministici (seno/coseno/rapporto aureo, non `Math.random()`):
 * stesso ciclo a ogni transizione, come il resto del progetto (vedi es. il
 * contorno dell'isola in `LevelMapScene.tsx`). */
const STAR_STREAK_VARIANTS: StarStreakVariant[] = Array.from({ length: STAR_STREAK_COUNT }, (_, index) => {
  const angle = (index / STAR_STREAK_COUNT) * Math.PI * 2 + 0.5;
  const radius = 40 + 35 * Math.sin(index * 2.3 + 1.1); // ~5–75: sparse su tutto il riquadro
  const restLeft = 50 + Math.cos(angle) * radius;
  const restTop = 50 + Math.sin(angle) * radius * VERTICAL_SPREAD;
  // Il CSS `.starStreak` punta "in su" (verso -Y) di default; l'angolo qui
  // sotto è quello di rotazione (in gradi, verso orario, coerente con
  // `transform: rotate()`) che porta quella direzione a puntare dal centro
  // (50, 50) verso QUESTA posizione di riposo — derivato invertendo la
  // matrice di rotazione standard per il vettore (0, -1). La stella viaggia
  // poi lungo questo stesso asse, dal centro verso l'esterno (vedi
  // `travelDistance`).
  const dx = restLeft - 50;
  const dy = restTop - 50;
  const angleDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const delay = ((index * GOLDEN_RATIO_CONJUGATE) % 1) * 0.55;
  return {
    restLeft,
    restTop,
    angleDeg,
    travelDistance: TRAVEL_DISTANCE_BASE + radius * 6,
    length: 70 + radius * 0.9,
    width: 2.4 + ((index * 7) % 5) * 0.35,
    warm: index % 6 === 0,
    delay
  };
});

const STAR_TRAVEL_DURATION = 0.5;
/** Il rientro (`backward`) resta più breve e brusco dell'andata (che dura
 * `STAR_TRAVEL_DURATION` + fino a 0.55s di ritardo sparso, quindi
 * complessivamente più di 1s) ma non troppo: un primo tentativo a 0.32s si
 * è rivelato quasi impercettibile a schermo — le stelle sono già ferme e
 * ci vuole comunque un momento perché l'occhio registri "si stanno
 * ritirando" prima di sfumare. */
const STAR_RETREAT_DURATION = 0.5;
/** Frazione di `STAR_STREAK_VARIANTS[i].delay` usata per il ritardo di
 * ogni stella nel rientro — non l'intero valore (che darebbe una finestra
 * larga quanto l'andata, contraddicendo "strappo secco"), ma abbastanza da
 * non far scattare tutte insieme nello stesso istante. */
const RETREAT_DELAY_FACTOR = 0.65;

/**
 * Spinta visiva che accompagna il cambio di mondo: un campo di stelle in
 * stile "velocità di curvatura" — nascono vicino al centro e sfrecciano
 * VERSO i bordi (accelerando, non convergendo verso il centro: la prima
 * versione lo faceva al contrario e si leggeva come un risucchio/vortice
 * invece che come "stiamo volando in avanti", oltre ad avere scie sottili e
 * uniformi che sembravano graffi sullo schermo invece che stelle — testa
 * luminosa con bagliore + coda sfumata qui sotto risolvono anche quello).
 * La durata del "lancio" di ogni stella è la stessa per tutte
 * (`STAR_TRAVEL_DURATION`), ma la distanza percorsa varia (`travelDistance`,
 * proporzionale a quanto la stella finisce lontana dal centro): a parità di
 * tempo, chi percorre più strada sembra più veloce — la stessa prospettiva
 * di un vero campo stellare attraversato in velocità, senza dover truccare
 * le durate a mano. I ritardi di partenza (`delay`, spalmati su ~0.55s con
 * una sequenza a rapporto aureo) fanno sì che le stelle continuino a
 * scattare per gran parte del volo della camera (`CameraRig` in
 * `LevelMapScene.tsx`, 1.1s), non solo in un lampo nei primi fotogrammi.
 *
 * Prima di questa fase esisteva anche un velo di nuvole che copriva per
 * intero lo schermo durante il cambio città — con le isole ora tutte
 * permanentemente montate e sparse nello spazio (Fase 2 del piano isole
 * multiple), quel velo nasconderebbe esattamente il volo che si vuole
 * rendere visibile: rimosso. Il cambio di città stesso è ormai immediato
 * (vedi `LevelSelectScene.changeDisplayedCity`): questo componente non
 * blocca né segnala più nulla, `trigger`/`direction` sono l'unico contratto
 * rimasto.
 *
 * L'effetto è un overlay 2D (schermo intero, sopra il Canvas 3D) che non
 * legge affatto la direzione 3D reale del volo — funziona a prescindere da
 * come sono disposte le isole nello spazio (oggi a stella secondo la loro
 * posizione reale reciproca, vedi `islandLayout.ts`; prima di quello, in
 * fila lungo un solo asse): quello che conta per la resa è solo che UN
 * ALTRO elemento della scena (un'isola di passaggio, lo sfondo stellato)
 * scorra visibilmente sotto mentre la camera vola, cosa che succede in
 * ogni caso quando la camera si sposta in 3D. Quando si torna indietro nel
 * percorso (`direction === 'backward'`), l'effetto va rovesciato di
 * proposito — non solo `reverse()` della stessa timeline, che sembrerebbe
 * "la stessa cosa alla rovescia" più che "il verso di marcia è cambiato":
 * vedi il ramo `else` sotto.
 */
export function CloudTransition({ trigger, direction }: CloudTransitionProps) {
  const starRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (trigger === 0) return;

    const stars = starRefs.current.filter((el): el is HTMLDivElement => el !== null);
    const timeline = gsap.timeline();

    if (direction === 'forward') {
      timeline
        .set(stars, {
          opacity: 0,
          scaleY: 0.7,
          y: (index) => -STAR_STREAK_VARIANTS[index].travelDistance
        })
        .to(stars, {
          y: 0,
          scaleY: 1,
          opacity: 1,
          duration: STAR_TRAVEL_DURATION,
          delay: (index) => STAR_STREAK_VARIANTS[index].delay,
          ease: 'power2.in'
        })
        // Spegnimento unico per tutte, non per singola stella: le durate di
        // "lancio" combinate (ritardo + `STAR_TRAVEL_DURATION`) coprono già
        // ~0.5–1.05s, un secondo fade-out per stella complicherebbe il
        // timeline senza un beneficio visibile — questo spegnimento
        // sincronizzato verso la fine del volo basta a non lasciare le
        // stelle "appese" a schermo dopo l'arrivo.
        .to(
          stars,
          {
            opacity: 0,
            duration: 0.3,
            ease: 'power1.out'
          },
          0.55 + STAR_TRAVEL_DURATION - 0.15
        );
    } else {
      // Rientro: NON il semplice contrario nel tempo dell'andata (partenza
      // da riposo invece che da vicino al centro, corsa breve e SEMPRE
      // verso il centro invece che verso i bordi, easing 'power2.in' anche
      // qui ma stavolta per accelerare VERSO il centro) — deve sembrare un
      // gesto diverso, non la stessa clip riavvolta, altrimenti l'utente
      // non percepirebbe il cambio di verso (motivo esplicito di questa
      // variante). Le stelle sono già "lì" (opacity 1 fin da subito, niente
      // arrivo dal buio) e vengono risucchiate via — uno strappo secco.
      timeline
        .set(stars, { opacity: 1, scaleY: 1, y: 0 })
        .to(stars, {
          y: (index) => -STAR_STREAK_VARIANTS[index].travelDistance * 0.5,
          scaleY: 0.55,
          opacity: 0,
          duration: STAR_RETREAT_DURATION,
          delay: (index) => STAR_STREAK_VARIANTS[index].delay * RETREAT_DELAY_FACTOR,
          ease: 'power2.in'
        });
    }

    return () => {
      timeline.kill();
    };
  }, [trigger, direction]);

  return (
    <div className={styles.container}>
      <div className={styles.starField}>
        {STAR_STREAK_VARIANTS.map((variant, index) => (
          <div
            key={index}
            className={styles.starStreakWrap}
            style={{ left: `${variant.restLeft}%`, top: `${variant.restTop}%`, transform: `rotate(${variant.angleDeg}deg)` }}
          >
            <div
              ref={(el) => {
                starRefs.current[index] = el;
              }}
              className={styles.starStreak}
              style={
                {
                  '--star-length': `${variant.length}px`,
                  '--star-width': `${variant.width}px`,
                  '--star-color': variant.warm ? STAR_WARM_COLOR : STAR_ICE_COLOR,
                  '--star-glow': variant.warm ? STAR_WARM_GLOW : STAR_ICE_GLOW
                } as CSSProperties
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
