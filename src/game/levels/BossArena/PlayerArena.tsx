import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { CharacterAnimator2D, type CharacterAnimState } from '@/game/render2d/CharacterAnimator2D';
import { useArenaStore } from '@/store/arenaStore';
import type { ArenaWorld } from './arenaState';
import { addRing } from './combat';
import { createFinisher } from './finisher';
import { fireGun, launchShock, launchWave } from './playerShots';
import {
  BERSERK_ATTACK_SPEED,
  BERSERK_DRAIN_PER_SECOND,
  BERSERK_JUMP,
  BERSERK_REACH,
  BERSERK_SKILL_COST,
  BERSERK_SPEED,
  GUN_COOLDOWN,
  GUN_WINDUP,
  RAGE_MAX,
  SHOCK_RECOVERY,
  SHOCK_WINDUP,
  SKILL_TIERS_BLOODBORNE,
  WAVE_RECOVERY,
  WAVE_WINDUP,
  CLASH_PRESS_GAIN,
  BOSS_BLOCK_HALF_WIDTH,
  BOSS_BLOCK_HEIGHT,
  HEAL_AMOUNT,
  HEAL_CHANNEL,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_ATTACK_POSTURE,
  PLAYER_MAX_HP,
  SKILL_TIERS,
  ARENA_GRAVITY,
  ARENA_GROUND_Y,
  ARENA_HALF_WIDTH,
  ARENA_DOUBLE_JUMP_SPEED,
  ARENA_JUMP_SPEED,
  ARENA_MAX_JUMPS,
  ARENA_PLAYER_HEIGHT,
  ARENA_PLAYER_SPAWN_X,
  ARENA_PLAYER_SPEED,
  ARENA_PLAYER_VARIANT,
  ATTACK_HALF_HEIGHT,
  ATTACK_REACH,
  ATTACK_TIMING,
  DASH_COOLDOWN,
  DASH_DURATION,
  DASH_SPEED,
  PARRY_REACH,
  PARRY_TIMING
} from './arenaConfig';

// Stesso pattern di `Player2D.tsx`: i tasti premuti vivono in un Set del
// modulo, non in stato React (un `setState` dentro `useFrame` causerebbe 60
// render al secondo). In più, `justPressed` raccoglie le PRESSIONI (senza
// l'auto-repeat del tasto tenuto): attacco/parata/dash sono azioni a scatto,
// non a tasto tenuto.
const held = new Set<string>();
const justPressed = new Set<string>();

function press(key: string, repeat = false) {
  if (!repeat) justPressed.add(key);
  held.add(key);
}
function release(key: string) {
  held.delete(key);
}
function handleKeyDown(event: KeyboardEvent) {
  press(event.key.toLowerCase(), event.repeat);
}
function handleKeyUp(event: KeyboardEvent) {
  release(event.key.toLowerCase());
}
function handleMouseDown(event: MouseEvent) {
  press(event.button === 2 ? 'mouse2' : 'mouse0');
}
function handleMouseUp(event: MouseEvent) {
  release(event.button === 2 ? 'mouse2' : 'mouse0');
}
function handleContextMenu(event: MouseEvent) {
  event.preventDefault();
}

/** Hitbox e finestre di parata visibili solo in sviluppo, per tararle. */
const SHOW_DEBUG_BOXES = import.meta.env.DEV;

/** Mezza larghezza del corpo del giocatore, per la collisione col boss. */
const PLAYER_BODY_HALF_WIDTH = 0.35;

type Action = 'none' | 'attack' | 'parry' | 'dash' | 'heal' | 'skill' | 'cast';

/** Azione a distanza del potenziamento Bloodborne: parte dopo `windup`, poi `recovery`. */
interface Cast {
  kind: 'gun' | 'wave' | 'shock';
  fired: boolean;
  windup: number;
  recovery: number;
  damage: number;
  posture: number;
}

interface PlayerArenaProps {
  world: ArenaWorld;
}

