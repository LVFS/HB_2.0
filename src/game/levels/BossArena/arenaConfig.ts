// Costanti dell'arena del boss (Checco Zalone, `boss_fase1`): valori "da
// vista", tarati a occhio in gioco come tutte le altre costanti del progetto
// (`level1Config.ts`, `wallConfig.ts`) — nessun calcolo fisico vero.
import type { CharacterVariant } from '@/game/render2d/characterSprites';

/** Chi controlla il giocatore nell'arena. D1 ha la lama (posa `action` =
 *  posa d'attacco); D0 è disarmato e la sua `action` è solo un passo. */
export const ARENA_PLAYER_VARIANT: CharacterVariant = 'D1';

/** Palco chiuso: giocatore e boss ai due capi, con margine per manovrare. */
export const ARENA_HALF_WIDTH = 11;
export const ARENA_GROUND_Y = 0;
export const ARENA_PLAYER_SPAWN_X = -8;
export const ARENA_CAMERA_ZOOM = 85;
export const ARENA_CAMERA_Z = 20;
export const ARENA_CAMERA_EYE_Y = 1.6;
/** Smorzamento della camera che segue il punto medio giocatore/boss. */
export const ARENA_CAMERA_SMOOTHING = 0.08;
/** Quanto oltre `ARENA_HALF_WIDTH` la camera può spingersi (i pilastri ai capi). */
export const ARENA_CAMERA_EDGE_MARGIN = 2;

export const ARENA_PLAYER_HEIGHT = 1.9;
export const ARENA_PLAYER_SPEED = 4.8;
/** Alzato da 8: per scavalcare il corpo solido di Checco (`BOSS_BLOCK_*`) serve
 *  stare sopra `BOSS_BLOCK_HEIGHT` per tutto il tempo di attraversarlo. */
export const ARENA_JUMP_SPEED = 9.5;
export const ARENA_GRAVITY = -22;

/** Attacco: windup → finestra attiva → recupero (secondi). L'hitbox esiste
 *  solo durante `active`. */
export const ATTACK_TIMING = { windup: 0.08, active: 0.12, recovery: 0.16 } as const;
export const ATTACK_REACH = 1.5;
export const ATTACK_HALF_HEIGHT = 0.7;

/** Parata: la finestra `active` è quella in cui un colpo subito conta come
 *  parry riuscito (a timing preciso), poi recupero in cui si è scoperti. */
export const PARRY_TIMING = { active: 0.10, recovery: 0.22 } as const;
export const PARRY_REACH = 1;

/** Dash: spostamento rapido con i-frames per tutta la durata. */
export const DASH_DURATION = 0.18;
export const DASH_SPEED = 14;
export const DASH_COOLDOWN = 0.45;

// ---------------------------------------------------------------------------
// Combattimento (passi 5-10 del piano). Numeri "da vista": si tarano giocando.

/** Giocatore. */
export const PLAYER_MAX_HP = 100;
export const PLAYER_ATTACK_DAMAGE = 7;
export const PLAYER_ATTACK_POSTURE = 10;
export const PLAYER_HIT_STUN = 0.3;
export const PLAYER_IFRAMES_AFTER_HIT = 0.45;
export const PLAYER_KNOCKBACK = 6;
/** Dopo una parata riuscita: per COUNTER_WINDOW secondi i danni aumentano. */
export const COUNTER_WINDOW = 0.45;
export const COUNTER_MULTIPLIER = 1.5;

/** Hit-stop: brevissimo freeze del gameplay su un colpo, peso a costo zero. */
export const HITSTOP_LIGHT = 0.05;
export const HITSTOP_PARRY = 0.09;

/** Checco Zalone: più grande di D (esce dallo schermo, vedi `dialogo_pre_boss`). */
export const BOSS_MAX_HP = 3333;
export const BOSS_HEIGHT = 2.5;
export const BOSS_HALF_WIDTH = 0.75;
export const BOSS_SPAWN_X = 6;
export const BOSS_SPEED_ROUND1 = 3.4;
export const BOSS_SPEED_ROUND2 = 4.2;
export const BOSS_MOVE_COOLDOWN_ROUND1 = 0.6;
export const BOSS_MOVE_COOLDOWN_ROUND2 = 0.3;

/** Postura del boss: sale con colpi e parate, decade da sola; a 100 barcolla. */
export const POSTURE_MAX = 300;
export const POSTURE_DECAY_PER_SECOND = 10;
export const POSTURE_DECAY_DELAY = 5.0;
export const PARRY_POSTURE_GAIN = 25;
export const BOSS_STAGGER_DURATION = 2.0;
export const BOSS_STAGGER_DAMAGE_MULTIPLIER = 5;

