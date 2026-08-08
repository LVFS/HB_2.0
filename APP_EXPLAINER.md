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
- `fragmentsFound`: conta quanti frammenti sono stati raccolti in gioco.
- `selectedLevel`: id del livello selezionato nella schermata di selezione.
- `levels`: array che descrive i livelli disponibili.

Zustand è una libreria molto leggera per lo stato globale. Invece di usare Redux o context pesante, si crea uno store con `create()` e poi si leggono solo le parti necessarie.

---

## 2. Flusso dell'app corrente

### 2.1 `src/main.tsx`

Questo file monta React sul DOM:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

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

---

## 3. Componenti principali

### 3.1 `src/game/menu/MenuScene.tsx`

Questa scena è il menu iniziale 3D.

Cosa fa:

- genera una camera che parte dal basso e vola verso un portone
- disegna un ambiente semplice con una piattaforma e un portone
- mostra un overlay HTML in cui ci sono le azioni `Gioca` e `Seleziona livello`
- se premi `Gioca`, apre il portone e poi passa a `levelSelect`

Libriere usate:

- `@react-three/fiber`: per creare una scena 3D dentro React.
- `@react-three/drei`: fornisce componenti utili come `Environment` e `Text`.
- `three`: usata per vettori e tipi di mesh.

Alcuni dettagli tecnici:

- `CameraIntro` usa `useFrame` per aggiornare la camera ad ogni fotogramma.
- `DoorFrame` ruota le due ante della porta quando l'utente preme `Gioca`.
- l'overlay in HTML è mostrato sopra la scena 3D con CSS.

### 3.2 `src/game/menu/LevelSelectScene.tsx`

Questa scena mostra i livelli come punti fisici nella scena.

Cosa fa:

- legge `levels` dallo store
- crea un cilindro per ogni livello, posizionato nello spazio 3D
- consente di cliccare sul cilindro per selezionare un livello
- mostra i dettagli del livello selezionato in un overlay HTML
- il pulsante `Avvia livello` porta al `screen` `game`

Il modello è semplice, ma la logica è già pronta per aggiungere altri elementi come colline, modelli 3D o descrizioni più complesse.

### 3.3 `src/game/scene/SceneManager.tsx`

Questa è la scena di gioco vera e propria.

Cosa fa:

- mostra `GameOverlay`, un pannello di gioco con missione, anteprima frammenti e controlli
- crea una scena 3D con `Canvas`
- aggiunge luci e `Physics` per la fisica
- inserisce `EnvironmentScene`, `Player` e `Fragments`
- usa `OrbitControls` per consentire la rotazione della camera con il mouse

### 3.4 `src/components/GameOverlay.tsx`

L'overlay mostra informazioni in HUD:

- contatore frammenti raccolti
- anteprima dei frammenti con colori
- mini-guida ai controlli

Il componente legge `fragmentsFound` dallo store e mostra l'elenco di `fragmentData`.

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

### 6.1 `src/game/scene/Player.tsx`

Rappresenta il giocatore come una sfera fisica.

- ascolta i tasti con `window.addEventListener('keydown')`
- aggiorna la sua velocità in `useFrame`, che viene chiamato ogni fotogramma
- `body.current.setLinvel(...)` imposta la velocità del corpo fisico
- quando il giocatore tocca il suolo, può saltare di nuovo

### 6.2 `src/game/scene/Fragments.tsx`

Rappresenta gli oggetti da raccogliere.

- `fragmentData` contiene nome e colore di ogni frammento
- `fragmentPositions` indica dove posizionarli nella scena
- quando il giocatore entra in contatto con un frammento, `addFragment()` aggiorna lo stato globale

### 6.3 `src/game/scene/EnvironmentScene.tsx`

Dà un pavimento e alcuni oggetti decorativi.

- `RigidBody type="fixed"` significa che la superficie non si muove
- le mesh semplici definiscono l'ambiente di gioco

---

## 7. CSS e layout

Tutto lo stile è in `src/styles.css`.

- `app-shell` definisce il layout principale
- `canvas` è impostato per occuparsi dell'intera altezza
- `game-overlay` e `menu-hero-overlay` sono pannelli fissi sopra la scena 3D
- i pulsanti hanno classi `.primary` e `.secondary`

La UI è pensata per essere leggibile sopra la scena 3D senza coprirla troppo.

---

## 8. Come modificare e imparare

### Se vuoi cambiare il menu iniziale

1. Apri `src/game/menu/MenuScene.tsx`
2. Modifica `CameraIntro` per cambiare la traiettoria della camera
3. Modifica il portone o aggiungi oggetti 3D nella scena
4. Cambia il testo dell'overlay HTML

### Se vuoi aggiungere livelli

1. Aggiungi nuovi oggetti in `src/store/gameStore.ts` dentro `levels`
2. Modifica `LevelSelectScene.tsx` per visualizzare più dettagli
3. Collega `selectedLevel` alla logica di avvio del livello

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

- `src/App.tsx`: router delle schermate
- `src/main.tsx`: bootstrap dell'app
- `src/styles.css`: stili globali
- `src/store/gameStore.ts`: stato globale del gioco
- `src/game/menu/MenuScene.tsx`: menu iniziale cinematico
- `src/game/menu/LevelSelectScene.tsx`: selezione dei livelli
- `src/game/scene/SceneManager.tsx`: scena di gioco principale
- `src/components/GameOverlay.tsx`: HUD di gioco
- `src/game/scene/Player.tsx`: controlli e movimento del giocatore
- `src/game/scene/Fragments.tsx`: frammenti da raccogliere
- `src/game/scene/EnvironmentScene.tsx`: ambiente della scena
- `src/game/AudioManager.ts`: gestione audio di base

---

## 10. Prossimi passi consigliati

Se vuoi imparare con calma, questi sono i pezzi migliori da studiare in ordine:

1. `src/App.tsx` — capisci il flusso principale
2. `src/store/gameStore.ts` — guarda come cambia lo stato globale
3. `src/game/menu/MenuScene.tsx` — vedi la scena 3D del menu
4. `src/game/menu/LevelSelectScene.tsx` — impara come funzionano i livelli
5. `src/game/scene/SceneManager.tsx` — entra nel gioco vero e proprio

Buono studio! Se vuoi, posso anche creare un secondo file con una mini-guida punto per punto su come modificare un elemento specifico (ad esempio aggiungere un nuovo livello o cambiare i controlli).