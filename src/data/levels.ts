// Dati statici dei livelli: contenuto di gioco, non stato mutabile.
// Nello store resta solo il livello attualmente selezionato.

export interface LevelInfo {
  id: string;
  name: string;
  description: string;
  position: [number, number, number];
  color: string;
}

export const levels: LevelInfo[] = [
  {
    id: 'forest',
    name: 'Bosco delle Luci',
    description: 'Una valle incantata tra alberi luminescenti e antiche rovine.',
    position: [-6, 0, -3],
    color: '#86efac'
  },
  {
    id: 'cliff',
    name: 'Falesia Ventosa',
    description: 'Un altopiano battuto dal vento con punti panoramici e segreti.',
    position: [3, 0, -5],
    color: '#7dd3fc'
  },
  {
    id: 'flame',
    name: 'Pianura Fiammeggiante',
    description: 'Una distesa bruciata dove il fuoco guida il percorso.',
    position: [6, 0, 4],
    color: '#fb7185'
  }
];
