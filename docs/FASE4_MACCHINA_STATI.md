# Fase 4 (scheletro) — macchina a stati del Livello 1 + prima scena scritta

Come per la Fase 3, questo è specifica + contenuto, non codice — lo implementi tu/VS Code.

## Perché partire da qui invece che aspettare LDtk (Fase 2)

Il piano originale mette Fase 4 dopo Fase 2, perché in teoria usa i dati veri delle stanze.
Ma il principio guida di tutto il progetto finora è stato "scheletro con segnaposto prima,
contenuto vero dopo" (è così che è stato costruito il menu, ed è così che avete fatto la
Fase 1). Quindi propongo di costruire ORA lo scheletro della macchina a stati con zone di
trigger segnaposto (coordinate scritte a mano, marcate `TODO_LDTK`), cablare la prima
scena con dialoghi VERI (sotto), e giocare il primo pezzo del livello per intero prima che
tu tocchi LDtk. Quando la Fase 2 sarà pronta, si sostituiscono le coordinate segnaposto con
quelle vere lette dal JSON — il resto (macchina a stati, dialoghi, trigger) non cambia.
Se preferisci comunque partire da LDtk prima, va bene lo stesso: sono le due metà del
piano già pensate per stare in parallelo, nessuna delle due blocca l'altra.

## La macchina a stati (stessa lista già concordata nel piano originale)

```ts
type LevelPhase =
  | 'intro_dialogo'
  | 'cammino_libero_ariston'
  | 'attivita_stupide'
  | 'dialogo_pre_boss'
  | 'boss_fase1'
  | 'transizione_seconda_spada'
  | 'boss_fase2_tunnel'
  | 'combo_doppia_spada_qte'
  | 'fuga_checco'
  | 'inseguimento_spaziale_cutscene'
  | 'qte_supporto_eve'
  | 'carica_cannone_qte'
  | 'dialogo_finale'
  | 'schermata_punteggio'
```

Stesso principio di `MenuPhase`: uno stato Zustand (`levelStore.ts`, nuovo file, separato
da `gameStore.ts` che resta per fase/schermata globale) con `phase: LevelPhase` +
`setPhase(next)`, letto da `SceneManager2D` per decidere cosa montare. Ogni fase monta
esattamente i componenti che le servono (dialogo, boss, tunnel, ecc.) — non un unico
componente gigante con `if` a cascata.

## Trigger segnaposto (da sostituire con LDtk in Fase 2)

```ts
// src/data/level1/triggers.ts — TODO_LDTK: sostituire con lettura da LDtk quando pronto
export const LEVEL1_TRIGGERS_PLACEHOLDER = {
  eveArrivalX: 6,       // punto in cui D incontra Eve, avvia intro_dialogo → cammino_libero
  aristonEntranceX: 22, // ingresso edificio, avvia attivita_stupide
  sala1EntranceX: 30,   // ingresso sala 1, avvia dialogo_pre_boss → boss_fase1
} as const
```

Numeri onestamente a caso (da tarare a occhio quando c'è davvero qualcosa da camminarci
sopra) — l'importante è che il CODICE che li legge sia già quello definitivo, così quando
arrivano le coordinate vere da LDtk il cambio è di un file solo, dati, zero logica da
riscrivere.

## Dialogo scena di apertura (contenuto vero, pronto da usare)

Formato dati, stesso principio di `data/levels.ts` — un array ordinato, `speaker` per
scegliere il ritratto/nome in UI, avanzamento con `useAnyInput` già esistente:

```ts
// src/data/dialogues/level1_intro.ts
export type DialogueLine = { speaker: 'D' | 'Eve' | 'narratore'; text: string }

export const LEVEL1_INTRO_DIALOGUE: DialogueLine[] = [
  { speaker: 'narratore', text: 'Fuori dal Cinema Ariston. Sera.' },
  { speaker: 'D', text: 'Ecco, fantastico. Un altro sabato sera speso così.' },
  { speaker: 'D', text: 'Mannaggia a te, Checco Zalone. Sempre tu, ogni volta.' },
  { speaker: 'D', text: '"Buen camino" per la millesima volta. Ormai lo recito a memoria pure io.' },
  { speaker: 'narratore', text: 'Un bagliore attraversa il cielo. Qualcosa atterra in fondo alla strada.' },
  { speaker: 'D', text: 'Eh no, questa proprio non me la aspettavo.' },
  { speaker: 'Eve', text: 'Tu sei l\'unico registrato in questa zona compatibile con l\'interfaccia da combattimento. Bene.' },
  { speaker: 'D', text: 'Scusa, compatibile con... cosa, esattamente?' },
  { speaker: 'Eve', text: 'Sono stata inviata per fermare la piaga di Buen Camino. Si sta propagando oltre i confini previsti. Mi serve il tuo aiuto.' },
  { speaker: 'D', text: 'Aspetta, "piaga"? È un film, non un\'epidemia.' },
  { speaker: 'Eve', text: 'Non più da un pezzo. Prendi questa.' },
  { speaker: 'narratore', text: 'Eve porge una spada. D la prende, ancora visibilmente poco convinto.' },
  { speaker: 'D', text: 'Va bene, va bene. Tanto stasera non avevo altri piani.' },
]
```

Battute scritte per restare nel tono "scoglionato" richiesto — D non urla eroicamente,
subisce la situazione con fastidio e ironia, Eve resta seria/quasi burocratica per
contrasto comico. Da leggere ad alta voce prima di implementarle: se qualche riga non
suona come la volevi, è testo puro, si cambia in due secondi senza toccare nessun codice.

## Cosa serve dal codice per far girare questo

- `useDialogue(lines: DialogueLine[])`: hook che avanza una riga per pressione
  (`useAnyInput`), espone `currentLine`, `isDone`.
- `DialogueBox.tsx`: overlay HTML (non dentro `<Canvas>`, stesso motivo del video di salto
  nel menu — è testo, non ha senso texturizzarlo in 3D/2D-scene), nome parlante + testo,
  CSS Modules coerente con `ui.module.css` esistente.
- `SceneManager2D` monta `DialogueBox` quando `phase` è uno stato "di dialogo"
  (`intro_dialogo`, `dialogo_pre_boss`, `dialogo_finale`), altrimenti monta il gameplay.
- Al termine di `LEVEL1_INTRO_DIALOGUE`, `setPhase('cammino_libero_ariston')` — da qui in
  poi il giocatore comanda D (`Player2D` già esistente) ed Eve lo segue (IA di
  compagnia — ancora da scrivere, segui-dietro con offset smorzato, come da piano
  originale: nessun pathfinding, il livello è lineare).

## Ordine consigliato per continuare

1. Wiring della macchina a stati + `DialogueBox` + questo dialogo vero → si gioca la primissima
   scena per intero, dall'inizio.
2. IA di compagnia di Eve (segui D) → si può camminare insieme verso l'Ariston.
3. Da lì, o LDtk (per rendere vera la stanza invece che uno sfondo vuoto), o le attività
   stupide, in qualunque ordine preferisci — sono indipendenti l'una dall'altra.
