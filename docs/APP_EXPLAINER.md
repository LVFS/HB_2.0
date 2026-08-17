# Epic Birthday Quest - Spiegazione completa

Questo file descrive come funziona l'app attualmente e include spiegazioni base su React, Zustand, Three.js e le librerie usate.

---

## 1. Architettura generale dell'app

Questa app è una single page application (SPA) costruita con React e Vite.

- `index.html` è il punto di ingresso del browser.
- `src/main.tsx` monta il componente principale `App` dentro il DOM.
- `src/App.tsx` decide quale parte dell'app mostrare in base allo stato globale del gioco.
- Il progetto usa React per l'interfaccia, `@react-three/fiber` per la grafica 3D e `zustand` per lo stato globale.

### Stato dell'app

Lo stato globale è gestito da `src/store/gameStore.ts` con Zustand.

- `screen`: indica quale schermata mostrare. Oggi i valori sono:
  - `menu` → menu iniziale cinematografico
  - `levelSelect` → selezione livelli
  - `game` → scena di gioco principale
- `collectedFragmentIds`: elenco degli id dei frammenti già raccolti.
- `selectedLevel`: id del livello selezionato nella schermata di selezione.

Zustand è una libreria molto leggera per lo stato globale. Invece di usare Redux o context pesante, si crea uno store con `create()` e poi si leggono solo le parti necessarie.

### Dati statici vs stato

Nello store ci va **solo ciò che cambia**. I contenuti fissi del gioco stanno in `src/data/`:

- `src/data/levels.ts`: elenco dei livelli
- `src/data/fragments.ts`: id, nome, colore e posizione di ogni frammento

Il vantaggio è che sia la UI (`GameOverlay`) sia la scena 3D (`Fragments`) leggono dalla stessa fonte, senza che uno dei due debba importare dall'altro.

Nota sui frammenti: lo stato tiene gli **id** e non un semplice contatore. Con un contatore, ripassare sullo stesso frammento lo avrebbe contato due volte; con gli id il frammento raccolto sparisce dalla scena e non può essere ripreso.

### Alias `@/`

Gli import usano l'alias `@/` al posto dei percorsi relativi:

```tsx
import { useGameStore } from '@/store/gameStore'; // invece di '../../store/gameStore'
```

È configurato in due posti che devono restare allineati: `resolve.alias` in `vite.config.ts` (per il bundler) e `compilerOptions.paths` in `tsconfig.json` (per TypeScript).

---

## 2. Flusso dell'app corrente

### 2.1 `src/main.tsx`

Questo file monta React sul DOM:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- `ReactDOM.createRoot(...)` crea il root di React.
- `<App />` è il componente principale.
- `React.StrictMode` è un wrapper utile in sviluppo per evidenziare problemi comuni.

### 2.2 `src/App.tsx`

`App` decide quale schermata mostrare:

- `MenuScene` quando lo stato è `menu`
- `LevelSelectScene` quando lo stato è `levelSelect`
- `SceneManager` quando lo stato è `game`

Questo è il cuore del flusso: la UI cambia in base al valore di `screen`.

`App` chiama anche l'hook `useBackgroundMusic()`, che tiene viva la musica di sottofondo per tutta la durata dell'app, indipendentemente dalla schermata attiva.

---

## 3. Componenti principali

### 3.1 `src/game/menu/MenuScene.tsx`

Questa scena è il menu iniziale 3D: un'intera "ambientazione di ingresso"
(strada, cartello di benvenuto, case, un distributore di benzina, i binari
del treno) con in fondo un muro stile Attack on Titan che chiude la strada,
con un portone al centro. `MenuScene` possiede la **fase** (una macchina a
stati, non solo "aperto/chiuso") e delega la parte 3D a
`MainMenuSceneAnimation.tsx` e l'overlay HTML a `MainMenuOverlay.tsx`.

Le fasi, in ordine (`menuPhase.ts`):

