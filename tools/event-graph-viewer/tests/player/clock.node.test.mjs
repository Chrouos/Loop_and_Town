import test from 'node:test';
import assert from 'node:assert/strict';
import { timeAt } from '../../src/player/clock.ts';
import { normalizeSave } from '../../src/player/model.ts';

test('the first evening is anchored to 18:00 and subsequent loops last a day', () => {
  assert.deepEqual([timeAt(0, 0).minute, timeAt(0, 20 * 60000).minute, timeAt(0, 6 * 3600000).loop, timeAt(0, 30 * 3600000).loop], [1080, 1100, 2, 3]);
});

test('a broken save and a clock rollback cannot erase established progress', () => {
  assert.equal(normalizeSave('{broken', 1000).version, 1);
  const save = normalizeSave({ version: 1, anchorMs: 0, lastConfirmedMs: 2000, loops: { 1: { actionIds: ['protect_wakaharu'], revealedIds: [], sealed: false } } }, 1000);
  assert.equal(save.lastConfirmedMs, 2000);
  assert.deepEqual(save.loops[1].actionIds, ['protect_wakaharu']);
});