/** Evento "Avvia il film": scatta una volta, quando la vita del boss scende sotto questa frazione del massimo (non un numero fisso: regge se cambia BOSS_MAX_HP). */
export const SPECIAL_TRIGGER_HP_FRACTION = 0.65;
export const SPECIAL_WINDUP = 3.2;
/** Ultimi secondi del windup in cui una parata a portata lo interrompe. */
export const SPECIAL_PARRY_WINDOW = 1.0;
export const SPECIAL_PARRY_RANGE = 3.5;
/** Danno inflitto durante il windup che basta a interromperlo. */
export const SPECIAL_INTERRUPT_DAMAGE = 16;
export const SPECIAL_COMPLETED_BOSS_HEAL = 15;
export const SPECIAL_COMPLETED_PLAYER_SPEED = 0.75;
export const SPECIAL_INTERRUPTED_PLAYER_HEAL = 20;
export const SPECIAL_INTERRUPTED_PLAYER_DAMAGE = 1.25;
export const SPECIAL_INTERRUPTED_BOSS_SPEED = 0.85;

/** Eve: a terra all'inizio, richiamabile con `F`, poi supporto marginale. */
export const EVE_HEIGHT = 1.7;
export const EVE_DOWN_X = -4.5;
export const EVE_SPEED = 3.4;
export const EVE_ATTACK_RANGE = 1.6;
export const EVE_ATTACK_INTERVAL = 2.4;
export const EVE_ATTACK_WINDUP = 0.35;
export const EVE_ATTACK_DAMAGE = 5;
export const EVE_ATTACK_POSTURE = 4;
export const EVE_STAGGER_DURATION = 1.2;
/** Probabilità che, scegliendo una mossa, Checco prenda di mira Eve. */
export const EVE_AGGRO_CHANCE = 0.2;

/** Corpo solido di Checco: il giocatore non lo attraversa camminando, ma lo
 *  scavalca saltando (quando i suoi piedi sono sopra `BOSS_BLOCK_HEIGHT`).
 *  Vale in un solo senso: Checco non è bloccato dal giocatore. Più largo della
 *  hurtbox da combattimento (`BOSS_HALF_WIDTH`). */
export const BOSS_BLOCK_HALF_WIDTH = 0.85;
export const BOSS_BLOCK_HEIGHT = 1.0;

/** Cure (stile fiaschetta): cariche fisse per tentativo, canalizzazione
 *  interrompibile (nessun i-frame mentre si cura). */
export const HEAL_CHARGES = 3;
export const HEAL_CHANNEL = 0.8;
export const HEAL_AMOUNT = 50;

/** Barra abilità 0-100. Si carica quando si fa bene: colpo a segno, parata
 *  riuscita, barcollamento INFLITTO al boss (mai subito). Due soglie, due mosse
 *  su un solo tasto (`E`): esegue la più forte disponibile. */
export const SKILL_MAX = 100;
export const SKILL_GAIN_HIT = 6;
export const SKILL_GAIN_PARRY = 12;
export const SKILL_GAIN_STAGGER = 25;
/** Soglie e mosse (segnaposto, le mosse vere si progettano insieme): la tier
 *  alta consuma tutta la barra, la bassa metà. `cost` è quanto toglie. */
export const SKILL_TIERS = [
  { id: 'fendente_caricato', threshold: 100, cost: 100, windup: 0.3, active: 0.2, recovery: 0.35, reach: 3.2, damage: 250, posture: 250 },
  { id: 'affondo', threshold: 50, cost: 50, windup: 0.15, active: 0.15, recovery: 0.25, reach: 2.4, damage: 100, posture: 100 }
] as const;

/** Dopo vittoria/sconfitta: pausa prima del passaggio successivo. */
export const END_DELAY = 1.8;

/** Soffitto: da qui cadono i detriti (quota Y). */
export const ARENA_CEILING_Y = 7;
/** Detriti: dopo il marcatore a terra (`warn`) cadono veloci e non si parano. */
export const DEBRIS_FALL_SPEED = 20;
export const DEBRIS_HALF_SIZE = 0.45;
/** Proiettili di Checco: parabili e rimandabili indietro. */
export const PROJECTILE_HALF_SIZE = 0.28;
export const PROJECTILE_REFLECT_SPEED_MULTIPLIER = 1.5;
export const PROJECTILE_REFLECT_DAMAGE = 14;
export const PROJECTILE_REFLECT_POSTURE = 25;
export const PROJECTILE_LIFETIME = 4;
/** Teletrasporto: dietro il giocatore, a questa distanza. */
export const TELEPORT_BEHIND_DISTANCE = 2;

/** Distanza minima dal bersaglio per le mosse a distanza (lancio/raffica):
 *  da più vicino Checco usa quelle in mischia. */
export const RANGED_MIN_RANGE = 2;

