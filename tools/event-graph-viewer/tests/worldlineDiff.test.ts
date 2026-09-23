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
});
