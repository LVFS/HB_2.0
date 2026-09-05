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

  useEffect(() => {
    if (trigger === 0) return;

    const clouds = cloudRefs.current.filter((el): el is HTMLDivElement => el !== null);
    const veil = veilRef.current;
    const timeline = gsap.timeline();
    timeline
      .set(clouds, {
        left: (index) => `${CLOUD_VARIANTS[index].startLeft}%`,
        top: (index) => `${CLOUD_VARIANTS[index].startTop}%`,
        opacity: 1
      })
      .set(veil, { opacity: 0 })
      .to(clouds, {
        left: (index) => `${CLOUD_VARIANTS[index].restLeft}%`,
        top: (index) => `${CLOUD_VARIANTS[index].restTop}%`,
        duration: (index) => COVER_DURATION / CLOUD_VARIANTS[index].speed,
        ease: 'power2.in',
        stagger: { each: 0.014, from: 'random' }
      })
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