1. `intro` — la camera vola dall'alto verso l'inquadratura ferma sul muro.
2. `ready` — muro intatto in attesa, a schermo compare "Premi un tasto per
   iniziare"; qualunque input (tastiera, mouse/touch, gamepad) avvia la
   sequenza — niente più un pulsante da cliccare.
3. `punching` — parte una sequenza cinematica: un personaggio (stile Saitama)
   entra in scena, recita, poi scatta verso il muro e lo colpisce.
4. `breaking` — il pugno ha innescato la rottura vera e propria del muro
   (fisica dei detriti); a rottura finita si passa alla schermata
   `levelSelect`.

Il muro non è un modello unico: è fatto di centinaia di frammenti pre-rotti
in Blender (vedi `docs/MENU_INTRO.md`), ma solo quelli vicini al punto colpito
diventano fisici — il resto resta scenografia immobile.

Librerie usate:

- `@react-three/fiber`: per creare una scena 3D dentro React.
- `@react-three/drei`: componenti utili come `Environment`, `Text`, `Sky`,
  `Cloud`, `useGLTF` (per caricare i modelli `.glb` esportati da Blender).
- `@react-three/rapier`: la fisica dei detriti quando il muro si rompe.
- `gsap`: tutte le animazioni "a comando" (camera, personaggio, dissolvenze).
- `three`: usata per vettori e tipi di mesh.

Alcuni dettagli tecnici:

- `CameraDirector` (dentro `MainMenuSceneAnimation.tsx`) usa `useFrame` per
  aggiornare la camera ad ogni fotogramma nelle fasi `intro`/`ready`/`breaking`.
- `CharacterIntro` (`game/menu/character/`) fa lo stesso lavoro nelle fasi
  `punching`/`breaking`: i due si escludono a vicenda, mai attivi insieme.
- l'overlay in HTML è mostrato sopra la scena 3D con CSS.

### 3.2 `src/game/menu/LevelSelectScene.tsx`

Questa scena mostra i livelli come punti fisici nella scena.

Cosa fa:

- legge `levels` da `src/data/levels.ts`
- crea un cilindro per ogni livello, posizionato nello spazio 3D
- consente di cliccare sul cilindro per selezionare un livello
- mostra i dettagli del livello selezionato in un overlay HTML
- il pulsante `Avvia livello` porta al `screen` `game`

Il modello è semplice, ma la logica è già pronta per aggiungere altri elementi come colline, modelli 3D o descrizioni più complesse.

### 3.3 `src/game/levels/Level1/SceneManager.tsx`

(rinominato da `src/game/scene/` per supportare più livelli in futuro — se
una fonte più vecchia cita `game/scene/`, è superata)

Questa è la scena di gioco vera e propria.

Cosa fa:

- mostra `GameOverlay`, un pannello di gioco con missione, anteprima frammenti e controlli
- crea una scena 3D con `Canvas`
- aggiunge luci e `Physics` per la fisica
- inserisce `EnvironmentScene`, `Player` e `Fragments`
- usa `OrbitControls` per consentire la rotazione della camera con il mouse

I contenuti 3D sono avvolti in `<Suspense>`: componenti come `Environment` e `Text` caricano asset in modo asincrono e "sospendono" il render, e senza un boundary React solleverebbe un errore invece di aspettare.

### 3.4 `src/components/GameOverlay.tsx`

L'overlay mostra informazioni in HUD:

- contatore frammenti raccolti
- anteprima dei frammenti con colori
- mini-guida ai controlli

Il componente legge `collectedFragmentIds` dallo store e mostra l'elenco di `fragments` preso da `src/data/fragments.ts`.

---

## 4. Dettagli di React

### 4.1 Componente funzionale

Ogni file `.tsx` definisce un componente React funzionale:

```tsx
export function MenuScene() {
  return <div>...</div>;
}
```

Questa è la forma più comune in React moderno.

### 4.2 JSX

Il codice HTML-like che vedi dentro il `return` si chiama JSX.
È tradotto da Vite/TypeScript in `React.createElement(...)`.

Esempio:

```tsx
<div className="menu-title">Epic Birthday Quest</div>
```

