import { describe, expect, it } from 'vitest';
import { simulateNamedWorldline } from '../src/simulator/storySimulation';
import { loadRealStory } from './helpers/loadRealStory';

function eventVariant(result: ReturnType<typeof simulateNamedWorldline>, eventId: string) {
  return result.fullHistory.find((entry) => entry.kind === 'event' && entry.eventId === eventId);
}

describe('Chapter 2 Wakaharu rescue worldline', () => {
  it('keeps Wakaharu alive while Doctor dies and lets her continue her own life', () => {
    const result = simulateNamedWorldline(loadRealStory(), 'WL-04');
    const station = eventVariant(result, 'evt_1831_station');
    const life = eventVariant(result, 'evt_2030_wakaharu_life');
    const resignation = result.fullHistory.find((entry) => entry.scheduleEntryId === 'wakaharu_submit_resignation');

    expect(station?.variantId).toBe('doctor_dies');
    expect((result.state.characters as Record<string, { status: string }>).wakaharu.status).toBe('alive');
    expect((result.state.characters as Record<string, { status: string }>).doctor.status).toBe('dead');
    expect(resignation).toEqual(expect.objectContaining({ scheduleStatus: 'applied' }));
    expect((result.state.characters as Record<string, { life_status: string }>).wakaharu.life_status)
      .toBe('resignation_submitted');
    expect(life?.variantId).toBe('wakaharu_life_continues');
    expect((life?.sequence ?? 0)).toBeGreaterThan(resignation?.sequence ?? 0);
  });

  it('does not expose the Chapter 2 life continuation when the Doctor is not the 18:31 victim', () => {
    const story = loadRealStory();
    const doctorStopped = simulateNamedWorldline(story, 'WL-05');
    const bothProtected = simulateNamedWorldline(story, 'WL-06');

    expect(eventVariant(doctorStopped, 'evt_2030_wakaharu_life')?.variantId).not.toBe('wakaharu_life_continues');
    expect(eventVariant(bothProtected, 'evt_2030_wakaharu_life')?.variantId).not.toBe('wakaharu_life_continues');
  });
});
