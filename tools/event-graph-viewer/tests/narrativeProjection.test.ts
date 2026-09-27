import { expect, it } from 'vitest';
import type { WorldlineHistoryEntry } from '../src/simulator/types';
import { projectNarrative } from '../src/narrative/projection';
import type { NarrativeFoundation } from '../src/narrative/types';
import type { ActivityRun } from '../src/narrative/activity';

const story: NarrativeFoundation = {
  characters: [],
  relationships: [],
  knowledgeFacts: [],
  activities: [],
  protagonistSchedule: { characterId: 'protagonist', entries: [] },
  artifacts: [],
  scenes: [
    {
      id: 'scene_a',
      at: { day: 0, time: '15:00' },
      kind: 'narration',
      participants: [],
      blocks: [{ type: 'narration', text: 'A' }],
    },
    {
      id: 'scene_b',
      at: { day: 0, time: '15:00' },
      kind: 'narration',
      participants: [],
      blocks: [{ type: 'narration', text: 'B' }],
    },
  ],
};

const context = {
  protagonistLocation: 'old_house',
  online: true,
  channels: ['present', 'phone', 'artifact'] as const,
  minute: 900,
};

it('returns the same narrative queue for identical input', () => {
  const input = { story, fullHistory: [], context, consumedSceneIds: [] };
  expect(projectNarrative(input)).toEqual(projectNarrative(input));
});

it('preserves authored order for scenes at the same minute', () => {
  const beats = projectNarrative({ story, fullHistory: [], context, consumedSceneIds: [] });
  expect(beats.map((beat) => beat.sourceId)).toEqual(['scene_a', 'scene_b']);
});

it('does not enqueue hidden world movement as narrative', () => {
  const hidden: WorldlineHistoryEntry = {
    sequence: 1,
    day: 0,
    time: '15:00',
    minute: 900,
    absoluteMinute: 900,
    kind: 'schedule',
    visibility: 'hidden',
    title: 'reporter_enter_old_lab',
    sourceId: 'reporter_enter_old_lab',
  };
  const beats = projectNarrative({ story, fullHistory: [hidden], context, consumedSceneIds: [] });
  expect(beats.some((beat) => beat.sourceId === 'reporter_enter_old_lab')).toBe(false);
});

it('places active activity after eligible scenes', () => {
  const activity: ActivityRun = {
    activityId: 'rest_and_read',
    startedAt: 890,
    durationMinutes: 20,
    consumedMinutes: 10,
    remainingMinutes: 10,
    interruptible: true,
    status: 'running',
  };
  const beats = projectNarrative({ story, fullHistory: [], context, activeActivity: activity, consumedSceneIds: [] });
  expect(beats.map((beat) => beat.kind)).toEqual(['scene', 'scene', 'activity']);
});

it('does not replay consumed scenes', () => {
  const beats = projectNarrative({ story, fullHistory: [], context, consumedSceneIds: ['scene_a'] });
  expect(beats.map((beat) => beat.sourceId)).toEqual(['scene_b']);
});
