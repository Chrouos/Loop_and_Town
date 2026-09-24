import { describe, expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';

describe('player narrative authored data', () => {
  it('loads ordered ambient beats', () => {
    const reading = loadRealStory().narrative.activities.find((item) => item.id === 'rest_and_read');
    expect(reading?.ambient?.map((beat) => beat.atMinute)).toEqual([5, 11, 17]);
  });

  it('loads player choices without author impact metadata', () => {
    const choice = loadRealStory().playerChoices.find((item) => item.id === 'arrival_coffee');
    expect(choice?.label).toBe('先去買杯咖啡');
    expect(choice).not.toHaveProperty('impactType');
  });

  it('loads old-house to station travel as 22 minutes', () => {
    expect(loadRealStory().travelEdges).toContainEqual({ from: 'old_house', to: 'old_station', minutes: 22 });
  });
});
