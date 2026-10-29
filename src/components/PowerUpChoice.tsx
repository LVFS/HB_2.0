import { useEffect, useRef, useState } from 'react';
import { ActionGlyph } from '@/components/ActionGlyph';
import { formatActionText } from '@/input/glyphLabels';
import { useActionPress, useGlyphDevice } from '@/input/useInputHooks';
import { useArenaStore } from '@/store/arenaStore';
import styles from './PowerUpChoice.module.css';

/**
 * Schermata di scelta del potenziamento (dopo aver interrotto "Avvia il film"):
 * il gioco è fermo finché non si sceglie. Una carta per opzione — oggi una sola,
 * ma la lista arriva dallo store (`powerUpChoice`), quindi aggiungerne è solo
 * dati. Si sceglie con click, frecce + Invio/Spazio o il numero della carta, oppure
 * dal controller con croce/stick sinistra-destra + A (FASE 14); l'arena legge `powerUpPicked`.
 */
export function PowerUpChoice() {
  const options = useArenaStore((s) => s.powerUpChoice);
  const title = useArenaStore((s) => s.powerUpChoiceTitle);
  const [selected, setSelected] = useState(0);
  const { device, family } = useGlyphDevice();
  // La carta evidenziata si tiene anche in un ref: i gestori dei tasti la leggono senza passare da un aggiornamento di stato.
  const current = useRef(0);

  const pick = (index: number) => {
    const option = options?.[index];
    if (option) useArenaStore.getState().set({ powerUpPicked: option.id });
  };
  const move = (delta: number) => {
    if (!options) return;
    current.current = Math.min(options.length - 1, Math.max(0, current.current + delta));
    setSelected(current.current);
  };

  useEffect(() => {
    if (!options) return;
    current.current = 0;
    setSelected(0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        move(event.key === 'ArrowLeft' ? -1 : 1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        pick(current.current);
      } else if (/^[1-9]$/.test(event.key)) {
        pick(Number(event.key) - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `move` e `pick` leggono solo `options` (la dipendenza) e ref
  }, [options]);

  // Controller: croce o stick a sinistra/destra per scegliere la carta, A per confermare (la tastiera ha il suo gestore qui sopra).
  useActionPress(
    (action) => {
      if (action === 'left') move(-1);
      else if (action === 'right') move(1);
      else if (action === 'confirm') pick(current.current);
    },
    { enabled: !!options, padOnly: true }
  );

  if (!options) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-label="Scegli un potenziamento">
      <div className={styles.title}>{title ?? 'Scegli il potenziamento'}</div>
      <div className={styles.cards}>
        {options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            className={index === selected ? styles.cardSelected : styles.card}
            onClick={() => useArenaStore.getState().set({ powerUpPicked: option.id })}
          >
            <span className={styles.cardIndex}>{index + 1}</span>
            <span className={styles.cardName}>{option.label}</span>
            <span className={styles.cardText}>{formatActionText(option.description, device, family)}</span>
          </button>
        ))}
      </div>
      <div className={styles.hint}>
        {device === 'gamepad' ? (
          <>
            <ActionGlyph action="left" /> <ActionGlyph action="right" /> e <ActionGlyph action="confirm" />, o clicca una carta
          </>
        ) : (
          'Frecce e Invio, o clicca una carta'
        )}
      </div>
    </div>
  );
}
