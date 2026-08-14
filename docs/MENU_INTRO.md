# La scena del muro — architettura e roadmap

Come è fatta la schermata iniziale, perché è fatta così, e cosa serve per
passare dai cubi procedurali ai modelli Blender.

---

## 1. Architettura

### Albero dei componenti

```
MenuScene                      ← possiede la FASE, non disegna niente
├── MainMenuSceneAnimation     ← il <Canvas>: tutto il 3D sta qui dentro
│   ├── CameraDirector         ← possiede la TIMELINE GSAP e la camera
│   ├── WallTitle              ← titolo inciso sul muro, dissolve all'impatto
│   ├── mesh (terreno)         ← sempre presente, fuori dalla fisica
│   └── Wall  ─oppure─  WallShatter (lazy)
│       │                        └── Physics
│       │                            ├── CuboidCollider (terreno)
│       │                            └── InstancedRigidBodies (i blocchi)
│       └── entrambi leggono lo stesso layout da buildWallChunks
└── MainMenuOverlay            ← la UI HTML: pulsanti e selettore variante
```

### Dove vive lo stato

Tre livelli, con una regola precisa per ciascuno.

| Cosa | Dove | Perché |
|---|---|---|
| `screen` (menu / levelSelect / game) | Zustand `gameStore` | Sopravvive al cambio di schermata: è l'unica cosa che davvero riguarda tutta l'app. |
| `musicEnabled`, `sfxEnabled`, `volume` | Zustand `settingsStore` (persistito) | Deve durare tra una sessione e l'altra. |
| `phase`, `variant` | `useState` in `MenuScene` | Muoiono con la schermata. I due componenti che li usano sono fratelli: basta il genitore comune. |
| posizione camera, opacità del titolo, chi è già esploso | ref e oggetti Three | Cambiano a ogni fotogramma. In React causerebbero 60 render al secondo. |

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

## 2. L'MVP: un muro fatto di cubi

### Perché InstancedRigidBodies

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

## 5. Step 2: il muro pre-fratturato da Blender

### In Blender

1. **Abilita l'addon**: `Edit ▸ Preferences ▸ Add-ons`, cerca *Cell Fracture*
   (è incluso in Blender, va solo attivato).
2. Modella il muro, poi `Object ▸ Quick Effects ▸ Cell Fracture`.
   - *Source*: `Own Verts` o `Own Particles` — con le particelle controlli
     dove i frammenti sono più fitti (utile: più piccoli al centro).
   - *Noise*: 0.3–0.5, altrimenti i tagli sembrano geometrici.
   - *Recursion*: 1–2 solo sui frammenti centrali, se ne vuoi di più piccoli lì.
   - Punta a **80–150 frammenti**, non di più: vedi la sezione performance.
3. **Applica le trasformazioni** su tutti i frammenti: `Ctrl+A ▸ All Transforms`.
   Se non lo fai, scale e rotazioni residue arrivano in Rapier come collider
   deformati.
4. **Sposta ogni origine sul proprio centro di massa**:
   `Object ▸ Set Origin ▸ Origin to Center of Mass (Volume)`.
   **È il passaggio che si dimentica sempre.** Cell Fracture lascia a tutti i
   frammenti l'origine del muro originale: senza questa correzione ogni
   frammento ruota attorno a un punto lontanissimo e l'esplosione sembra un
   frullatore.
5. **Nomina i frammenti con un prefisso**: `shard_000`, `shard_001`, … Servirà
   al codice per distinguerli da eventuali altri oggetti nel file.
6. **Esporta** `File ▸ Export ▸ glTF 2.0 (.glb)`:
   - `Include ▸ Selected Objects`
   - `Transform ▸ +Y Up` (Three usa Y in alto, Blender Z)
   - `Data ▸ Mesh ▸ Apply Modifiers`
   - `Compression ▸ Draco` se il file supera qualche MB

### Nel codice

Il punto è che **`buildWallChunks` è l'unica cosa da sostituire**. Deve produrre
la stessa forma di dati, letta dal GLB invece che da una griglia:

