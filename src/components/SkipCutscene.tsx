import { useCutsceneSkip } from '@/hooks/useCutsceneSkip';
import { ActionGlyph } from './ActionGlyph';
import styles from './SkipCutscene.module.css';

interface SkipCutsceneProps {
  /** Salta la cutscene: deve portarla al suo stato finale (vedi `useCutsceneSkip`). */
  onSkip: () => void;
  enabled?: boolean;
}

/**
 * Invito "tieni premuto per saltare" con barra di riempimento, in un angolo
 * dello schermo. Si salta TENENDO premuto Esc/Invio (o il bottone) per ~0.6 s,
 * mai con un tap. Overlay HTML sopra la scena; condiviso da tutte le cutscene.
 */
export function SkipCutscene({ onSkip, enabled = true }: SkipCutsceneProps) {
  const { progress, buttonProps } = useCutsceneSkip(onSkip, { enabled });
  if (!enabled) return null;

  return (
    <button type="button" className={styles.button} aria-label="Tieni premuto per saltare la scena" {...buttonProps}>
      <span className={styles.label}>
        Tieni premuto <ActionGlyph action="skip" /> per saltare
      </span>
      <span className={styles.track}>
        <span className={styles.fill} style={{ width: `${Math.round(progress * 100)}%` }} />
      </span>
    </button>
  );
}
