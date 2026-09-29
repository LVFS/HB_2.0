// Dialogo della scena di apertura del Livello 1 (Fase 4 del piano, vedi
// docs/PIANO_LIVELLO1_2D.md) — contenuto vero, non segnaposto. Stesso
// principio di `data/levels.ts`: un array ordinato, letto da `useDialogue`.
// Battute scritte per restare nel tono "scoglionato": D subisce la
// situazione con fastidio e ironia, non urla eroicamente; Eve resta seria/
// quasi burocratica per contrasto comico.

export type DialogueSpeaker = 'D' | 'Eve' | 'narratore';

export interface DialogueLine {
  speaker: DialogueSpeaker;
  text: string;
}

export const LEVEL1_INTRO_DIALOGUE: DialogueLine[] = [
  { speaker: 'narratore', text: 'Fuori dal Cinema Ariston. Sera.' },
  { speaker: 'D', text: 'Ecco, fantastico. Un altro sabato sera speso così.' },
  { speaker: 'D', text: 'Mannaggia a te, Checco Zalone. Sempre tu, ogni volta.' },
  { speaker: 'D', text: '"Buen camino" per la millesima volta. Ormai lo recito a memoria pure io.' },
  { speaker: 'narratore', text: 'Un bagliore attraversa il cielo. Qualcosa atterra in fondo alla strada.' },
  { speaker: 'D', text: 'Oh wow, questa proprio non me la aspettavo!' },
  { speaker: 'Eve', text: "Tu sei l'unico registrato in questa zona compatibile con l'interfaccia da combattimento. Bene." },
  { speaker: 'D', text: 'Scusa, compatibile con... cosa, esattamente?' },
  { speaker: 'Eve', text: 'Sono stata inviata per fermare la piaga di Buen Camino. Si sta propagando oltre i confini previsti. Mi serve il tuo aiuto.' },
  { speaker: 'D', text: "Aspetta, \"piaga\"? È un film, non un'epidemia." },
  { speaker: 'Eve', text: 'Non più da un pezzo. Prendi questa.' },
  { speaker: 'narratore', text: 'Eve porge una spada. D la prende, ancora visibilmente poco convinto.' },
  { speaker: 'D', text: 'Va bene, va bene. Sto al gioco. Non pensavo sarebbe mai arrivata un\'occasione simile.' }
];
