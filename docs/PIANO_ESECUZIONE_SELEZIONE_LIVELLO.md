# Piano di esecuzione: selezione mappa/livello (A + B + C + D, a piccoli passi)

Confermato: si fa tutto (A, B, C, D), ma UNA fase alla volta, ognuna verificata prima di
passare alla successiva — nessuna fase dipende dal codice non ancora scritto di
un'altra, quindi si può fermarsi dopo ognuna senza lasciare nulla a metà.

Prima di scrivere questo piano ho riletto anche `ui.module.css`/`LevelListOverlay.module.css`
per la Fase 1: nella prima proposta avevo suggerito di dare alle card livello il taglio
diagonale dei pannelli — sbagliato, il codice lo esclude ESPLICITAMENTE apposta ("Voce di
livello. Non usa `ui.button` né la sagoma smussata dei pannelli: è una RIGA DI ELENCO",
`LevelListOverlay.module.css` riga 49-52). Quella regola resta, la Fase 1 sotto la
rispetta invece di scavalcarla.

## Ordine consigliato e perché

1. **C** — solo CSS/JSX in un file, zero rischio sulla scena 3D, il colpo d'occhio più
   immediato per lo sforzo minore. Primo passo naturale.
2. **D** — additivo nello stesso pannello di C, non tocca navigazione/stato esistente.
3. **A (soluzione ponte)** — tocca Blender + `LevelMarker.tsx`, ma è isolato (un solo
   componente, nessuna dipendenza dalle fasi precedenti).
4. **B, piccolo passo** — solo `CloudTransition.tsx`, isolato dal resto.
5. **B, passo grande** (isole multiple + volo camera) e **A, soluzione definitiva**
   (modelli veri per Silì/Cagliari) restano FUORI da questo piano — sono il lavoro più
   grosso e strutturale dei quattro, meglio pianificarli a parte quando le fasi 1-4 sono
   confermate a schermo e (per B grande) dopo la Fase 1 del piano di caricamento asset
   di cui abbiamo già parlato, altrimenti tre isole texturizzate insieme aggravano
   proprio quel problema.

Si esegue una fase, si guarda a schermo, si conferma, si passa alla prossima — stesso
principio già usato per il resto del progetto.

---

## Fase 1 (= proposta C) — identità visiva dei mondi nella lista

*Sei un esperto di design system e CSS per interfacce di gioco.*

**Problema concreto**: `worldRow` (`LevelListOverlay.tsx` righe 66-81) mostra tre
pulsanti che sono solo testo — "Oristano", "Silì", "Cagliari" — senza nessun legame
visivo con i colori (`level.color`) già assegnati a ciascun livello in `data/levels.ts`
e già usati sul marker 3D (cristallo, anello a terra). Il pannello 2D e la scena 3D
oggi non condividono questo linguaggio.

**Cosa fare**: aggiungere un piccolo indicatore di identità (un pallino/LED, non un
riempimento colorato del pulsante intero — i token sono espliciti sul fatto che
l'ambra è l'UNICO accento d'azione e l'acciaio è l'UNICO accento di stato, quindi un
terzo colore per riga va usato con parsimonia, come "etichetta", mai come sfondo
pieno del pulsante) accanto al nome di ogni mondo, dello stesso colore del livello.

In `LevelListOverlay.tsx`, dentro il `.map` di `worlds` (riga 67-80):

```tsx
{worlds.map((world, index) => {
  const worldLevel = getWorldLevel(world.id);
  return (
    <button
      key={world.id}
      type="button"
      className={`${ui.secondary} ${styles.worldButton} ${index === focusedWorldIndex ? styles.worldButtonFocused : ''}`}
      aria-pressed={world.id === activeWorldId}
      onClick={() => {
        setFocusedWorldIndex(index);
        onSelectWorld(world.id);
      }}
    >
      {worldLevel && <span className={styles.worldDot} style={{ background: worldLevel.color }} aria-hidden="true" />}
      {world.name}
    </button>
  );
})}
```

In `LevelListOverlay.module.css`, aggiungere:

```css
.worldDot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  margin-right: var(--space-1);
  vertical-align: middle;
}
```

`getWorldLevel` esiste già in `data/levels.ts` (usato altrove nel file), va solo
importato in `LevelListOverlay.tsx`.

**Fatto quando**: ogni pulsante mondo ha un piccolo pallino del colore del suo livello,
senza cambiare la struttura a bottoni/il layout esistente.

## Fase 2 (= proposta D) — percorso visivo tra le tre città

*Sei un esperto di UX per la progressione del giocatore in interfacce di gioco.*

**Problema concreto**: `data/levels.ts` ha già `order` (1, 2, 3) e la logica di sblocco
progressivo (`isLevelUnlocked`), ma `worldRow` mostra i tre mondi come pulsanti
equivalenti — nessun segno che siano tappe in sequenza di un viaggio reale
(Oristano→Silì→Cagliari).

**Cosa fare**: sostituire la semplice `flex` row (`worldRow`) con una fila che include
una linea di collegamento tra i pulsanti, ordinata per `level.order` invece che per
l'ordine dell'array `worlds` (oggi coincidono, ma ordinare esplicitamente evita un bug
futuro se cambia `worlds`). Tenerla semplice: un separatore CSS tra i pulsanti (una
linea sottile, colore `--line` a riposo e `--steel` se il mondo a sinistra è
completato) invece di un componente SVG/mappa a parte — coerente con "squadrato, non
capsule" già stabilito nel sistema, niente di nuovo da inventare.

