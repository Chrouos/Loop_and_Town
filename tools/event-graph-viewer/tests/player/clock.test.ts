import { expect, it } from 'vitest';
import { timeAt } from '../../src/player/clock';
import { normalizeSave } from '../../src/player/model';

it('anchors the first visit to 18:00 and keeps later loops a day long', () => {
  expect(timeAt(0, 0).minute).toBe(1080);
  expect(timeAt(0, 20 * 60_000).minute).toBe(1100);
  expect(timeAt(0, 6 * 3_600_000).loop).toBe(2);
  expect(timeAt(0, 30 * 3_600_000).loop).toBe(3);
});

it('keeps confirmed progress when device time goes backwards', () => {
  const save = normalizeSave({ version: 1, anchorMs: 0, lastConfirmedMs: 2000, loops: { 1: { actionIds: ['protect_wakaharu'], revealedIds: [], sealed: false } } }, 1000);
  expect(save.lastConfirmedMs).toBe(2000);
  expect(save.loops[1].actionIds).toEqual(['protect_wakaharu']);
});
