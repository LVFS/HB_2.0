import { useArenaStore } from '@/store/arenaStore';
import type { AABB } from '@/game/render2d/collision';
import type { ArenaProjectile, ArenaWorld, DamagePopup } from './arenaState';
import {
  ARENA_PLAYER_HEIGHT,
  PLAYER_BODY_HALF_WIDTH,
  BERSERK_AOE_DAMAGE,
  BERSERK_AOE_RADIUS,
  BERSERK_COMBO_MAX,
  BERSERK_COMBO_STEP,
  BERSERK_DAMAGE,
  BERSERK_DAMAGE_TAKEN,
  PROJECTILE_REFLECT_DAMAGE,
  PROJECTILE_REFLECT_SPEED_MULTIPLIER,
  RAGE_MAX,
  BOSS_HALF_WIDTH,
  BOSS_HEIGHT,
  BOSS_STAGGER_DAMAGE_MULTIPLIER,
  BOSS_STAGGER_DURATION,
  COUNTER_HOP_DISTANCE,
  COUNTER_HOP_DURATION,
  COUNTER_MULTIPLIER,
  COUNTER_STUN_DURATION,
  COUNTER_WINDOW,
  EVE_HEIGHT,
  HITSTOP_LIGHT,
  HITSTOP_PARRY,
  PARRY_POSTURE_GAIN,
  PLAYER_HIT_STUN,
  PLAYER_IFRAMES_AFTER_HIT,
  PLAYER_KNOCKBACK,
  POSTURE_MAX,
  SKILL_GAIN_HIT,
  SKILL_GAIN_PARRY,
  SKILL_GAIN_STAGGER,
  SKILL_MAX
} from './arenaConfig';

/**
 * Carica la barra abilità del giocatore. Si guadagna solo facendo bene (colpo
 * a segno, parata riuscita, barcollamento INFLITTO al boss) — mai subendo,
 * altrimenti premierebbe l'essere colpiti.
 */
export function gainSkill(world: ArenaWorld, amount: number): void {
  const { player } = world;
  const total = player.skill + amount;
  player.skill = Math.min(SKILL_MAX, total);
  const store = useArenaStore.getState();
  store.set({ skill: Math.round(player.skill) });
  // Potenziamento con berserk: ciò che eccede la barra già piena carica la
  // furia (secondo livello di carica). Durante il berserk non si ricarica.
  if (world.powerUp === 'bloodborne' && !player.berserk && total > SKILL_MAX) {
    player.rage = Math.min(RAGE_MAX, player.rage + (total - SKILL_MAX));
    store.set({ rage: Math.round(player.rage) });
  }
}

/** Bersaglio dei colpi: le scatole "che possono essere colpite". */
export function playerHurtbox(world: ArenaWorld): AABB {
  return { x: world.player.x, y: world.player.y + ARENA_PLAYER_HEIGHT / 2, halfWidth: PLAYER_BODY_HALF_WIDTH, halfHeight: ARENA_PLAYER_HEIGHT / 2 };
}
export function bossHurtbox(world: ArenaWorld): AABB {
  return { x: world.boss.x, y: world.boss.y + BOSS_HEIGHT / 2, halfWidth: BOSS_HALF_WIDTH, halfHeight: BOSS_HEIGHT / 2 };
}
export function eveHurtbox(world: ArenaWorld): AABB {
  return { x: world.eve.x, y: EVE_HEIGHT / 2, halfWidth: 0.35, halfHeight: EVE_HEIGHT / 2 };
}

function requestHitStop(world: ArenaWorld, seconds: number) {
  world.hitStop = Math.max(world.hitStop, seconds);
}

/** Mette in coda un numero di danno (lo disegna `DamageNumbers.tsx`). */
function pushPopup(world: ArenaWorld, popup: DamagePopup) {
  world.popups.push(popup);
}

/**
 * Un colpo (del giocatore o di Eve) va a segno sul boss: danno, postura,
 * eventuale barcollamento. I moltiplicatori si compongono: buff del giocatore,
 * contraccolpo dopo una parata riuscita, boss già barcollante (= "danno
 * critico" alla Sekiro, ma senza uccisione istantanea).
 */