/**
 * Evento "oggetti del Buen Camino": a queste frazioni di vita (una volta
 * ciascuna) Checco evoca degli oggetti sparsi per l'arena e finché ne esiste
 * anche uno è INVULNERABILE. Il giocatore deve staccarsi da lui per
 * distruggerli (colpendoli, o rimandando un proiettile parato contro di loro).
 */
export const TOTEM_TRIGGER_FRACTIONS = [0.45, 0.2];
export const TOTEM_COUNTS = [3, 4];
export const TOTEM_WINDUP = 1.1;
export const TOTEM_HP = 30;
export const TOTEM_HALF_WIDTH = 0.5;
export const TOTEM_HEIGHT = 1.8;
/** Distanze minime di spawn: da Checco e fra un oggetto e l'altro. */
export const TOTEM_MIN_DISTANCE_FROM_BOSS = 5;
export const TOTEM_MIN_SPACING = 3.5;
/** Danno di un proiettile rimandato su un oggetto. */
export const TOTEM_REFLECT_DAMAGE = 12;

/**
 * Contrasto (alla "mikiri" di Sekiro): schivando CONTRO una carica di Checco
 * (dash verso di lui mentre carica) la si ferma e lo si stordisce.
 */
export const COUNTER_STUN_DURATION = 3;

/**
 * Fulmini a ricerca (mossa "tempesta", solo round 2). Parati a terra costano
 * poco danno ma bloccano il giocatore; parati IN ARIA tornano indietro e
 * stordiscono Checco; il dash li schiva.
 */
export const BOLT_AIR_MIN_Y = 0.35;
export const BOLT_TURN_RATE = 2.4;
export const BOLT_PARRY_GROUND_DAMAGE = 4;
export const BOLT_PARRY_GROUND_FREEZE = 1.3;
export const BOLT_REFLECT_DAMAGE = 20;
export const BOLT_REFLECT_POSTURE = 40;
export const BOLT_REFLECT_STUN = 2.2;
export const BOLT_REFLECT_SPEED_MULTIPLIER = 1.4;
/** Ogni parata IN ARIA di un fulmine spinge il giocatore verso l'alto: così
 *  può parare anche i fulmini successivi. */
export const BOLT_AIR_PARRY_BOOST = 8.5;

/**
 * Cariche di Checco (lunge/balzo): il punto d'arrivo è sempre la posizione del
 * giocatore al momento della scelta della mossa. La velocità si adatta alla
 * distanza per arrivarci nel tempo della finestra, fra questi limiti.
 */
export const LUNGE_MIN_SPEED = 5;
/** Percorrenza minima di una carica a terra: se il giocatore è più vicino,
 *  Checco prosegue OLTRE di lui (travolgendolo se non lo schiva/para) invece
 *  di fare pochi centimetri. Non vale per il balzo. */
export const LUNGE_MIN_TRAVEL = 2.6;
export const LUNGE_MAX_SPEED = 18;

/** Mini balzo all'indietro di Checco dopo un contrasto riuscito. */
export const COUNTER_HOP_DISTANCE = 2.4;
export const COUNTER_HOP_DURATION = 0.42;
export const COUNTER_HOP_HEIGHT = 0.9;

/**
 * Braccio di ferro del contrasto: quando il dash del giocatore incontra la
 * carica di Checco entrambi si bloccano e il giocatore deve PREMERE a
 * ripetizione attacco (`J`/click). La barra parte da `CLASH_START_PROGRESS`,
 * ogni pressione la fa salire di `CLASH_PRESS_GAIN`, la spinta di Checco la fa
 * scendere di `CLASH_DECAY` al secondo. A 1 vince (Checco stordito, come
 * prima); a 0 o a tempo scaduto perde (sbalzato via, danno e stordimento).
 * Con questi valori servono ~6 pressioni al secondo per vincere.
 */
export const CLASH_DURATION = 1.8;
export const CLASH_START_PROGRESS = 0.3;
export const CLASH_PRESS_GAIN = 0.12;
export const CLASH_DECAY = 0.25;
export const CLASH_LOSE_DAMAGE = 14;
export const CLASH_FLING_SPEED = 30;
export const CLASH_FLING_BOOST = 5.5;
export const CLASH_LOSE_STUN = 1.1;

/** Doppio salto del giocatore: un secondo salto in aria (un filo più basso). */
export const ARENA_DOUBLE_JUMP_SPEED = 8.5;
export const ARENA_MAX_JUMPS = 2;

/**
 * Torrette: Checco ne lancia ogni tanto, INDIPENDENTEMENTE da quello che sta
 * facendo (attacchi asincroni). Si piantano a terra o sui muri, a un'altezza
 * raggiungibile saltando, e sparano da sole al giocatore (colpi parabili: la
 * parata li rimanda contro Checco). Si eliminano ATTACCANDOLE.
 */
