// Esterno dell'Ariston (Livello 1): zona d'interazione della porta e coerenza delle posizioni di messa in scena.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isInsideZone, jumpRequested } from '../src/game/levels/Level1/interactZone.ts';
import {
  ARISTON_DOOR_HALF_WIDTH,
  ARISTON_DOOR_X,
  BACKDROP_PX_PER_UNIT,
  BACKDROP_WIDTH,
  PLAYER_HEIGHT,
  SHIP_HEIGHT,
  SHIP_X,
  SIDEWALK_MAX_X,
  SIDEWALK_MIN_X
} from '../src/game/levels/Level1/level1Config.ts';
import { LEVEL1_TRIGGERS_PLACEHOLDER as T } from '../src/data/level1/triggers.ts';
import { actionsForToken } from '../src/input/tokenActions.ts';
import { actionLabel } from '../src/input/glyphLabels.ts';

const DOOR = { centerX: ARISTON_DOOR_X, halfWidth: ARISTON_DOOR_HALF_WIDTH };

test('zona della porta: dentro al centro e ai bordi, fuori appena oltre', () => {
  assert.equal(isInsideZone(ARISTON_DOOR_X, DOOR), true);
  assert.equal(isInsideZone(ARISTON_DOOR_X - ARISTON_DOOR_HALF_WIDTH + 0.01, DOOR), true);
  assert.equal(isInsideZone(ARISTON_DOOR_X + ARISTON_DOOR_HALF_WIDTH - 0.01, DOOR), true);
  assert.equal(isInsideZone(ARISTON_DOOR_X + ARISTON_DOOR_HALF_WIDTH + 0.01, DOOR), false);
  assert.equal(isInsideZone(ARISTON_DOOR_X - ARISTON_DOOR_HALF_WIDTH - 0.01, DOOR), false);
});

test("la zona è larga circa quanto la porta (~135 px dell'immagine), non un tratto di marciapiede", () => {
  const widthPx = ARISTON_DOOR_HALF_WIDTH * 2 * BACKDROP_PX_PER_UNIT;
  assert.ok(widthPx >= 130 && widthPx <= 200, `larghezza zona ${widthPx} px`);
});

test("proporzioni: D è un po' più basso delle porte interne dell'Ariston (~120 px dell'immagine)", () => {
  const heroPx = PLAYER_HEIGHT * BACKDROP_PX_PER_UNIT;
  assert.ok(heroPx < 120 && heroPx > 80, `D alto ${heroPx} px`);
});

test('partenza: sul marciapiede, a sinistra della navicella, fuori dalla zona della porta, con Eve accanto', () => {
  assert.ok(T.startX >= SIDEWALK_MIN_X && T.startX < SHIP_X);
  assert.ok(T.eveStartX > T.startX && T.eveStartX <= SIDEWALK_MAX_X, 'Eve dietro a D (D guarda a sinistra) e dentro il marciapiede');
  assert.equal(isInsideZone(T.startX, DOOR), false);
  assert.equal(isInsideZone(T.eveStartX, DOOR), false);
});

test('uscendo dall\'interno si riappare davanti alla porta ma fuori dalla zona (niente «Entra» immediato)', () => {
  assert.equal(isInsideZone(T.aristonExitX, DOOR), false);
  assert.ok(T.aristonExitX >= SIDEWALK_MIN_X && T.aristonExitX <= SIDEWALK_MAX_X);
});

test('limiti del cammino: dentro l\'immagine, la porta è raggiungibile, il bordo destro sta prima della navicella', () => {
  assert.ok(SIDEWALK_MIN_X > 0 && SIDEWALK_MAX_X < BACKDROP_WIDTH);
  assert.ok(ARISTON_DOOR_X - ARISTON_DOOR_HALF_WIDTH > SIDEWALK_MIN_X);
  assert.ok(SIDEWALK_MAX_X < SHIP_X, 'la navicella sta oltre il limite: si passa solo davanti al marciapiede');
});

test('la navicella è più alta di D', () => {
  assert.ok(SHIP_HEIGHT > PLAYER_HEIGHT);
});

test('«interagisci»: E e Invio da tastiera, A/Croce sul pad; Spazio resta solo salto', () => {
  assert.ok(actionsForToken('e').includes('interact'));
  assert.ok(actionsForToken('enter').includes('interact'));
  assert.ok(actionsForToken('pad:b0').includes('interact'));
  assert.ok(!actionsForToken(' ').includes('interact'));
  assert.equal(actionLabel('interact', 'keyboard', 'generic'), 'E');
  assert.equal(actionLabel('interact', 'gamepad', 'playstation'), '✕');
  assert.equal(actionLabel('interact', 'gamepad', 'xbox'), 'A');
});

test("salto davanti alla porta: da controller (A, come «Entra») non salta, da tastiera sì, fuori dalla zona tutto com'è", () => {
  assert.equal(jumpRequested(false, true, true), false, 'pad A in zona: solo entra');
  assert.equal(jumpRequested(true, false, true), true, 'Spazio in zona: salta');
  assert.equal(jumpRequested(false, true, false), true, 'pad A fuori zona: salta');
  assert.equal(jumpRequested(true, true, true), true, 'tastiera e pad insieme: vale la tastiera');
  assert.equal(jumpRequested(false, false, false), false);
});

