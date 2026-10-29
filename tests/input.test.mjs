// Test dell'input (FASE 14): famiglia del pad, stato del pad (stick, isteresi, bordi), binding e QTE ad azioni, etichette.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { padFamily, glyphFamily } from '../src/input/padFamily.ts';
import { axisActive, readPadTokens, readPadsTokens } from '../src/input/padState.ts';
import { STICK_OFF, STICK_ON, GAMEPAD_BINDINGS } from '../src/input/gamepadBindings.ts';
import { KEYBOARD_BINDINGS } from '../src/input/keyboardBindings.ts';
import { GAME_ACTIONS, QTE_ACTIONS } from '../src/input/inputActions.ts';
import { actionsForToken, isCannonToken, qteActionForToken } from '../src/input/tokenActions.ts';
import { actionLabel, formatActionText } from '../src/input/glyphLabels.ts';

// ---------- padFamily ----------
test('padFamily: identificatore di Chrome (con produttore)', () => {
  assert.equal(padFamily('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)'), 'playstation');
  assert.equal(padFamily('Xbox 360 Controller (XInput STANDARD GAMEPAD)'), 'xbox');
  assert.equal(padFamily('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)'), 'switch');
  assert.equal(padFamily('Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'), 'xbox');
});

test('padFamily: identificatore di Firefox (vid-pid-nome)', () => {
  assert.equal(padFamily('054c-09cc-Wireless Controller'), 'playstation');
  assert.equal(padFamily('045e-0b12-Xbox Wireless Controller'), 'xbox');
  assert.equal(padFamily('057e-2009-Pro Controller'), 'switch');
});

test('padFamily: dal nome quando manca il produttore, e generic per gli sconosciuti', () => {
  assert.equal(padFamily('DualSense Wireless Controller'), 'playstation');
  assert.equal(padFamily('DUALSHOCK 4'), 'playstation');
  assert.equal(padFamily('Nintendo Switch Pro Controller'), 'switch');
  assert.equal(padFamily('Microsoft X-Box One pad'), 'xbox');
  assert.equal(padFamily('USB Gamepad 1234'), 'generic');
  assert.equal(padFamily(''), 'generic');
});

test('glyphFamily: generic usa le icone Xbox', () => {
  assert.equal(glyphFamily('generic'), 'xbox');
  assert.equal(glyphFamily('playstation'), 'playstation');
});

// ---------- padState ----------
const button = (pressed, value = pressed ? 1 : 0) => ({ pressed, value });
const pad = (over = {}) => ({ mapping: 'standard', buttons: Array.from({ length: 17 }, () => button(false)), axes: [0, 0, 0, 0], ...over });
const withButtons = (indices, over = {}) => {
  const buttons = Array.from({ length: 17 }, (_, i) => button(indices.includes(i)));
  return pad({ buttons, ...over });
};

test('padState: bottoni, croce e grilletti analogici', () => {
  assert.deepEqual([...readPadTokens(withButtons([0, 2]))].sort(), ['pad:b0', 'pad:b2']);
  assert.deepEqual([...readPadTokens(withButtons([14]))], ['pad:left']);
  assert.deepEqual([...readPadTokens(withButtons([15, 12]))].sort(), ['pad:right', 'pad:up']);
  const trigger = pad({ buttons: Array.from({ length: 17 }, (_, i) => (i === 7 ? button(false, 0.8) : button(false))) });
  assert.deepEqual([...readPadTokens(trigger)], ['pad:b7']);
  const soft = pad({ buttons: Array.from({ length: 17 }, (_, i) => (i === 7 ? button(false, 0.3) : button(false))) });
  assert.equal(readPadTokens(soft).size, 0);
});

test('padState: lo stick si accende sopra la soglia e non sotto', () => {
  assert.equal(readPadTokens(pad({ axes: [STICK_ON - 0.01, 0] })).size, 0);
  assert.deepEqual([...readPadTokens(pad({ axes: [-(STICK_ON + 0.05), 0] }))], ['pad:left']);
  assert.deepEqual([...readPadTokens(pad({ axes: [0, STICK_ON + 0.05] }))], ['pad:down']);
  assert.deepEqual([...readPadTokens(pad({ axes: [0, -0.9] }))], ['pad:up']);
});

