// Dialogo del finale a terra (FASE 12, fase `dialogo_finale`): D raggiunge Eve accanto alla navicella schiantata,
// la ringrazia, e lei risponde che una collaborazione fra loro non può funzionare. La storia è fissa: gli esiti
// di spazio (`levelStore.spaceResult`) e dei QTE cambiano SOLO due righe. Battute sostituibili.

import type { DialogueLine } from './level1_intro';

/** Dal supporto a Eve in su (0-1) il suo aiuto è stato «accettabile». */
export const GOOD_SUPPORT_AT = 0.6;
/** Dalla carica del cannone in su (0-1) il colpo è stato «pulito» (sotto, il cannone è partito forzato). */
export const GOOD_CANNON_AT = 0.7;

interface FinaleOutcome {
  support: number;
  cannon: number;
}

export function wasSpaceGood(result: FinaleOutcome | null): boolean {
  return result !== null && result.support >= GOOD_SUPPORT_AT && result.cannon >= GOOD_CANNON_AT;
}

/** La battuta su come è andato il supporto di D, e la riga sul cannone: le due che cambiano. */
export function getFinalDialogue(result: FinaleOutcome | null): DialogueLine[] {
  const good = wasSpaceGood(result);
  const cannonLine: DialogueLine =
    result !== null && result.cannon >= GOOD_CANNON_AT
      ? { speaker: 'D', text: 'Cioè? Ho appena caricato un cannone da casa mia.' }
      : { speaker: 'D', text: 'Cioè? Il cannone è partito quasi da solo, ma insomma, c’ero anch’io.' };
  return [
    { speaker: 'narratore', text: 'Un campo. Una navicella conficcata nel terreno. Del fumo.' },
    { speaker: 'D', text: 'Eve! Eve, ci sei?' },
    { speaker: 'Eve', text: 'Presente. Danni: ragionevoli. Dignità: variabile.' },
    { speaker: 'D', text: 'Ti ringrazio. Davvero. Senza di te… sarei ancora in coda ai popcorn.' },
    good
      ? { speaker: 'Eve', text: 'Il tuo supporto è stato… accettabile.' }
      : { speaker: 'Eve', text: 'Il tuo supporto è stato… presente.' },
    { speaker: 'Eve', text: 'Devo informarti che una collaborazione fra noi non può funzionare.' },
    cannonLine,
    { speaker: 'Eve', text: 'Indice di imprevisti: cento per cento. Non è un’insinuazione. È una statistica.' },
    { speaker: 'D', text: 'Beh. Grazie del… sincero.' },
    { speaker: 'narratore', text: 'Eve si allontana verso il sole che sorge. D resta lì, con la spada in mano e l’aria di uno a cui hanno dato un voto basso.' }
  ];
}
