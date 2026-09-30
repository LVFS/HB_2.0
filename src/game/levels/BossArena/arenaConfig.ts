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
export const PARRY_TIMING = { active: 0.18, recovery: 0.24 } as const;
export const PARRY_REACH = 1.1;

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
export const BOSS_MAX_HP = 140;
export const BOSS_HEIGHT = 2.8;
export const BOSS_HALF_WIDTH = 0.75;
export const BOSS_SPAWN_X = 6;
export const BOSS_SPEED_ROUND1 = 2.4;
export const BOSS_SPEED_ROUND2 = 3.2;
export const BOSS_MOVE_COOLDOWN_ROUND1 = 0.7;
export const BOSS_MOVE_COOLDOWN_ROUND2 = 0.4;

/** Postura del boss: sale con colpi e parate, decade da sola; a 100 barcolla. */
export const POSTURE_MAX = 100;
export const POSTURE_DECAY_PER_SECOND = 12;
export const POSTURE_DECAY_DELAY = 1.6;
export const PARRY_POSTURE_GAIN = 28;
export const BOSS_STAGGER_DURATION = 2.8;
export const BOSS_STAGGER_DAMAGE_MULTIPLIER = 2;

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
export const HEAL_AMOUNT = 40;

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
  { id: 'fendente_caricato', threshold: 100, cost: 100, windup: 0.3, active: 0.2, recovery: 0.35, reach: 3.2, damage: 40, posture: 50 },
  { id: 'affondo', threshold: 50, cost: 50, windup: 0.15, active: 0.15, recovery: 0.25, reach: 2.4, damage: 18, posture: 25 }
] as const;

/** Dopo vittoria/sconfitta: pausa prima del passaggio successivo. */
export const END_DELAY = 1.8;
