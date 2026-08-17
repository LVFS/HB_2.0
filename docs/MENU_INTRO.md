# La scena del muro — architettura e roadmap

Come è fatta la schermata iniziale, perché è fatta così. L'ambientazione
completa (strada, cartello, case, distributore, binari, muro AoT) e la
sequenza cinematica del personaggio sono **fatte**: questo documento descrive
l'architettura reale, non più un piano per arrivarci — le sezioni 5 e 6
raccontano anche le insidie incontrate, utili se si ritocca quella parte.

---

## 1. Architettura

### Albero dei componenti

```
MenuScene                      ← possiede la FASE, non disegna niente
├── MainMenuSceneAnimation     ← il <Canvas>: tutto il 3D sta qui dentro
│   ├── CameraDirector         ← possiede la camera nelle fasi intro/ready/breaking
│   ├── CharacterIntro (lazy)  ← possiede la camera nelle fasi punching/breaking
│   │                             (i due si escludono a vicenda via guard su `phase`)
│   ├── WallTitle              ← titolo inciso sul muro, dissolve all'impatto
│   ├── Wall  ─oppure─  WallShatter (lazy)
│   │       │                     └── Physics
│   │       │                         ├── CuboidCollider (terreno)
│   │       │                         └── RigidBody colliders="hull" per frammento
│   │       │                             (uno per pezzo: geometrie tutte diverse,
│   │       │                              filtrate per AFFECT_RADIUS dall'impatto)
│   │       └── entrambi leggono l'ambientazione da environmentModel.ts
│   └── (durante `punching`/`breaking`) due gruppi Base/Jab, visibilità
│       nascosta/mostrata via GSAP `.call()` — mai smontati/rimontati
└── MainMenuOverlay            ← la UI HTML: pulsanti e selettore variante
```

### Dove vive lo stato

Tre livelli, con una regola precisa per ciascuno.

| Cosa | Dove | Perché |
|---|---|---|
| `screen` (menu / levelSelect / game) | Zustand `gameStore` | Sopravvive al cambio di schermata: è l'unica cosa che davvero riguarda tutta l'app. |
| `musicEnabled`, `sfxEnabled`, `volume` | Zustand `settingsStore` (persistito) | Deve durare tra una sessione e l'altra. |
| `phase` (`intro`/`ready`/`punching`/`breaking`), `variant`, `introVariant`, `impactY`, `whiteout` | `useState` in `MenuScene` | Muoiono con la schermata. I componenti che li usano sono fratelli: basta il genitore comune. |
| posizione camera, opacità del titolo, chi è già esploso, posizione del personaggio | ref e oggetti Three | Cambiano a ogni fotogramma. In React causerebbero 60 render al secondo. |

**La riga più importante è l'ultima.** In un gioco la maggior parte dello stato
non deve stare in React né in Zustand. Se un valore cambia a ogni frame, va in
una `useRef` o direttamente nell'oggetto Three, e React non ne sa niente.
Zustand non è "il posto dove si mette lo stato": è il posto dove si mette lo
stato *condiviso da componenti lontani*.

### Chi comanda cosa: GSAP, Rapier, Howler

Il rischio, con tre librerie che animano roba, è che si contendano gli stessi
oggetti. La divisione che usiamo:

