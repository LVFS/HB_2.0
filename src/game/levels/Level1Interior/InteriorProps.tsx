import { Component, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import { Sprite2D } from '@/game/render2d/Sprite2D';
import type { LevelProp } from './ldtk/parseLevelGeometry';
import { ISO_CAMERA_AZIMUTH, PROP_DEFAULT_HEIGHT, PROP_TARGET_HEIGHTS, WORLD_UNIT_PER_CELL } from './interiorConfig';
import { MODEL_SPRITE_PREFIX, getPropModelUrl, getPropSpriteUrl } from './propSprites';

interface InteriorPropsProps {
  props: LevelProp[];
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * Un modello mancante o con il nome sbagliato in LDtk (es. un refuso in
 * `model:nome`) non deve mandare in crash l'intero <Canvas>: si salta quel
 * prop e si avvisa in console. Serve una classe perché l'errore arriva da un
 * loader Suspense (stesso motivo di `IslandCapErrorBoundary`).
 */
class PropModelErrorBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn(`Modello prop "${this.props.name}" non caricabile (nome sbagliato in LDtk?):`, error.message);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Prop 3D (`spriteId` = `model:nome`, file `public/models/props/nome.glb`):
 * a differenza degli sprite piatti, un modello ha una forma vera e si può
 * girare a piacere con `rotY` (es. 90 per una porta su un muro laterale) —
 * niente rotazione automatica verso la camera. L'altezza si scala dal
 * bounding box reale del modello verso l'altezza-bersaglio.
 */
function PropModel({ name, height }: { name: string; height: number }) {
  const gltf = useGLTF(getPropModelUrl(name));
  const { object, scale } = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const size = new Box3().setFromObject(clone).getSize(new Vector3());
    return { object: clone, scale: size.y > 0 ? height / size.y : 1 };
  }, [gltf, height]);
  return <primitive object={object} scale={scale} />;
}

/**
 * Arredi (`Prop` in LDtk). Due tipi:
 * - sprite piatti (default), pensati per un'unica angolazione, quella della
 *   camera isometrica fissa (vedi FASE5_INTERNO_ISOMETRICO.md): un
 *   `rotation.y` fisso pari all'azimuth della camera basta e avanza;
 * - modelli 3D (`model:nome`), vedi `PropModel`.
 */
export function InteriorProps({ props }: InteriorPropsProps) {
  return (
    <>
      {props.map((prop, index) => {
        const height = (PROP_TARGET_HEIGHTS[prop.spriteId] ?? PROP_DEFAULT_HEIGHT) * prop.scale;
        const position: [number, number, number] = [
          (prop.col + prop.offsetX) * WORLD_UNIT_PER_CELL,
          prop.offsetY,
          (prop.row + prop.offsetZ) * WORLD_UNIT_PER_CELL
        ];

        if (prop.spriteId.startsWith(MODEL_SPRITE_PREFIX)) {
          const modelName = prop.spriteId.slice(MODEL_SPRITE_PREFIX.length);
          return (
            <group key={index} position={position} rotation={[0, prop.rotY * DEG_TO_RAD, 0]}>
              <PropModelErrorBoundary name={modelName}>
                <PropModel name={modelName} height={height} />
              </PropModelErrorBoundary>
            </group>
          );
        }

        return (
          <group key={index} position={position} rotation={[0, ISO_CAMERA_AZIMUTH + prop.rotY * DEG_TO_RAD, 0]}>
            <Sprite2D textureUrl={getPropSpriteUrl(prop.spriteId)} height={height} position={[0, height / 2, 0]} />
          </group>
        );
      })}
    </>
  );
}