export const TURRET_MAX_ROUND1 = 2;
export const TURRET_MAX_ROUND2 = 4;
export const TURRET_FIRST_DELAY = 7;
export const TURRET_INTERVAL_ROUND1: [number, number] = [10, 15];
export const TURRET_INTERVAL_ROUND2: [number, number] = [6, 10];
export const TURRET_HP = 14;
export const TURRET_SIZE = 0.9;
export const TURRET_FLIGHT = 0.6;
/** Pausa fra un colpo e l'altro, e secondi di carica visibile prima di sparare. */
export const TURRET_FIRE_INTERVAL: [number, number] = [2.2, 3.4];
export const TURRET_CHARGE = 0.55;
export const TURRET_SHOT_SPEED = 7;
export const TURRET_SHOT_DAMAGE = 10;
/** Quota (centro) delle torrette a muro: raggiungibili saltando. */
export const TURRET_WALL_Y: [number, number] = [1.5, 2.7];
export const TURRET_FLOOR_CHANCE = 0.5;

/**
 * Potenziamento "Bloodborne" (scelto quando si interrompe l'evento "Avvia il
 * film"): al posto della parata c'è la pistola, le abilità cambiano e a furia
 * piena si può entrare in berserk. Tutto da tarare giocando.
 */
export const POWER_UP_INTRO_SECONDS = 2.6;

/** Pistola: colpo istantaneo in linea retta (tasto parata). Fa il minimo del
 *  danno, ma ferma tutto ciò che si frappone e PARA l'attacco di Checco. */
export const GUN_WINDUP = 0.04;
export const GUN_COOLDOWN = 0.42;
export const GUN_HEIGHT = 1.05;
export const GUN_RAY_HALF_HEIGHT = 0.2;
export const GUN_DAMAGE = 4;
export const GUN_POSTURE = 6;
/** Postura data a Checco quando il colpo lo PARA mentre attacca. */
export const GUN_PARRY_POSTURE = 60;
/** Danno a torrette e oggetti del Buen Camino. */
export const GUN_OBJECT_DAMAGE = 8;
export const GUN_TRACER_LIFE = 0.09;

/** Abilità Bloodborne (stesse soglie di SKILL_TIERS: 50 e 100). */
export const SKILL_TIERS_BLOODBORNE = [
  { id: 'carica_falce', threshold: 100, cost: 100, damage: 250, posture: 250 },
  { id: 'fendente_celeste', threshold: 50, cost: 50, damage: 100, posture: 100 }
] as const;

/** Fendente celeste (mezza barra): onda che viaggia fino al primo ostacolo. */
export const WAVE_WINDUP = 0.28;
export const WAVE_RECOVERY = 0.3;
export const WAVE_SPEED = 20;
export const WAVE_HALF_HEIGHT = 0.7;

/** Carica con falce (barra piena): sequenza guidata scatto → colpo che lo
 *  lancia in aria → falce che si schianta. `launchShare` = quota di danno e
 *  postura del primo colpo (il resto va allo schianto). */
export const FINISHER = {
  dashTime: 0.2,
  standOff: 1.1,
  launchTime: 0.3,
  launchHeight: 3.4,
  hangTime: 0.3,
  slamTime: 0.16,
  recoverTime: 0.4,
  launchShare: 0.4,
  slamRadius: 3.4
} as const;

/** Furia: si carica con l'eccesso della barra abilità già piena; `Q` a furia
 *  piena scatena il berserk, che la svuota piano. */
export const RAGE_MAX = 100;
export const BERSERK_DRAIN_PER_SECOND = 8;
/** Usare l'abilità (`E`) in berserk costa furia e lancia ruggito + onda d'urto. */
export const BERSERK_SKILL_COST = 20;
export const BERSERK_SPEED = 1.5;
export const BERSERK_JUMP = 1.2;
export const BERSERK_REACH = 1.6;
export const BERSERK_ATTACK_SPEED = 1.6;
export const BERSERK_DAMAGE = 1.5;
export const BERSERK_DAMAGE_TAKEN = 0.5;
/** Moltiplicatore a catena: +STEP a ogni colpo a segno, torna a 1 al primo colpo subito. */
export const BERSERK_COMBO_STEP = 0.15;
export const BERSERK_COMBO_MAX = 3;
/** Attacco in salto in berserk: area attorno al giocatore a ogni colpo a segno. */
export const BERSERK_AOE_RADIUS = 3;
export const BERSERK_AOE_DAMAGE = 14;
export const SHOCK_WINDUP = 0.2;
export const SHOCK_RECOVERY = 0.35;
export const SHOCK_SPEED = 16;
export const SHOCK_DAMAGE = 140;
export const SHOCK_POSTURE = 80;
export const SHOCK_HALF_HEIGHT = 1.3;
