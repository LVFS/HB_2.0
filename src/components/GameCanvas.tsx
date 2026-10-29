import { Canvas, type Props } from '@react-three/fiber';
import { usePauseStore } from '@/store/pauseStore';

/**
 * Il `<Canvas>` delle scene di gioco: identico a quello di R3F, ma si ferma in pausa (`frameloop="never"`: nessun `useFrame`
 * gira e l'ultima immagine resta a schermo). Tutte le scene dei livelli lo usano al posto di `Canvas` — vedi `pauseStore`.
 */
export function GameCanvas(props: Props) {
  const paused = usePauseStore((state) => state.paused);
  return <Canvas {...props} frameloop={paused ? 'never' : 'always'} />;
}
