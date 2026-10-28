// Test del punteggio (`npm test`): Node carica direttamente i .ts puri (type stripping), senza Vite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, gradeFor } from '../src/game/score/computeScore.ts';
import { CURIOSITY_FULL_AT, HITS_ZERO_AT, TIME_PAR_SECONDS, TIME_ZERO_SECONDS } from '../src/game/score/scoreConfig.ts';

const NO_DEFINITIONS = [];
const TWO_ACTIVITIES = [
  { id: 'biglietti', label: 'Biglietti' },
  { id: 'popcorn', label: 'Popcorn' }
];

const best = () => ({
  elapsedSeconds: 0,
  hitsTaken: 0,
  qte: { bossCoop: true, barrage: 1, support: 1, cannon: 1 },
  curiosities: Array.from({ length: CURIOSITY_FULL_AT }, (_, i) => `c${i}`),
  activities: []
});

const worst = () => ({
  elapsedSeconds: TIME_ZERO_SECONDS * 2,
  hitsTaken: HITS_ZERO_AT * 2,
  qte: { bossCoop: false, barrage: 0, support: 0, cannon: 0 },
  curiosities: [],
  activities: []
});

test('tutto a zero: 0 punti e voto C', () => {
  const result = computeScore(worst(), NO_DEFINITIONS);
  assert.equal(result.total, 0);
  assert.equal(result.grade, 'C');
});

test('tutto al massimo senza attività definite: 100 e voto S', () => {
  const result = computeScore(best(), NO_DEFINITIONS);
  assert.equal(result.total, 100);
  assert.equal(result.grade, 'S');
});

test('nessuna attività definita: il peso si ridistribuisce e la somma dei massimi resta 100', () => {
  const result = computeScore(best(), NO_DEFINITIONS);
  assert.equal(result.parts.activities.ratio, null);
  assert.equal(result.parts.activities.max, 0);
  const sum = Object.values(result.parts).reduce((total, part) => total + part.max, 0);
  assert.ok(Math.abs(sum - 100) < 1e-9);
});

test('con attività definite pesano: nessuna completata toglie i loro punti', () => {
  const none = computeScore(best(), TWO_ACTIVITIES);
  assert.equal(none.parts.activities.max, 10);
  assert.equal(none.total, 90);
  const all = computeScore({ ...best(), activities: ['biglietti', 'popcorn'] }, TWO_ACTIVITIES);
  assert.equal(all.total, 100);
  const half = computeScore({ ...best(), activities: ['biglietti', 'altro'] }, TWO_ACTIVITIES);
  assert.equal(half.total, 95);
});

test('il tempo: pieno fino al limite, zero oltre, lineare in mezzo', () => {
  const at = (elapsedSeconds) => computeScore({ ...best(), elapsedSeconds }, NO_DEFINITIONS).parts.time.ratio;
  assert.equal(at(TIME_PAR_SECONDS), 1);
  assert.equal(at(TIME_ZERO_SECONDS), 0);
  assert.ok(Math.abs(at((TIME_PAR_SECONDS + TIME_ZERO_SECONDS) / 2) - 0.5) < 1e-9);
});

test('tempo ignoto (null): la componente non conta, non penalizza', () => {
  const result = computeScore({ ...best(), elapsedSeconds: null }, NO_DEFINITIONS);
  assert.equal(result.parts.time.ratio, null);
  assert.equal(result.total, 100);
});

test('QTE mai giocati: la componente non conta; giocati solo in parte: media dei giocati', () => {
  const unplayed = computeScore({ ...best(), qte: { bossCoop: null, barrage: null, support: null, cannon: null } }, NO_DEFINITIONS);
  assert.equal(unplayed.parts.qte.ratio, null);
  const some = computeScore({ ...best(), qte: { bossCoop: true, barrage: null, support: 0.5, cannon: null } }, NO_DEFINITIONS);
  assert.equal(some.parts.qte.ratio, 0.75);
});

test('colpi subiti: ogni colpo toglie, mai sotto zero né sopra uno', () => {
  const ratio = (hitsTaken) => computeScore({ ...best(), hitsTaken }, NO_DEFINITIONS).parts.hits.ratio;
  assert.equal(ratio(0), 1);
  assert.ok(ratio(5) < ratio(1));
  assert.equal(ratio(HITS_ZERO_AT), 0);
  assert.equal(ratio(HITS_ZERO_AT * 10), 0);
  assert.equal(ratio(-3), 1);
});

test('le curiosità si contano per id univoco: lo stesso id due volte vale una', () => {
  const ratio = (curiosities) => computeScore({ ...best(), curiosities }, NO_DEFINITIONS).parts.curiosities.ratio;
  assert.equal(ratio(['a', 'a', 'a']), ratio(['a']));
  assert.ok(ratio(['a', 'b']) > ratio(['a']));
});

test('i voti cambiano alle soglie', () => {
  assert.equal(gradeFor(100), 'S');
  assert.equal(gradeFor(90), 'S');
  assert.equal(gradeFor(89), 'A');
  assert.equal(gradeFor(75), 'A');
  assert.equal(gradeFor(74), 'B');
  assert.equal(gradeFor(55), 'B');
  assert.equal(gradeFor(54), 'C');
  assert.equal(gradeFor(0), 'C');
});

test('è pura: la stessa entrata dà la stessa uscita e non muta l’entrata', () => {
  const input = best();
  const snapshot = JSON.stringify(input);
  assert.deepEqual(computeScore(input, NO_DEFINITIONS), computeScore(input, NO_DEFINITIONS));
  assert.equal(JSON.stringify(input), snapshot);
});
