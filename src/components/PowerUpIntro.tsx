import { useState } from 'react';
import { useArenaStore } from '@/store/arenaStore';
import styles from './PowerUpIntro.module.css';

/**
 * Scritta a tutto schermo dopo la scelta del potenziamento ("BLOODBORNE").
 * Quando ci sarà il video, `videoSrc` lo mostra al posto della scritta; se il
 * file manca o non parte si ricade sulla scritta (stesso trattamento tollerante
 * del video di salto nel menu).
 */
export function PowerUpIntro() {
  const intro = useArenaStore((s) => s.powerUpIntro);
  const [videoFailed, setVideoFailed] = useState(false);
  if (!intro) return null;

  const showVideo = intro.videoSrc !== undefined && !videoFailed;
  return (
    <div className={styles.overlay}>
      {showVideo ? (
        <video
          className={styles.video}
          src={`${import.meta.env.BASE_URL}${intro.videoSrc}`}
          autoPlay
          muted
          playsInline
          onError={() => setVideoFailed(true)}
        />
      ) : (
        <div className={styles.text}>
          <div className={styles.title}>{intro.title}</div>
          <div className={styles.subtitle}>{intro.subtitle}</div>
        </div>
      )}
    </div>
  );
}
