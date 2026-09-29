# Attività stupide + dialogo pre-boss — contenuto per continuare la catena di fasi

Stesso principio delle volte scorse: qui sotto trovi contenuto vero (battute, non
segnaposto) pronto da dare in pasto a VS Code, con una nota tecnica su come agganciarlo.
A differenza dei documenti precedenti però questo è più "scrittura comica" che
"architettura" — sono partito da un\'idea concreta apposta per darti qualcosa di facile da
correggere, ma se hai già gag/battute tue in mente (o riferimenti interni/private jokes),
questo è IL posto giusto per usarle: sostituisci pure il mio testo, la struttura sotto
resta identica.

## `attivita_stupide` — due attività, non bloccanti

Proposta: nessuna delle due è obbligatoria per proseguire verso `sala1EntranceX` — sono
puro sapore comico, coerente con "attività a caso... stupide" dello storyboard. Se le rendi
obbligatorie invece serve un contatore tipo `collectedIds` (stesso pattern già usato per i
frammenti nel vecchio MVP) — ma io partirei da non bloccanti, più semplice e meno rischio
di soft-lock se un giocatore le salta.

```ts
// src/data/dialogues/level1_activities.ts
export const ACTIVITY_BIGLIETTI: DialogueLine[] = [
  { speaker: 'narratore', text: 'Una cassa automatica per i biglietti, lampeggiante.' },
  { speaker: 'D', text: 'Va bene, semplice. Schermo touch, due tap e via.' },
  { speaker: 'narratore', text: 'Lo schermo si blocca su "Caricamento...". Da tre minuti buoni.' },
  { speaker: 'D', text: 'Dai. Dai!' },
  { speaker: 'narratore', text: 'Il biglietto esce. È per uno spettacolo di tre settimane fa, sala 4, fila Z.' },
  { speaker: 'D', text: 'Perfetto. Esattamente quello che serviva stasera.' },
]

export const ACTIVITY_POPCORN: DialogueLine[] = [
  { speaker: 'narratore', text: 'Al bancone, un cartellone con dodici gusti e un sistema di sconti indecifrabile.' },
  { speaker: 'Commesso', text: 'Medio, grande, o "esperienza family gigante plus"?' },
  { speaker: 'D', text: 'Prendo il piccolo.' },
  { speaker: 'Commesso', text: 'Non esiste il piccolo.' },
  { speaker: 'D', text: '...Allora il medio.' },
  { speaker: 'Commesso', text: 'Il medio è finito.' },
  { speaker: 'D', text: 'Va bene, quello che c\'è.' },
  { speaker: 'narratore', text: 'Arriva un secchio di popcorn più grande di Eve.' },
]
```

Nuovo `speaker: 'Commesso'` da aggiungere al tipo `DialogueLine` esistente (`'D' | 'Eve' |
'narratore'` → `+ 'Commesso'`), nessun ritratto dedicato necessario, il nome basta.

Meccanica: due trigger `useXTrigger` in più (stesso hook già scritto per `sala1EntranceX`
ecc.), posizionati vicino a due elementi di sfondo (cassa/bancone — anche solo due sprite
segnaposto per ora, l\'arredo vero arriva con l\'arte della stanza), ognuno avvia la sua
`DialogueBox` una volta sola (stesso `useDialogue` già scritto), poi torna a
`cammino_libero_ariston`/`attivita_stupide` senza cambiare fase in modo permanente.

## `dialogo_pre_boss` — prima apparizione di Checco Zalone

```ts
// src/data/dialogues/level1_preboss.ts
export const LEVEL1_PREBOSS_DIALOGUE: DialogueLine[] = [
  { speaker: 'narratore', text: 'Sala 1. Sul mega schermo, Checco Zalone si blocca a metà di una battuta e si volta verso la sala.' },
  { speaker: 'Checco', text: 'Aspetta, aspetta. Fermate tutto un secondo.' },
  { speaker: 'Checco', text: 'Tu. Sì, proprio tu in terza fila. Ti ho visto entrare con la spada.' },
  { speaker: 'D', text: 'Ehm.' },
  { speaker: 'Checco', text: 'Guarda che io le battute le porto avanti a tutti i costi, eh. Anche stasera.' },
  { speaker: 'Eve', text: 'Rilevata anomalia dimensionale dietro lo schermo. Non è un attore. È un nodo.' },
  { speaker: 'Checco', text: '"Nodo"? Io sono un fenomeno, al massimo.' },
  { speaker: 'Checco', text: 'Comunque. Se volete passare la serata in pace, prima dovete sentire come va a finire il film.' },
  { speaker: 'D', text: 'Preferirei di no.' },
  { speaker: 'Checco', text: 'Neanche io preferirei. Ma tant\'è.' },
  { speaker: 'narratore', text: 'Lo schermo si spacca. Checco ne esce, decisamente più grande del previsto.' },
]
```

Scritte apposta senza citare battute vere del film (restano una parodia originale, non una
riproduzione) — se vuoi invece proprio citare qualcosa di riconoscibile, dimmi tu quale
riga e la sistemo, ma meglio deciderlo consapevolmente piuttosto che finirci per inerzia.
Al termine, `setPhase('boss_fase1')`.

## Prossimo bivio reale: LDtk prima di continuare oltre `boss_fase1`

Fin qui i trigger segnaposto sono costati poco (avete già dovuto allargare
`WORLD_HALF_WIDTH` una volta per farci stare `sala1EntranceX`). La stanza del boss però è
quella che avevate già sketchato a mano (piantina Piano Terra/Primo Piano, con la sala
vera e propria) — è il punto in cui continuare a tirare a indovinare le coordinate inizia
a costare più che disegnarle. Consiglio: prima di scrivere `boss_fase1` per davvero, vale
la pena fare la Fase 2 (LDtk) almeno per la stanza del boss — il resto (attività, corridoio
d\'ingresso) può restare a segnaposto ancora per un po\' senza problemi.
