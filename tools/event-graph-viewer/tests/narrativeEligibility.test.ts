import { expect, it } from 'vitest';
import type { ActivityRun } from '../src/narrative/activity';
import { projectNarrative } from '../src/narrative/projection';
import type { NarrativeFoundation } from '../src/narrative/types';
import type { WorldlineHistoryEntry } from '../src/simulator/types';

const baseStory: NarrativeFoundation = {
  characters: [],
  relationships: [],
  knowledgeFacts: [],
  activities: [],
  protagonistSchedule: { characterId: 'protagonist', entries: [] },
  artifacts: [],
  scenes: [],
};

const context = {
  protagonistLocation: 'old_house',
  online: true,
  channels: ['present', 'phone', 'artifact'] as const,
  minute: 1111,
};

it('gates scenes by player fact and location', () => {
  const story: NarrativeFoundation = {
    ...baseStory,
    scenes: [{
      id: 'home_fact',
      at: '15:00',
      kind: 'narration',
      participants: [],
      blocks: [{ type: 'narration', text: 'home' }],
      requiresFacts: ['fact_x'],
      requiresLocation: 'old_house',
    }],
  };

  expect(projectNarrative({ story, fullHistory: [], context }).map((beat) => beat.sourceId)).toEqual([]);
  expect(projectNarrative({ story, fullHistory: [], context, knownFactIds: ['fact_x'] }).map((beat) => beat.sourceId)).toEqual(['home_fact']);
});

it('selects only the authored simulator event variant', () => {
  const story: NarrativeFoundation = {
    ...baseStory,
    scenes: [
      {
        id: 'wakaharu_result', at: '18:31', kind: 'narration', participants: [],
        blocks: [{ type: 'narration', text: 'w' }],
        sourceEvent: { eventId: 'evt_1831_station', variantId: 'wakaharu_dies' },
      },
      {
        id: 'doctor_result', at: '18:31', kind: 'narration', participants: [],
        blocks: [{ type: 'narration', text: 'd' }],
        sourceEvent: { eventId: 'evt_1831_station', variantId: 'doctor_dies' },
      },
    ],
  };
  const history: WorldlineHistoryEntry[] = [{
    sequence: 1, day: 0, time: '18:31', minute: 1111, absoluteMinute: 1111,
    kind: 'event', visibility: 'observable', eventId: 'evt_1831_station', variantId: 'doctor_dies',
    title: '18:31 車站異常',
  }];

  expect(projectNarrative({ story, fullHistory: history, context }).map((beat) => beat.sourceId)).toEqual(['doctor_result']);
});

it('defers ordinary prose while its activity is still running', () => {
  const story: NarrativeFoundation = {
    ...baseStory,
    scenes: [{
      id: 'after_idle', at: '14:20', kind: 'narration', participants: [],
      blocks: [{ type: 'narration', text: 'done' }], deferWhileActivity: true,
    }],
  };
  const running: ActivityRun = {
    activityId: 'buy_coffee', startedAt: 860, durationMinutes: 8,
    consumedMinutes: 4, remainingMinutes: 4, interruptible: true, status: 'running',
  };
  const complete: ActivityRun = { ...running, consumedMinutes: 8, remainingMinutes: 0, status: 'complete' };

  expect(projectNarrative({ story, fullHistory: [], context, activeActivity: running })).toEqual([]);
  expect(projectNarrative({ story, fullHistory: [], context, activeActivity: complete }).map((beat) => beat.sourceId)).toEqual(['after_idle']);
});