Questo crea una `div` con classe CSS `menu-title`.

### 4.3 Hook principali

React usa gli hook per gestire stato e effetti.

- `useState`: conserva uno stato locale al componente.
- `useEffect`: esegue codice dopo il render, utile per side effect.
- `useRef`: conserva valori che non causano un nuovo render quando cambiano.

Esempio:

```tsx
const [doorOpen, setDoorOpen] = useState(false);
```

### 4.4 Condizionale rendering

React mostra un componente solo se la condizione è vera:

```tsx
{screen === 'menu' && <MenuScene />}
```

Questo è il modo in cui facciamo passare tra menu, selezione livello e gioco.

---

## 5. Dettagli di Three.js e @react-three/fiber

### 5.1 `@react-three/fiber`

È un renderer React per Three.js. Ti permette di scrivere scene 3D come componenti React.

Esempio:

```tsx
<Canvas shadows camera={{ position: [0, 4, 8], fov: 55 }}>
  <ambientLight intensity={0.45} />
  <mesh>
    <sphereGeometry args={[0.8, 32, 32]} />
  </mesh>
</Canvas>
```

### 5.2 `@react-three/drei`

È una raccolta di componenti utili per scene 3D: luci, testo, controlli, ambiente.

Nel progetto usiamo:

- `Environment`: crea luce ambientale e riflessi
- `Text`: scrive testo 3D nella scena
- `OrbitControls`: permette di ruotare la camera con il mouse

### 5.3 `Rapier` e fisica

`@react-three/rapier` collega Rapier alla scena 3D.

- `Physics` crea un contenitore fisico.
- `RigidBody` trasforma un oggetto in un corpo fisico.

Nel gioco, `Player` e `Fragments` usano `RigidBody` per muoversi e interagire.

---

## 6. Spiegazione dei componenti di gioco

### 6.1 `src/game/levels/Level1/Player.tsx`

Rappresenta il giocatore come una sfera fisica.

- ascolta i tasti con `window.addEventListener('keydown')`
- aggiorna la sua velocità in `useFrame`, che viene chiamato ogni fotogramma
- `body.current.setLinvel(...)` imposta la velocità del corpo fisico
- quando il giocatore tocca il suolo, può saltare di nuovo

Attenzione a un dettaglio importante: il fatto di essere a terra è tenuto in una `useRef`, non in uno `useState`. Chiamare `setState` dentro `useFrame` farebbe ri-renderizzare React decine di volte al secondo. **Regola generale in react-three-fiber: lo stato che cambia a ogni fotogramma va in una ref.**

### 6.2 `src/game/levels/Level1/Fragments.tsx`

Rappresenta gli oggetti da raccogliere.

- i dati (id, nome, colore, posizione) arrivano da `src/data/fragments.ts`
- il `RigidBody` ha la prop `sensor`: senza, Rapier tratterebbe il frammento come un ostacolo solido e non emetterebbe mai `onIntersectionEnter`
- quando il giocatore attraversa un frammento, `collectFragment(id)` aggiorna lo stato globale e la mesh smette di essere renderizzata

### 6.3 `src/game/levels/Level1/EnvironmentScene.tsx`

Dà un pavimento e alcuni oggetti decorativi.

- `RigidBody type="fixed"` significa che la superficie non si muove
- le mesh semplici definiscono l'ambiente di gioco

---

## 7. CSS e layout

Lo stile è diviso in due categorie.

**Globale** — `src/styles/global.css`, importato una volta sola in `main.tsx`.
Contiene solo ciò che non appartiene a un componente specifico: reset, sfondo
della pagina, `.app-shell`, `.scene-shell` e il `canvas` a tutto schermo.

**CSS Modules** — un file `NomeComponente.module.css` accanto a ogni componente.
Si usano importandoli:

```tsx
import styles from './GameOverlay.module.css';

<aside className={styles.overlay}>
```

