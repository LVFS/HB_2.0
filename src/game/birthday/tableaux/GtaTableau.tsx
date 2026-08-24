import { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { GTA_STATS, RECIPIENT_NAME, TEXTS } from '../birthdayConfig';
import styles from './GtaTableau.module.css';

const CONFETTI_COUNT = 70;
const CONFETTI_COLORS = ['#ffd447', '#ff6b6b', '#4ecdc4', '#a78bfa', '#f8fafc', '#ff9f43'];

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Props {
  active: boolean;
}

/**
 * Quadro 6 — il finale, in stile "mission passed".
 *
 * I numeri delle statistiche sono l'unico punto di tutta la sequenza in cui
 * serve davvero GSAP dentro un quadro: un contatore che sale va scritto nel
 * DOM a ogni fotogramma, e passarlo da uno stato React vorrebbe dire
 * ridisegnare l'albero sessanta volte al secondo. Qui invece GSAP anima un
 * oggetto normale e `onUpdate` scrive direttamente nel nodo di testo — React
 * non se ne accorge nemmeno.
 */
export function GtaTableau({ active }: Props) {
  const valueRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const confetti = useMemo(() => {
    if (prefersReducedMotion()) return [];
    return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 1.6}s`,
      duration: `${2.4 + Math.random() * 2.6}s`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      width: `${5 + Math.random() * 6}px`,
      height: `${9 + Math.random() * 8}px`,
      tilt: `${Math.random() * 360}deg`
    }));
  }, []);

  useEffect(() => {
    if (!active) return;

    if (prefersReducedMotion()) {
      // Niente conteggio: i valori finali compaiono e basta.
      GTA_STATS.forEach((stat, i) => {
        const node = valueRefs.current[i];
        if (node) node.textContent = `${stat.to}${stat.suffix ?? ''}`;
      });
      return;
    }

    const tweens = GTA_STATS.map((stat, i) => {
      const counter = { value: stat.from };
      return gsap.to(counter, {
        value: stat.to,
        duration: 1.5,
        delay: 0.35 + i * 0.22,
        ease: 'power2.out',
        onUpdate: () => {
          const node = valueRefs.current[i];
          if (node) node.textContent = `${Math.round(counter.value)}${stat.suffix ?? ''}`;
        }
      });
    });

    return () => {
      tweens.forEach((tween) => tween.kill());
    };
  }, [active]);

  return (
    <div className={styles.root}>
      {/* Slot opzionale: resta trasparente se il file manca, il gradiente
          sotto fa comunque da base. */}
      <div className={styles.bgImage} />

      {/* Vampata bianca brevissima, la tipica "flash" dei title-card
          action/mission-passed, prima che partano coriandoli e contatori.
          Un <span> a schermo intero che sfuma via in fretta — nessun nuovo
          asset. Rimontata da zero a ogni volta che `active` torna true
          (key sul valore stesso) così l'animazione riparte anche se il
          quadro venisse rivisitato. */}
      {active && <span key="flash" aria-hidden="true" className={styles.flash} />}


      {active &&
        confetti.map((piece) => (
          <span
            key={piece.id}
            className={styles.confetto}
            style={{
              left: piece.left,
              width: piece.width,
              height: piece.height,
              background: piece.color,
              animationDelay: piece.delay,
              animationDuration: piece.duration,
              rotate: piece.tilt
            }}
          />
        ))}

      <div className={styles.content}>
        <span className={styles.kicker}>Mission passed</span>

        <ul className={styles.stats}>
          {GTA_STATS.map((stat, i) => (
            <li key={stat.label} className={styles.statRow}>
              <span className={styles.statLabel}>{stat.label}</span>
              <span
                className={styles.statValue}
                ref={(node) => {
                  valueRefs.current[i] = node;
                }}
              >
                {stat.from}
                {stat.suffix ?? ''}
              </span>
            </li>
          ))}
        </ul>

        <h1 className={styles.title}>
          {TEXTS.gtaTitle},
          <span className={styles.name}>{RECIPIENT_NAME}</span>
        </h1>
      </div>
    </div>
  );
}
