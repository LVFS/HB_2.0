import { useEffect, useRef } from 'react';
import { formatActionText } from '@/input/glyphLabels';
import { useGlyphDevice } from '@/input/useInputHooks';
import { useArenaStore } from '@/store/arenaStore';
import { ActionGlyph } from './ActionGlyph';
import { QteChallenge } from './QteChallenge';
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
interface ArenaHudProps {
  /** `boss` (default): barre di Checco, abilità e furia. `tunnel`: al posto di Checco la barra
   *  "distanza dalla marionetta", niente abilità/furia (vedi `docs/FASE8_TUNNEL_INSEGUIMENTO.md`). */
  mode?: 'boss' | 'tunnel';
}

/**
 * Il bianco dell'abbaglio dei paparazzi. Parte SOLO quando il conteggio sale rispetto a quello visto al montaggio: se la HUD si
 * rimonta (cambio di fase, ripartenza) con un conteggio già alto non rifà il lampo, che sarebbe uno sparaflash senza paparazzi.
 */
function BlindFlash({ count }: { count: number }) {
  const seen = useRef(count);
  useEffect(() => {
    if (count < seen.current) seen.current = count;
  }, [count]);
  if (count <= seen.current) return null;
  return <div key={count} className={styles.blinded} />;
}

export function ArenaHud({ mode = 'boss' }: ArenaHudProps = {}) {
  const tunnel = mode === 'tunnel';
  const tunnelGap = useArenaStore((s) => s.tunnelGap);
  const tunnelStatus = useArenaStore((s) => s.tunnelStatus);
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
  // I testi dei messaggi hanno segnaposto come {attack}: si scrivono col tasto del dispositivo attuale.
  const { device, family } = useGlyphDevice();

  const pct = (value: number, max: number) => `${Math.max(0, Math.min(100, (value / max) * 100))}%`;

  return (
    <div className={styles.layer}>
      {/* Il buio sta SOTTO la HUD: le barre restano leggibili. */}
      {/* Tunnel: il buio (resta un cerchio di luce attorno a D) e l'abbaglio dei paparazzi. */}
      {tunnel && tunnelStatus && tunnelStatus.dark > 0 && (
        <div
          className={styles.darkness}
          style={{ ['--dark-x' as string]: `${tunnelStatus.darkX}%`, ['--dark-a' as string]: tunnelStatus.dark / 100 }}
        />
      )}
      {tunnel && tunnelStatus && <BlindFlash count={tunnelStatus.blind} />}

      {/* Tunnel: la distanza dalla marionetta (0 = raggiunta, 100 = sparita). */}
      {tunnel && tunnelGap !== null && (
        <div className={styles.bossBar}>
          <div className={styles.name}>
            <span>Marionetta di Checco</span>
            <span className={styles.round}>Distanza {tunnelGap} m</span>
          </div>
          <div className={styles.track} aria-label={`Distanza dalla marionetta: ${tunnelGap} su 100`}>
            <div className={tunnelGap >= 75 ? styles.fillGapDanger : styles.fillGap} style={{ width: `${tunnelGap}%` }} />
            <span className={styles.gapMark} style={{ left: `${tunnelGap}%` }} />
          </div>
          <div className={styles.gapScale}>
            <span>Raggiunta</span>
            <span>Sfuggita</span>
          </div>
        </div>
      )}
      {!tunnel && (
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
      )}

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
        {!tunnel && (
          <div className={styles.skillTrack}>
            <div className={skill >= 100 ? styles.fillSkillFull : styles.fillSkill} style={{ width: `${skill}%` }} />
            <div className={styles.skillMark} />
          </div>
        )}
        {/* Furia (solo con un potenziamento che ha il berserk): Q a barra piena. */}
        {!tunnel && powerUp !== null && (
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
                <>
                  Furia piena — premi <ActionGlyph action="berserk" />
                </>
              ) : (
                `Furia ${rage}`
              )}
            </div>
          </div>
        )}
        {!tunnel && (<div className={styles.heals} aria-label={`Cure rimaste: ${healsLeft}`}>
          {Array.from({ length: Math.max(3, healsLeft) }, (_, slot) => slot).map((slot) => (
            <span key={slot} className={slot < healsLeft ? styles.healFull : styles.healEmpty} />
          ))}
        </div>)}

        {/* Tunnel: Slancio, Sfere del Drago, casella bonus, tempo e bonus a tempo. */}
        {tunnel && tunnelStatus && (
          <div className={styles.bonusBlock}>
            <div className={styles.slancio} aria-label={`Slancio: livello ${tunnelStatus.slancio} su ${tunnelStatus.slancioMax}`}>
              <span className={styles.bonusLabel}>Slancio</span>
              {Array.from({ length: tunnelStatus.slancioMax }, (_, i) => (
                <span key={i} className={i < tunnelStatus.slancio ? styles.slancioPipOn : styles.slancioPip} />
              ))}
              {tunnelStatus.speedPct > 0 && <span className={styles.slancioValue}>+{tunnelStatus.speedPct}% velocità</span>}
            </div>
            <div className={styles.spheres} aria-label={`Sfere del Drago: ${tunnelStatus.spheres} su ${tunnelStatus.spheresMax}`}>
              <span className={styles.bonusLabel}>Sfere</span>
              {Array.from({ length: tunnelStatus.spheresMax }, (_, i) => (
                <span key={i} className={i < tunnelStatus.spheres ? styles.sphereOn : styles.sphereOff} />
              ))}
            </div>
            {/* In sella al gatto: coccole (J) e pappa (R) da tenere alte. */}
            {tunnelStatus.cat && (
              <div className={styles.cat}>
                <span className={styles.catLabel}>Gatto</span>
                <span className={styles.catBars}>
                  <span className={styles.catBar} title={formatActionText('Coccole ({attack})', device, family)}>
                    <span className={tunnelStatus.cat.affection < 30 ? styles.catFillLow : styles.catFill} style={{ width: `${tunnelStatus.cat.affection}%` }} />
                  </span>
                  <span className={styles.catBar} title={formatActionText('Pappa ({heal})', device, family)}>
                    <span className={tunnelStatus.cat.hunger < 30 ? styles.catFillLow : styles.catFill} style={{ width: `${tunnelStatus.cat.hunger}%` }} />
                  </span>
                </span>
                <span className={styles.catKeys}>
                  <ActionGlyph action="attack" bare /> coccole · <ActionGlyph action="heal" bare /> pappa
                </span>
              </div>
            )}
            {/* Stili permanenti lasciati dagli ospiti (e la carica del volo, se si può volare). */}
            {(tunnelStatus.perks.length > 0 || tunnelStatus.flight !== null) && (
              <div className={styles.wishes} aria-label="Stili permanenti">
                {tunnelStatus.perks.map((name) => (
                  <span key={name} className={styles.perkChip}>
                    {name}
                  </span>
                ))}
                {tunnelStatus.flight !== null && <span className={styles.wishChipUse}>Volo {tunnelStatus.flight}%</span>}
              </div>
            )}
            {/* Desideri di Shenron: permanenti avuti, Istinti rimasti e Zoltraak di riserva (Q). */}
            {(tunnelStatus.wishes.owned.length > 0 || tunnelStatus.wishes.instinct > 0 || tunnelStatus.wishes.reserve > 0) && (
              <div className={styles.wishes} aria-label="Desideri esauditi">
                {tunnelStatus.wishes.owned.map((name) => (
                  <span key={name} className={styles.wishChip}>
                    {name}
                  </span>
                ))}
                {tunnelStatus.wishes.instinct > 0 && <span className={styles.wishChipUse}>Istinto ×{tunnelStatus.wishes.instinct}</span>}
                {tunnelStatus.wishes.reserve > 0 && <span className={styles.wishChipUse}>Zoltraak ×{tunnelStatus.wishes.reserve} (<ActionGlyph action="berserk" bare />)</span>}
              </div>
            )}
            {/* Casella bonus (stile Mario Kart): un solo bonus, si usa con E. */}
            <div className={tunnelStatus.slot ? styles.slotFull : styles.slotEmpty}>
              <span className={styles.bonusLabel}>Bonus</span>
              {tunnelStatus.slot ? (
                <>
                  <img className={styles.slotIcon} src={tunnelStatus.slot.icon} alt="" />
                  <span className={styles.slotName}>{tunnelStatus.slot.label}</span>
                  <kbd className={styles.slotKey}>
                    <ActionGlyph action="skill" bare />
                  </kbd>
                </>
              ) : (
                <span className={styles.slotName}>vuota</span>
              )}
            </div>
            <div className={styles.timer} aria-label={`Tempo rimasto: ${tunnelStatus.timeLeft} secondi`}>
              <span className={styles.bonusLabel}>Tempo</span>
              <span className={tunnelStatus.timeLeft <= 30 ? styles.timerLow : styles.timerValue}>
                {Math.floor(tunnelStatus.timeLeft / 60)}:{String(tunnelStatus.timeLeft % 60).padStart(2, '0')}
              </span>
            </div>
            {tunnelStatus.buffs.map((buff) => (
              <div key={buff.id} className={buff.bad ? `${styles.buff} ${styles.malus}` : styles.buff}>
                <span className={styles.buffLabel}>{buff.label}</span>
                <span className={styles.buffTrack}>
                  <span className={styles.buffFill} style={{ width: `${buff.pct}%` }} />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {message && (
        // Nel tunnel i messaggi sono battute piccole sotto le barre: quelle grandi coprirebbero le minacce.
        <div className={tunnel ? styles.bark : styles.message} key={message}>
          <div className={styles.messageTitle}>{formatActionText(message, device, family)}</div>
          {hint && <div className={styles.messageHint}>{formatActionText(hint, device, family)}</div>}
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

      {/* Tunnel: l'onda con cui Checco altera la realtà, con i metri che mancano e le vie che copre. */}
      {tunnel && tunnelStatus?.threat && (
        <div className={styles.threat} role="alert" aria-label={`Onda in arrivo tra ${tunnelStatus.threat.meters} metri`}>
          <span className={styles.threatTitle}>Onda di Checco</span>
          <span className={styles.threatMeters}>{tunnelStatus.threat.meters} m</span>
          <span className={styles.threatLanes}>
            {[0, 1, 2].map((lane) => (
              <span key={lane} className={tunnelStatus.threat?.lanes.includes(lane) ? styles.threatLaneOn : styles.threatLane} />
            ))}
          </span>
        </div>
      )}
      {/* Tunnel: la modalità in corso. */}
      {tunnel && tunnelStatus?.mode && (
        <div className={tunnelStatus.mode.id === 'camino' ? styles.modeCamino : styles.modeAnime}>
          <span>{tunnelStatus.mode.id === 'camino' ? 'Modalità Buen Camino' : tunnelStatus.mode.finale ? 'Kamehameha!' : 'Modalità shonen'}</span>
          <span className={styles.modeTrack}>
            <span className={styles.modeFill} style={{ width: `${tunnelStatus.mode.pct}%` }} />
          </span>
        </div>
      )}

      {/* Tunnel: Checco è fuori dallo schermo, a destra: indicatore con i metri che mancano. */}
      {tunnel && tunnelStatus?.offscreen && tunnelGap !== null && (
        <div className={styles.offscreen} aria-label={`Checco è a ${tunnelGap} metri`}>
          <span className={styles.offscreenName}>Checco</span>
          <span className={styles.offscreenMeters}>{tunnelGap} m</span>
          <span className={styles.offscreenArrow} aria-hidden="true">▶</span>
        </div>
      )}

      {berserk && <div className={styles.berserkVignette} />}
      {tunnel && tunnelStatus?.buffs.some((buff) => buff.id === 'saiyan') && <div className={styles.saiyanGlow} />}
      {tunnel && tunnelStatus?.buffs.some((buff) => buff.id === 'ciak') && <div className={styles.ciakTint} />}
      {tunnel && tunnelStatus?.mode?.id === 'camino' && <div className={styles.caminoTint} />}
      {tunnel && tunnelStatus?.mode?.id === 'anime' && <div className={styles.animeRays} />}

      {flash > 0 && <div className={styles.flash} key={flash} />}

      <QteChallenge />
      {/* Nell'arena sceglie il potenziamento Bloodborne; nel tunnel i desideri di Shenron. */}
      <PowerUpChoice />
      {!tunnel && <PowerUpIntro />}

      {!tunnel && evePromptVisible && (
        <div className={styles.evePrompt}>
          Premi <ActionGlyph action="summon" /> per richiamare Eve
        </div>
      )}
    </div>
  );
}