test('padState: isteresi — tra le due soglie resta acceso solo se era già acceso', () => {
  const between = (STICK_ON + STICK_OFF) / 2;
  assert.equal(axisActive(between, false), false);
  assert.equal(axisActive(between, true), true);
  assert.equal(axisActive(STICK_OFF - 0.01, true), false);
  const off = readPadTokens(pad({ axes: [between, 0] }), new Set());
  const on = readPadTokens(pad({ axes: [between, 0] }), new Set(['pad:right']));
  assert.equal(off.size, 0);
  assert.deepEqual([...on], ['pad:right']);
});

test('padState: bordo di salita — un token nuovo rispetto al frame prima è una pressione', () => {
  const frame1 = readPadTokens(withButtons([2]));
  const frame2 = readPadTokens(withButtons([2]), frame1);
  const rising = [...frame2].filter((token) => !frame1.has(token));
  assert.equal(rising.length, 0, 'tenuto: nessun nuovo bordo');
  const frame3 = readPadTokens(withButtons([2, 4]), frame2);
  assert.deepEqual([...frame3].filter((token) => !frame2.has(token)), ['pad:b4']);
});

test('padState: pad non standard conta solo i bottoni 0-3 e lo stick; più pad si uniscono', () => {
  const odd = withButtons([0, 5, 12], { mapping: '' });
  assert.deepEqual([...readPadTokens(odd)], ['pad:b0']);
  const merged = readPadsTokens([withButtons([0]), null, withButtons([3])]);
  assert.deepEqual([...merged].sort(), ['pad:b0', 'pad:b3']);
});

// ---------- binding e azioni ----------
test('binding: ogni azione ha almeno un token di tastiera e uno di pad', () => {
  for (const action of GAME_ACTIONS) {
    assert.ok(KEYBOARD_BINDINGS[action].length > 0, action);
    assert.ok(GAMEPAD_BINDINGS[action].length > 0, action);
  }
});

test('tastiera invariata: gli stessi tasti di prima per ogni azione', () => {
  const expected = { attack: ['j', 'mouse0'], parry: ['k', 'mouse2'], dash: ['shift'], jump: [' ', 'w', 'arrowup'], heal: ['r'], skill: ['e'], berserk: ['q'], summon: ['f'], laneUp: ['w', 'arrowup'], laneDown: ['s', 'arrowdown'], left: ['a', 'arrowleft'], right: ['d', 'arrowright'] };
  for (const [action, keys] of Object.entries(expected)) assert.deepEqual([...KEYBOARD_BINDINGS[action]], keys, action);
});

test('mappatura del pad come da piano', () => {
  assert.deepEqual([...GAMEPAD_BINDINGS.jump], ['pad:b0']);
  assert.deepEqual([...GAMEPAD_BINDINGS.attack], ['pad:b2']);
  assert.deepEqual([...GAMEPAD_BINDINGS.parry], ['pad:b4']);
  assert.deepEqual([...GAMEPAD_BINDINGS.dash], ['pad:b1']);
  assert.deepEqual([...GAMEPAD_BINDINGS.heal], ['pad:b3']);
  assert.deepEqual([...GAMEPAD_BINDINGS.skill], ['pad:b5']);
  assert.deepEqual([...GAMEPAD_BINDINGS.berserk], ['pad:b7']);
  assert.deepEqual([...GAMEPAD_BINDINGS.summon], ['pad:b6']);
  assert.deepEqual([...GAMEPAD_BINDINGS.skip], ['pad:b9']);
});

test('actionsForToken: un token può essere più azioni; le sostituzioni valgono solo per la tastiera', () => {
  assert.deepEqual(actionsForToken('pad:b0'), ['jump', 'confirm', 'interact']);
  assert.ok(actionsForToken('w').includes('jump'));
  assert.ok(!actionsForToken('w', { jump: [' '] }).includes('jump'));
  assert.ok(actionsForToken('pad:b0', { jump: [' '] }).includes('jump'));
  assert.deepEqual(actionsForToken('z'), []);
});

