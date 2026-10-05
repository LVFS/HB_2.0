import { useArenaStore } from '@/store/arenaStore';
import type { BossContext } from './bossRuntime';
import { spawnTotems } from './bossSpawns';
import { addPosture } from './combat';
import { POWER_UP_IDS, POWER_UPS, type PowerUpId } from './powerUps';
import {
  BOSS_COOLDOWN_AFTER_SPECIAL,
  BOSS_COOLDOWN_AFTER_SUMMON,
  PLAYER_MAX_HP,
  POSTURE_MAX,
  POWER_UP_INTRO_SECONDS,
  SPECIAL_COMPLETED_BOSS_HEAL,
  SPECIAL_COMPLETED_PLAYER_SPEED,
  SPECIAL_INTERRUPT_DAMAGE,
  SPECIAL_INTERRUPTED_BOSS_SPEED,
  SPECIAL_INTERRUPTED_PLAYER_DAMAGE,
  SPECIAL_INTERRUPTED_PLAYER_HEAL,
  SPECIAL_PARRY_RANGE,
  SPECIAL_PARRY_WINDOW,
  SPECIAL_TRIGGER_HP_FRACTION,
  SPECIAL_WINDUP,
  TOTEM_COUNTS,
  TOTEM_TRIGGER_FRACTIONS,
  TOTEM_WINDUP
} from './arenaConfig';

/**
 * Gli eventi "di storia" del boss: l'evento "Avvia il film" (windup lungo,
 * esito completato/interrotto, scelta del potenziamento) e l'evocazione degli
 * oggetti del Buen Camino a soglie di vita. Nessun React: ricevono il
 * `BossContext` e mutano il mondo/lo store come faceva il frame del boss.
 */

/**
 * Ferma il gioco e offre i potenziamenti. Il blocco è lo stesso dell'hit-stop
 * (tutti i sistemi lo controllano) ma senza scadenza; lo toglie `updatePowerUpChoice`
 * quando il giocatore ha scelto e la scritta è finita.
 */
function startPowerUpChoice({ world }: BossContext): void {
  world.choice = { picked: null, introT: 0 };
  world.hitStop = Number.POSITIVE_INFINITY;
  useArenaStore.getState().set({
    powerUpPicked: null,
    powerUpChoice: POWER_UP_IDS.map((id) => ({
      id,
      label: POWER_UPS[id].label,
      description: POWER_UPS[id].description
    }))
  });
}

/**
 * Scelta del potenziamento: gioco fermo (hit-stop infinito). Prima si aspetta la
 * carta scelta nella HUD, poi resta la scritta di introduzione, infine si
 * riparte con "Round 2". Restituisce `true` finché la scelta è in corso (il
 * frame del boss deve fermarsi lì).
 */
export function updatePowerUpChoice({ world, messenger }: BossContext, rawDelta: number): boolean {
  const choice = world.choice;
  if (!choice) return false;
  const store = useArenaStore.getState();
  if (!choice.picked) {
    const picked = store.powerUpPicked;
    if (picked && picked in POWER_UPS) {
      const def = POWER_UPS[picked as PowerUpId];
      choice.picked = def.id;
      choice.introT = POWER_UP_INTRO_SECONDS;
      world.powerUp = def.id;
      store.set({
        powerUpChoice: null,
        powerUpPicked: null,
        powerUp: def.label,
        backdrop: def.backdrop,
        powerUpIntro: def.intro
      });
    }
  } else {
    choice.introT -= rawDelta;
    if (choice.introT <= 0) {
      world.choice = null;
      world.hitStop = 0;
      store.set({ powerUpIntro: null });
      store.triggerFlash();
      messenger.flash('Round 2', 'Film interrotto! Recuperi forze, Checco è sbilanciato');
    }
  }
  return true;
}

/** "Avvia il film" è un evento di round 1, una sola volta, a una frazione della vita massima. */
export function shouldStartSpecial({ world, rt }: BossContext): boolean {
  return !rt.specialDone && !rt.action && world.boss.round === 1 && world.boss.hp <= world.boss.hpMax * SPECIAL_TRIGGER_HP_FRACTION;
}

export function startSpecial({ world, rt }: BossContext): void {
  rt.special = { t: 0 };
  world.boss.specialActive = true;
  world.boss.specialDamageTaken = 0;
  useArenaStore.getState().set({
    message: 'AVVIA IL FILM!',
    hint: 'Para all’ultimo istante o colpiscilo forte per interromperlo'
  });
}

