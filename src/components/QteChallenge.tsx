import type { GameAction } from '@/input/inputActions';
import { useArenaStore } from '@/store/arenaStore';
import { ActionGlyph } from './ActionGlyph';
import styles from './QteChallenge.module.css';

/**
 * Sequenza di prompt a tempo (QTE): una fila di tasti, quello corrente
 * evidenziato con una barra che si svuota nella sua finestra, i già risolti
 * colorati (verde = colpito, rosso = mancato). Riceve tutto dallo store
 * (`qte`, aggiornato agli EVENTI — non a ogni frame): la barra che si svuota
 * è un'animazione CSS di durata `windowSeconds`, che riparte a ogni prompt
 * grazie alla `key`. Generico: la logica sta in `game/levels/BossArena/qte.ts`
 * e può servire ad altri QTE del livello.
 */
export function QteChallenge() {
  const qte = useArenaStore((s) => s.qte);
  if (!qte) return null;

  return (
    <div className={styles.wrap} role="status" aria-label="Sequenza a tempo">
      <div className={styles.title}>{qte.title}</div>
      <div className={styles.subtitle}>Premi il tasto indicato, al momento giusto</div>
      <div className={styles.row}>
        {qte.keys.map((key, index) => {
          const result = qte.results[index];
          const isCurrent = index === qte.index && !qte.waiting;
          const className = result === 'hit' ? styles.hit : result === 'miss' ? styles.miss : isCurrent ? styles.current : styles.key;
          return (
            <div key={`${index}-${key}`} className={className}>
              <ActionGlyph action={key as GameAction} bare />
            </div>
          );
        })}
      </div>
      {/* La barra della finestra: ricreata a ogni prompt (key) per riavviare l'animazione. */}
      <div className={styles.timer}>
        {!qte.waiting && (
          <div
            key={qte.index}
            className={styles.timerFill}
            style={{ animationDuration: `${qte.windowSeconds}s` }}
          />
        )}
      </div>
    </div>
  );
}
