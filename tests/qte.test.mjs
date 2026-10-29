// Test del QTE (FASE 14): la sequenza parla in AZIONI (attack/parry/skill/heal/jump), indipendenti dal dispositivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countMisses, createQte, isQteFinished, pickQteKeys, updateQte } from '../src/game/levels/BossArena/qte.ts';

const ACTIONS = ['attack', 'parry', 'skill', 'heal', 'jump'];
const WINDOWS = [1, 1, 1];

/** Fa passare il tempo (in passi da `step`) finché il prompt non è attivo, poi premi. */
function pressWhenActive(qte, pressed) {
  let event = null;
  for (let i = 0; i < 200 && !event; i += 1) event = updateQte(qte, 0.05, i === 20 ? pressed : []);
  return event;
}

test('pickQteKeys: restituisce azioni del pool, mai la stessa due volte di fila', () => {
  for (let run = 0; run < 50; run += 1) {
    const keys = pickQteKeys(ACTIONS, 10);
    assert.equal(keys.length, 10);
    keys.forEach((key, i) => {
      assert.ok(ACTIONS.includes(key));
      if (i > 0) assert.notEqual(key, keys[i - 1]);
    });
  }
});

test('updateQte: l\'azione giusta nella finestra è un colpo; una diversa è un mancato', () => {
  const qte = createQte(['attack', 'parry', 'jump'], WINDOWS, 0.1);
  assert.equal(pressWhenActive(qte, ['attack']).result, 'hit');
  assert.equal(pressWhenActive(qte, ['skill']).result, 'miss');
  assert.equal(pressWhenActive(qte, ['jump']).result, 'hit');
  assert.ok(isQteFinished(qte));
  assert.equal(countMisses(qte), 1);
});

test('updateQte: una finestra senza pressioni scade come mancato', () => {
  const qte = createQte(['heal'], [0.5], 0.1);
  let event = null;
  for (let i = 0; i < 100 && !event; i += 1) event = updateQte(qte, 0.05, []);
  assert.equal(event.result, 'miss');
});

test('updateQte: le pressioni durante la pausa fra due prompt non contano', () => {
  const qte = createQte(['attack', 'parry'], [1, 1], 0.5);
  const first = updateQte(qte, 0.1, ['attack']);
  assert.equal(first, null, 'ancora nella pausa iniziale');
  assert.equal(qte.index, 0);
});

test('stessa sequenza di azioni per tastiera e pad: ciò che cambia è solo il token tradotto', async () => {
  const { qteActionForToken } = await import('../src/input/tokenActions.ts');
  const keyboard = ['j', 'k', ' ', 'e', 'r'].map(qteActionForToken);
  const pad = ['pad:b2', 'pad:b4', 'pad:b0', 'pad:b5', 'pad:b3'].map(qteActionForToken);
  assert.deepEqual(keyboard, pad);
  const qte = createQte(keyboard, [1, 1, 1, 1, 1], 0.05);
  keyboard.forEach((action) => assert.equal(pressWhenActive(qte, [action]).result, 'hit'));
  assert.equal(countMisses(qte), 0);
});