/** Chiude l'evento: `completed` (Buen Camino: Checco si rinvigorisce, il giocatore rallenta) o `interrupted` (scelta del potenziamento). */
export function resolveSpecial(ctx: BossContext, kind: 'completed' | 'interrupted'): void {
  const { world, rt, messenger } = ctx;
  const { boss, player } = world;
  const store = useArenaStore.getState();
  rt.special = null;
  rt.specialDone = true;
  boss.specialActive = false;

  if (kind === 'completed') {
    // Parte "Buen Camino": Checco si rinvigorisce, il giocatore rallenta.
    boss.hp = Math.min(boss.hpMax, boss.hp + SPECIAL_COMPLETED_BOSS_HEAL);
    player.speedMultiplier = SPECIAL_COMPLETED_PLAYER_SPEED;
    store.set({ backdrop: 'buen_camino', bossHp: Math.round(boss.hp) });
    messenger.flash('Round 2', 'Buen Camino: Checco si rinvigorisce e ti rallenta');
  } else {
    // Interrotto: buff al giocatore e malus a Checco, poi il gioco si ferma e
    // il giocatore sceglie un potenziamento (= il film che parte al posto
    // del suo). Sfondo e messaggio di "Round 2" arrivano dopo la scelta.
    player.hp = Math.min(PLAYER_MAX_HP, player.hp + SPECIAL_INTERRUPTED_PLAYER_HEAL);
    player.damageMultiplier = SPECIAL_INTERRUPTED_PLAYER_DAMAGE;
    boss.speedMultiplier = SPECIAL_INTERRUPTED_BOSS_SPEED;
    boss.staggerTimer = 0;
    addPosture(world, POSTURE_MAX);
    store.set({ playerHp: Math.round(player.hp), message: null, hint: null });
    startPowerUpChoice(ctx);
  }

  boss.round = 2;
  store.set({ round: 2 });
  if (kind === 'completed') store.triggerFlash();
  rt.cooldown = BOSS_COOLDOWN_AFTER_SPECIAL;
  rt.action = null;
  boss.attackBox = null;
}

/** Windup dell'evento: si interrompe parando all'ultimo istante o con abbastanza danno, altrimenti si completa. */
export function tickSpecial(ctx: BossContext, delta: number): void {
  const { world, rt } = ctx;
  const { boss, player } = world;
  const special = rt.special;
  if (!special) return;
  special.t += delta;
  boss.facing = player.x >= boss.x ? 1 : -1;
  const inParryWindow = special.t >= SPECIAL_WINDUP - SPECIAL_PARRY_WINDOW;
  if (inParryWindow && player.parryActive && Math.abs(player.x - boss.x) <= SPECIAL_PARRY_RANGE) {
    resolveSpecial(ctx, 'interrupted');
  } else if (boss.specialDamageTaken >= SPECIAL_INTERRUPT_DAMAGE) {
    resolveSpecial(ctx, 'interrupted');
  } else if (special.t >= SPECIAL_WINDUP) {
    resolveSpecial(ctx, 'completed');
  }
}

/** Evocazione degli oggetti del Buen Camino a 45% e 20% di vita (se non ce ne sono già). */
export function shouldStartSummon({ world, rt }: BossContext): boolean {
  return (
    !rt.action &&
    world.totems.length === 0 &&
    rt.totemEvents < TOTEM_TRIGGER_FRACTIONS.length &&
    world.boss.hp <= world.boss.hpMax * TOTEM_TRIGGER_FRACTIONS[rt.totemEvents]
  );
}

export function startSummon({ rt }: BossContext): void {
  rt.summon = { t: 0 };
  rt.totemEvents += 1;
}

/** Carica l'evocazione, poi gli oggetti compaiono e Checco diventa invulnerabile finché ne resta uno. */
export function tickSummon({ world, rt, messenger }: BossContext, delta: number): void {
  const summon = rt.summon;
  if (!summon) return;
  const { boss, player } = world;
  summon.t += delta;
  boss.facing = player.x >= boss.x ? 1 : -1;
  if (summon.t >= TOTEM_WINDUP) {
    spawnTotems(world, TOTEM_COUNTS[Math.min(rt.totemEvents - 1, TOTEM_COUNTS.length - 1)]);
    rt.summon = null;
    rt.cooldown = BOSS_COOLDOWN_AFTER_SUMMON;
    messenger.flash('BUEN CAMINO!', 'Distruggi gli oggetti: finché esistono Checco è invulnerabile', 3.2);
  }
}
