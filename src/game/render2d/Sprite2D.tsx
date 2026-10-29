import { useEffect, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { useTexture } from '@react-three/drei';
import { NearestFilter, type MeshBasicMaterial } from 'three';

export interface Sprite2DProps {
  /** URL della texture: singola immagine, o sprite-sheet a griglia uniforme. */
  textureUrl: string;
  /** Colonne/righe della griglia dello sprite-sheet. 1x1 = texture singola. */
  columns?: number;
  rows?: number;
  /** Indice del fotogramma corrente, da sinistra a destra, riga per riga
   *  (riga 0 = quella più IN BASSO nel file immagine, per via delle UV di
   *  Three.js che partono dal basso). */
  frame?: number;
  /** Larghezza del piano in unità di mondo. Se omessa, si deriva dalla
   *  proporzione naturale della texture (larghezza/altezza del singolo
   *  fotogramma) — utile per sprite le cui pose hanno proporzioni diverse
   *  l'una dall'altra (vedi `Character2D`: un'altezza fissa con `width`
   *  calcolata evita di schiacciare/stirare le pose più strette o larghe). */
  width?: number;
  height: number;
  /** Specchia orizzontalmente via `scale`, non toccando le UV: più semplice
   *  e senza sorprese di winding rispetto a un repeat/offset negativo. */
  flipX?: boolean;
  position?: [number, number, number];
  /** Popolato con l'istanza del materiale: per chi deve animarne `opacity`/
   *  `color` direttamente via GSAP (crossfade, flash) — mai passando da uno
   *  state React, che con un valore che cambia ad ogni fotogramma di un
   *  tween causerebbe un render al secondo per ogni frame del tween. */
  materialRef?: MutableRefObject<MeshBasicMaterial | null>;
  /** Pixel art: ingrandisce senza sfumare (`NearestFilter`, niente mipmap). */
  pixelated?: boolean;
}

/**
 * Piano texturizzato per personaggi/oggetti "cutout" in 2D (vedi
 * docs/PIANO_LIVELLO1_2D.md, Fase 1 e Fase 3). Materiale non illuminato
 * (`meshBasicMaterial`): le illustrazioni sono già "finite" nel file, non
 * c'è bisogno di luci di scena per leggerle.
 *
 * La texture viene SEMPRE clonata: `useTexture` la mette in cache per URL,
 * quindi due `Sprite2D` con lo stesso `textureUrl` (es. due nemici con la
 * stessa sagoma) condividerebbero l'identico oggetto `Texture` — mutare
 * `offset`/`repeat` su quello per animare UNO sposterebbe il fotogramma
 * anche dell'altro. Il clone costa poco (nessun nuovo download, solo un
 * oggetto Texture in più) ed evita il bug.
 */
export function Sprite2D({
  textureUrl,
  columns = 1,
  rows = 1,
  frame = 0,
  width,
  height,
  flipX = false,
  position = [0, 0, 0],
  materialRef,
  pixelated = false
}: Sprite2DProps) {
  const baseTexture = useTexture(textureUrl);

  const texture = useMemo(() => {
    const clone = baseTexture.clone();
    if (pixelated) {
      clone.magFilter = NearestFilter;
      clone.minFilter = NearestFilter;
      clone.generateMipmaps = false;
    }
    clone.needsUpdate = true;
    return clone;
  }, [baseTexture, pixelated]);

  useEffect(() => () => texture.dispose(), [texture]);

  useEffect(() => {
    const col = frame % columns;
    const row = Math.floor(frame / columns);
    texture.repeat.set(1 / columns, 1 / rows);
    texture.offset.set(col / columns, 1 - (row + 1) / rows);
    texture.needsUpdate = true;
  }, [texture, frame, columns, rows]);

  // L'immagine è già decodificata a questo punto (`useTexture` sospende
  // finché non lo è): `.image.width/height` sono le dimensioni naturali
  // dell'intero file, un frame singolo è quella proporzione divisa per la
  // griglia dello sprite-sheet.
  const image = baseTexture.image as { width?: number; height?: number } | undefined;
  const frameAspect =
    image?.width && image?.height ? (image.width / columns) / (image.height / rows) : 1;
  const resolvedWidth = width ?? height * frameAspect;

  return (
    <mesh position={position} scale={[flipX ? -1 : 1, 1, 1]}>
      <planeGeometry args={[resolvedWidth, height]} />
      <meshBasicMaterial ref={materialRef} map={texture} transparent alphaTest={0.01} />
    </mesh>
  );
}
