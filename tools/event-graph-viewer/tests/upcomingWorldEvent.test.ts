import { describe, expect, it } from 'vitest';
import { projectUpcomingWorldEvent } from '../src/playerNarrative/upcomingEvent';

describe('upcoming world event projection', () => {
  it('returns the next observable event and remaining story minutes', () => {
    const next = projectUpcomingWorldEvent([
      { id: 'past', title: '已經發生', at: { day: 0, time: '12:00' }, visibility: 'observable', variants: [] },
      { id: 'hidden', title: '不該顯示', at: { day: 0, time: '13:30' }, visibility: 'hidden', variants: [] },
      { id: 'next', title: '回到老家', at: { day: 0, time: '15:00' }, visibility: 'observable', variants: [] },
    ], 13 * 60 + 13);

    expect(next).toEqual({ title: '回到老家', minute: 15 * 60, remainingMinutes: 107 });
  });

  it('returns null when no observable event remains', () => {
    expect(projectUpcomingWorldEvent([], 13 * 60)).toBeNull();
  });
});
