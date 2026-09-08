import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import styles from './CloudTransition.module.css';

interface CloudTransitionProps {
  /**
   * Incrementato per avviare una transizione — un contatore, non un
   * booleano, stesso motivo di `skipIntroToken` in `MenuScene.tsx`: ogni
   * pressione/selezione deve poter far ripartire l'animazione anche se il
   * valore "logico" non cambierebbe. `0` è il valore iniziale, prima di
   * qualunque transizione: non deve far scattare nulla al primo render.
   */
  trigger: number;
  /** Chiamato a schermo completamente coperto: il momento giusto per
   * cambiare cosa c'è sotto (qui: la città mostrata da `LevelMap`). */
  onCovered: () => void;
  /** Chiamato a fine ciclo, nuvole di nuovo fuori schermo: il momento giusto
   * per far partire un'eventuale transizione accodata da `LevelSelectScene`
   * (vedi lì il guard sui trigger ravvicinati). */
  onCleared: () => void;
}

const COVER_DURATION = 0.6;
const HOLD_DURATION = 0.2;
const CLEAR_DURATION = 0.6;

/** Il velo (sotto, garanzia di copertura totale) entra in scena DOPO le
 * nuvole, non insieme a loro: le nuvole devono leggersi come protagoniste
 * del movimento — se il velo iniziasse a comparire nello stesso istante in
 * cui le nuvole partono verso il centro, l'effetto sarebbe "lo schermo
 * sbianca" più che "le nuvole coprono lo schermo". */
const VEIL_DELAY = 0.22;
const VEIL_IN_DURATION = 0.5;

const CLOUD_COUNT = 30;

interface CloudVariant {
  /** Posizione di riposo (schermo coperto), in percentuale del contenitore:
   * le nuvole non collassano su un punto solo — un raggio comunque > 0,
   * diverso per nuvola, è quello che dà "alcune vanno più in là da una
   * parte piuttosto che dall'altra" — ma restano abbastanza vicine al
   * centro, e abbastanza grandi, da garantire copertura piena con ampio
   * margine di sovrapposizione. */
  restLeft: number;
  restTop: number;
  /** Posizione di partenza/uscita (fuori schermo), sulla STESSA direzione
   * radiale di quella di riposo: ogni nuvola arriva e riparte lungo la
   * propria retta verso/dal centro, non semplicemente da sinistra/destra. */
  startLeft: number;
  startTop: number;
  widthVw: number;
  heightVw: number;
  /** Una nuvola più grande (più "vicina") si muove anche un po' più in
   * fretta delle altre: accenno di profondità invece di copie identiche in
   * sincrono. */
  speed: number;
}

/**
 * Disposte tutt'intorno al centro (angolo distribuito sull'intero cerchio,
 * non solo da sinistra/destra) invece che in bande orizzontali fisse — le
 * nuvole arrivano da ogni direzione e CONVERGONO verso il centro, non
 * scorrono in blocco. Valori fissi via seno/coseno (non `Math.random()`):
 * stesso ciclo a ogni transizione, come il resto del progetto (vedi es. il
 * contorno dell'isola in `LevelMapScene.tsx`).
 *
 * `left`/`top` sono percentuali del contenitore, ma relative a due misure
 * diverse (larghezza per `left`, altezza per `top`) — su un riquadro più
 * largo che alto (il caso comune, un gioco 3D in orizzontale) lo STESSO
 * numero di raggio applicato a seno e coseno produce un cerchio "vero" solo
 * in percentuale, non in pixel: schiacciato in verticale, lascia scoperti i
 * bordi sopra/sotto (visto a schermo: il titolo restava leggibile sopra le
 * nuvole anche a copertura "completa"). `VERTICAL_SPREAD` compensa
 * amplificando solo la componente verticale, tarato su un rapporto
 * orizzontale/verticale tipico da gioco (~16:9–16:10), non calcolato
 * dinamicamente sulla viewport reale.
 */
const VERTICAL_SPREAD = 1.6;

const CLOUD_VARIANTS: CloudVariant[] = Array.from({ length: CLOUD_COUNT }, (_, index) => {
  const angle = (index / CLOUD_COUNT) * Math.PI * 2;
  const startRadius = 100 + 35 * Math.sin(index * 1.7 + 0.4); // ~65–135: ben fuori dal riquadro
  const restRadius = 14 + 10 * Math.sin(index * 1.3 + 2); // ~4–24: vicine al centro, non sovrapposte a un punto
  const sizeScale = 0.7 + 0.35 * (0.5 + 0.5 * Math.sin(index * 0.9 + 1)); // ~0.7–1.05

  return {
    restLeft: 50 + Math.cos(angle) * restRadius,
    restTop: 50 + Math.sin(angle) * restRadius * VERTICAL_SPREAD,
    startLeft: 50 + Math.cos(angle) * startRadius,
    startTop: 50 + Math.sin(angle) * startRadius * VERTICAL_SPREAD,
    widthVw: 60 * sizeScale,
    heightVw: 40 * sizeScale,
    speed: 0.8 + (sizeScale - 0.7) * 0.6
  };
});

