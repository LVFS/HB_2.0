import { useArenaStore } from '@/store/arenaStore';
import { PowerUpChoice } from './PowerUpChoice';
import { PowerUpIntro } from './PowerUpIntro';
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
  const bossPostureMax = useArenaStore((s) => s.bossPostureMax);
  const clash = useArenaStore((s) => s.clash);
  const totemsLeft = useArenaStore((s) => s.totemsLeft);
  const healsLeft = useArenaStore((s) => s.healsLeft);
  const skill = useArenaStore((s) => s.skill);
  const powerUp = useArenaStore((s) => s.powerUp);
  const rage = useArenaStore((s) => s.rage);
  const berserk = useArenaStore((s) => s.berserk);
  const combo = useArenaStore((s) => s.combo);
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
          <span className={styles.trackValue}>
            {Math.ceil(bossHp)} / {bossHpMax}
          </span>
        </div>
        <div className={styles.trackThin}>
          <div
            className={bossPosture >= bossPostureMax ? styles.fillPostureBroken : styles.fillPosture}
            style={{ width: pct(bossPosture, bossPostureMax) }}
          />
        </div>
        <div className={styles.postureValue}>
          Postura {Math.round(bossPosture)} / {bossPostureMax}
        </div>
        {totemsLeft > 0 && (
          <div className={styles.totems}>Checco è invulnerabile — oggetti da distruggere: {totemsLeft}</div>
        )}
      </div>

      <div className={styles.playerBar}>
        <div className={styles.name}>
          <span>D</span>
        </div>
        <div className={styles.track}>
          <div className={styles.fillPlayer} style={{ width: pct(playerHp, playerHpMax) }} />
          <span className={styles.trackValue}>
            {Math.ceil(playerHp)} / {playerHpMax}
          </span>
        </div>
        {/* Barra abilità: il segno a metà è la prima soglia, la fine la seconda. */}
        <div className={styles.skillTrack}>
          <div className={skill >= 100 ? styles.fillSkillFull : styles.fillSkill} style={{ width: `${skill}%` }} />
          <div className={styles.skillMark} />
        </div>
        {/* Furia (solo con un potenziamento che ha il berserk): Q a barra piena. */}
        {powerUp !== null && (
          <div className={styles.rageBlock}>
            <div className={styles.rageTrack}>
              <div className={berserk ? styles.fillRageActive : styles.fillRage} style={{ width: `${rage}%` }} />
            </div>
            <div className={styles.rageLabel}>
              {berserk ? (
                <>
                  Berserk <span className={styles.combo}>×{combo.toFixed(2)}</span>
                </>
              ) : rage >= 100 ? (
                'Furia piena — premi Q'
              ) : (
                `Furia ${rage}`
              )}
            </div>
          </div>
        )}
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

      {clash !== null && (
        <div className={styles.clash}>
          <div className={styles.clashTitle}>Premi J a ripetizione!</div>
          <div className={styles.clashTrack}>
            <div className={styles.clashFill} style={{ width: `${Math.round(clash * 100)}%` }} />
          </div>
        </div>
      )}

      {berserk && <div className={styles.berserkVignette} />}

      {flash > 0 && <div className={styles.flash} key={flash} />}

      <PowerUpChoice />
      <PowerUpIntro />

      {evePromptVisible && <div className={styles.evePrompt}>Premi F per richiamare Eve</div>}
    </div>
  );
}
