import { describe, expect, it } from 'vitest';
import { projectAmbientBeats } from '../src/playerNarrative/ambient';
import type { ActivityDefinition } from '../src/narrative/types';
import type { ActivityRun } from '../src/narrative/activity';

const definition: ActivityDefinition = {
  id: 'read', durationMinutes: 20, interruptible: true,
  presentation: { start: 'start', idle: 'idle', complete: 'done' },
  ambient: [
    { id: 'a', atMinute: 5, text: 'A' },
    { id: 'b', atMinute: 11, text: 'B' },
    { id: 'c', atMinute: 17, text: 'C', requiresFacts: ['letter'] },
  ],
};

function run(consumedMinutes: number): ActivityRun {
  return {
    activityId: 'read', startedAt: 900, durationMinutes: 20,
    consumedMinutes, remainingMinutes: 20 - consumedMinutes,
    interruptible: true, status: consumedMinutes >= 20 ? 'complete' : 'running',
  };
}

describe('ambient prose', () => {
  it('returns only due beats in order', () => {
    expect(projectAmbientBeats(run(12), definition, []).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('applies fact requirements', () => {
    expect(projectAmbientBeats(run(18), definition, []).map((x) => x.id)).toEqual(['a', 'b']);
    expect(projectAmbientBeats(run(18), definition, ['letter']).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});