/**
 * Giocatore dell'arena: variante di combattimento di `Player2D` (file
 * separato apposta — fuori dall'arena il giocatore non deve poter
 * attaccare/parare). Attacco `J`/click sinistro, parata `K`/click destro,
 * dash `Shift`, salto `Spazio`/`W`. Nessuna fisica Rapier: integrazione
 * manuale come nel resto del livello 2D. I danni subiti li applica
 * `combat.ts` scrivendo su `world.player`; qui si leggono (reazione al colpo,
 * contraccolpo, i-frames) e si mostrano.
 *
 * In sviluppo (`import.meta.env.DEV`): `1` mostra la reazione al colpo,
 * `2` il barcollamento, `3` la parata riuscita — anteprime degli stati di
 * animazione.
 */
export function PlayerArena({ world }: PlayerArenaProps) {
  const group = useRef<Group>(null);
  const attackBoxMesh = useRef<Mesh>(null);
  const parryBoxMesh = useRef<Mesh>(null);
  const shieldMesh = useRef<Mesh>(null);
  const healMesh = useRef<Mesh>(null);
  const skillTier = useRef<(typeof SKILL_TIERS)[number] | null>(null);
  const velocityY = useRef(0);
  const onGround = useRef(true);
  const jumpsUsed = useRef(0);
  const facing = useRef<1 | -1>(1);
  const action = useRef<Action>('none');
  const actionTime = useRef(0);
  const dashDirection = useRef<1 | -1>(1);
  const dashCooldown = useRef(0);
  const debugState = useRef<{ state: CharacterAnimState; time: number } | null>(null);
  const cast = useRef<Cast | null>(null);
  const lastRageShown = useRef(0);

  /** Avvia un'azione a distanza (pistola, onda celeste, ruggito). */
  const startCast = (kind: Cast['kind'], windup: number, recovery: number, damage = 0, posture = 0) => {
    cast.current = { kind, fired: false, windup, recovery, damage, posture };
    action.current = 'cast';
    actionTime.current = 0;
  };

  /** Furia mostrata in HUD solo quando cambia il valore arrotondato. */
  const syncRage = () => {
    const rounded = Math.round(world.player.rage);
    if (rounded !== lastRageShown.current) {
      lastRageShown.current = rounded;
      useArenaStore.getState().set({ rage: rounded });
    }
  };

  const [animState, setAnimState] = useState<CharacterAnimState>('idle');
  const [facingState, setFacingState] = useState<1 | -1>(1);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('contextmenu', handleContextMenu);
      held.clear();
      justPressed.clear();
    };
  }, []);

  useFrame((_, rawDelta) => {
    const g = group.current;
    if (!g) return;
    // Scelta del potenziamento: gioco fermo, l'input non si accumula (i tasti
    // premuti per scegliere non devono scattare appena si riparte).
    if (world.choice) {
      justPressed.clear();
      return;
    }
    // Hit-stop: il gameplay è congelato (l'input resta in coda, non si perde).
    if (world.hitStop > 0) return;
    const delta = Math.min(rawDelta, 0.05);
    const state = world.player;

    // A combattimento finito nessuno si muove più.
    if (world.over) {
      justPressed.clear();
      setAnimState(world.over === 'defeat' ? 'hit' : 'idle');
      return;
    }

    // Braccio di ferro del contrasto: fermo e invulnerabile, ogni pressione di
    // attacco (J/click) fa salire la barra. L'esito lo decide `BossChecco`.
    if (world.clash) {
      if (justPressed.has('j') || justPressed.has('mouse0')) {
        world.clash.progress = Math.min(1, world.clash.progress + CLASH_PRESS_GAIN);
      }
      justPressed.clear();
      action.current = 'none';
      actionTime.current = 0;
      state.invulnerable = true;
      state.dashDir = 0;
      state.parryActive = false;
      state.attackBox = null;
      facing.current = world.boss.x >= g.position.x ? 1 : -1;
      state.facing = facing.current;
      setAnimState('attack');
      setFacingState(facing.current);
      return;
    }

    // Carica con falce: la sequenza (`finisher.ts`, fatta avanzare da `BossChecco`)
    // comanda la posizione del giocatore, che è invulnerabile.
    if (world.finisher) {
      const f = world.finisher;
      justPressed.clear();
      g.position.set(f.playerX, f.playerY, 0);
      velocityY.current = 0;
      onGround.current = f.playerY <= 0.01;
      jumpsUsed.current = 0;
      action.current = 'none';
      actionTime.current = 0;
      facing.current = f.dir;
      state.x = f.playerX;
      state.y = f.playerY;
      state.facing = f.dir;
      state.invulnerable = true;
      state.dashDir = 0;
      state.parryActive = false;
      state.attackBox = null;
      setAnimState('attack');
      setFacingState(f.dir);
      return;
    }

    // --- timer che scendono da soli ---
    state.iframes = Math.max(0, state.iframes - delta);
    state.hitTimer = Math.max(0, state.hitTimer - delta);
    state.parryFlash = Math.max(0, state.parryFlash - delta);
    state.counterWindow = Math.max(0, state.counterWindow - delta);
    dashCooldown.current = Math.max(0, dashCooldown.current - delta);

    const bloodborne = world.powerUp === 'bloodborne';
    // Berserk: la furia si svuota piano; a zero finisce e la catena si azzera.
    if (state.berserk) {
      state.rage = Math.max(0, state.rage - BERSERK_DRAIN_PER_SECOND * delta);
      syncRage();
      if (state.rage <= 0) {
        state.berserk = false;
        state.combo = 1;
        useArenaStore.getState().set({ berserk: false, combo: 1 });
      }
    }

    // --- input ---
    let moveX = 0;
    if (held.has('a') || held.has('arrowleft')) moveX -= 1;
    if (held.has('d') || held.has('arrowright')) moveX += 1;
    const stunned = state.hitTimer > 0;
    const wantsAttack = !stunned && (justPressed.has('j') || justPressed.has('mouse0'));
    const wantsParry = !stunned && (justPressed.has('k') || justPressed.has('mouse2'));
    const wantsDash = !stunned && justPressed.has('shift');
    const wantsJump = !stunned && (justPressed.has(' ') || justPressed.has('w') || justPressed.has('arrowup'));
    const wantsHeal = !stunned && justPressed.has('r');
    const wantsSkill = !stunned && justPressed.has('e');
    const wantsRage = !stunned && justPressed.has('q');

    if (import.meta.env.DEV) {
      if (justPressed.has('1')) debugState.current = { state: 'hit', time: 0.35 };
      if (justPressed.has('2')) debugState.current = { state: 'stagger', time: 0.6 };
      if (justPressed.has('3')) debugState.current = { state: 'parry', time: 0.3 };
    }
    justPressed.clear();

    // --- macchina a stati dell'azione ---
    if (action.current === 'none') {
      if (wantsDash && dashCooldown.current === 0) {
        action.current = 'dash';
        actionTime.current = 0;
        dashDirection.current = moveX !== 0 ? (moveX < 0 ? -1 : 1) : facing.current;
        dashCooldown.current = DASH_COOLDOWN;
      } else if (wantsRage && bloodborne && !state.berserk && state.rage >= RAGE_MAX) {
        // "Premi per scatenare il potere della bestia": la furia comincia a svuotarsi.
        state.berserk = true;
        state.combo = 1;
        useArenaStore.getState().set({ berserk: true, combo: 1 });
        addRing(world, state.x, state.y + ARENA_PLAYER_HEIGHT / 2, 3.2, 0.5, '#ef4444');
        world.hitStop = Math.max(world.hitStop, 0.2);
      } else if (wantsParry) {
        if (bloodborne) {
          // Potenziamento Bloodborne: il tasto di parata spara.
          startCast('gun', GUN_WINDUP, GUN_COOLDOWN);
        } else {
          action.current = 'parry';
          actionTime.current = 0;
        }
      } else if (wantsHeal && state.heals > 0 && state.hp < PLAYER_MAX_HP) {
        // Cura: la carica si consuma all'inizio; la vita arriva solo a fine
        // canalizzazione, e un colpo subito nel mezzo la spreca (vedi
        // `hitPlayer`: azzera `healing`). Nessun i-frame mentre si cura.
        action.current = 'heal';
        actionTime.current = 0;
        state.heals -= 1;
        state.healing = true;
        useArenaStore.getState().set({ healsLeft: state.heals });
      } else if (wantsSkill && bloodborne && state.berserk) {
        // In berserk l'abilità costa furia: ruggito e onda d'urto in avanti.
        if (state.rage >= BERSERK_SKILL_COST) {
          state.rage -= BERSERK_SKILL_COST;
          syncRage();
          startCast('shock', SHOCK_WINDUP, SHOCK_RECOVERY);
        }
      } else if (wantsSkill && bloodborne) {
        const tier = SKILL_TIERS_BLOODBORNE.find((candidate) => state.skill >= candidate.threshold);
        if (tier?.id === 'carica_falce') {
          // La carica serve un boss presente e colpibile.
          if (world.boss.hp > 0 && !world.boss.vanished) {
            state.skill -= tier.cost;
            useArenaStore.getState().set({ skill: Math.round(state.skill) });
            world.finisher = createFinisher(world, tier.damage, tier.posture);
          }
        } else if (tier) {
          state.skill -= tier.cost;
          useArenaStore.getState().set({ skill: Math.round(state.skill) });
          startCast('wave', WAVE_WINDUP, WAVE_RECOVERY, tier.damage, tier.posture);
        }
      } else if (wantsSkill && state.skill >= SKILL_TIERS[SKILL_TIERS.length - 1].threshold) {
        // Un solo tasto, due mosse: la più forte disponibile in quel momento.
        const tier = SKILL_TIERS.find((candidate) => state.skill >= candidate.threshold);
        if (tier) {
          skillTier.current = tier;
          action.current = 'skill';
          actionTime.current = 0;
          state.swingId += 1;
          state.attackDamage = tier.damage;
          state.attackPosture = tier.posture;
          state.skill = Math.max(0, state.skill - tier.cost);
          useArenaStore.getState().set({ skill: Math.round(state.skill) });
        }
      } else if (wantsAttack) {
        action.current = 'attack';
        actionTime.current = 0;
        state.swingId += 1;
        state.attackDamage = PLAYER_ATTACK_DAMAGE;
        state.attackPosture = PLAYER_ATTACK_POSTURE;
      }
    } else if (stunned) {
      action.current = 'none';
      state.healing = false;
    }

    // Berserk: attacchi e azioni a distanza scorrono più in fretta.
    const fastAction = state.berserk && (action.current === 'attack' || action.current === 'cast');
    actionTime.current += delta * (fastAction ? BERSERK_ATTACK_SPEED : 1);
    const t = actionTime.current;
    let attackActive = false;
    let parryActive = false;
    let dashing = false;
    let attackReach = state.berserk ? ATTACK_REACH * BERSERK_REACH : ATTACK_REACH;

    switch (action.current) {
      case 'attack': {
        const { windup, active, recovery } = ATTACK_TIMING;
        attackActive = t >= windup && t < windup + active;
        // Berserk: l'attacco conta anche come parata per tutta la sua durata.
        parryActive = state.berserk;
        if (t >= windup + active + recovery) action.current = 'none';
        break;
      }
      case 'cast': {
        const current = cast.current;
        if (!current) {
          action.current = 'none';
          break;
        }
        if (!current.fired && t >= current.windup) {
          current.fired = true;
          if (current.kind === 'gun') fireGun(world);
          else if (current.kind === 'wave') launchWave(world, current.damage, current.posture);
          else launchShock(world);
        }
        if (t >= current.windup + current.recovery) action.current = 'none';
        break;
      }
      case 'skill': {
        const tier = skillTier.current;
        if (!tier) {
          action.current = 'none';
          break;
        }
        attackReach = tier.reach;
        attackActive = t >= tier.windup && t < tier.windup + tier.active;
        if (t >= tier.windup + tier.active + tier.recovery) action.current = 'none';
        break;
      }
      case 'heal': {
        // Canalizzazione compiuta senza essere interrotti: la vita arriva ora.
        if (!state.healing) {
          action.current = 'none';
        } else if (t >= HEAL_CHANNEL) {
          state.healing = false;
          state.hp = Math.min(PLAYER_MAX_HP, state.hp + HEAL_AMOUNT);
          useArenaStore.getState().set({ playerHp: Math.round(state.hp) });
          action.current = 'none';
        }
        break;
      }
      case 'parry': {
        parryActive = t < PARRY_TIMING.active;
        if (t >= PARRY_TIMING.active + PARRY_TIMING.recovery) action.current = 'none';
        break;
      }
      case 'dash': {
        dashing = true;
        if (t >= DASH_DURATION) action.current = 'none';
        break;
      }
      default:
        break;
    }

    // --- movimento ---
    const locked =
      action.current === 'attack' ||
      action.current === 'parry' ||
      action.current === 'skill' ||
      action.current === 'cast' ||
      action.current === 'heal' ||
      stunned;
    let vx = 0;
    if (dashing) {
      vx = dashDirection.current * DASH_SPEED;
      facing.current = dashDirection.current;
    } else if (!locked && moveX !== 0) {
      vx = moveX * ARENA_PLAYER_SPEED * state.speedMultiplier * (state.berserk ? BERSERK_SPEED : 1);
      facing.current = moveX < 0 ? -1 : 1;
    }
    // Contraccolpo dopo un colpo subito: decade da solo.
    state.knockbackVx -= state.knockbackVx * Math.min(1, 10 * delta);
    vx += state.knockbackVx;
    const previousX = g.position.x;
    g.position.x = Math.min(ARENA_HALF_WIDTH, Math.max(-ARENA_HALF_WIDTH, previousX + vx * delta));

    if (wantsJump && !locked && !dashing) {
      const jumpMultiplier = state.berserk ? BERSERK_JUMP : 1;
      if (onGround.current) {
        velocityY.current = ARENA_JUMP_SPEED * jumpMultiplier;
        onGround.current = false;
        jumpsUsed.current = 1;
      } else if (jumpsUsed.current < ARENA_MAX_JUMPS) {
        // Doppio salto: un secondo impulso in aria (serve anche a raggiungere
        // le torrette sui muri).
        velocityY.current = ARENA_DOUBLE_JUMP_SPEED * jumpMultiplier;
        jumpsUsed.current += 1;
      }
    }
    // Spinta verso l'alto (es. dopo una parata in aria di un fulmine): conta
    // come il primo salto, il doppio salto resta disponibile.
    if (state.airBoost > 0) {
      velocityY.current = state.airBoost;
      onGround.current = false;
      jumpsUsed.current = Math.min(jumpsUsed.current, 1);
      state.airBoost = 0;
    }
    velocityY.current += ARENA_GRAVITY * delta;
    let nextY = g.position.y + velocityY.current * delta;
    if (nextY <= ARENA_GROUND_Y) {
      nextY = ARENA_GROUND_Y;
      velocityY.current = 0;
      onGround.current = true;
      jumpsUsed.current = 0;
    }
    g.position.y = nextY;

    // --- corpo solido di Checco: non si attraversa camminando, si scavalca
    // saltando (piedi sopra `BOSS_BLOCK_HEIGHT`) o si passa sotto se è in aria.
    // Vale in un solo senso: Checco non è bloccato dal giocatore. ---
    const boss = world.boss;
    if (
      boss.hp > 0 &&
      nextY < boss.y + BOSS_BLOCK_HEIGHT &&
      nextY + ARENA_PLAYER_HEIGHT > boss.y
    ) {
      const reach = BOSS_BLOCK_HALF_WIDTH + PLAYER_BODY_HALF_WIDTH;
      if (Math.abs(g.position.x - boss.x) < reach) {
        // Lato da cui arrivava: così non si "teletrasporta" dall'altra parte.
        const side = previousX === boss.x ? facing.current * -1 : previousX < boss.x ? -1 : 1;
        g.position.x = Math.min(ARENA_HALF_WIDTH, Math.max(-ARENA_HALF_WIDTH, boss.x + side * reach));
      }
    }

    // --- stato condiviso (letto dal boss) ---
    const px = g.position.x;
    const py = g.position.y;
    state.x = px;
    state.y = py;
    state.facing = facing.current;
    state.attackBox = attackActive
      ? {
          x: px + (facing.current * attackReach) / 2,
          y: py + ARENA_PLAYER_HEIGHT / 2,
          halfWidth: attackReach / 2,
          halfHeight: state.berserk ? ATTACK_HALF_HEIGHT * 1.25 : ATTACK_HALF_HEIGHT
        }
      : null;
    state.parryActive = parryActive;
    state.invulnerable = dashing;
    state.dashDir = dashing ? dashDirection.current : 0;

    // La parata si vede sempre (scudo azzurro); le hitbox d'attacco/parata
    // esatte solo in sviluppo, per tararle.
    if (shieldMesh.current) {
      shieldMesh.current.visible = action.current === 'parry';
      shieldMesh.current.position.set(px + (facing.current * PARRY_REACH) / 2, py + ARENA_PLAYER_HEIGHT / 2, 0.1);
    }
    if (attackBoxMesh.current) {
      attackBoxMesh.current.visible = SHOW_DEBUG_BOXES && state.attackBox !== null;
      if (state.attackBox) {
        attackBoxMesh.current.position.set(state.attackBox.x, state.attackBox.y, 0.1);
        attackBoxMesh.current.scale.x = (state.attackBox.halfWidth * 2) / ATTACK_REACH;
      }
    }
    if (healMesh.current) {
      healMesh.current.visible = action.current === 'heal';
      healMesh.current.position.set(px, py + ARENA_PLAYER_HEIGHT / 2, 0.1);
    }
    if (parryBoxMesh.current) {
      parryBoxMesh.current.visible = SHOW_DEBUG_BOXES && parryActive;
      parryBoxMesh.current.position.set(px + (facing.current * PARRY_REACH) / 2, py + ARENA_PLAYER_HEIGHT / 2, 0.15);
    }

    // --- stato d'animazione (React solo quando cambia il valore LOGICO) ---
    let nextAnim: CharacterAnimState = 'idle';
    if (debugState.current && (debugState.current.time -= delta) > 0) {
      nextAnim = debugState.current.state;
    } else if (state.hitTimer > 0) {
      nextAnim = 'hit';
    } else if (state.parryFlash > 0) {
      nextAnim = 'parry';
    } else if (action.current === 'attack' || action.current === 'skill' || action.current === 'cast') {
      nextAnim = 'attack';
    } else if (dashing || vx !== 0) {
      nextAnim = 'walk';
    }
    setAnimState(nextAnim);
    setFacingState(facing.current);
  });

  return (
    <>
      <group ref={group} position={[ARENA_PLAYER_SPAWN_X, ARENA_GROUND_Y, 0]}>
        <CharacterAnimator2D
          variant={ARENA_PLAYER_VARIANT}
          state={animState}
          facing={facingState}
          height={ARENA_PLAYER_HEIGHT}
        />
      </group>

      <mesh ref={shieldMesh} visible={false}>
        <planeGeometry args={[PARRY_REACH * 0.6, ARENA_PLAYER_HEIGHT * 0.9]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.35} />
      </mesh>
      {/* Canalizzazione della cura: alone verde, si vede che si è scoperti. */}
      <mesh ref={healMesh} visible={false}>
        <planeGeometry args={[1.3, ARENA_PLAYER_HEIGHT * 1.05]} />
        <meshBasicMaterial color="#4ade80" transparent opacity={0.28} />
      </mesh>
      <mesh ref={attackBoxMesh} visible={false}>
        <planeGeometry args={[ATTACK_REACH, ATTACK_HALF_HEIGHT * 2]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.25} />
      </mesh>
      <mesh ref={parryBoxMesh} visible={false}>
        <planeGeometry args={[PARRY_REACH, ARENA_PLAYER_HEIGHT]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.25} />
      </mesh>
    </>
  );
}