// ---------- QTE ad azioni ----------
test('QTE: tastiera e pad premono le stesse azioni', () => {
  assert.equal(qteActionForToken('j'), 'attack');
  assert.equal(qteActionForToken('k'), 'parry');
  assert.equal(qteActionForToken('e'), 'skill');
  assert.equal(qteActionForToken('r'), 'heal');
  assert.equal(qteActionForToken(' '), 'jump');
  assert.equal(qteActionForToken('pad:b2'), 'attack');
  assert.equal(qteActionForToken('pad:b4'), 'parry');
  assert.equal(qteActionForToken('pad:b5'), 'skill');
  assert.equal(qteActionForToken('pad:b3'), 'heal');
  assert.equal(qteActionForToken('pad:b0'), 'jump');
});

test('QTE: i tasti che prima non c\'erano non contano (W/freccia su, scatto, furia, croce)', () => {
  for (const token of ['w', 'arrowup', 'shift', 'q', 'f', 'pad:up', 'pad:b1', 'pad:b7', 'enter']) assert.equal(qteActionForToken(token), null, token);
  assert.deepEqual([...QTE_ACTIONS].sort(), ['attack', 'heal', 'jump', 'parry', 'skill']);
});

test('cannone: vale qualunque tasto frontale (attacco, parata, salto, scatto), non gli altri', () => {
  for (const token of ['j', 'k', ' ', 'shift', 'pad:b0', 'pad:b1', 'pad:b2', 'pad:b4']) assert.ok(isCannonToken(token), token);
  for (const token of ['e', 'r', 'q', 'pad:b5', 'pad:b3', 'pad:left']) assert.ok(!isCannonToken(token), token);
});

// ---------- etichette ----------
test('etichette per dispositivo e famiglia', () => {
  assert.equal(actionLabel('attack', 'keyboard', 'generic'), 'J');
  assert.equal(actionLabel('jump', 'keyboard', 'generic'), 'Spazio');
  assert.equal(actionLabel('attack', 'gamepad', 'xbox'), 'X');
  assert.equal(actionLabel('attack', 'gamepad', 'playstation'), '□');
  assert.equal(actionLabel('jump', 'gamepad', 'playstation'), '✕');
  assert.equal(actionLabel('jump', 'gamepad', 'switch'), 'B');
  assert.equal(actionLabel('parry', 'gamepad', 'playstation'), 'L1');
  assert.equal(actionLabel('parry', 'gamepad', 'generic'), 'LB');
  assert.equal(actionLabel('skip', 'gamepad', 'playstation'), 'Options');
  assert.equal(actionLabel('left', 'gamepad', 'xbox'), '←');
});

test('formatActionText: sostituisce i segnaposto e lascia stare gli altri', () => {
  assert.equal(formatActionText('Premi {skill} per usarlo', 'keyboard', 'generic'), 'Premi E per usarlo');
  assert.equal(formatActionText('Premi {skill} per usarlo', 'gamepad', 'xbox'), 'Premi RB per usarlo');
  assert.equal(formatActionText('{attack}: coccola · {heal}: pappa', 'gamepad', 'playstation'), '□: coccola · △: pappa');
  assert.equal(formatActionText('Zoltraak {boh}', 'keyboard', 'generic'), 'Zoltraak {boh}');
});

// ---------- pausa e salto (FASE 14b) ----------
test('Esc e Start sono sia «pausa» (tocco) sia «salta» (tenuto): stessi token, azioni diverse', () => {
  assert.deepEqual(actionsForToken('escape'), ['skip', 'pause']);
  assert.deepEqual(actionsForToken('pad:b9'), ['skip', 'pause']);
  assert.ok(!actionsForToken('enter').includes('pause'), 'Invio non mette in pausa');
  assert.equal(qteActionForToken('pad:b9'), null);
  assert.ok(!isCannonToken('pad:b9'));
  assert.equal(actionLabel('pause', 'gamepad', 'playstation'), 'Options');
  assert.equal(actionLabel('pause', 'keyboard', 'generic'), 'Esc');
});

test('croce e stick sono le direzioni dei menu; A conferma e B torna indietro', () => {
  assert.deepEqual(actionsForToken('pad:left'), ['left']);
  assert.deepEqual(actionsForToken('pad:down'), ['laneDown']);
  assert.ok(actionsForToken('pad:b0').includes('confirm'));
  assert.ok(actionsForToken('pad:b1').includes('back'));
});
