// Dialogo del Sotterraneo (fase `transizione_seconda_spada`): dopo il finale
// del boss D è caduto sotto il piano terra, Eve è rimasta di sopra, e gli dà
// "un'altra spada". Stesso tono della scena di apertura (D scoglionato, Eve
// seria/quasi burocratica). Una riga cambia con l'esito del QTE cooperativo
// del finale (`levelStore.finalQteSuccess`): è tutta la differenza narrativa,
// la storia resta identica.

import type { DialogueLine } from './level1_intro';

const COORDINATION_GOOD: DialogueLine[] = [
  { speaker: 'Eve', text: 'Coordinazione sul finale: eccellente. Annotato.' },
  { speaker: 'D', text: 'Bel colpo di squadra, eh. Peccato per la parte in cui ci ha lanciati come stracci.' }
];

const COORDINATION_BAD: DialogueLine[] = [
  { speaker: 'Eve', text: 'Coordinazione sul finale: insufficiente. Ne riparleremo.' },
  { speaker: 'D', text: "Ce l'abbiamo fatta lo stesso, no? Più o meno. Diciamo che gli siamo arrivati addosso." }
];

export function getSecondSwordDialogue(qteSuccess: boolean | null): DialogueLine[] {
  const coordination = qteSuccess === false ? COORDINATION_BAD : COORDINATION_GOOD;
  return [
    { speaker: 'narratore', text: 'Sotto il Cinema Ariston. Buio, polvere, pezzi di sala. Un varco di luce, in alto.' },
    { speaker: 'D', text: 'Ahia. Ahia. Ahia. Mi ha scaraventato come una... come una bambola. Di legno. Ma cosa gli danno da mangiare?' },
    { speaker: 'Eve', text: 'D. Segnali vitali: presenti. Danni: accettabili. Rispondi.' },
    { speaker: 'D', text: 'Grazie della premura. Dove sei?' },
    { speaker: 'Eve', text: 'Al piano di sopra. Il crollo ha diviso la sala: tu sei sotto, la mia sezione è bloccata. Nessun passaggio diretto.' },
    ...coordination,
    { speaker: 'Eve', text: 'Checco si è ritirato attraverso la rete di servizio. Un tunnel. Devi seguirlo: ti raggiungo appena libero il passaggio.' },
    { speaker: 'D', text: 'Io? Da solo? Sotto terra, al buio, dietro a quella cosa di legno?' },
    { speaker: 'Eve', text: 'Prendi questa. Seconda lama, calibrata sulla tua. Ti servirà.' },
    { speaker: 'narratore', text: 'Una spada scivola giù dal varco. D la afferra al volo.' },
    { speaker: 'D', text: 'Un\'altra spada. Perfetto. Fra poco apro una collezione.' },
    { speaker: 'Eve', text: 'Vai. E, D: non farti ammazzare. Sei ancora l\'unico compatibile.' }
  ];
}
