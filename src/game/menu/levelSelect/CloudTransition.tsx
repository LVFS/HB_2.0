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
}

const COVER_DURATION = 0.55;
const HOLD_DURATION = 0.2;
const CLEAR_DURATION = 0.55;

/**
 * Transizione tra una città e l'altra: nuvole che coprono tutto lo schermo,
 * si aprono sulla città nuova. Riusa la stessa idea del whiteout di fine
 * menu (overlay pilotato da GSAP, sempre montato) ma con nuvole al posto di
 * un colore pieno — qui non deve sopravvivere a un cambio di `screen`
 * (siamo sempre dentro `LevelSelectScene`), quindi può restare locale
 * invece di salire fino ad `App.tsx`.
 */
export function CloudTransition({ trigger, onCovered }: CloudTransitionProps) {
  const blobRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (trigger === 0) return;

    const blobs = blobRefs.current.filter((el): el is HTMLDivElement => el !== null);
    const timeline = gsap.timeline();
    timeline
      .set(blobs, { xPercent: (index) => (index % 2 === 0 ? -130 : 130), opacity: 1 })
      .to(blobs, { xPercent: 0, duration: COVER_DURATION, ease: 'power2.in', stagger: 0.05 })
      .call(() => onCovered())
      .to({}, { duration: HOLD_DURATION })
      .to(
        blobs,
        { xPercent: (index) => (index % 2 === 0 ? 130 : -130), duration: CLEAR_DURATION, ease: 'power2.out', stagger: 0.05 }
      );

    return () => {
      timeline.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCovered non va in dipendenza: il chiamante lo ricrea spesso, la ref sui blob basta a restare aggiornati
  }, [trigger]);

  return (
    <div className={styles.container}>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          ref={(el) => {
            blobRefs.current[index] = el;
          }}
          className={styles.blob}
          style={{ top: `${index * 22 - 10}%` }}
        />
      ))}
    </div>
  );
}
