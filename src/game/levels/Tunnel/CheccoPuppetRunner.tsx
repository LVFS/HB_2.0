import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color } from 'three';
import type { Group, Mesh, MeshBasicMaterial, OrthographicCamera } from 'three';
import { BOSS_HEIGHT } from '../BossArena/arenaConfig';
import { drawWarningTexture } from '../BossArena/bossWarnings';
import { PuppetFigure } from './PuppetFigure';
import { laneScale, laneZ } from './tunnelLanes';
import type { TunnelWorld } from './tunnelState';

const COLOR_WOOD = new Color('#cdb892');
const COLOR_FLASH = new Color('#ffffff');
/** Altezza massima dell'avviso (bordo alto visibile ≈ 6.3). */
const WARNING_MAX_Y = 5.3;
/** Quanto prima del bordo destro dello schermo si ferma l'avviso quando la marionetta è più lontana. */
const WARNING_EDGE_MARGIN = 1.3;

/**
 * La marionetta di Checco che corre davanti a D: a scatti, con i fili che
 * salgono dalla testa. Quando prepara un lancio si GIRA verso D e compare
 * l'avviso sopra la testa — rosso "PARA" (parabile: rimbalza), giallo "SALTA"
 * (non parabile, basso). Se è fuori schermo (non ancora rivelata, o lontana) l'avviso
 * resta incollato al bordo destro, così il lancio si legge lo stesso. Segnaposto a
 * tinte unite come il resto del boss; la logica sta in `tunnelPuppet.ts`.
 */
export function CheccoPuppetRunner({ world }: { world: TunnelWorld }) {
  const camera = useThree((state) => state.camera) as OrthographicCamera;
  const width = useThree((state) => state.size.width);
  const group = useRef<Group>(null);
  const bodyMat = useRef<MeshBasicMaterial>(null);
  const warning = useRef<Mesh>(null);
  const warningMat = useRef<MeshBasicMaterial>(null);
  const time = useRef(0);
  const textures = useMemo(
    () => ({ parry: drawWarningTexture('#dc1f1f', ['PARA']), dodge: drawWarningTexture('#facc15', ['SALTA']) }),
    []
  );
  useEffect(
    () => () => {
      textures.parry.dispose();
      textures.dodge.dispose();
    },
    [textures]
  );

  useFrame((_, rawDelta) => {
    const g = group.current;
    if (!g) return;
    const { puppet } = world;
    g.visible = puppet.visible;
    time.current += Math.min(rawDelta, 0.05);
    const t = time.current;
    // Corsa a scatti: sobbalza e dondola; il passo si legge dal rimbalzo.
    const step = Math.abs(Math.sin(t * 11));
    const z = laneZ(puppet.lane);
    const s = laneScale(puppet.lane);
    g.position.set(puppet.x, (0.12 * step + puppet.lift) * s, z);
    g.rotation.z = Math.sin(t * 11) * 0.06;
    // Quando prepara un lancio guarda indietro, verso D.
    g.scale.set(puppet.telegraph > 0 ? -s : s, s, 1);
    if (bodyMat.current) bodyMat.current.color.copy(puppet.flash > 0 ? COLOR_FLASH : COLOR_WOOD);

    const w = warning.current;
    const wm = warningMat.current;
    if (w && wm) {
      w.visible = puppet.telegraph > 0 && puppet.telegraphKind !== null;
      if (w.visible && puppet.telegraphKind) {
        const texture = textures[puppet.telegraphKind];
        if (wm.map !== texture) {
          wm.map = texture;
          wm.needsUpdate = true;
        }
        const pulse = 1 + 0.12 * Math.sin(t * 18);
        // Bordo destro visibile: metà larghezza dello schermo (in unità) oltre il centro della camera.
        const rightEdge = camera.position.x + width / 2 / camera.zoom - WARNING_EDGE_MARGIN;
        // L'avviso sta nella via da cui parte il lancio, sopra la testa (o al bordo, se lei è fuori schermo).
        const threat = world.throws.find((next) => next.launchT !== null);
        const warnLane = threat ? threat.lane : puppet.lane;
        w.position.set(Math.min(puppet.x, rightEdge), Math.min(BOSS_HEIGHT + 0.95, WARNING_MAX_Y) * laneScale(warnLane), laneZ(warnLane) + 0.4);
        w.scale.set(pulse, pulse, 1);
      }
    }
  });

  return (
    <>
      <group ref={group}>
        <PuppetFigure bodyMaterial={bodyMat} />
      </group>
      <mesh ref={warning} visible={false}>
        <planeGeometry args={[2.3, 1.8]} />
        <meshBasicMaterial ref={warningMat} transparent depthTest={false} />
      </mesh>
    </>
  );
}