export function hitBoss(
  world: ArenaWorld,
  hit: { damage: number; posture: number; source: 'player' | 'eve' }
): void {
  const { boss, player } = world;
  if (boss.hp <= 0 || world.over || boss.vanished || world.finale) return;

  // Finché esiste un oggetto del Buen Camino Checco è invulnerabile: il colpo
  // viene bloccato (lampo dello scudo) e non dà danno, postura né abilità.
  const popupX = boss.x + (Math.random() - 0.5) * 0.8;
  const popupY = boss.y + BOSS_HEIGHT + 0.15;
  if (world.totems.length > 0) {
    boss.shieldHit = 0.15;
    pushPopup(world, { x: popupX, y: popupY, amount: 0, target: 'boss', boost: 1, blocked: true });
    return;
  }

  let damage = hit.damage;
  const berserkMultiplier = hit.source === 'player' && player.berserk ? BERSERK_DAMAGE * player.combo : 1;
  if (hit.source === 'player') {
    damage *= player.damageMultiplier;
    if (player.counterWindow > 0) damage *= COUNTER_MULTIPLIER;
    damage *= berserkMultiplier;
  }
  if (boss.staggerTimer > 0) damage *= BOSS_STAGGER_DAMAGE_MULTIPLIER;

  if (import.meta.env.DEV) {
    const parts = [
      `base ${hit.damage}`,
      hit.source === 'player' && player.damageMultiplier !== 1 ? `buff ×${player.damageMultiplier}` : null,
      hit.source === 'player' && player.counterWindow > 0 ? `parata ×${COUNTER_MULTIPLIER}` : null,
      berserkMultiplier !== 1 ? `berserk ×${berserkMultiplier.toFixed(2)}` : null,
      boss.staggerTimer > 0 ? `stordito ×${BOSS_STAGGER_DAMAGE_MULTIPLIER}` : null
    ].filter(Boolean);
    // eslint-disable-next-line no-console -- log di sviluppo (rimosso dalla build)
    console.debug(`[danno boss] ${hit.source}: ${damage.toFixed(1)} (${parts.join(', ')})`);
  }
  pushPopup(world, { x: popupX, y: popupY, amount: damage, target: 'boss', boost: damage / hit.damage });

  // Non muore qui: sotto `FINALE_HP_FRACTION` parte il finale scriptato, che
  // chiude il combattimento. La vita minima è 1.
  boss.hp = Math.max(1, boss.hp - damage);
  boss.hitFlash = 0.1;
  if (boss.specialActive) boss.specialDamageTaken += damage;
  requestHitStop(world, HITSTOP_LIGHT);

  if (hit.source === 'player') {
    gainSkill(world, SKILL_GAIN_HIT);
    // Berserk: ogni colpo a segno alza il moltiplicatore a catena.
    if (player.berserk) {
      player.combo = Math.min(BERSERK_COMBO_MAX, player.combo + BERSERK_COMBO_STEP);
      useArenaStore.getState().set({ combo: Math.round(player.combo * 100) / 100 });
    }
  }
  if (boss.staggerTimer <= 0) addPosture(world, hit.posture, hit.source === 'player');

  useArenaStore.getState().set({ bossHp: Math.round(boss.hp) });
}

/**
 * Aggiunge postura; a soglia massima il boss barcolla (finestra di danno).
 * `byPlayer`: se il barcollamento lo provoca il giocatore (colpi o parata),
 * carica la barra abilità — non quando lo causa Eve o un effetto dell'evento.
 */
export function addPosture(world: ArenaWorld, amount: number, byPlayer = false): void {
  const { boss } = world;
  if (boss.staggerTimer > 0 || world.totems.length > 0) return;
  boss.posture = Math.min(POSTURE_MAX, boss.posture + amount);
  if (boss.posture >= POSTURE_MAX) {
    boss.staggerTimer = BOSS_STAGGER_DURATION;
    if (byPlayer) gainSkill(world, SKILL_GAIN_STAGGER);
  }
  useArenaStore.getState().set({ bossPosture: Math.round(boss.posture) });
}

/**
 * CONTRASTO (alla "mikiri"): il giocatore schiva CONTRO una carica di Checco, la
 * ferma e lo stordisce per qualche secondo — è vulnerabile (danni maggiorati,
 * come in ogni barcollamento) e non si muove. Premia il rischio più della
 * semplice parata e carica la barra abilità.
 */
export function counterCharge(world: ArenaWorld): void {
  const { boss } = world;
  boss.staggerTimer = Math.max(boss.staggerTimer, COUNTER_STUN_DURATION);
  boss.attackBox = null;
  // Mini balzo all'indietro, lontano dal giocatore.
  const away = boss.x >= world.player.x ? 1 : -1;
  boss.hopTime = COUNTER_HOP_DURATION;
  boss.hopVx = (away * COUNTER_HOP_DISTANCE) / COUNTER_HOP_DURATION;
  world.hitStop = Math.max(world.hitStop, HITSTOP_PARRY * 1.6);
  gainSkill(world, SKILL_GAIN_STAGGER);
}

