// Costanti della scena nello spazio (FASE 12, `docs/FASE12_FUGA_SPAZIO_FINALE_PUNTEGGIO.md`): niente numeri magici fuori da qui.
// Niente import con alias: `chargeMeter.ts` (testato con Node) legge questo file direttamente.

// ---------- Inquadratura: palcoscenico logico fisso 16×9 (centrato sull'origine, y verso l'alto) ----------
export const SPACE_VIEW_WIDTH = 16;
export const SPACE_VIEW_HEIGHT = 9;
export const SPACE_CAMERA_Z = 10;

// ---------- Cutscene d'apertura (inseguimento) ----------
/** Durata della timeline d'apertura, secondi. Dura quanto l'ultima battuta (vedi `level1_spazio.ts`). */
export const SPACE_OPENING_DURATION = 20;
/** Il razzo di Checco parte da qui e arriva alla nave madre. */
export const SPACE_ROCKET_START = { x: -5.5, y: -5.2 };
export const SPACE_ROCKET_DOCK = { x: 3.2, y: 2.0 };
/** La navicella di Eve parte da fuori schermo e si porta in posizione di scorta. */
export const SPACE_EVE_START = { x: -9.5, y: -4.8 };
export const SPACE_EVE_HOME = { x: -3.6, y: -0.6 };
/** Dove sta la nave madre (centro). */
export const SPACE_MOTHER_POS = { x: 4.1, y: 2.0 };
/** Velocità di scorrimento delle stelle (unità/s) per i tre strati, dal più lontano al più vicino. */
export const SPACE_STAR_SPEEDS = [0.35, 0.9, 2.2] as const;
export const SPACE_STAR_COUNTS = [70, 40, 18] as const;

// ---------- QTE di supporto a Eve ----------
export const SUPPORT_QTE_KEYS = ['attack', 'parry', 'skill', 'heal', 'jump'] as const; // azioni (FASE 14)
export const SUPPORT_QTE_COUNT = 10;
/** Finestra del primo e dell'ultimo prompt (secondi): le intermedie scendono in modo lineare. */
export const SUPPORT_QTE_WINDOW_FIRST = 1.2;
export const SUPPORT_QTE_WINDOW_LAST = 0.8;
export const SUPPORT_QTE_GAP = 0.35;
/** Pausa prima del primo prompt e dopo l'ultimo (la nave madre apre il fuoco / la navicella barcolla). */
export const SUPPORT_INTRO = 2.2;
export const SUPPORT_OUTRO = 1.6;
export const SUPPORT_QTE_TITLE = 'Supporto a Eve!';
/** Quanto resta a schermo una battuta di Eve durante il QTE. */
export const SUPPORT_CHATTER_SECONDS = 2.0;
/** Durata del volo di un colpo della nave madre, e quanto la navicella si sposta per schivarlo. */
export const SPACE_BOLT_SECONDS = 0.28;
export const SPACE_DODGE_DISTANCE = 1.5;

// ---------- Carica del cannone ----------
/** Carica con qualunque tasto frontale (attacco, parata, salto, scatto) o con un click/tap: vedi `isCannonToken` in `src/input/`. */
/** Carica per pressione (0-1). A ~6 pressioni al secondo la barra si riempie in ~7.5 s. */
export const CANNON_GAIN_PER_TAP = 0.022;
/** Moltiplicatore se la pressione è su un tasto DIVERSO dalla precedente (alternare J e K rende un po' di più). */
export const CANNON_ALTERNATE_BONUS = 1.2;
/** Dopo l'ultima pressione la carica non cala per questo tempo (premia il ritmo); poi scende di `DECAY_PER_SECOND`. */
export const CANNON_IDLE_GRACE = 0.3;
export const CANNON_DECAY_PER_SECOND = 0.15;
/** Tempo massimo per caricare, secondi. */
export const CANNON_TIME_LIMIT = 10;
/** A tempo scaduto sotto questa carica il cannone spara lo stesso a questa carica (raggio più sottile). */
export const CANNON_FORCED_MIN = 0.7;
/** Pause a inizio carica (le pressioni del dialogo precedente non contano) e dopo il «pieno» prima dello sparo. */
export const CANNON_READY_DELAY = 0.5;
export const CANNON_FIRE_HOLD = 0.9;

// ---------- Cutscene della distruzione ----------
export const SPACE_DESTRUCTION_DURATION = 12.5;
/** Il bianco parte poco prima della fine, e passa questo tempo (ms) fra il bianco e il cambio di fase (come `EscapeCutscene`). */
export const SPACE_WHITEOUT_LEAD = 1.8;
export const SPACE_WHITEOUT_TO_PHASE_MS = 550;
/** Larghezza del raggio (unità) con carica forzata e con carica piena. */
export const SPACE_BEAM_WIDTH_MIN = 0.35;
export const SPACE_BEAM_WIDTH_MAX = 1.5;

// ---------- Pausa prima che il dialogo ascolti l'input (chi ha appena finito il QTE sta ancora premendo tasti) ----------
export const SPACE_DIALOGUE_DELAY_MS = 1200;
