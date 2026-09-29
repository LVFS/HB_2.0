// TODO_LDTK: sostituire con lettura da LDtk quando la Fase 2 del piano
// (docs/PIANO_LIVELLO1_2D.md) è pronta. Numeri onestamente a caso, da
// tarare a occhio quando c'è davvero qualcosa da camminarci sopra — quello
// che conta è che il codice che li legge (Fase 4) sia già quello
// definitivo: il cambio, quando arriveranno le coordinate vere, sarà di
// questo file solo, dati, zero logica da riscrivere.
export const LEVEL1_TRIGGERS_PLACEHOLDER = {
  eveArrivalX: 6, // punto in cui D incontra Eve, avvia intro_dialogo → cammino_libero
  aristonEntranceX: 22, // ingresso edificio, avvia attivita_stupide
  // Uscendo dall'interno isometrico (vedi Level1Interior/SceneManager2DIso.tsx)
  // D riappare qui, non esattamente su `aristonEntranceX`: altrimenti
  // rientrerebbe subito nel trigger d'ingresso appena tornato fuori.
  aristonExitX: 20,
  sala1EntranceX: 30 // ingresso sala 1, avvia dialogo_pre_boss → boss_fase1
} as const;
