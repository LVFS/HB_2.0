import { fragmentData } from '../game/scene/Fragments';
import { useGameStore } from '../store/gameStore';

// GameOverlay è il piccolo pannello laterale visibile mentre giochi.
// Mostra informazioni utili senza interferire con la scena 3D.
export function GameOverlay() {
  const fragmentsFound = useGameStore((state) => state.fragmentsFound);

  return (
    <aside className="game-overlay">
      {/* Primo blocco: missione e contatore */}
      <div className="overlay-card">
        <div className="overlay-title">Missione</div>
        <div className="overlay-text">Raccogli tutti i frammenti verdi</div>
        <div className="fragment-counter">{fragmentsFound} / {fragmentData.length}</div>
      </div>

      {/* Secondo blocco: anteprima dei frammenti */}
      <div className="overlay-card preview-card">
        <div className="overlay-title">Anteprima frammenti</div>
        <div className="fragment-preview-list">
          {fragmentData.map((item, index) => (
            <div
              key={item.label}
              className={`fragment-preview-item ${index < fragmentsFound ? 'collected' : ''}`}
            >
              {/* Il colore dell'icona corrisponde al frammento nella scena 3D */}
              <span className="fragment-badge" style={{ backgroundColor: item.color }} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Terzo blocco: guida rapida ai controlli */}
      <div className="overlay-card controls-card">
        <div className="overlay-title">Controlli</div>
        <div className="control-row">
          <span className="control-key">W/A/S/D</span>
          <span className="control-label">Muovi</span>
        </div>
        <div className="control-row">
          <span className="control-key">Space</span>
          <span className="control-label">Salta</span>
        </div>
        <div className="control-row">
          <span className="control-key">Drag</span>
          <span className="control-label">Ruota telecamera</span>
        </div>
      </div>
    </aside>
  );
}
