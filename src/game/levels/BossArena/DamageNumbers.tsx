import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { ArenaWorld, DamagePopup } from './arenaState';
import styles from './DamageNumbers.module.css';

const POPUP_LIFETIME_MS = 900;
const MAX_VISIBLE = 14;

interface Popup extends DamagePopup {
  id: number;
}

/**
 * Numeri di danno che salgono e svaniscono sopra chi ha subito il colpo.
 * `combat.ts` mette i colpi in `world.popups` (per-frame, niente React); qui si
 * svuota la coda e si crea un elemento HTML per ognuno — stato React solo
 * all'EVENTO del colpo, mai ogni frame. Sono `<Html>` di drei, quindi seguono la
 * camera senza che ci sia da proiettare a mano; la salita e la dissolvenza sono
 * una animazione CSS, non un tween per frame.
 */
export function DamageNumbers({ world }: { world: ArenaWorld }) {
  const [popups, setPopups] = useState<Popup[]>([]);
  const nextId = useRef(0);
  const timeouts = useRef<number[]>([]);

  useEffect(() => {
    const pending = timeouts.current;
    return () => pending.forEach((handle) => window.clearTimeout(handle));
  }, []);

  useFrame(() => {
    if (world.popups.length === 0) return;
    const fresh = world.popups.splice(0).map((popup) => ({ ...popup, id: nextId.current++ }));
    setPopups((current) => [...current, ...fresh].slice(-MAX_VISIBLE));
    for (const popup of fresh) {
      timeouts.current.push(
        window.setTimeout(() => setPopups((current) => current.filter((p) => p.id !== popup.id)), POPUP_LIFETIME_MS)
      );
    }
  });

  return (
    <>
      {popups.map((popup) => {
        const text = popup.label ?? (popup.blocked ? 'BLOCCATO' : String(Math.max(1, Math.round(popup.amount))));
        const className = popup.label
          ? styles.parry
          : popup.blocked
          ? styles.blocked
          : popup.target === 'player'
            ? styles.player
            : popup.target === 'object'
              ? styles.object
              : popup.boost > 1.01
                ? styles.boosted
                : styles.boss;
        return (
          <Html
            key={popup.id}
            position={[popup.x, popup.y, popup.z ?? 2]}
            center
            zIndexRange={[30, 20]}
            style={{ pointerEvents: 'none' }}
          >
            <span className={`${styles.number} ${className}`}>{text}</span>
          </Html>
        );
      })}
    </>
  );
}