In fase di build la classe `.overlay` diventa qualcosa come `_overlay_a1b2c_3`.
Il vantaggio è che due componenti possono avere entrambi una classe `.card`
senza pestarsi i piedi: prima, con un unico file globale, bastava un nome
ripetuto per rompere una schermata diversa da quella su cui stavi lavorando.

I pezzi condivisi da più schermate (pulsanti, pannelli, titoli) stanno in
`src/styles/ui.module.css`. Per riusarli senza ripetere le regole si usa
`composes`:

```css
.primary {
  composes: button;   /* eredita tutte le regole di .button */
  background: linear-gradient(135deg, #60a5fa, #38bdf8);
}
```

In JSX basta la sola classe `ui.primary`: React riceverà entrambe.

Attenzione a un limite: TypeScript **non** verifica i nomi delle classi dei
moduli CSS. Se scrivi `styles.overlya` non ottieni un errore di compilazione,
solo un elemento senza stile. È l'unico punto del progetto dove un typo passa
silenziosamente.

La UI è pensata per essere leggibile sopra la scena 3D senza coprirla troppo.

---

## 7-bis. Come è diviso il bundle

Il gioco carica tre librerie molto pesanti: three.js, drei e il motore fisico
Rapier. Se finissero tutte in un unico file, aprire il menu significherebbe
scaricare oltre 3 MB prima di vedere qualsiasi cosa.

Due meccanismi lo evitano.

**1. Schermate caricate a richiesta.** In `App.tsx` le tre schermate sono
importate con `lazy()`:

```tsx
const SceneManager = lazy(() =>
  import('@/game/levels/Level1/SceneManager').then((m) => ({ default: m.SceneManager }))
);
```

Il codice della scena di gioco — e con lui Rapier, che pesa da solo ~2 MB
perché include il WebAssembly del motore fisico — viene scaricato solo quando
premi "Avvia livello". `<Suspense>` in `App.tsx` mostra il fallback nell'attesa.

**2. Librerie in chunk separati.** In `vite.config.ts`, l'opzione
`codeSplitting.groups` con `entriesAware: true` raggruppa le dipendenze in base
a quali schermate le usano davvero. Il risultato sono file come
`vendor~MenuScene~LevelSelectScene.js` (usato da due schermate) e
`vendor~SceneManager.js` (solo dal gioco).

Il primo caricamento della pagina è passato da ~3,3 MB a ~190 KB.

Nota: `npm run build` segnala ancora che un chunk supera i 500 KB. È quello di
Rapier: 2 MB di motore fisico non si comprimono, e l'unica cosa sensata era
spostarli fuori dal percorso di avvio — cosa che ora è fatta.

---

## 8. Come modificare e imparare

### Se vuoi cambiare il menu iniziale

1. Apri `src/game/menu/MenuScene.tsx` per capire il flusso delle fasi
2. Modifica `CameraDirector` (dentro `MainMenuSceneAnimation.tsx`) per
   cambiare la traiettoria della camera nelle fasi intro/ready/breaking, o
   `CharacterIntro` (`game/menu/character/`) per la sequenza del personaggio
3. Modifica il muro/portone (Blender, vedi `docs/MENU_INTRO.md`) o aggiungi
   oggetti 3D nella scena
4. Cambia il testo dell'overlay HTML in `MainMenuOverlay.tsx`

### Se vuoi aggiungere livelli

1. Aggiungi nuovi oggetti in `src/data/levels.ts` dentro `levels`
2. Modifica `LevelSelectScene.tsx` per visualizzare più dettagli
3. Collega `selectedLevel` alla logica di avvio del livello

### Se vuoi aggiungere frammenti

Basta aggiungere una riga in `src/data/fragments.ts`: la scena 3D e l'HUD si aggiornano da soli, perché leggono entrambi da lì.

### Se vuoi imparare React

- `useState` serve per memorizzare dato locale a un componente
- `useEffect` esegue codice dopo il render
- `props` sono i dati che passi ai componenti
- `JSX` è il modo di scrivere l'HTML dentro JavaScript

Esempio base:

```tsx
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>
      {count}
    </button>
  );
}
```

