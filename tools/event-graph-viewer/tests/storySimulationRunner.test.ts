import { expect, it } from 'vitest';
import { simulateNamedWorldline, simulateStory } from '../src/simulator/storySimulation';
import { loadRealStory } from './helpers/loadRealStory';

it('simulates a named worldline through the real story bundle', () => {
  const story = loadRealStory();
  const result = simulateNamedWorldline(story, 'WL-00');
  expect(result.fullHistory.some((entry) => entry.eventId === 'evt_1831_station')).toBe(true);
  expect(result.playerHistory.every((entry) => entry.visibility === 'observable')).toBe(true);
});

it('rejects an unknown named worldline', () => {
  expect(() => simulateNamedWorldline(loadRealStory(), 'WL-99')).toThrow('Unknown worldline: WL-99');
});

it('can stop a custom simulation before the loop end', () => {
  const result = simulateStory({
    story: loadRealStory(),
    actionIds: [],
    until: { day: 0, time: '18:31' },
  });
  expect(result.fullHistory.at(-1)?.absoluteMinute).toBeLessThanOrEqual(1111);
  expect((result.state.clock as Record<string, unknown>).time).toBe('18:31');
});
