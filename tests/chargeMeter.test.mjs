// Test della carica del cannone (`npm test`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargeOutcome, createChargeMeter, tap, updateChargeMeter } from '../src/game/levels/Spazio/chargeMeter.ts';
import { CANNON_FORCED_MIN, CANNON_TIME_LIMIT } from '../src/game/levels/Spazio/spazioConfig.ts';

const STEP = 1 / 120;

/** Simula `rate` pressioni al secondo (sui tasti dati, a turno) finché la carica non finisce; restituisce i secondi. */
function mash(meter, rate, keys) {
  let nextTap = 0;
  let i = 0;
  while (meter.state === 'charging') {
    if (meter.elapsed >= nextTap) {
      tap(meter, keys[i % keys.length]);
      i += 1;
      nextTap += 1 / rate;
    }
    updateChargeMeter(meter, STEP);
  }
  return meter.elapsed;
}

test('premere di continuo (~6 al secondo su un tasto) riempie in 7-8.5 s', () => {
  const meter = createChargeMeter();
  const seconds = mash(meter, 6, ['j']);
  assert.equal(meter.state, 'full');
  assert.ok(seconds >= 7 && seconds <= 8.5, `riempita in ${seconds.toFixed(2)} s`);
});

test('alternare J e K rende un po’ più di un tasto solo, ma non il doppio', () => {
  const single = mash(createChargeMeter(), 6, ['j']);
  const alternating = mash(createChargeMeter(), 6, ['j', 'k']);
  assert.ok(alternating < single, 'alternando ci si mette meno');
  assert.ok(alternating > single * 0.7, 'ma di poco');
});

test('lasciarlo stare: scade il tempo, carica 0, spara lo stesso al minimo', () => {
  const meter = createChargeMeter();
  while (updateChargeMeter(meter, STEP) === 'charging');
  assert.equal(meter.state, 'timeout');
  assert.ok(Math.abs(meter.elapsed - CANNON_TIME_LIMIT) < 0.05);
  const outcome = chargeOutcome(meter);
  assert.equal(outcome.score, 0);
  assert.equal(outcome.fired, CANNON_FORCED_MIN);
  assert.equal(outcome.forced, true);
});

test('un ritmo lento arriva solo a una parte e il punteggio è il massimo raggiunto', () => {
  const meter = createChargeMeter();
  mash(meter, 2.5, ['j']);
  assert.equal(meter.state, 'timeout');
  const outcome = chargeOutcome(meter);
  assert.ok(outcome.score > 0 && outcome.score < 1);
  assert.ok(outcome.score >= meter.charge, 'il punteggio non cala col decadimento');
  assert.equal(outcome.fired, Math.max(outcome.score, CANNON_FORCED_MIN));
});

test('dopo uno scatto iniziale e una pausa la carica decade, ma il massimo resta', () => {
  const meter = createChargeMeter();
  for (let i = 0; i < 12; i += 1) {
    tap(meter, 'j');
    for (let t = 0; t < 1 / 8 / STEP; t += 1) updateChargeMeter(meter, STEP);
  }
  const peak = meter.peak;
  assert.ok(peak > 0.2);
  for (let t = 0; t < 2 / STEP; t += 1) updateChargeMeter(meter, STEP);
  assert.ok(meter.charge < peak, 'cala dopo la tregua');
  assert.equal(meter.peak, peak);
});

test('la tregua: nei primi istanti dopo una pressione la carica non cala', () => {
  const meter = createChargeMeter();
  tap(meter, 'j');
  const before = meter.charge;
  updateChargeMeter(meter, 0.2);
  assert.equal(meter.charge, before);
});

test('carica piena: punteggio 1, carica sparata 1, non forzata; le pressioni successive non fanno nulla', () => {
  const meter = createChargeMeter();
  mash(meter, 8, ['j', 'k']);
  assert.equal(meter.state, 'full');
  const taps = meter.taps;
  tap(meter, 'j');
  assert.equal(meter.taps, taps);
  const outcome = chargeOutcome(meter);
  assert.equal(outcome.score, 1);
  assert.equal(outcome.fired, 1);
  assert.equal(outcome.forced, false);
});

test('la carica sta sempre fra 0 e 1', () => {
  const meter = createChargeMeter();
  for (let i = 0; i < 500; i += 1) tap(meter, i % 2 ? 'j' : 'k');
  assert.ok(meter.charge >= 0 && meter.charge <= 1);
  const idle = createChargeMeter();
  for (let t = 0; t < 600; t += 1) updateChargeMeter(idle, STEP);
  assert.ok(idle.charge >= 0);
});
