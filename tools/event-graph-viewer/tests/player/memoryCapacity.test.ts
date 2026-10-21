import { describe, expect, it } from 'vitest';
import { normalizeSave, type PersistentMemory } from '../../src/player/model';
import { forgetMemory, MEMORY_CAPACITY, memoryFull, rememberNarrativeExcerpt } from '../../src/player/knowledge';
import { addMemoryToWall } from '../../src/player/logic';
import type { PlayerNarrativeRecord } from '../../src/player/story';

const T0 = new Date(2026, 9, 20, 9, 0, 0, 0).getTime();
const memory = (n: number): PersistentMemory => ({
  id: `memory:1:scene_${n}`, sourceLoop: 1, sourceRecordId: `scene_${n}`, sourceSceneId: `scene_${n}`,
  capturedAtMinute: 600 + n, capturedAtMs: T0 + n, kind: 'text', title: `片段 ${n}`, content: [`第 ${n} 段`],
});
const coffee = {
  id: 'daily_clock_1140_black_coffee', sceneId: 'daily_clock_1140_black_coffee', loopId: 1, title: '予安的黑咖啡',
  body: ['他替我加了糖和奶，自己那杯什麼都沒加。'], excerpts: [{ id: 'plain', text: '自己那杯什麼都沒加' }],
} as unknown as PlayerNarrativeRecord;

describe('how much she can carry across midnight', () => {
  it('refuses a new memory once she is full instead of silently dropping an old one', () => {
    const save = normalizeSave(null, T0);
    save.loops[1].revealedIds.push(`1:${coffee.id}`);
    save.knowledge.memories = Array.from({ length: MEMORY_CAPACITY }, (_, n) => memory(n));
    expect(memoryFull(save)).toBe(true);
    expect(() => rememberNarrativeExcerpt(save, 1, coffee, 'plain', 700, T0)).toThrow();
    expect(save.knowledge.memories).toHaveLength(MEMORY_CAPACITY);
  });

  it('lets a memory go for good, off the wall as well, which makes room for the next one', () => {
    const save = normalizeSave(null, T0);
    save.loops[1].revealedIds.push(`1:${coffee.id}`);
    save.knowledge.memories = Array.from({ length: MEMORY_CAPACITY }, (_, n) => memory(n));
    addMemoryToWall(save, 'memory:1:scene_0');
    forgetMemory(save, 'memory:1:scene_0');
    expect(save.knowledge.memories.map(item => item.id)).not.toContain('memory:1:scene_0');
    expect(save.knowledge.wallRefs).not.toContain('memory:1:scene_0');
    expect(rememberNarrativeExcerpt(save, 1, coffee, 'plain', 700, T0).content).toEqual(['自己那杯什麼都沒加']);
    expect(save.knowledge.memories).toHaveLength(MEMORY_CAPACITY);
  });
});
