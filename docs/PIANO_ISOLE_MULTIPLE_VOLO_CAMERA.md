# Piano di esecuzione: isole multiple + camera che vola (B, passo grande)

Prima di scrivere questo piano ho riletto TUTTO il codice attuale di `LevelMapScene.tsx`,
`CameraRig`, `CloudTransition.tsx`, `LevelSelectScene.tsx`, `LevelMarker.tsx`,
`assetPreload.ts` e `mapProjection.ts` — non a memoria: dall'ultimo piano è cambiato
parecchio (Fasi 1-4 della selezione livello E la Fase 1 del piano di caricamento asset
sono ENTRAMBE già implementate: `worldDot`, `worldConnector`, marker-ottaedro per
Silì/Cagliari, scia di stelle nella transizione, e soprattutto le mappe sono già state
convertite in `.webp` — `oristano-ariston.webp` 1.5MB, `cagliari-bastione.webp` 1.2MB,
`sili.webp` 0.8MB, contro i 20+MB delle PNG originali). Questo È la premessa che sblocca
B-grande: la nota nel piano precedente ("tre isole texturizzate insieme aggravano lo
scatto") non vale più, il totale delle tre mappe insieme (~3.5MB) è ora comparabile a
UNA sola mappa PNG di prima.

**Scoperta utile prima di dettagliare le fasi**: buona parte del "volo della camera" è
già involontariamente pronta. Oggi `CameraRig` (`LevelMapScene.tsx` righe 683-808) non
viene MAI rimontato quando cambia `level` (nessun `key` su di lui) — il suo
`useEffect` alle righe 700-720 rilancia già un tween GSAP verso la nuova
`cameraFarPosition` ogni volta che `geometry` (derivata da `level`) cambia. Il motivo
per cui oggi questo non si vede come un "volo" è che (a) le isole sono tutte centrate
sulla stessa origine `[0,0,0]` — cambiare livello sposta solo la DISTANZA della camera,
mai la posizione laterale — e (b) `CloudTransition` copre lo schermo proprio mentre
questo tween gira, quindi anche se viaggiasse lateralmente non lo vedresti. Il lavoro
vero di questo piano non è "inventare un volo", è: dare a ogni isola una posizione
propria nello spazio, tenerle **tutte montate insieme** invece di sostituirle una
alla volta, e togliere di mezzo il velo che oggi nasconde il tween che già esiste.

## Decisioni da confermare (impatto visivo diretto, non solo tecnico)

1. **Disposizione delle isole**: userei un arco leggero (non allineate su una riga
   dritta) ordinato per `level.order` (Oristano→Silì→Cagliari), con la distanza tra due
   isole vicine proporzionale alla LORO dimensione (`mapGrid`) invece che alla distanza
   reale in km — Silì è a ~5km da Oristano ma Cagliari a ~95km: usare le distanze reali
   creerebbe o isole quasi sovrapposte o un volo di minuti. È una scelta stilizzata,
   nello stesso spirito del contorno procedurale delle isole (deterministico ma non
   cartograficamente fedele) — se preferisci mantenere una proporzione (anche
   compressa/logaritmica) rispetto alla distanza reale, dimmelo prima della Fase 1.
2. **Cosa succede al velo di nuvole**: per vedere davvero il volo, il velo OPACO che
   oggi copre tutto lo schermo durante il cambio città non può più coprire tutto —
   altrimenti nascondi esattamente l'effetto che vuoi. Consiglio: tenere lo scatto di
   stelle (Fase 4 del piano precedente, già pronto) come "spinta" iniziale ma togliere
   il velo pieno per i cambi-mondo, lasciando la camera visibile mentre vola sopra lo
   spazio aperto tra le isole. La transizione capsula/impatto (tutt'altro meccanismo,
   `CapsuleSequence.tsx`) non è toccata da questo. Se preferisci un compromesso diverso
   (velo semitrasparente, o tenerlo com'è e rinunciare a vedere il volo), fammelo sapere
   — è l'unica parte di questo piano che è più una scelta di regia che un bug da
   correggere.

Il resto del piano assume le opzioni consigliate sopra; se cambi idea su una delle due
le Fasi 1-2 restano valide comunque, cambia solo la Fase 3.

## Fase 1 — Preparazione: geometria condivisa + layout delle isole

*Sei un esperto di architettura del codice per scene 3D basate su dati.*

**Nessun cambiamento visivo atteso in questo passo** — è un refactor puro più
l'aggiunta di dati non ancora usati da nessuno, verificabile solo controllando che la
build passi e la scena resti IDENTICA a schermo.

**Problema concreto**: `PLANE_SIZE_PER_TILE`, `TILE_SIZE_PX`, `MapGeometry`,
`getMapGeometry`, `CAMERA_FAR_TARGET`, `CAMERA_NEAR`, `MAX_POLAR_ANGLE` vivono oggi solo
dentro `LevelMapScene.tsx` (righe 30-108, 636-647). Per calcolare dove piazzare ogni
isola nello spazio serve la STESSA formula di `planeSize` usata per costruirla — la
duplicherei in un secondo file per errore esattamente nella classe di bug che i
commenti di questo stesso file segnalano già tre volte (vedi il commento sopra
`CAMERA_FAR_Y_RATIO`, riga 33-38: "bug reale preso tre volte... dimenticando di
riscalare camera/nebbia insieme quando cambiava PLANE_SIZE").

**Cosa fare**: estrarre quel blocco in un nuovo file `mapGeometry.ts` accanto a
`LevelMapScene.tsx`, con le stesse funzioni/costanti esportate; `LevelMapScene.tsx` le
importa invece di definirle. Poi un secondo file nuovo, `islandLayout.ts`, che calcola
UNA VOLTA (a livello di modulo, come `CLOUD_VARIANTS` in `CloudTransition.tsx`) la
posizione `[x, z]` di ogni isola, derivandola dalla stessa `getMapGeometry`:

```ts
// src/game/menu/levelSelect/islandLayout.ts
import { levels } from '@/data/levels';
import { getMapGeometry } from './mapGeometry';

/** Margine estra (unità mondo) tenuto tra il bordo di due isole vicine, oltre
 * alla somma dei loro raggi — tarato a vista, non calcolato: abbastanza largo
 * perché il volo tra due isole attraversi davvero uno spazio vuoto, non un
 * saltare da un bordo roccioso all'altro. */
const ISLAND_GAP = 40;

/** Curvatura dell'arco su cui si dispongono le isole in ordine — 0 = riga
 * dritta, valori più alti = arco più pronunciato. Frazione del raggio della
 * singola isola, non un valore assoluto, così la curva resta proporzionata
 * qualunque sia la dimensione delle isole coinvolte. */
const ARC_CURVATURE = 0.6;

/** Raggio massimo del contorno frastagliato di un'isola, come proxy del suo
 * "ingombro" — usa la stessa base di `ISLAND_BASE_RADIUS_RATIO`/armoniche di
 * `LevelMapScene.tsx` (picco moltiplicatore ~1.32 su `baseRadius = planeSize *
 * 0.34`, quindi ~0.45 * planeSize): planeSize/2 resta un margine leggermente
 * più ampio del picco reale, prudente per non far mai toccare due isole. */
function footprintRadius(planeSize: number): number {
  return planeSize / 2;
}

/**
 * Posizione `[x, z]` di ogni isola, calcolata una sola volta a livello di
 * modulo — deterministica come il contorno di `buildIslandShape`, non deriva
 * da nulla di casuale. Ordinate per `level.order` (il percorso reale
 * Oristano→Silì→Cagliari), non per l'ordine dell'array `levels` (che oggi
 * coincidono, ma non è garantito — stessa cautela già presa in
 * `LevelListOverlay.tsx` per `orderedWorlds`).
 */
export const islandOffsets: Record<string, readonly [number, number]> = (() => {
  const ordered = [...levels].sort((a, b) => a.order - b.order);
  const offsets: Record<string, readonly [number, number]> = {};
  let cursorX = 0;
  ordered.forEach((level, index) => {
    const radius = footprintRadius(getMapGeometry(level).planeSize);
    if (index === 0) {
      cursorX = 0;
    } else {
      const previous = ordered[index - 1];
      const previousRadius = footprintRadius(getMapGeometry(previous).planeSize);
      cursorX += previousRadius + ISLAND_GAP + radius;
    }
    const z = Math.sin(index * 0.9) * radius * ARC_CURVATURE;
    offsets[level.id] = [cursorX, z];
  });
  return offsets;
})();

export function getIslandOffset(levelId: string): readonly [number, number] {
  return islandOffsets[levelId] ?? [0, 0];
}
```

**Fatto quando**: `npm run build` (o il comando equivalente del progetto) passa senza
errori, il gioco a schermo è indistinguibile da prima — `islandOffsets` esiste ma non lo
consuma ancora nessuno.

## Fase 2 — Isole sempre montate, camera che vola davvero (il cuore del cambiamento)

*Sei un esperto di react-three-fiber e gestione di scene 3D con più elementi
persistenti.*

**Attenzione**: dopo questa fase il volo tra isole FUNZIONA a livello di camera/pan, ma
resta ancora nascosto dal velo di nuvole (lo togliamo in Fase 3) — di proposito,
per isolare eventuali bug di QUESTA fase (isole/camera) da quelli di CloudTransition.
Per verificarla comunque a schermo prima della Fase 3: puoi disattivare temporaneamente
la chiamata a `startCloudTransitionTo` in `LevelSelectScene.tsx` (o semplicemente
guardare la console/il pannello sviluppatore mentre il velo copre) per controllare che
la camera arrivi al posto giusto.

**Problema concreto**: oggi (`LevelMapScene.tsx` righe 933-985) SOLO l'isola/marker del
`level` corrente sono montati, con `key={level.id}` che li smonta e rimonta a ogni
cambio città — apposta, per risolvere bug reali di stato bloccato (vedi i commenti alle
righe 934-939, 968-980). `CityTexturePrewarm`/`HiddenCityTexture` (righe 397-435)
esistono solo per scaldare la GPU sulle texture delle città NON mostrate, con mesh
invisibili duplicate — un aggiramento che non serve più se le texture sono comunque
tutte visibili.

**Cosa fare**:

1. In `LevelMapScene.tsx`, sostituire il blocco che oggi renderizza UN solo
   coperchio/gonna/pancia/marker (righe 928-985) con un `.map(levels...)`, un
   `<group position={[offsetX, 0, offsetZ]}>` per isola, tutte montate insieme e mai
   smontate finché `LevelSelectScene` vive:

```tsx
{levels.map((mapLevel) => {
  const [offsetX, offsetZ] = getIslandOffset(mapLevel.id);
  const mapGeometry = getMapGeometry(mapLevel);
  const mapIsland = buildIslandGeometry(mapLevel, mapGeometry.planeSize); // vedi nota sotto sulla dispose
  const offset = projectToImageOffset(mapLevel.coordinates, mapLevel.coordinates, mapLevel.zoom);
  const localMarkerPosition = imageOffsetToPlanePosition(offset, mapGeometry.planeSize, mapGeometry.imageSize);
  const markerPosition: [number, number, number] = [
    localMarkerPosition[0] + offsetX,
    localMarkerPosition[1],
    localMarkerPosition[2] + offsetZ
  ];

  return (
    <group key={mapLevel.id} position={[offsetX, 0, offsetZ]}>
      <Suspense fallback={null}>
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <IslandCapErrorBoundary fallback={<IslandCapFallback level={mapLevel} geometry={mapIsland.capGeometry} />}>
            <IslandCapTexture level={mapLevel} geometry={mapIsland.capGeometry} />
          </IslandCapErrorBoundary>
        </group>
      </Suspense>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <IslandTransition geometry={mapIsland.transitionGeometry} />
        <IslandBelly geometry={mapIsland.bellyGeometry} planeSize={mapGeometry.planeSize} />
      </group>
      <LevelMarker
        level={mapLevel}
        position={markerPosition}
        focused={focused && mapLevel.id === level.id}
        onSelect={() => onActivateMarker(mapLevel.id)}
      />
    </group>
  );
})}
<CameraRig level={level} focused={focused} islandOffset={getIslandOffset(level.id)} cameraLockedRef={cameraLockedRef} />
```

   Punti di attenzione, non dettagli cosmetici:
   - `buildIslandGeometry` per TUTTE le isole viene ricalcolato a ogni render di
     `LevelMapScene` con questo schema — va spostato dentro un `useMemo` con
     dipendenza `levels` (stabile, l'array non cambia mai a runtime) per costruirlo una
     volta sola, non a ogni render; e la `dispose()` in `useEffect` (righe 862-868)
     va estesa a TUTTE le geometrie di TUTTE le isole nello stesso ciclo di pulizia,
     non solo quella dell'isola corrente — altrimenti si ripresenta esattamente il
     leak GPU che quel codice già risolveva, ma ora per 3 isole invece di 1.
   - `onActivateMarker` cambia firma: prima "attiva IL marker" (un solo livello
     possibile), ora deve sapere QUALE marker tra i tre — passare l'id (vedi sopra),
     e in `LevelSelectScene.tsx` `handleSelectLevel(mapLevel.id)` invece del vecchio
     `() => handleSelectLevel(displayedLevel.id)` (riga 226).
   - `focused` va scoped al marker giusto (`focused && mapLevel.id === level.id`
     sopra): senza, mettere a fuoco un livello metterebbe a fuoco (disabilitando hover)
     anche i marker delle altre due isole, non ancora scelte.
   - I marker delle isole NON attive restano interattivi al passaggio del mouse per
     costruzione (non li disabilitiamo) — è un effetto collaterale positivo consapevole:
     si potrà vedere in lontananza un'altra isola con il suo pin che si illumina
     all'hover, PRIMA di cliccarla dai pulsanti 2D. Cliccarla direttamente in 3D
     funzionerebbe già (chiama `onSelect` come sempre) ma il picking su un pin minuscolo
     e lontano è scomodo — non lo promuoviamo a interazione "ufficiale" in questa fase
     (resta un bonus, non un requisito): la Fase 5 fuori piano (sotto) è il posto giusto
     per curarlo davvero.

2. Rimuovere `CityTexturePrewarm`/`HiddenCityTexture` (righe 382-435) e la sua chiamata
   (riga 982): con tutte e tre le texture genuinamente montate e visibili, scaldarne
   una copia invisibile non serve più — netto: circa 50 righe in meno, non in più.

3. `CameraRig` (righe 683-808) prende un nuovo prop `islandOffset: readonly [number, number]`
   (l'offset dell'isola ATTIVA, quella su cui puntano `focused`/pan/zoom):
   - Il tween (righe 700-720) usa `geometry.cameraFarPosition`/`CAMERA_FAR_TARGET`:
     entrambi vanno spostati di `islandOffset` (X/Z, non Y — l'altezza della camera
     resta quella calcolata dalla formula esistente, solo lateralmente si sposta).
     `CAMERA_NEAR` (riga 57, oggi una costante fissa) va sommato a `islandOffset` allo
     stesso modo quando `focused` è vero.
   - Il clamp radiale del pan (righe 778-795) oggi assume l'isola centrata
     sull'origine (`const x = controls.target.x; const z = controls.target.z;`) — con
     le isole ora sparse, va reso relativo all'isola ATTIVA:
     ```ts
     const [offsetX, offsetZ] = islandOffset;
     const x = controls.target.x - offsetX;
     const z = controls.target.z - offsetZ;
     // ... stessa logica di prima fino al clamp ...
     controls.target.x = clampedX + offsetX;
     controls.target.z = clampedZ + offsetZ;
     camera.position.x += dx; // invariato, dx/dz restano delta, non serve offset qui
     camera.position.z += dz;
     ```
     Senza questo, panare sulla mappa vicino al bordo di un'isola diversa da quella
     all'origine clamperebbe rispetto al punto [0,0,0] invece che al centro
     dell'isola vera — il pan si bloccherebbe nel posto sbagliato per due isole su tre.

**Fatto quando**: le tre isole sono visibili sparse nello spazio (verificabile
disattivando temporaneamente il velo come detto sopra, o semplicemente aspettando la
Fase 3), il pan/zoom sull'isola attiva resta clampato al SUO bordo (non a quello
dell'isola vicina né all'origine), e passare a un altro mondo sposta davvero la camera
lateralmente verso la nuova isola invece di limitarsi a cambiare distanza sullo stesso
punto.

## Fase 3 — Il volo si vede: adattare la transizione

*Sei un esperto di composizione visiva e transizioni di camera in scene 3D.*

**Problema concreto**: `LevelSelectScene.tsx` oggi coordina il cambio città con
`CloudTransition` (righe 90-174): il velo copre tutto → `setDisplayedLevelId` cambia
SOLO a schermo coperto (`handleCloudCovered`, righe 152-163) → le nuvole si aprono di
nuovo. Questo nasconde esattamente il tween di `CameraRig` che, dopo la Fase 2, produce
un volo vero tra isole — a schermo oggi si vedrebbe un lampo di nuvole e poi la
destinazione già pronta, il volo stesso invisibile sotto il velo.

**Cosa fare** (assumendo la decisione consigliata sopra: via il velo pieno per i cambi
mondo, resta solo lo scatto di stelle come spinta iniziale):

1. In `LevelSelectScene.tsx`, semplificare `changeDisplayedCity` (righe 102-123): niente
   più coda/velo, il cambio è immediato — `setDisplayedLevelId(levelId)` e basta. Questo
   rende superflue `isTransitioningRef`, `queuedLevelIdRef`, `pendingFocusIdRef`,
   `startCloudTransitionTo`, `handleCloudCovered`, `handleCloudCleared` (circa 60 righe
   di macchina di accodamento che esisteva solo per coordinarsi con un velo che
   copriva/nascondeva il cambio — se il cambio non nasconde più nulla, la coda non
   serve). `handleSelectLevel` (righe 140-150) si semplifica allo stesso modo: mette a
   fuoco subito, senza il ramo "aspetta che le nuvole coprano".
2. `CloudTransition.tsx` diventa più leggero: tenere `STAR_STREAK_*` (la scia di
   stelle, già pronta dalla Fase 4 del piano precedente) come un breve "colpo" che parte
   insieme al cambio mondo ma NON blocca né copre — rimuovere `veil`/`CLOUD_VARIANTS` dal
   percorso di cambio-mondo (restano eventualmente utili altrove se in futuro serve di
   nuovo un vero cover-to-black, ma non per questo).
   Il contratto `trigger`/`onCovered`/`onCleared` si riduce: senza velo non serve più
   sapere "quando è coperto" per cambiare la città sotto (il cambio è già immediato) —
   `onCovered`/`onCleared` possono restare solo come "inizio/fine dello scatto di
   stelle" se qualcosa ancora li usa, altrimenti si tolgono.
3. Verifica end-to-end a schermo: selezionare un mondo diverso dall'elenco 2D o dal
   pulsante mondo deve mostrare la camera staccarsi dall'isola attuale, attraversare lo
   spazio aperto (stelle sullo sfondo, le altre isole visibili in lontananza) e arrivare
   sull'isola nuova, senza mai un fotogramma con geometria "sparita" o la camera in una
   posizione degenere (stesso tipo di controllo già fatto per il dolly ravvicinato,
   vedi i commenti su `MAX_POLAR_ANGLE`/`isAnimating` in `CameraRig`).

**Fatto quando**: cambiare mondo si sente davvero come "volare da un'isola all'altra"
(l'ispirazione Spiritfarer del documento precedente), non più un taglio dietro le
nuvole; il click di conferma su un livello (zoom ravvicinato sul marker) resta
invariato — quello non passa da `CloudTransition`, non lo tocchiamo.

---

## Cosa NON cambia (per essere chiari su dove finisce questo piano)

- La sequenza capsula/impatto (`CapsuleSequence.tsx`, "Avvia livello") — meccanismo
  completamente separato, non interagisce con il cambio-mondo.
- Lo swap pin↔modello per distanza (`CLOSEUP_DISTANCE`, `LevelMarker.tsx`) — funziona
  già bene distanza per distanza, indipendentemente da quante isole esistono
  contemporaneamente nella scena; anzi con le isole permanenti la logica del fronte di
  salita (`wasCloseupRef`) diventa PIÙ corretta, non meno: oggi un rientro sulla stessa
  città si affida al rimontaggio via `key` per "dimenticare" lo stato precedente
  (commento riga 968-980); tolto quel rimontaggio, il fronte di salita scatta solo
  quando la camera attraversa DAVVERO la soglia di distanza — che con isole vere
  distanziate nello spazio è quello che succede comunque ogni volta che si vola via e
  si ritorna. Da verificare a schermo lo stesso (tornare su un mondo già visitato deve
  far ripartire `Grow_Landing` sull'Ariston), ma è un punto in cui ci aspettiamo che il
  refactor risolva un problema piuttosto che introdurne uno.
- La generazione delle mappe statiche/`.webp` — già a posto, non tocchiamo
  `scripts/generate-map-images.mjs`.

## Cosa resta fuori (di proposito) e quando riparlarne

- **Fase 5 — cliccare direttamente un'isola lontana in 3D** invece di passare dai
  pulsanti mondo 2D: tecnicamente già "gratis" dopo la Fase 2 (i marker delle isole non
  attive rispondono già a `onSelect`), ma il picking su un pin piccolo e lontano va
  curato (raggio di hit-test più permissivo in base alla distanza, magari un'evidenza
  visiva più leggibile da lontano) prima di proporlo come interazione vera — separato
  apposta, si valuta dopo aver visto le Fasi 1-3 confermate a schermo.
- **A, soluzione definitiva** (modelli Blender veri per Silì e Cagliari): resta un
  lavoro di modellazione a sé, indipendente da questo piano — anzi, con le isole ora
  visibili tutte insieme contemporaneamente, avere ancora due placeholder-ottaedro
  accanto all'Ariston modellato si noterà DI PIÙ (prima si vedeva un'isola alla volta),
  quindi vale la pena tenerlo in cima alla lista subito dopo aver verificato questo
  piano, non come priorità lontana.

Procedo con la Fase 1 quando mi dai il via (o fammi sapere cosa ne pensi delle due
decisioni in cima al documento, specialmente il velo di nuvole — è la parte con più
impatto visivo diretto).
