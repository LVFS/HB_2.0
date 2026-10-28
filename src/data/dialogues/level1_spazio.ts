// Battute dello spazio (FASE 12): l'inseguimento di Checco, il supporto a Eve, il cannone e la distruzione.
// Tono: D scoglionato, Eve burocratica. SOSTITUIBILI senza toccare il codice. Le cutscene (apertura e distruzione)
// mostrano le battute a TEMPO (didascalie: `at` e `hold` in secondi dall'inizio della timeline) perché la scena
// si muove da sola; il dialogo dopo il QTE, invece, avanza con un tasto per riga.

import type { DialogueLine } from './level1_intro';

/** Una didascalia a tempo: compare a `at` secondi dall'inizio della cutscene e resta `hold` secondi. */
export interface CaptionCue {
  at: number;
  hold: number;
  line: DialogueLine;
}

/** Apertura (~20 s, `inseguimento_spaziale_cutscene`). */
export const SPACE_OPENING_CUES: CaptionCue[] = [
  { at: 0.8, hold: 3.6, line: { speaker: 'narratore', text: 'Il razzo buca le nuvole. Più su, qualcosa di enorme lo aspetta.' } },
  { at: 5.2, hold: 3.0, line: { speaker: 'Eve', text: 'Vettore di fuga confermato. Nave madre in orbita. Parto.' } },
  { at: 8.8, hold: 2.6, line: { speaker: 'D', text: 'Aspetta, e io? Non mi porti?' } },
  { at: 11.8, hold: 4.0, line: { speaker: 'Eve', text: 'Il tuo mezzo non è omologato per lo spazio. Resta in linea: mi servi per il supporto.' } },
  { at: 16.2, hold: 3.4, line: { speaker: 'D', text: 'Supporto. Certo. Io sono sempre il supporto.' } }
];

/** Messaggi brevi di Eve durante il QTE di supporto: compaiono dopo il prompt `afterPrompt` (0 = il primo). */
export const SPACE_SUPPORT_CHATTER: Array<{ afterPrompt: number; line: DialogueLine }> = [
  { afterPrompt: 1, line: { speaker: 'Eve', text: 'Manovra evasiva.' } },
  { afterPrompt: 4, line: { speaker: 'Eve', text: 'Scafo al 60%.' } },
  { afterPrompt: 7, line: { speaker: 'Eve', text: 'Sto perdendo quota.' } }
];

/** Dopo il QTE (`carica_cannone_qte`): lo scafo è compromesso comunque, qualunque sia l'esito. */
export const SPACE_AFTER_SUPPORT: DialogueLine[] = [
  { speaker: 'Eve', text: 'Scafo compromesso. Non arriverò dall’altra parte intera. Passo al cannone.' },
  { speaker: 'D', text: 'Cannone? Quale cannone?' },
  { speaker: 'Eve', text: 'Quello di bordo. Va caricato manualmente. Da te, a distanza. Premi.' }
];

/** Distruzione (~12 s, saltabile). */
export const SPACE_DESTRUCTION_CUES: CaptionCue[] = [
  { at: 3.6, hold: 2.6, line: { speaker: 'Checco', text: 'Il film… è finito?' } },
  { at: 6.2, hold: 3.4, line: { speaker: 'narratore', text: 'Il raggio taglia la nave madre in due. La navicella di Eve, senza più spinta, cade.' } },
  { at: 9.8, hold: 2.4, line: { speaker: 'Checco', text: 'Buen… camino.' } }
];
