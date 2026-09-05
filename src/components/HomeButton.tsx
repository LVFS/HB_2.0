import ui from '@/styles/ui.module.css';
import styles from './HomeButton.module.css';

interface HomeButtonProps {
  onClick: () => void;
}

/**
 * Icona "torna alla home", volutamente un componente a sé e non infilata
 * dentro `SettingsBar`: "tornare alla home" ha un significato diverso a
 * seconda di dove ci si trova (da qui vuol dire tornare al menu; da un
 * livello vero in futuro potrebbe voler dire "vuoi davvero uscire? perdi i
 * progressi"), mentre `SettingsBar` deve restare generica, senza sapere
 * nulla di schermate. Chi la monta decide il posto e cosa fa `onClick`.
 *
 * Tooltip nativo (`title`): sufficiente per un pulsante isolato come
 * questo, non vale la pena di un componente tooltip dedicato per un solo
 * caso d'uso.
 */
export function HomeButton({ onClick }: HomeButtonProps) {
  return (
    <button
      type="button"
      className={`${ui.secondary} ${styles.button}`}
      title="Torna al menu"
      onClick={(event) => {
        onClick();
        // Stesso motivo di `SettingsBar`: un fuoco lasciato qui sopra
        // intercetterebbe una pressione successiva non più legata a questo
        // pulsante.
        event.currentTarget.blur();
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M4 12.5 12 5l8 7.5M6.5 11v8h4v-5h3v5h4v-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
