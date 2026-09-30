import { useArenaStore } from '@/store/arenaStore';
import styles from './ArenaHud.module.css';

/**
 * HUD del combattimento col boss (overlay HTML sopra il Canvas): vita e
 * postura di Checco in alto al centro, vita del giocatore in alto a sinistra,
 * messaggi ("Round 2", "AVVIA IL FILM!") al centro, flash bianco ai cambi di
 * sfondo e l'invito a richiamare Eve. Legge solo `useArenaStore`, che si
 * aggiorna agli eventi (colpi, cambi round), mai a ogni frame.
 */
export function ArenaHud() {
  const playerHp = useArenaStore((s) => s.playerHp);
  const playerHpMax = useArenaStore((s) => s.playerHpMax);
  const bossHp = useArenaStore((s) => s.bossHp);
  const bossHpMax = useArenaStore((s) => s.bossHpMax);
  const bossPosture = useArenaStore((s) => s.bossPosture);
  const healsLeft = useArenaStore((s) => s.healsLeft);
  const skill = useArenaStore((s) => s.skill);
  const round = useArenaStore((s) => s.round);
  const flash = useArenaStore((s) => s.flash);
  const message = useArenaStore((s) => s.message);
  const hint = useArenaStore((s) => s.hint);
  const evePromptVisible = useArenaStore((s) => s.evePromptVisible);

  const pct = (value: number, max: number) => `${Math.max(0, Math.min(100, (value / max) * 100))}%`;

  return (
    <div className={styles.layer}>
      <div className={styles.bossBar}>
        <div className={styles.name}>
          <span>Checco Zalone</span>
          <span className={styles.round}>Round {round}</span>
        </div>
        <div className={styles.track}>
          <div className={styles.fillBoss} style={{ width: pct(bossHp, bossHpMax) }} />
        </div>
        <div className={styles.trackThin}>
          <div
            className={bossPosture >= 100 ? styles.fillPostureBroken : styles.fillPosture}
            style={{ width: `${bossPosture}%` }}
          />
        </div>
      </div>

      <div className={styles.playerBar}>
        <div className={styles.name}>
          <span>D</span>
        </div>
        <div className={styles.track}>
          <div className={styles.fillPlayer} style={{ width: pct(playerHp, playerHpMax) }} />
        </div>
        {/* Barra abilità: il segno a metà è la prima soglia, la fine la seconda. */}
        <div className={styles.skillTrack}>
          <div className={skill >= 100 ? styles.fillSkillFull : styles.fillSkill} style={{ width: `${skill}%` }} />
          <div className={styles.skillMark} />
        </div>
        <div className={styles.heals} aria-label={`Cure rimaste: ${healsLeft}`}>
          {[0, 1, 2].map((slot) => (
            <span key={slot} className={slot < healsLeft ? styles.healFull : styles.healEmpty} />
          ))}
        </div>
      </div>

      {message && (
        <div className={styles.message} key={message}>
          <div className={styles.messageTitle}>{message}</div>
          {hint && <div className={styles.messageHint}>{hint}</div>}
        </div>
      )}

      {flash > 0 && <div className={styles.flash} key={flash} />}

      {evePromptVisible && <div className={styles.evePrompt}>Premi F per richiamare Eve</div>}
    </div>
  );
}