const STAR_STREAK_COUNT = 40;

interface StarStreakVariant {
  /** Posizione di partenza, in percentuale — sparsa su TUTTO il riquadro
   * (raggio fino a ~75), non solo vicino al centro come il riposo delle
   * nuvole: deve leggersi come "arrivano da ogni parte dello schermo",
   * non da un anello stretto. */
  startLeft: number;
  startTop: number;
  /** Angolo (gradi) della striscia: punta dal proprio punto di partenza
   * verso il centro, così l'animazione (una traslazione lungo il proprio
   * asse locale, vedi il JSX) si legge davvero come "vola verso il
   * centro" invece che come una barra qualunque che si allunga. */
  angleDeg: number;
  /** Leggero sfalsamento di partenza — non tutte scattano nello stesso
   * istante, stesso principio dello `stagger` delle nuvole ma calcolato a
   * mano (qui non serve lo stagger di GSAP: la partenza è comune a tutte,
   * ANCHE se le nuvole partono insieme, un ritardo diverso per stella dà
   * comunque l'impressione di un campo che arriva "a raffica" invece che
   * in blocco). */
  delay: number;
}

/** Sfalsate di fase (`+0.5`) rispetto a `CLOUD_VARIANTS`: se condividessero
 * lo stesso angolo, ogni stella nascerebbe esattamente sotto una nuvola,
 * invece di leggersi come un campo indipendente. Stesso principio
 * deterministico (seno/coseno, non `Math.random()`) del resto del
 * progetto. */
const STAR_STREAK_VARIANTS: StarStreakVariant[] = Array.from({ length: STAR_STREAK_COUNT }, (_, index) => {
  const angle = (index / STAR_STREAK_COUNT) * Math.PI * 2 + 0.5;
  const radius = 40 + 35 * Math.sin(index * 2.3 + 1.1); // ~5–75: sparse su tutto il riquadro
  const startLeft = 50 + Math.cos(angle) * radius;
  const startTop = 50 + Math.sin(angle) * radius * VERTICAL_SPREAD;
  // Il CSS `.starStreak` punta "in su" (verso -Y) di default; l'angolo qui
  // sotto è quello di rotazione (in gradi, verso orario, coerente con
  // `transform: rotate()`) che porta quella direzione a puntare dal punto
  // di partenza verso il centro (50, 50) — derivato invertendo la matrice
  // di rotazione standard per il vettore (0, -1).
  const dx = 50 - startLeft;
  const dy = 50 - startTop;
  const angleDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return { startLeft, startTop, angleDeg, delay: (index % 10) * 0.015 };
});

const STAR_STREAK_DURATION = 0.34;

/**
 * Transizione tra una città e l'altra: nuvole che coprono tutto lo schermo,
 * si aprono sulla città nuova. Riusa la stessa idea del whiteout di fine
 * menu (overlay pilotato da GSAP, sempre montato) ma con nuvole al posto di
 * un colore pieno — qui non deve sopravvivere a un cambio di `screen`
 * (siamo sempre dentro `LevelSelectScene`), quindi può restare locale
 * invece di salire fino ad `App.tsx`.
 */