```tsx
import { useGLTF } from '@react-three/drei';
import { Mesh, Vector3 } from 'three';

useGLTF.preload(`${import.meta.env.BASE_URL}models/wall.glb`);

function useWallShards() {
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}models/wall.glb`);

  return useMemo(() => {
    const position = new Vector3();
    const shards: WallChunk[] = [];

    scene.traverse((object) => {
      if (!(object instanceof Mesh) || !object.name.startsWith('shard_')) return;
      // getWorldPosition, non object.position: i frammenti possono essere
      // annidati dentro gruppi e il locale non basta.
      object.getWorldPosition(position);
      shards.push({
        index: shards.length,
        position: [position.x, position.y, position.z],
        geometry: object.geometry,      // al posto di `size`
        shade: /* deterministico dall'indice, come ora */ 0
      });
    });

    return shards;
  }, [scene]);
}
```

Poi, al posto di `InstancedRigidBodies`, un `<RigidBody>` per frammento
(le geometrie sono tutte diverse, quindi l'instancing non si applica):

```tsx
{shards.map((shard) => (
  <RigidBody
    key={shard.index}
    ref={(body) => { bodies.current[shard.index] = body; }}
    type="fixed"
    colliders="hull"          // ← vedi sotto
    position={shard.position}
  >
    <mesh geometry={shard.geometry} material={stoneMaterial} castShadow />
  </RigidBody>
))}
```

**`colliders="hull"` è la scelta giusta e non è un compromesso**: Cell Fracture
produce celle *convesse*, e per una forma convessa l'inviluppo convesso è la
forma esatta. Costa quanto una scatola e non ha buchi.

Da lì in poi la logica degli impulsi — `planBreak`, il cursore in `useFrame`,
`setBodyType` — resta **identica**. È il ritorno sull'investimento del punto 3.

Un dettaglio: le posizioni nel `.glb` sono quelle di Blender. O modelli il muro
già dove lo vuoi, oppure sposti tutto con un `<group position={...}>` esterno —
ma allora ricordati che le origini dei frammenti vanno prese in coordinate
mondo (`getWorldPosition`), altrimenti gli impulsi puntano dalla parte
sbagliata.

---

## 6. Il personaggio che tira il pugno

### Esportare da Blender

- Rigga con **Rigify** o, molto più veloce, carica il modello su **Mixamo** e
  scarica l'animazione *punch* già applicata.
- Una sola armatura per file. Rinomina l'azione in modo riconoscibile
  (`Punch`, `Idle`): quel nome diventa la chiave in `actions`.
- Esporta `.glb` con `Include ▸ Armature` e, in `Animation`, spunta
  `Always Sample Animations`. Se usi le NLA strips, esporta come azioni.
- **Misura in Blender il frame in cui il pugno tocca il muro** e converti in
  secondi: `frame / fps`. Ti serve subito dopo.

### Nel codice

```tsx
const group = useRef<Group>(null);
const { scene, animations } = useGLTF(`${import.meta.env.BASE_URL}models/hero.glb`);
const { actions } = useAnimations(animations, group);

useEffect(() => {
  if (phase !== 'breaking') return;
  const punch = actions.Punch;
  if (!punch) return;

  punch.reset();
  punch.setLoop(LoopOnce, 1);
  punch.clampWhenFinished = true;   // resta sull'ultimo frame invece di tornare in T-pose
  actions.Idle?.crossFadeTo(punch, 0.15, false);
  punch.play();
}, [phase, actions]);
```

### La sincronizzazione

Questa è la parte che conta, e l'aggancio è già pronto:
`VARIANT_IMPACT_DELAY.punch`. Oggi vale `0.55` a occhio; domani ci metti il
tempo misurato in Blender, e **camera, audio, scossone e rottura del muro si
riallineano tutti insieme**, perché leggono tutti da lì.

Preferisci questo (guidato dalla timeline) all'alternativa "ascolta un evento
del mixer": gli eventi di `AnimationMixer` sono solo `finished` e `loop`, che
arrivano troppo tardi, e controllare `action.time` a ogni frame reintroduce
un secondo orologio da tenere allineato. Un numero solo, letto da tutti, è
più robusto.

**Bonus, quando ci arrivi**: prendi il punto d'impatto dal pugno vero invece
che dalla costante in `VARIANT_ORIGIN`:

```ts
const fist = scene.getObjectByName('mixamorigRightHand');
fist?.getWorldPosition(impactPoint);
// e passa impactPoint come `origin` a planBreak
```

Così se sposti il personaggio, il buco nel muro si sposta da solo.

---

## 7. Performance

### Cosa costa davvero

| Voce | Impatto | Cosa fare |
|---|---|---|
| Draw call | alto | Instancing per i cubi (già fatto). Per i frammenti Blender, un solo materiale condiviso da tutti. |
| Numero di corpi | alto | 80–200 va bene. Oltre i ~400 dinamici insieme, Rapier soffre anche su desktop. |
| Tipo di collider | **altissimo** | `cuboid` e `ball` sono quasi gratis, `hull` è economico, **`trimesh` su corpi dinamici va evitato**: è instabile e lentissimo. Con Cell Fracture usa sempre `hull`. |
| Ombre | alto | Una luce che proietta ombre rifà la scena da capo per la shadow map. Verifica il frustum: quello di default copre ~10 unità, su un muro da 40 le ombre spariscono. |
| `dpr` | **altissimo su mobile** | Un telefono con dpr 3 disegna 9× i pixel. `dpr={[1, 1.75]}` (già impostato) è il singolo intervento più efficace. |
| Peso degli asset | medio | Draco sui `.glb`, KTX2/basis sulle texture, texture ≤ 2048 (≤ 1024 su mobile). |

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
