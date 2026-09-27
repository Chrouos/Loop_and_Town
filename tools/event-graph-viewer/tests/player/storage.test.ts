import { expect, it } from 'vitest';
import { normalizeSave } from '../../src/player/model';
import { importLegacy, exportSave } from '../../src/player/storage';

it('imports only known legacy knowledge, never old world results as actions', () => {
  const fresh = normalizeSave(null, 0);
  const imported = importLegacy(JSON.stringify({ memory: { letter: 2, sister: 2, death: 3 }, pins: ['letter:postmark', 'sister:death'], lines: ['letter|sister'], world: { dead: true }, tasks: [{ type: 'hold' }] }), fresh);
  expect(imported.loops[1].actionIds).toEqual([]);
  expect(imported.knowledge.notes.some(x => x.source === 'legacy')).toBe(true);
  expect(imported.knowledge.pins).toEqual(['letter:postmark', 'old-death:death']);
  expect(imported.knowledge.connections).toContain('letter:postmark|old-death:death#letter-after-death');
  expect(importLegacy('{broken', fresh).version).toBe(1);
  expect(importLegacy(exportSave(imported), fresh).loops[1].actionIds).toEqual([]);
});
