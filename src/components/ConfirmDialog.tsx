import { useRef } from 'react';
import { usePadNavLayer } from '@/input/padNav';
import ui from '@/styles/ui.module.css';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  text?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Finestra di conferma (uscire dal livello, tornare al menu): due pulsanti, il fuoco parte su «annulla» (la scelta prudente);
 * da controller ○/B annulla. È un livello di navigazione da pad, quindi sta sopra qualunque altro pannello aperto.
 */
export function ConfirmDialog({ title, text, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  usePadNavLayer(panel, true, onCancel);

  return (
    <div className={styles.backdrop} role="alertdialog" aria-label={title} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.key !== 'Escape' && event.stopPropagation()}>
      <div ref={panel} className={styles.panel}>
        <h2 className={styles.title}>{title}</h2>
        {text && <p className={styles.text}>{text}</p>}
        <div className={styles.row}>
          <button type="button" className={ui.primary} data-nav onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" className={ui.secondary} data-nav data-nav-default onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