export function CloudTransition({ trigger, onCovered, onCleared }: CloudTransitionProps) {
  const cloudRefs = useRef<(HTMLDivElement | null)[]>([]);
  const veilRef = useRef<HTMLDivElement | null>(null);
  const starRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (trigger === 0) return;

    const clouds = cloudRefs.current.filter((el): el is HTMLDivElement => el !== null);
    const veil = veilRef.current;
    const stars = starRefs.current.filter((el): el is HTMLDivElement => el !== null);
    const timeline = gsap.timeline();
    timeline
      .set(clouds, {
        left: (index) => `${CLOUD_VARIANTS[index].startLeft}%`,
        top: (index) => `${CLOUD_VARIANTS[index].startTop}%`,
        opacity: 1
      })
      .set(veil, { opacity: 0 })
      .set(stars, { scaleY: 0.3, y: 0, opacity: 0 })
      // Etichetta esplicita invece di affidarsi al chaining implicito: le
      // stelle sono un layer AGGIUNTIVO inserito tra i `.set()` iniziali e
      // il movimento delle nuvole già esistente — senza un punto di
      // riferimento assoluto, il movimento delle nuvole (sotto) finirebbe
      // per partire in coda alle stelle invece che insieme a loro,
      // allungando la copertura totale (che il piano vieta esplicitamente
      // di cambiare).
      .addLabel('coverStart')
      // Le stelle sfrecciano verso il centro DIETRO le nuvole (nel DOM
      // prima di loro) e finiscono ben prima di `onCovered()` — nascono
      // insieme alle nuvole (stessa etichetta `coverStart`) ma durano meno
      // (`STAR_STREAK_DURATION` < tempo che intercorre fino a
      // `onCovered`), quindi sono già sparite quando la città cambia
      // sotto il velo.
      .to(
        stars,
        {
          scaleY: 1,
          y: (index) => -90 * (0.6 + STAR_STREAK_VARIANTS[index].delay * 4),
          opacity: 1,
          duration: STAR_STREAK_DURATION,
          ease: 'power1.in',
          stagger: { each: 0.01, from: 'random' }
        },
        'coverStart'
      )
      .to(
        stars,
        {
          opacity: 0,
          duration: STAR_STREAK_DURATION * 0.5,
          ease: 'power1.out'
        },
        `>-${STAR_STREAK_DURATION * 0.3}`
      )
      .to(
        clouds,
        {
          left: (index) => `${CLOUD_VARIANTS[index].restLeft}%`,
          top: (index) => `${CLOUD_VARIANTS[index].restTop}%`,
          duration: (index) => COVER_DURATION / CLOUD_VARIANTS[index].speed,
          ease: 'power2.in',
          stagger: { each: 0.014, from: 'random' }
        },
        'coverStart'
      )
      // Le sagome dei `.puff` coprono lo schermo "in media", ma con solo
      // `CLOUD_COUNT` direzioni discrete (12° tra una nuvola e l'altra a 30)
      // e forma/raggio di ognuna indipendenti dal suo angolo, una direzione
      // sfortunata può sempre restare più sottile delle altre (visto a
      // schermo: un filo di sfondo/titolo che filtrava a bordo schermo anche
      // a "copertura completa"). Questo velo — un rettangolo pieno,
      // `inset: 0`, quindi copertura totale per costruzione qualunque sia
      // l'aspect ratio — lo garantisce: dietro le nuvole (nel DOM prima di
      // loro), sfuma DOPO che sono già partite (`VEIL_DELAY`), non insieme a
      // loro — vedi il commento su `VEIL_DELAY`.
      .to(veil, { opacity: 1, duration: VEIL_IN_DURATION, ease: 'power1.inOut' }, `<+=${VEIL_DELAY}`)
      .call(() => onCovered())
      .to({}, { duration: HOLD_DURATION })
      .to(clouds, {
        left: (index) => `${CLOUD_VARIANTS[index].startLeft}%`,
        top: (index) => `${CLOUD_VARIANTS[index].startTop}%`,
        duration: (index) => CLEAR_DURATION / CLOUD_VARIANTS[index].speed,
        ease: 'power2.out',
        stagger: { each: 0.014, from: 'random' }
      })
      .to(veil, { opacity: 0, duration: CLEAR_DURATION, ease: 'power1.inOut' }, '<')
      // Stato finale esplicito: non affidarsi solo al fatto che le nuvole
      // siano fuori dal riquadro (`overflow: hidden`) per restare invisibili
      // se in futuro cambiano dimensioni massime o quella regola CSS.
      .set(clouds, { opacity: 0 })
      .set(veil, { opacity: 0 })
      .call(() => onCleared());

    return () => {
      timeline.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCovered/onCleared non vanno in dipendenza: il chiamante li ricrea spesso, la ref sui blob basta a restare aggiornati
  }, [trigger]);

  return (
    <div className={styles.container}>
      <div ref={veilRef} className={styles.veil} />

      <div className={styles.starField}>
        {STAR_STREAK_VARIANTS.map((variant, index) => (
          <div
            key={index}
            className={styles.starStreakWrap}
            style={{ left: `${variant.startLeft}%`, top: `${variant.startTop}%`, transform: `rotate(${variant.angleDeg}deg)` }}
          >
            <div
              ref={(el) => {
                starRefs.current[index] = el;
              }}
              className={styles.starStreak}
            />
          </div>
        ))}
      </div>

      {CLOUD_VARIANTS.map((variant, index) => (
        <div
          key={index}
          ref={(el) => {
            cloudRefs.current[index] = el;
          }}
          className={styles.cloud}
          style={{ width: `${variant.widthVw}vw`, height: `${variant.heightVw}vw` }}
        >
          {Array.from({ length: 5 }).map((_, puffIndex) => (
            <div key={puffIndex} className={styles.puff} />
          ))}
        </div>
      ))}
    </div>
  );
}
