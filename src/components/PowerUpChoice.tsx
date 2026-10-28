import { useEffect, useState } from 'react';
import { useArenaStore } from '@/store/arenaStore';
import styles from './PowerUpChoice.module.css';

/**
 * Schermata di scelta del potenziamento (dopo aver interrotto "Avvia il film"):
 * il gioco è fermo finché non si sceglie. Una carta per opzione — oggi una sola,
 * ma la lista arriva dallo store (`powerUpChoice`), quindi aggiungerne è solo
 * dati. Si sceglie con click, frecce + Invio/Spazio o il numero della carta;
 * l'arena legge `powerUpPicked`.
 */
export function PowerUpChoice() {
  const options = useArenaStore((s) => s.powerUpChoice);
  const title = useArenaStore((s) => s.powerUpChoiceTitle);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!options) return;
    setSelected(0);
    // La carta evidenziata si tiene anche qui (non solo in stato React): il
    // gestore dei tasti la legge senza passare da un aggiornamento di stato.
    let current = 0;
    const pick = (index: number) => {
      const option = options[index];
      if (option) useArenaStore.getState().set({ powerUpPicked: option.id });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        current = Math.min(options.length - 1, Math.max(0, current + (event.key === 'ArrowLeft' ? -1 : 1)));
        setSelected(current);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        pick(current);
      } else if (/^[1-9]$/.test(event.key)) {
        pick(Number(event.key) - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [options]);

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
            <span className={styles.cardText}>{option.description}</span>
          </button>
        ))}
      </div>
      <div className={styles.hint}>Frecce e Invio, o clicca una carta</div>
    </div>
  );
}