In `LevelListOverlay.module.css`:

```css
.worldRow {
  display: flex;
  align-items: center;
  gap: 0;
}

.worldButton {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  font-size: 0.78rem;
}

.worldConnector {
  flex: 0 0 var(--space-3);
  height: 2px;
  background: var(--line);
}

.worldConnectorCompleted {
  background: var(--steel);
}
```

In `LevelListOverlay.tsx`, interponendo un connettore tra i bottoni (serve ordinare i
mondi per `order` del loro livello — usare `getWorldLevel(world.id)?.order` come chiave
di sort, con fallback se un mondo non ha ancora livelli):

```tsx
const orderedWorlds = useMemo(
  () => [...worlds].sort((a, b) => (getWorldLevel(a.id)?.order ?? 0) - (getWorldLevel(b.id)?.order ?? 0)),
  []
);
```

e nel render, tra un `<button>` e il successivo:

```tsx
{index > 0 && (
  <span
    className={`${styles.worldConnector} ${isWorldCompleted(orderedWorlds[index - 1]) ? styles.worldConnectorCompleted : ''}`}
    aria-hidden="true"
  />
)}
```

(`isWorldCompleted` è una piccola funzione locale: il livello di quel mondo è tra
`completedLevelIds`.)

**Attenzione controller**: `useGamepadCycleSelect` cicla per INDICE (`focusedWorldIndex`
su `worlds`, riga 33-58) — se si introduce `orderedWorlds`, il ciclo da controller deve
scorrere sullo stesso array ordinato, altrimenti L1/R1 e il connettore visivo
racconterebbero due sequenze diverse. Va aggiornato insieme, non lasciato indietro.

**Fatto quando**: i tre pulsanti mondo sono uniti da un filo visivo che si "accende"
(steel) man mano che si completano i mondi precedenti, il ciclo da controller segue lo
stesso ordine.

## Fase 3 (= proposta A, soluzione ponte) — marker placeholder più curato

*Sei un esperto di modellazione procedurale in Blender e integrazione asset in Three.js.*

**Problema concreto**: `PlaceholderModel` (`LevelMarker.tsx` righe 79-91) è un cilindro
colorato pieno con un cartello di testo sopra — usato oggi per Silì e Cagliari, stona
vicino all'Ariston rifinito.

**Cosa fare** (senza ancora costruire un edificio vero per luogo, quello resta la
"soluzione definitiva" fuori da questo piano): sostituire SOLO la geometria/materiale
del placeholder con qualcosa che riprenda il linguaggio del pin (ottaedro sfaccettato,
bagliore, non un cilindro pieno) — un piccolo modello Blender procedurale (o anche
codice puro, tipo `<octahedronGeometry>` scalato più grande con materiale emissivo),
mantenendo lo stesso `level.color`/testo sopra che già funzionano.

Punto di attenzione: `PlaceholderModel` oggi è dichiarato "INVARIATO, non toccato in
questo giro" nei commenti sia di `LevelMarker.tsx` (riga 77-78) sia di `LevelMapScene`
— quei commenti vanno aggiornati quando si tocca davvero il componente, altrimenti il
prossimo che legge il codice si fida di un commento ormai falso (lo stesso principio
già seguito nel resto del progetto).

**Fatto quando**: Silì e Cagliari mostrano da lontano un marker che si legge come
"fratello" del cristallo del pin invece di un cilindro generico, senza toccare
`CinemaAristonModel` né la logica di swap per distanza.

## Fase 4 (= proposta B, piccolo passo) — transizione tra mondi più "spaziale"

*Sei un esperto di animazione GSAP e composizione visiva per transizioni di scena.*

**Problema concreto**: `CloudTransition.tsx` copre/scopre con nuvole, ma il resto della
scena (stelle, pianeta lontano) non partecipa: la transizione si legge come "velo
generico" più che "salto nello spazio" tra due luoghi reali.

**Cosa fare**: aggiungere, dietro il velo di nuvole e prima di `onCovered()`, un breve
effetto di stelle/particelle che sfrecciano verso il centro (parallasse veloce) — un
layer aggiuntivo in `CloudTransition.module.css`/`.tsx`, sulla stessa timeline GSAP già
esistente (righe 114-155), senza toccare la logica di copertura/`onCovered`/`onCleared`
che già funziona.

**Fatto quando**: la transizione si sente più come "volare da un luogo all'altro" senza
cambiare la durata complessiva né il contratto (`trigger`/`onCovered`/`onCleared`) che
`LevelSelectScene.tsx` già usa.

---

## Cosa resta fuori (di proposito) e quando riparlarne

- **A, soluzione definitiva** (modelli Blender veri per Silì e Cagliari): quando vuoi,
  è lavoro di modellazione puro, non tocca altro codice — possiamo farlo in una sessione
  Blender dedicata come per l'Ariston/la creatura.
- **B, passo grande** (isole multiple in una sola scena + camera che vola fisicamente
  tra loro): il pezzo più ambizioso e strutturale — merita un piano suo, e ha senso
  affrontarlo dopo aver verificato la Fase 1 del piano di caricamento asset (altrimenti
  tre isole texturizzate insieme peggiorano proprio lo scatto di cui ci siamo occupati).

Procedo con la Fase 1 quando mi dai il via, oppure fammi sapere se vuoi cambiare
l'ordine.