- **GSAP guida ciò che deve andare esattamente come diciamo noi**: camera,
  dissolvenze, e i *cue* (istanti in cui far partire qualcos'altro). È il
  direttore d'orchestra: conosce la linea del tempo.
- **Rapier guida ciò che deve sembrare non scritto**: i detriti. Noi diamo il
  calcio d'inizio (un impulso), poi non tocchiamo più niente. Se ti trovi a
  voler correggere la posizione di un detrito, stai usando male la fisica.
- **Howler non guida niente**: viene chiamato dalla timeline nei punti giusti.

Regola pratica: **un oggetto ha un solo padrone.** Nessun `useFrame` deve
scrivere su qualcosa che GSAP sta animando, e nessun tween deve toccare un
corpo Rapier dinamico.

Il caso limite è la camera, che ha bisogno di due contributi insieme (il
movimento e lo scossone). Lì la soluzione è in `CameraDirector`:

```ts
// GSAP anima un oggetto QUALSIASI, non camera.position
const base = useRef({ x: 0, y: 1.5, z: 68 }).current;
const shake = useRef({ value: 0 }).current;

// e la posizione vera la ricostruiamo noi ogni frame
useFrame(() => {
  camera.position.set(
    base.x + (Math.random() - 0.5) * shake.value * 1.6,
    ...
  );
});
```

Se GSAP animasse direttamente `camera.position` e noi ci sommassimo lo
scossone, l'offset finirebbe dentro il tween e la camera andrebbe alla deriva.
È un errore che si vede subito e si capisce tardi.

---

## 2. L'MVP: un muro fatto di cubi (superato, letto per i principi)

**Questa sezione descrive l'implementazione originale, sostituita dal muro
Blender (sezione 5).** `buildWallChunks.ts` e `chunkInstances.ts` non esistono
più nel repo. È rimasta perché i principi (impulsi, `fixed`→dinamico,
`hull` vs `trimesh`) valgono ancora, solo applicati a frammenti Blender invece
che a una griglia di cubi generata a runtime.

### Perché InstancedRigidBodies (allora — oggi si usa un `RigidBody` per frammento)

176 blocchi come 176 `<RigidBody>` separati significano 176 mesh, cioè 176
draw call per fotogramma. `InstancedRigidBodies` genera invece **una sola
InstancedMesh** con 176 corpi fisici: una draw call. Su desktop la differenza
si nota, su mobile è la differenza tra 60 e 20 fps.

Il prezzo: le istanze non sono oggetti della scena, quindi posizione e colore
non si impostano con le prop React ma scrivendo nei buffer
(`chunkInstances.ts`). Va bene, perché quei valori non cambiano mai da React:
li scrive Rapier.

### Perché i blocchi nascono `fixed`

L'alternativa sarebbe tenerli dinamici con `<Physics paused>`. Non funziona
bene: appena si toglie la pausa, una pila di cubi appoggiati si assesta da
sola e il muro trema prima ancora di essere colpito.

Con `type="fixed"` i blocchi sono immobili e costano quasi zero. Diventano
dinamici uno alla volta, quando li chiama la variante:

```ts
body.setBodyType(RIGID_BODY_DYNAMIC, true);
body.applyImpulse(...);
```

Questo dà anche il controllo sul *timing*: si può far cedere prima il centro e
poi i bordi, che è esattamente cosa distingue un'esplosione da un crollo.

### Il tranello degli impulsi

Un impulso non è una velocità: è **massa × variazione di velocità**. Un blocco
di 2.5 × 2.4 × 1.8 con densità 1 pesa ~10 kg, quindi per lanciarlo a 15 m/s
serve un impulso di ~150, non di 5.

È il motivo per cui la prima versione sembrava rotta: i blocchi si spostavano
di pochi centimetri. Se cambi le dimensioni dei blocchi, la massa cambia con il
**cubo** del lato, e `IMPULSE.base` va ritarato.

Secondo tranello: la direzione. Spingere i detriti *lontano* dalla camera dà
un'esplosione che non si vede. `radial` spinge verso la camera (`+z`), `punch`
spinge dentro (`-z`) perché lì il bello è il buco che si apre.

---

## 3. Aggiungere una variante di rottura

Una variante è **solo** questa funzione:

```ts
export type BreakPattern = (context: BreakContext) => ChunkKick[];
```

Riceve la lista dei blocchi e il punto d'impatto; restituisce, per ogni blocco,
un impulso, una coppia (rotazione) e un ritardo. Non sa cosa siano React,
Three, Rapier, la camera o l'audio.

Per aggiungerne una:

1. crea `breakPatterns/tuaVariante.ts` con quella firma;
2. aggiungi il nome a `BreakVariant` in `wallConfig.ts`;
3. registrala in `breakPatterns/index.ts`.

Il tipo `Record<BreakVariant, BreakPattern>` fa fallire la compilazione se
dimentichi il punto 3. La scena non si tocca.

Idee che rientrano tutte in questa firma senza modifiche: taglio verticale
(spingi in base a `Math.abs(dx) < soglia`), onda dal basso (`delay` in
funzione di `row`), disintegrazione dai bordi verso il centro (inverti il
falloff), colpo diagonale (proietta la posizione su una direzione).

Il valore vero di questa separazione si vedrà al punto 5: quando i blocchi
arriveranno da un `.glb` invece che da una griglia, **le varianti non
cambieranno di una riga**, perché dipendono solo da posizioni e indici.

---

## 4. La timeline GSAP

La sequenza di rottura vive in un unico `useEffect` in `CameraDirector`:

```ts
const impactAt = VARIANT_IMPACT_DELAY[variant];

const timeline = gsap.timeline({ onComplete: onBreakComplete });
timeline
  .to(base, { ...SHOTS.break, duration: 3, ease: 'power2.out' }, 0)
  .to(look, { ...LOOK.break, duration: 3, ease: 'power2.out' }, 0)
  .call(() => playSfx('impact'), undefined, impactAt)
  .call(() => playSfx('rubble', { volume: 0.65 }), undefined, impactAt + 0.35)
  .to(shake, { value: 1, duration: 0.05 }, impactAt)
  .to(shake, { value: 0, duration: 1.5, ease: 'power2.out' }, impactAt + 0.05)
  .to({}, { duration: 0.5 }, 3);

return () => { timeline.kill(); };
```

Cose da notare:

**Il terzo argomento è la posizione assoluta sulla timeline.** Senza, GSAP
accoda i tween uno dopo l'altro. Con `0`, `impactAt`, `impactAt + 0.35` si
scrive una partitura: tutto è ancorato allo stesso istante d'impatto, e
spostando quell'unico numero si risincronizza l'intera scena.

**`.call()` piazza gli eventi discreti** (audio, e domani il pugno del
personaggio) sulla stessa linea del tempo dei movimenti continui.

**Il segmento vuoto finale** allunga la timeline: senza, `onComplete` scatterebbe
mentre i detriti sono ancora per aria e la schermata cambierebbe troppo presto.

**`timeline.kill()` nel cleanup non è opzionale.** Senza, tornando al menu la
vecchia timeline continua a scrivere sugli stessi oggetti insieme alla nuova.

**Le callback devono essere stabili.** `onBreakComplete` sta nelle dipendenze
dell'effetto: se il genitore la ricreasse a ogni render, la timeline verrebbe
distrutta e ricostruita di continuo e l'animazione ripartirebbe da capo. Per
questo `MenuScene` le avvolge in `useCallback`.

### Perché i detriti NON sono nella timeline

Gli impulsi per fotogramma li gestisce `WallShatter` con un cursore in
`useFrame`, non GSAP:

```ts
while (nextKick.current < kicks.length && kicks[nextKick.current].delay <= clock) {
  // libera il blocco e applica l'impulso
}
```

Motivo: 176 `.call()` su una timeline sono 176 oggetti GSAP da gestire, mentre
la lista è già ordinata per ritardo e basta un cursore che avanza. E
soprattutto tiene il *timing della fisica* dentro il codice della fisica.
GSAP resta il direttore, non l'esecutore.

I due orologi restano allineati perché leggono lo stesso
`VARIANT_IMPACT_DELAY[variant]`.

---

## 5. Il muro pre-fratturato da Blender (fatto)

Questo era lo "Step 2" pianificato quando il muro era ancora 176 cubi
procedurali. Oggi è realtà: l'intera ambientazione ("Ingresso a Oristano" —
strada, cartello, case, distributore ESSO, binari, muro AoT con portone) arriva
da un unico `public/models/ingresso-oristano.glb` (~1.8 MB, ~800+ mesh),
costruito in Blender via MCP e versionato come sorgente in
`assets/blender/ingresso_oristano.blend`.

