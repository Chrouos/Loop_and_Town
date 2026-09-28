import { expect, it } from 'vitest';
import { normalizeSave } from '../../src/player/model';
import { importLegacy, exportSave, readSave, SAVE_KEY, PREVIOUS_SAVE_KEY } from '../../src/player/storage';
import { LOOP_START_MINUTE } from '../../src/player/clock';

it('creates a fresh v2 save with Loop 1 accelerated at 06:12', () => {
  const save = normalizeSave(null, 1_000);
  expect(save.version).toBe(2);
  expect(save.currentLoopId).toBe(1);
  expect(save.loops[1].clock.mode).toBe('ACCELERATED');
  expect(save.loops[1].clock.entryMinute).toBe(LOOP_START_MINUTE);
});

it('migrates a v1 save without manufacturing intermediate loops', () => {
  const save = normalizeSave({
    version: 1,
    anchorMs: 0,
    lastConfirmedMs: 4 * 60 * 60_000,
    loops: { 1: { actionIds: ['protect_wakaharu'], revealedIds: ['1:letter'], sealed: false } },
    knowledge: { opened: ['letter'], pins: [], positions: {}, connections: [], notes: [] },
  }, 1_000);
  expect(save.version).toBe(2);
  expect(save.currentLoopId).toBe(1);
  expect(Object.keys(save.loops)).toEqual(['1']);
  expect(save.loops[1].actionIds).toEqual(['protect_wakaharu']);
  expect(save.loops[1].clock.anchor.scale).toBe(1);
  expect(save.loops[1].clock.anchor.simulationStartedMinute).toBe(1320);
});

it('reads v2 before v1 storage and normalizes malformed v2 clock state', () => {
  const storage = new Map<string, string>([
    [PREVIOUS_SAVE_KEY, JSON.stringify({ version: 1, anchorMs: 0, lastConfirmedMs: 0, loops: {} })],
    [SAVE_KEY, JSON.stringify({ version: 2, currentLoopId: 1, loops: { 1: { actionIds: [], revealedIds: [], sealed: false, clock: { mode: 'invalid' } } } })],
  ]);
  const save = readSave({ getItem: key => storage.get(key) ?? null }, 2_000);
  expect(save.version).toBe(2);
  expect(save.loops[1].clock.mode).toBe('ACCELERATED');
  expect(save.loops[1].clock.anchor.realStartedAtMs).toBe(2_000);
});

it('defaults missing player memory fields and rejects malformed entries', () => {
  const save = normalizeSave({
    version: 2,
    currentLoopId: 1,
    loops: { 1: { actionIds: [], revealedIds: [], sealed: false } },
    knowledge: {
      characterInsights: [
        { id: 'insight-1', characterId: 'wakaharu', sourceLoop: 1, text: '他獨自活著。' },
        { id: 42, characterId: 'doctor', sourceLoop: 1, text: '不應被接受' },
        { id: 'missing-text', characterId: 'doctor', sourceLoop: 1 },
      ],
      discoveredEvidence: ['evidence-letter', 42, null],
    },
  }, 1_000);

  expect(save.loops[1].seenSceneIds).toEqual([]);
  expect(save.knowledge.characterInsights).toEqual([
    { id: 'insight-1', characterId: 'wakaharu', sourceLoop: 1, text: '他獨自活著。' },
  ]);
  expect(save.knowledge.discoveredEvidence).toEqual(['evidence-letter']);
});

it('caps player memory collections at 250 entries', () => {
  const save = normalizeSave({
    version: 2,
    currentLoopId: 1,
    loops: { 1: { actionIds: [], revealedIds: [], sealed: false } },
    knowledge: {
      characterInsights: Array.from({ length: 251 }, (_, index) => ({
        id: `insight-${index}`,
        characterId: 'wakaharu',
        sourceLoop: 1,
        text: '記憶',
      })),
      discoveredEvidence: Array.from({ length: 251 }, (_, index) => `evidence-${index}`),
    },
  }, 1_000);

  expect(save.knowledge.characterInsights).toHaveLength(250);
  expect(save.knowledge.discoveredEvidence).toHaveLength(250);
});

it('imports only known legacy knowledge, never old world results as actions', () => {
  const fresh = normalizeSave(null, 0);
  const imported = importLegacy(JSON.stringify({ memory: { letter: 2, sister: 2, death: 3 }, pins: ['letter:postmark', 'sister:death'], lines: ['letter|sister'], world: { dead: true }, tasks: [{ type: 'hold' }] }), fresh);
  expect(imported.loops[1].actionIds).toEqual([]);
  expect(imported.knowledge.notes.some(x => x.source === 'legacy')).toBe(true);
  expect(imported.knowledge.pins).toEqual(['letter:postmark', 'old-death:death']);
  expect(imported.knowledge.connections).toContain('letter:postmark|old-death:death#letter-after-death');
  expect(importLegacy('{broken', fresh).version).toBe(2);
  expect(importLegacy(exportSave(imported), fresh).loops[1].actionIds).toEqual([]);
});
