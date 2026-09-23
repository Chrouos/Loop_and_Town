import { expect, it } from 'vitest';
import { normalizeSave } from '../../src/player/model';
import { claimsFor, judgeLink, knownDiff, pinExcerpt } from '../../src/player/logic';

it('requires a sourced excerpt, limits the table, and rejects an overclaim', () => {
  const save = normalizeSave(null, 0);
  save.loops[1].revealedIds = ['1:letter', '1:old-death'];
  expect(() => pinExcerpt(save, 'station-bulletin-wakaharu:victim')).toThrow(/來源/);
  pinExcerpt(save, 'letter:postmark');
  pinExcerpt(save, 'old-death:death');
  const wrong = judgeLink(save, 'letter:postmark', 'old-death:death', 'sister-alive');
  expect(wrong.save.knowledge.connections).toEqual([]);
  const right = judgeLink(save, 'letter:postmark', 'old-death:death', 'letter-after-death');
  expect(right.save.knowledge.connections).toHaveLength(1);
});

it('does not leak unknown outcomes across loops', () => {
  const save = normalizeSave(null, 0);
  save.loops[1].revealedIds = ['1:station-bulletin-wakaharu'];
  save.loops[2] = { actionIds: [], revealedIds: [], sealed: true };
  expect(knownDiff(save, 1, 2).right).toBe('尚未查到');
  save.loops[2].revealedIds.push('2:station-bulletin-doctor');
  expect(knownDiff(save, 1, 2).candidateInvariant).toContain('18:31');
});

it('offers the no-death inference only for the matching pair', () => {
  expect(claimsFor('station-bulletin-none:outcome', 'station-blackout:time').map(x => x.id)).toContain('clock-without-death');
});
