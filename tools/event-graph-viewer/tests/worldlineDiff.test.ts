import { describe, expect, it } from 'vitest';
import { diffWorldlines } from '../src/lib/worldlineDiff';
import type { WorldlineEntry } from '../src/types/story';

const item = (time: string, eventId: string, variantId?: string): WorldlineEntry => ({
  time,
  eventId,
  variantId,
  title: `${eventId}:${variantId ?? 'none'}`,
  source: 'event',
});

describe('diffWorldlines', () => {
  it('classifies same, changed and missing events', () => {
    const rows = diffWorldlines(
      [item('18:31', 'station', 'wakaharu_dies'), item('20:00', 'left_only')],
      [item('18:31', 'station', 'doctor_dies'), item('21:14', 'right_only')],
    );
    expect(rows.find((row) => row.key.includes('station'))?.status).toBe('changed');
    expect(rows.find((row) => row.key.includes('left_only'))?.status).toBe('left-only');
    expect(rows.find((row) => row.key.includes('right_only'))?.status).toBe('right-only');
  });

  it('marks identical event variants as same', () => {
    const rows = diffWorldlines([item('18:31', 'station', 'same')], [item('18:31', 'station', 'same')]);
    expect(rows[0].status).toBe('same');
  });

  it('aligns player actions and delayed effects alongside story events', () => {
    const rows = diffWorldlines(
      [item('18:20', 'protect_wakaharu'), item('18:31', 'station', 'doctor_dies')],
      [item('18:20', 'stop_doctor'), item('18:31', 'station', 'wakaharu_dies'), item('21:14', 'delayed:reporter_missing')],
    );

    expect(rows.map((row) => row.key)).toEqual([
      '18:20:protect_wakaharu',
      '18:20:stop_doctor',
      '18:31:station',
      '21:14:delayed:reporter_missing',
    ]);
    expect(rows.find((row) => row.key === '18:20:protect_wakaharu')?.status).toBe('left-only');
    expect(rows.find((row) => row.key === '21:14:delayed:reporter_missing')?.status).toBe('right-only');
  });
});
