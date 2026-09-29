// Tipi minimi per il sottoinsieme del formato LDtk che il gioco legge
// davvero (vedi docs/PIANO_LIVELLO1_2D.md, sezione Fase 5, e il piano di
// handoff Ariston interno): un IntGrid per i muri/pavimento e un layer
// Entities per marker puntuali. Il file `.ldtk` contiene molti altri campi
// (tileset, auto-layer, enum, ecc.) che qui non servono e non sono tipizzati.

export interface LdtkFieldInstance {
  __identifier: string;
  __value: unknown;
}

export interface LdtkEntityInstance {
  __identifier: string;
  /** Colonna/riga del pivot (in alto a sinistra per pivot [0,0], il default
   *  usato in questo progetto) nella griglia del layer, non pixel. */
  __grid: [number, number];
  /** Ingombro dell'entità in PIXEL (non celle): 16x16 per la maggior parte,
   *  ma es. 64x16 per `Door_horizontal_4pz` — serve per centrare
   *  correttamente le entità più larghe di una cella (vedi
   *  `parseLevelGeometry.ts`). */
  width: number;
  height: number;
  fieldInstances: LdtkFieldInstance[];
}

export interface LdtkLayerInstance {
  __identifier: string;
  __type: string;
  __cWid: number;
  __cHei: number;
  __gridSize: number;
  /** Presente solo sui layer IntGrid; vuoto altrove. */
  intGridCsv: number[];
  /** Presente solo sui layer Entities; vuoto altrove. */
  entityInstances: LdtkEntityInstance[];
}

export interface LdtkLevel {
  identifier: string;
  layerInstances: LdtkLayerInstance[];
}

export interface LdtkProject {
  levels: LdtkLevel[];
}