### In Blender

1. **Cell Fracture**: `Edit ▸ Preferences ▸ Add-ons` (nel nostro caso andava
   anche installato via Extensions online, non era bundlato di default), poi
   `Object ▸ Quick Effects ▸ Cell Fracture` sul solido intero di ogni unità
   (un'anta del portone, un pannello del muro, un contrafforte...). Per punti
   sorgente con densità variabile: subdividere il solido prima di fratturarlo
   e usare `source={'VERT_OWN'}` con `source_noise=1.0` — niente particle
   system, troppo lavoro per un guadagno marginale qui.
2. **`use_remove_original=True` non cancella l'oggetto sorgente davvero** —
   resta come mesh piena invisibile-di-nome sovrapposta ai frammenti. Va
   cancellato a mano dopo ogni frantumazione (bug ripetuto due volte in questo
   progetto, controllare sempre con una scansione `_CFsrc` residui prima di
   esportare).
3. `Object ▸ Set Origin ▸ Origin to Center of Mass (Volume)` su ogni frammento
   — altrimenti ruotano attorno all'origine dell'oggetto intero e l'esplosione
   sembra un frullatore. Con `use_recenter=True` nell'operatore Cell Fracture
   questo passaggio è già incluso.
4. **Nomina i frammenti con un prefisso che riconduce all'unità originale**:
   `{UnitName}_Frag_{i}` per i frammenti irregolari (`Gate_Door_L_Frag_0`,
   `WallPanel_003_Frag_2`, `Buttress_00_Frag_4`...). Il codice scopre i pezzi
   rompibili per **prefisso del nome**, non per collezione — vedi
   `SHARD_PREFIXES` sotto.
5. **Coperture solide** (`Solid_*`): un box pieno (o, se l'unità originale
   aveva un buco — es. il telaio del portone attorno all'apertura — una vera
   cornice con lo stesso buco, mai un blocco pieno) alle stesse dimensioni di
   ogni unità frantumata, con lo stesso materiale. Mostrato SOLO
   nell'ambientazione intatta, per nascondere le micro-crepe di Cell Fracture
   che altrimenti si vedrebbero anche a muro fermo.
6. **Esporta** `File ▸ Export ▸ glTF 2.0 (.glb)`: `Include ▸ Selected
   Objects`, `Transform ▸ +Y Up`, `Data ▸ Mesh ▸ Apply Modifiers`,
   `Materials ▸ Export`. Niente Draco per ora (il progetto non ha ancora
   configurato il decoder lato client).

Conversione assi (con `export_yup=True`): `x3 = xB`, `y3 = zB` (altezza),
`z3 = -yB` (profondità) — Blender Y (profondità) diventa Three Z negativo.

### Nel codice

`environmentModel.ts` sostituisce il vecchio `buildWallChunks.ts` (cancellato,
insieme a `chunkInstances.ts`):

```ts
const SHARD_PREFIXES = ['Gate_Door_', 'Gate_LowerBlock', 'WallPanel_', 'Buttress_'];

export function useBreakableShards(): WallChunk[] {
  const { scene } = useEnvironmentGltf();
  return useMemo(() => {
    const found: { mesh: Mesh; position: [number, number, number] }[] = [];
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if (!SHARD_PREFIXES.some((p) => object.name.startsWith(p))) return;
      // getWorldPosition, non object.position: i frammenti sono annidati
      // dentro gruppi nell'export glTF e il locale non basta.
      object.getWorldPosition(worldPos);
      found.push({ mesh: object, position: [worldPos.x, worldPos.y, worldPos.z] });
    });
    return found.map((entry, index) => ({ index, name: entry.mesh.name, /* ... */ }));
  }, [scene]);
}
```

Differenza rispetto al piano originale: **non tutti i frammenti scoperti
diventano fisici a ogni rottura**. Il muro intero è frantumato (~218 pezzi:
portone, 34 pannelli, 8 contrafforti), ma solo quelli entro `AFFECT_RADIUS`
(distanza orizzontale, X/Z, dall'origine dell'impatto — NON l'altezza, così
un'intera colonna vicina al portone resta coinvolta dal basso in alto) vengono
filtrati e trasformati in `<RigidBody>` da `WallShatter.tsx`. Il resto resta
nella scena statica, invisibile solo se è uno dei pezzi coinvolti in QUESTA
rottura specifica — non per prefisso, per nome esatto:

```tsx
const affectedNames = new Set(shards.map((s) => s.name));
clone.traverse((object) => {
  if (object instanceof Mesh && affectedNames.has(object.name)) {
    object.visible = false; // sostituito dal frammento fisico
  }
});
```

Questo filtro tiene il costo della rottura costante indipendentemente da
quanto è esteso il muro — importante dato che è stato allargato più volte
nel corso dello sviluppo (da 90 a 202 unità) senza mai dover ritoccare
`WallShatter.tsx`.

`colliders="hull"` resta la scelta giusta e non un compromesso: Cell Fracture
produce celle convesse, e per una forma convessa l'inviluppo convesso è la
forma esatta.

**Bug di indicizzazione da evitare**: se si filtra la lista di frammenti PRIMA
di costruire i `<RigidBody>`, l'`.index` di ogni pezzo va riassegnato sulla
posizione nel sotto-insieme filtrato, non lasciato all'indice nel catalogo
completo — altrimenti `kick.index` (prodotto da `planBreak`) e
`bodiesRef.current[i]` (popolato in ordine da `shards.map`) vanno fuori
sincrono non appena il filtro esclude anche un solo pezzo, e gli impulsi
finiscono sul corpo sbagliato.

---

## 6. La sequenza cinematica del personaggio (fatto, senza mixer)

Il piano originale prevedeva un personaggio riggato con un'animazione *punch*
importata da Mixamo, sincronizzata via `AnimationMixer`. Quello che è stato
costruito è diverso e più semplice: **nessuna animazione ad ossa**. Tutto il
movimento — camera, cambio di modello, "battuta" del corpo, corsa finale — è
guidato da GSAP che anima proprietà di oggetti Three (posizione, rotazione,
visibilità), esattamente come il resto del menu.

### Perché niente skin/scheletro

Il tentativo iniziale usava `Personaggio_Base`/`Jab` riggati (bind pose,
nessuna animazione, pensati per una futura rotazione del solo osso del collo).
**L'export con skin era rotto**: questi due modelli avevano un genitore
Blender con `scale=100` che Blender compensa "gratis" in viewport (l'armatura
in bind pose deforma la mesh *sopra* quella scala, e il risultato visivo è
corretto) — ma l'export `.glb` **non porta con sé quella correzione**. In
Three.js il risultato era o una mesh enorme (~140 unità) posizionata lontano
da dove ci si aspettava, o — dopo una correzione di scala/posizione a livello
di gruppo nel codice React — una mesh **stirata in modo non uniforme
per-osso**, visibile come nastri/vele deformate invece di un personaggio.
Una correzione di scala globale non basta perché il problema è nella skin
(inverse bind matrix), non solo nel transform del gruppo esterno.

**Fix**: ri-esportare `Personaggio_Base`/`Jab` con `export_apply=True`
(applica/cuoce la deformazione dell'armatura nella mesh) e
`export_skins=False` (niente scheletro nell'export). Si perde la possibilità
di ruotare un singolo osso via codice — compensato ruotando l'intero gruppo
per la "battuta" invece che solo la testa.

Verifica pratica (rifallo se in futuro si ri-esportano questi modelli): dopo
il caricamento, calcolare il bounding box mondo del gruppo
(`new Box3().setFromObject(group)`) e controllare che l'altezza sia
ragionevole (~1.5-2 unità, non ~20-150). Uno scarto enorme è il sintomo di
questo bug, non un problema di posizionamento della camera.

**Tentativo di risolvere il problema alla radice (riprovato una volta,
abbandonato di nuovo)**: l'idea era smettere di aggirare il bug e correggere
la gerarchia Blender per poter riesportare CON lo skin, abilitando in futuro
un'animazione ad ossa vera. `bpy.ops.object.transform_apply` sull'Empty
radice (`scale=100`) non elimina lo scale — lo Blender lo sposta nel
`matrix_parent_inverse` del figlio diretto (un campo pensato per mantenere
invariato l'aspetto world-space quando un genitore cambia): i bounds
calcolati sui vertici restano identici prima/dopo, quindi non è un fix, solo
uno spostamento del problema. Anche sganciare armatura e mesh dalla gerarchia
con "Clear Parent and Keep Transform" (nel tentativo di far atterrare lo
scale nei DATI veri — vertici/ossa — invece che in una matrice nascosta) non
converge in modo affidabile: a un certo punto le misure numeriche (bounds via
`matrix_world` sui vertici) e l'aspetto nel viewport hanno smesso di
coincidere, segno che la combinazione Armature modifier + questa gerarchia
particolare (probabile origine FBX/Sketchfab, con conversione d'unità cm→m)
deforma i vertici in uno spazio che non si lascia separare pulitamente con
operazioni di trasformazione a livello di oggetto — servirebbe capire lo
spazio di bind reale, non solo spostare matrici. **Non riprovare senza una
ragione nuova** (es. uno strumento di retargeting dedicato tipo Auto-Rig
Pro/Rokoko, o ricostruire il rig da zero). Nel frattempo lo "scatto verso il
muro" aggira il problema con tecniche cinematiche (vedi sotto) invece che con
un vero ciclo di corsa.

`Personaggio_Salto` (terzo modello, senza scheletro fin dall'inizio, pensato
per lo scatto finale a bassa poligonazione) **non è più usato**: anche
un modello senza il bug di skin, se tradotto rigidamente sul terreno con solo
un rimbalzo verticale e un'inclinazione (senza vero ciclo di corsa), si legge
come "pattinare sul ghiaccio" più che come corsa — il problema non era la
distorsione della mesh ma l'assenza di un'animazione delle gambe. Rimosso dal
codice (`characterModel.ts`, `characterConfig.ts`, `CharacterIntro.tsx`) e
dal repository (`public/models/personaggio-salto.glb`); può darsi esista
ancora come collezione nel file sorgente Blender, ma non va più ri-esportato.

### Struttura del codice

`game/menu/character/`:
- `characterConfig.ts` — `IntroVariant` (pool di coreografie, oggi solo
  `"saitama"`, stesso pattern di `BreakVariant`) e `SAITAMA_TIMING` (durata di
  ogni fase in secondi: piede, rivelazione volto, battuta, cambio
  espressione, anticipazione, scatto, impatto, ingresso nel varco, whiteout).
- `characterModel.ts` — due hook `useGLTF` (uno per modello), con
  `useGLTF.preload` a livello di modulo.
- `CharacterIntro.tsx` — il componente vero e proprio: possiede la camera
  durante `punching` (e `breaking`, per finire la scena), due gruppi sempre
  montati (Base/Jab) con visibilità nascosta/mostrata via `.call()`
  GSAP invece di smontare/rimontare componenti React (eviterebbe che due
  GLTF diversi si ricarichino a metà sequenza).

### La timeline

Un solo `gsap.timeline()` per l'intera sequenza, con un cursore esplicito:

```ts
let cursor = 0;
const advance = (duration: number) => {
  cursor += duration;
  return cursor; // l'istante in cui QUESTO segmento finisce, non in cui inizia
};
```

**Bug reale scovato qui**: la prima versione di `advance` restituiva il
cursore PRIMA di incrementarlo (l'inizio del segmento, non la fine) — il
primo segmento durava zero secondi e ogni fase successiva scivolava indietro
nel tempo. Facile da scrivere, difficile da notare finché non si misura la
timeline con un log o un aggancio di debug temporaneo.

Il cambio di modello è un `.call()` che nasconde un gruppo e ne mostra un
altro, ancorato allo stesso cursore di tutto il resto — niente eventi
separati da tenere allineati:

```ts
const setActiveModel = (which: 'base' | 'jab') => {
  baseGroupRef.current.visible = which === 'base';
  jabGroupRef.current.visible = which === 'jab';
};
timeline.call(() => setActiveModel('jab'), undefined, swapAt);
```

### Lo scatto verso il muro: raffica cinematica, non un ciclo di corsa

Base e Jab sono mesh statiche cotte (niente scheletro, vedi sopra sul
perché). Il primo tentativo per lo scatto finale era `Personaggio_Salto`, un
terzo modello in posa da corsa tradotto sul terreno con un rimbalzo verticale
ciclico e un'inclinazione in avanti — funzionava tecnicamente, ma **si vede**
che le gambe non si muovono: anche una buona posa statica, traslata di netto,
si legge come un pattinare sul ghiaccio più che come una corsa. Aggiustare
l'export per abilitare un'animazione scheletrica vera si è rivelato un
problema profondo (vedi sopra) e non riaperto per questa iterazione.

La soluzione adottata sposta il "vendere la velocità" dalla traslazione del
personaggio alla camera e al contorno — lo stesso trucco che l'animazione usa
da sempre per gli scatti action senza un ciclo di corsa disegnato in ogni
fotogramma:

- **Whip-pan di camera + FOV kick**: la camera non insegue con un tracking
  shot morbido, sferza da vicino/basso a un'inquadratura larga vicino al
  muro con una ease aggressiva (`power3.in`), mentre il campo visivo sale di
  colpo e torna alla normalità — lo stesso "risucchio" da corsa di tante
  scene d'azione.
- **Squash-and-stretch**: il gruppo del personaggio si stira lungo l'asse
  di corsa (`scale.z`) all'inizio dello scatto e torna a 1 prima
  dell'impatto — un principio classico dell'animazione, non serve scheletro.
- **Smear-cut Base/Jab**: due brevi (~50ms) scambi di visibilità verso Base e
  ritorno a Jab, sincronizzati ai due "passi" percepiti — un flicker in stile
  flipbook che suggerisce l'alternanza delle gambe senza animarle davvero.
- **Polvere + scossone ai piedi**: due cerchi piatti (`circleGeometry` +
  `meshBasicMaterial`) posizionati alla posizione corrente del personaggio,
  scala/opacità animate su`.to()` della timeline, più un piccolo scossone
  camera (stesso meccanismo del tremore d'impatto in `CameraDirector`) nello
  stesso istante — due beat ritmici che leggono come "footfall" anche senza
  un ciclo di corsa reale.

Tutti questi elementi sono `.to()`/`.call()` sulla STESSA timeline, ancorati
a posizioni assolute (mai `gsap.to()` ad-hoc dentro un `.call()`): coerente
con la regola generale di questo documento — un tween "orfano" fuori dalla
timeline principale sopravviverebbe a un `timeline.kill()` nel cleanup.

**Diagnosticare timing così stretto (beat da ~50-200ms) è difficile a
schermo**: gli screenshot presi con `waitForTimeout` fisso in headless
mancano quasi sempre il beat giusto. La tecnica che ha funzionato: un
aggancio diagnostico temporaneo su `window` (un contatore incrementato dentro
la funzione che piazza la polvere) letto da Playwright con
`page.waitForFunction(..., { polling: 'raf' })` — polla a ogni frame, quindi
cattura anche un evento che dura un solo tick. Rimosso subito dopo la verifica.

### L'aggancio alla rottura del muro (invariato rispetto al piano)

`onImpact()` viene chiamato dalla timeline nel fotogramma dell'impatto e
avvisa `MenuScene`, che forza la variante di rottura a `'punch'` e genera un
nuovo punto d'impatto casuale (`randomImpactY()`), poi passa la fase a
`breaking`. Da lì il sistema di rottura esistente (`WallShatter.tsx`,
`breakPatterns/punch.ts`) prende il controllo senza sapere che dietro c'è un
personaggio — l'aggancio è solo il cambio di fase e la variante forzata.

`CharacterIntro` resta montato anche durante `breaking` (non solo
`punching`): il personaggio deve finire di entrare nel varco appena aperto
mentre il muro cede, non sparire di scatto nel fotogramma dell'impatto.

### GSAP `lagSmoothing`: il bug più insidioso di questa parte

Con la timeline apparentemente corretta, la sequenza risultava bloccata per
secondi sulla prima inquadratura, poi avanzava a scatti lentissimi. Causa:
`gsap.ticker.lagSmoothing()` (attivo di default, soglia 500ms) ammortizza gli
scatti quando un fotogramma tarda, ma se il rendering stesso è lento (caso
tipico: caricamento dei modelli pesanti, compilazione shader al primo
utilizzo di un materiale, o hardware/software rendering scarso) lo fa
**rallentando la timeline** invece di farla recuperare — con
frame che richiedono più di 500ms, la timeline avanza a una frazione della
velocità reale, potenzialmente per sempre se il rendering non accelera mai.
Per una cinematica one-shot come questa è la scelta sbagliata:
`gsap.ticker.lagSmoothing(0)` (disattivato) fa sì che la timeline insegua
sempre il tempo reale, anche a costo di "saltare" fotogrammi persi.

### Diagnosticare problemi di questo tipo

Due tecniche usate con successo in questa sessione, quando gli screenshot
del viewport/browser diventano inaffidabili (capita, sia in Blender sia in
Chromium headless — a un certo punto danno risultati identici nonostante il
codice sia cambiato, sintomo di cache non del codice):

1. **Aggancio diagnostico temporaneo su `window`**, popolato in un
   `useFrame`/`useEffect`, letto da fuori (es. `page.evaluate()` in
   Playwright) per leggere lo stato REALE (posizione camera, bounding box di
   un gruppo, visibilità) senza dipendere dal rendering effettivo essere
   corretto. Va rimosso prima di consegnare il codice.
2. **Bounding box mondo vero** (`new Box3().setFromObject(obj)`) invece di
   fidarsi delle coordinate "di progetto" — specialmente su asset importati
   da Blender, dove trasformazioni annidate/scale anomale possono far sì che
   dove pensi che sia un oggetto non sia affatto dove è renderizzato
   davvero.

---

## 7. Performance

### Cosa costa davvero

| Voce | Impatto | Cosa fare |
|---|---|---|
| Draw call | alto | Il muro attuale non usa instancing (i frammenti Cell Fracture hanno geometrie tutte diverse): un materiale condiviso per unità (pannello/contrafforte/portone) tiene comunque basso il numero di materiali. |
| Numero di corpi | alto | `AFFECT_RADIUS` tiene i corpi dinamici per rottura a poche decine, indipendentemente da quanto è esteso il muro (~218 frammenti totali, mai tutti fisici insieme). Oltre i ~400 dinamici insieme, Rapier soffre anche su desktop. |
| Tipo di collider | **altissimo** | `cuboid` e `ball` sono quasi gratis, `hull` è economico, **`trimesh` su corpi dinamici va evitato**: è instabile e lentissimo. Con Cell Fracture usa sempre `hull`. |
| Ombre | alto | Una luce che proietta ombre rifà la scena da capo per la shadow map. Verifica il frustum: coprire tutta la larghezza reale del muro (raddoppiata la risoluzione della shadow map a 2048 quando il frustum è stato allargato, altrimenti ombre a blocchi). |
| `dpr` | **altissimo su mobile** | Un telefono con dpr 3 disegna 9× i pixel. `dpr={[1, 1.75]}` (già impostato) è il singolo intervento più efficace. |
| Peso degli asset | **da tenere d'occhio** | Ambientazione ~2 MB + due modelli personaggio ~1.9 MB in tutto (nessun Draco configurato lato client per ora). Tutti dietro `lazy()`/`useGLTF.preload` scaricati solo quando servono, ma se il totale cresce ancora vale la pena valutare Draco o KTX2 sulle texture. |

### Detriti: dormire ≠ sparire

`WallShatter` addormenta i corpi caduti sotto una certa quota:

```ts
if (body.translation().y < DESPAWN_Y) body.sleep();
```

Questo azzera il costo di **simularli**, non quello di **disegnarli**: un
InstancedMesh disegna sempre tutte le sue istanze. Per togliere anche quello
serve portare l'istanza a scala 0 (o all'ultimo slot dell'array e ridurre
`count`). Con 176 cubi non ne vale la pena; con frammenti Blender e mesh
separate, invece, conviene smontarli davvero dopo qualche secondo.

### Adattarsi al dispositivo

`WALL.cols` e `WALL.rows` sono in config apposta: il numero di corpi è
l'unico parametro che vale davvero la pena scalare.

```ts
const isLowEnd =
  navigator.hardwareConcurrency <= 4 ||
  matchMedia('(pointer: coarse)').matches;
```

Su mobile: meno blocchi, `shadow-mapSize` a 512 o ombre spente del tutto.
Sarebbe il candidato naturale per una voce `quality` in `settingsStore`.

### Mentre sviluppi

- `<Physics debug>` disegna i collider. Attivalo con
  `debug={import.meta.env.DEV}` così non finisce mai in produzione — è già il
  parametro `debug` di `WallShatter`.
- Se i detriti attraversano il terreno quando vanno forte, il problema è il
  *tunneling*: attiva `ccd` sui corpi veloci, o ispessisci il collider del
  terreno. Il nostro è spesso 1 unità apposta.
- Attenzione al `delta` di `useFrame` con la scheda in background: può valere
  diversi secondi al rientro. In `WallShatter` è limitato con
  `Math.min(delta, 0.05)`, altrimenti l'onda d'urto partirebbe tutta insieme.

### Il bundle

Rapier pesa ~2 MB (include il WebAssembly). Per questo `WallShatter` è dietro
`lazy()` e viene precaricato solo quando l'intro finisce: il menu si apre senza
scaricarlo, e al click è già in memoria.

⚠️ **Non importare `@dimforge/rapier3d-compat` come valore.** Un
`import { RigidBodyType } from '@dimforge/rapier3d-compat'` fa finire nel
bundle una **seconda copia** del motore fisico, altri 2 MB. Se ti serve un
valore di quel package, usa `import type` e ricopia la costante — è quello che
fa `RIGID_BODY_DYNAMIC` in `WallShatter.tsx`.