/**
 * Un colpo (giocatore, Eve o proiettile rimandato) raggiunge un oggetto del
 * Buen Camino. A zero l'oggetto si distrugge; quando cade l'ultimo Checco
 * torna vulnerabile.
 */
export function damageTotem(world: ArenaWorld, index: number, amount: number): void {
  const totem = world.totems[index];
  if (!totem) return;
  totem.hp -= amount;
  totem.flash = 0.12;
  pushPopup(world, { x: totem.x, y: 1.4, amount, target: 'object', boost: 1 });
  world.hitStop = Math.max(world.hitStop, HITSTOP_LIGHT);
  const store = useArenaStore.getState();
  if (totem.hp <= 0) {
    world.totems.splice(index, 1);
    store.set({ totemsLeft: world.totems.length });
    if (world.totems.length === 0) {
      store.set({ message: 'Checco è vulnerabile!', hint: null });
      window.setTimeout(() => useArenaStore.getState().set({ message: null }), 1800);
    }
  }
}

/** Un colpo raggiunge una torretta: a zero si distrugge (e carica un po' l'abilità). */
export function damageTurret(world: ArenaWorld, index: number, amount: number): void {
  const turret = world.turrets[index];
  if (!turret) return;
  turret.hp -= amount;
  turret.flash = 0.12;
  pushPopup(world, { x: turret.x, y: turret.y + 0.7, amount, target: 'object', boost: 1 });
  world.hitStop = Math.max(world.hitStop, HITSTOP_LIGHT);
  if (turret.hp <= 0) {
    world.turrets.splice(index, 1);
    gainSkill(world, SKILL_GAIN_HIT);
  }
}

/**
 * Parata riuscita contro un PROIETTILE: stessi premi di una parata normale
 * (lampo dorato, finestra di contraccolpo, hit-stop, abilità), ma la postura la
 * guadagna Checco quando il proiettile rimandato lo colpisce, non subito.
 */
export function parryProjectile(world: ArenaWorld): void {
  const { player } = world;
  player.parryFlash = 0.25;
  player.counterWindow = COUNTER_WINDOW;
  requestHitStop(world, HITSTOP_PARRY);
  gainSkill(world, SKILL_GAIN_PARRY);
}

export type PlayerHitResult = 'hit' | 'parried' | 'ignored';

/**
 * Un colpo del boss raggiunge il giocatore. Dash e i-frames lo ignorano; una
 * parata a timing lo annulla, aumenta la postura del boss e apre la finestra
 * di contraccolpo; altrimenti danno, reazione e brevi i-frames.
 *
 * Pensata per essere riusabile da un altro modo di gioco (il tunnel): da `world`
 * legge solo `over`, `player`, `popups`, `hitStop` e — per la parata e la
 * direzione del contraccolpo — il boss; `sourceX` dice da dove viene il colpo
 * (default: la posizione del boss), così un colpo senza boss non ha bisogno di
 * un boss per essere spinto dal lato giusto.
 */
export function hitPlayer(
  world: ArenaWorld,
  damage: number,
  { unparryable = false, sourceX }: { unparryable?: boolean; sourceX?: number } = {}
): PlayerHitResult {
  const { player, boss } = world;
  if (world.over || player.invulnerable || player.iframes > 0) return 'ignored';

  // Un colpo non parabile (es. l'onda dello schianto) si schiva o si salta:
  // la parata non lo annulla.
  if (player.parryActive && !unparryable) {
    player.parryFlash = 0.25;
    player.counterWindow = COUNTER_WINDOW;
    requestHitStop(world, HITSTOP_PARRY);
    gainSkill(world, SKILL_GAIN_PARRY);
    addPosture(world, PARRY_POSTURE_GAIN, true);
    return 'parried';
  }

  player.healing = false;
  // Berserk: i danni subiti sono ridotti, ma il primo colpo preso azzera la catena.
  if (player.berserk) {
    damage *= BERSERK_DAMAGE_TAKEN;
    player.combo = 1;
    useArenaStore.getState().set({ combo: 1 });
  }
  pushPopup(world, {
    x: player.x + (Math.random() - 0.5) * 0.5,
    y: player.y + ARENA_PLAYER_HEIGHT + 0.15,
    amount: damage,
    target: 'player',
    boost: 1
  });
  player.hp = Math.max(0, player.hp - damage);
  player.hitTimer = PLAYER_HIT_STUN;
  player.iframes = PLAYER_IFRAMES_AFTER_HIT;
  player.knockbackVx = (player.x >= (sourceX ?? boss.x) ? 1 : -1) * PLAYER_KNOCKBACK;
  requestHitStop(world, HITSTOP_LIGHT);
  useArenaStore.getState().set({ playerHp: Math.round(player.hp) });

  if (player.hp <= 0) {
    world.over = 'defeat';
    useArenaStore.getState().set({ message: 'Sconfitto', hint: 'Si riparte dall’inizio' });
  }
  return 'hit';
}

