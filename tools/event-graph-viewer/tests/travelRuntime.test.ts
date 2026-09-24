import { describe, expect, it } from 'vitest';
import { planTravel } from '../src/playerNarrative/travel';

const edges = [{ from: 'old_house', to: 'old_station', minutes: 22 }];

describe('travel runtime', () => {
  it('allows arrival after 18:31', () => {
    expect(planTravel(edges, 'old_house', 'old_station', 1092)).toEqual({
      from: 'old_house', to: 'old_station', departMinute: 1092, arriveMinute: 1114, durationMinutes: 22,
    });
  });
});
