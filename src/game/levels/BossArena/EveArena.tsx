import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import type { Group } from 'three';
import { CharacterAnimator2D, type CharacterAnimState } from '@/game/render2d/CharacterAnimator2D';
import { useArenaStore } from '@/store/arenaStore';
import type { ArenaWorld } from './arenaState';
import {
  ARENA_HALF_WIDTH,
  EVE_ATTACK_INTERVAL,
  EVE_ATTACK_RANGE,
  EVE_ATTACK_WINDUP,
  EVE_DOWN_X,
  EVE_HEIGHT,
  EVE_SPEED,
  EVE_STAGGER_DURATION
} from './arenaConfig';

/** Durata della finestra d'attacco attiva di Eve (breve, come un affondo). */
const EVE_ATTACK_ACTIVE = 0.1;
/** Alzata da terra quando è sdraiata: il perno dello sprite sono i piedi, e
 *  ruotandola di 90° metà della sua larghezza finirebbe sotto il pavimento. */
const LYING_LIFT = 0.3;
const RISE_DURATION = 0.6;

/**
 * Eve: entra nell'arena già a terra (tramortita). `F` la richiama: si rialza
 * e diventa una compagna di supporto con azioni marginali (si avvicina al
 * boss e ogni tanto colpisce), stessa FORMA di `EveCompanion` (ref-driven in
 * `useFrame`) ma logica diversa. Se non viene mai richiamata resta a terra
 * per tutto il round: il combattimento si completa in solitaria.
 */
export function EveArena({ world }: { world: ArenaWorld }) {
  const group = useRef<Group>(null);
  const [animState, setAnimState] = useState<CharacterAnimState>('idle');
  const [facing, setFacing] = useState<1 | -1>(-1);
  const attackTimer = useRef(EVE_ATTACK_INTERVAL * 0.5);
  const attackPhase = useRef<'none' | 'windup' | 'active'>('none');
  const attackTime = useRef(0);
  const staggerLeft = useRef(0);

  // Sdraiata all'inizio: rotazione sul gruppo, senza nuovi fotogrammi (stessa
  // filosofia "poche pose reali + moto procedurale" di `CharacterAnimator2D`).
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.rotation.z = -Math.PI / 2;
    g.position.set(EVE_DOWN_X, LYING_LIFT, 0);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f' || event.repeat) return;
      const eve = world.eve;
      const g = group.current;
      if (eve.status !== 'down' || !g || world.over) return;
      eve.status = 'rising';
      useArenaStore.getState().set({ evePromptVisible: false });
      gsap.to(g.rotation, { z: 0, duration: RISE_DURATION, ease: 'power2.out' });
      gsap.to(g.position, {
        y: 0,
        duration: RISE_DURATION,
        ease: 'power2.out',
        onComplete: () => {
          eve.status = 'active';
        }
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [world]);

  useFrame((_, rawDelta) => {
    const g = group.current;
    if (!g) return;
    if (world.hitStop > 0 || world.over) return;
    const delta = Math.min(rawDelta, 0.05);
    const eve = world.eve;
    const boss = world.boss;

    eve.attackBox = null;
    let nextAnim: CharacterAnimState = 'idle';

    if (eve.status === 'staggered') {
      // Colpita dal boss (aggro sporadico): barcolla e non attacca.
      if (staggerLeft.current <= 0) staggerLeft.current = EVE_STAGGER_DURATION;
      staggerLeft.current -= delta;
      attackPhase.current = 'none';
      nextAnim = 'stagger';
      if (staggerLeft.current <= 0) eve.status = 'active';
    } else if (eve.status === 'active') {
      const dx = boss.x - g.position.x;
      const dist = Math.abs(dx);
      eve.facing = dx >= 0 ? 1 : -1;

      if (attackPhase.current === 'none') {
        if (dist > EVE_ATTACK_RANGE) {
          g.position.x = Math.min(ARENA_HALF_WIDTH, Math.max(-ARENA_HALF_WIDTH, g.position.x + Math.sign(dx) * EVE_SPEED * delta));
          nextAnim = 'walk';
        }
        attackTimer.current -= delta;
        if (attackTimer.current <= 0 && dist <= EVE_ATTACK_RANGE + 0.3) {
          attackPhase.current = 'windup';
          attackTime.current = 0;
        }
      } else {
        attackTime.current += delta;
        nextAnim = 'attack';
        if (attackPhase.current === 'windup' && attackTime.current >= EVE_ATTACK_WINDUP) {
          attackPhase.current = 'active';
          eve.swingId += 1;
        }
        if (attackPhase.current === 'active') {
          eve.attackBox = {
            x: g.position.x + (eve.facing * EVE_ATTACK_RANGE) / 2,
            y: EVE_HEIGHT / 2,
            halfWidth: EVE_ATTACK_RANGE / 2,
            halfHeight: 0.8
          };
          if (attackTime.current >= EVE_ATTACK_WINDUP + EVE_ATTACK_ACTIVE) {
            attackPhase.current = 'none';
            attackTimer.current = EVE_ATTACK_INTERVAL;
          }
        }
      }
    }

    eve.x = g.position.x;
    setAnimState(nextAnim);
    setFacing(eve.facing);
  });

  return (
    <group ref={group}>
      <CharacterAnimator2D variant="Eve" state={animState} facing={facing} height={EVE_HEIGHT} />
    </group>
  );
}