/**
 * Rimanda un proiettile (non un fulmine) CONTRO CHECCO, più veloce — anche se
 * l'aveva sparato una torretta, quindi in diagonale. Usato dalla parata normale
 * e dai colpi a distanza (pistola, onda celeste).
 */
export function reflectProjectileToBoss(world: ArenaWorld, proj: ArenaProjectile): void {
  const speed = Math.hypot(proj.vx, proj.vy ?? 0) * PROJECTILE_REFLECT_SPEED_MULTIPLIER;
  const toBossX = world.boss.x - proj.x;
  const toBossY = world.boss.y + 1.4 - proj.y;
  const toBossLength = Math.hypot(toBossX, toBossY) || 1;
  proj.owner = 'player';
  proj.vx = (toBossX / toBossLength) * speed;
  proj.vy = (toBossY / toBossLength) * speed;
  proj.damage = PROJECTILE_REFLECT_DAMAGE;
  parryProjectile(world);
}

/**
 * Un colpo a distanza (pistola, onda celeste) raggiunge Checco MENTRE sta
 * attaccando con una mossa parabile: è una parata, non un attacco. La mossa
 * viene interrotta (lo fa `BossChecco` al frame successivo), la postura sale e
 * si apre la finestra di contraccolpo — nessun danno.
 */
export function gunParryBoss(world: ArenaWorld, posture: number): void {
  const { boss, player } = world;
  boss.interrupted = true;
  boss.attackBox = null;
  player.parryFlash = 0.25;
  player.counterWindow = COUNTER_WINDOW;
  requestHitStop(world, HITSTOP_PARRY * 1.4);
  gainSkill(world, SKILL_GAIN_PARRY);
  addPosture(world, posture, true);
  pushPopup(world, {
    x: boss.x,
    y: boss.y + BOSS_HEIGHT + 0.15,
    amount: 0,
    target: 'boss',
    boost: 1,
    label: 'PARATA'
  });
}

/** Aggiunge un cerchio che si espande (esplosione, ruggito, schianto). */
export function addRing(world: ArenaWorld, x: number, y: number, radius: number, life: number, color: string): void {
  world.fx.push({ x, y, radius, life, lifeMax: life, color });
}

/**
 * Esplosione a terra attorno a `x`: danneggia torrette e oggetti del Buen Camino
 * entro `radius` e distrugge i proiettili nemici. NON tocca il boss (chi la
 * provoca gli dà già il suo colpo a parte).
 */
export function areaBlast(world: ArenaWorld, x: number, radius: number, damage: number): void {
  for (let i = world.turrets.length - 1; i >= 0; i -= 1) {
    const turret = world.turrets[i];
    if (turret.state === 'active' && Math.abs(turret.x - x) <= radius) damageTurret(world, i, damage);
  }
  for (let i = world.totems.length - 1; i >= 0; i -= 1) {
    if (Math.abs(world.totems[i].x - x) <= radius) damageTotem(world, i, damage);
  }
  for (let i = world.projectiles.length - 1; i >= 0; i -= 1) {
    const proj = world.projectiles[i];
    if (proj.owner === 'boss' && Math.abs(proj.x - x) <= radius) world.projectiles.splice(i, 1);
  }
}

/**
 * In berserk, un colpo in salto che va a segno scatena un'area attorno al
 * giocatore (`BERSERK_AOE_*`). Da chiamare a ogni colpo di spada a segno.
 */
export function onPlayerMeleeHit(world: ArenaWorld): void {
  const { player } = world;
  if (!player.berserk || player.y < 0.4) return;
  areaBlast(world, player.x, BERSERK_AOE_RADIUS, BERSERK_AOE_DAMAGE);
  addRing(world, player.x, player.y + 0.8, BERSERK_AOE_RADIUS, 0.35, '#ef4444');
}
