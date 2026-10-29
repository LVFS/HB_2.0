// Posizioni di messa in scena dell'esterno dell'Ariston (X di mondo; la mappa sta in `game/levels/Level1/level1Config.ts`, qui solo i dati che
// leggono anche gli store). TODO_LDTK: sostituire con la lettura da LDtk se la pipeline arriverà anche al livello laterale.
// L'ingresso nel cinema NON è più un trigger di cammino: si entra premendo «interagisci» sulla porta centrale (zona in level1Config).
export const LEVEL1_TRIGGERS_PLACEHOLDER = {
  // Le X sono px/54 dell'immagine di sfondo (`BACKDROP_PX_PER_UNIT` in level1Config.ts).
  startX: 1910 / 54, // D all'inizio del livello: all'estremità destra del marciapiede, rivolto verso il cinema
  eveStartX: 1980 / 54, // Eve accanto/dietro a D (alla sua destra: guardano a sinistra)
  // Uscendo dall'interno isometrico (vedi Level1Interior/SceneManager2DIso.tsx) D riappare qui, davanti alla porta ma FUORI dalla zona
  // d'interazione: altrimenti comparirebbe subito il suggerimento «Entra».
  aristonExitX: 1200 / 54,
  sala1EntranceX: 30 // ingresso sala 1, avvia dialogo_pre_boss → boss_fase1 (non letto da nessuno: la porta sta nell'interno)
} as const;
