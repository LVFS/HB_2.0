import type { ReactNode } from 'react';
import type { GameAction } from '@/input/inputActions';
import { ControlsHint } from './ActionGlyph';
import styles from './PadHints.module.css';

interface PadHintsProps {
  position?: 'right' | 'center';
  items: ReadonlyArray<{ actions: readonly GameAction[]; label: ReactNode }>;
}

/** Il promemoria dei comandi di un menu (icone del dispositivo in uso), in basso a destra. */
export function PadHints({ items, position = 'right' }: PadHintsProps) {
  return (
    <div className={`${styles.hints} ${position === 'center' ? styles.center : ''}`}>
      <ControlsHint items={items} />
    </div>
  );
}
