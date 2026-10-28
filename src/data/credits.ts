// Titoli di coda (FASE 12): un elenco di blocchi che scorre sullo schermo nero. Il testo di dedica è DA SCRIVERE A MANO
// da chi fa il regalo: finché resta il segnaposto qui sotto, la schermata lo mostra ben visibile.

export interface CreditBlock {
  /** Titolo piccolo sopra le righe (es. «Un regalo per»), o null. */
  heading: string | null;
  lines: string[];
}

/** Segnaposto della dedica: se una riga contiene questo testo, la schermata la evidenzia come «da scrivere». */
export const DEDICATION_PLACEHOLDER = '[DA SCRIVERE: nome di chi riceve il regalo]';
export const DEDICATION_MESSAGE_PLACEHOLDER = '[DA SCRIVERE: messaggio di dedica]';

export const CREDITS: CreditBlock[] = [
  { heading: null, lines: ['EPIC BIRTHDAY QUEST'] },
  { heading: 'Livello 1', lines: ['Cinema Ariston'] },
  { heading: 'Con', lines: ['D', 'Eve', 'e, suo malgrado, Checco'] },
  { heading: 'Un regalo per', lines: [DEDICATION_PLACEHOLDER, DEDICATION_MESSAGE_PLACEHOLDER] },
  { heading: null, lines: ['Buon compleanno.'] }
];