### Se vuoi imparare `zustand`

- è uno store globale semplice
- puoi leggere solo quello che ti serve, come `useGameStore((state) => state.screen)`
- è più leggero di Redux

---

## 9. Struttura dei file attuale

- `src/App.tsx`: router delle schermate (con caricamento lazy)
- `src/main.tsx`: bootstrap dell'app
- `src/styles/global.css`: stili globali (reset e layout di pagina)
- `src/styles/ui.module.css`: pulsanti, pannelli e titoli condivisi
- `src/data/levels.ts`: dati statici dei livelli
- `src/data/fragments.ts`: dati statici dei frammenti
- `src/store/gameStore.ts`: stato globale del gioco
- `src/store/settingsStore.ts`: impostazioni audio, persistite in localStorage
- `src/hooks/useBackgroundMusic.ts`, `useSfx.ts`: musica di sottofondo ed effetti (Howler)
- `src/game/menu/MenuScene.tsx`: menu iniziale, possiede la fase (macchina a stati)
- `src/game/menu/MainMenuSceneAnimation.tsx`: parte 3D del menu (camera nelle fasi
  intro/ready/breaking, luci, cielo)
- `src/game/menu/MainMenuOverlay.tsx`: overlay HTML del menu
- `src/game/menu/menuPhase.ts`: tipo delle fasi (`intro`/`ready`/`punching`/`breaking`)
- `src/game/menu/wall/`: l'ambientazione e il muro distruttibile
  - `environmentModel.ts`: carica `ingresso-oristano.glb`, scopre i frammenti rompibili
  - `wallConfig.ts`: URL modello, punto d'origine del portone, forza degli impulsi
  - `Wall.tsx`: l'ambientazione intatta; `WallShatter.tsx`: la rottura vera e propria
  - `breakPatterns/`: le varianti di rottura (esplosione/crollo/pugno), una funzione pura ciascuna
- `src/game/menu/character/`: la sequenza cinematica del personaggio prima della rottura
  - `characterConfig.ts`: coreografie disponibili e durate di ogni fase
  - `characterModel.ts`: carica i due modelli del personaggio
  - `CharacterIntro.tsx`: la timeline GSAP che orchestra camera e personaggio
- `src/game/menu/LevelSelectScene.tsx`: selezione dei livelli
- `src/game/levels/Level1/SceneManager.tsx`: scena di gioco principale
- `src/components/GameOverlay.tsx`: HUD di gioco
- `src/game/levels/Level1/Player.tsx`: controlli e movimento del giocatore
- ogni componente con stili propri ha accanto il suo `*.module.css`
- `src/game/levels/Level1/Fragments.tsx`: frammenti da raccogliere
- `src/game/levels/Level1/EnvironmentScene.tsx`: ambiente della scena
- `public/audio/theme.mp3`: musica del tema
- `public/models/`: i modelli `.glb` esportati da Blender (ambientazione del menu e
  personaggio) — vedi `docs/MENU_INTRO.md` per come sono fatti e da dove vengono

Tutto ciò che sta in `public/` viene copiato così com'è nella build ed è
raggiungibile da URL assoluto (`/audio/theme.mp3`). Un file messo fuori da
`public/` funziona in `npm run dev` ma **non finisce in `dist/`**.

---

## 10. Prossimi passi consigliati

Se vuoi imparare con calma, questi sono i pezzi migliori da studiare in ordine:

1. `src/App.tsx` — capisci il flusso principale
2. `src/store/gameStore.ts` — guarda come cambia lo stato globale
3. `src/game/menu/MenuScene.tsx` — vedi la scena 3D del menu
4. `src/game/menu/LevelSelectScene.tsx` — impara come funzionano i livelli
5. `src/game/levels/Level1/SceneManager.tsx` — entra nel gioco vero e proprio

Buono studio! Se vuoi, posso anche creare un secondo file con una mini-guida punto per punto su come modificare un elemento specifico (ad esempio aggiungere un nuovo livello o cambiare i controlli).