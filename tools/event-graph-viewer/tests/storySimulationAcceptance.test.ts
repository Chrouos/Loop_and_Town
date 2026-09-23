import { expect, it } from 'vitest';
import { simulateNamedWorldline } from '../src/simulator/storySimulation';
import { loadRealStory } from './helpers/loadRealStory';

it.each([
  ['WL-00', 'wakaharu_dies', false, false],
  ['WL-01', 'wakaharu_dies', true, false],
  ['WL-03', 'wakaharu_dies', false, true],
  ['WL-04', 'doctor_dies', false, false],
  ['WL-05', 'wakaharu_dies', false, false],
  ['WL-06', 'no_death', false, false],
  ['WL-07', 'doctor_dies', false, true],
] as const)('%s resolves the approved causal outcome', (id, stationVariant, postal, reporterMissing) => {
  const result = simulateNamedWorldline(loadRealStory(), id);
  const station = result.fullHistory.find((entry) => entry.kind === 'event' && entry.eventId === 'evt_1831_station');
  expect(station?.variantId).toBe(stationVariant);
  expect(Boolean((result.state.flags as Record<string, unknown>).postal_record_anomaly_found)).toBe(postal);
  expect(((result.state.characters as Record<string, any>).reporter).status === 'missing').toBe(reporterMissing);
});

it('WL-02 reveals Wakaharu warning without changing the station victim', () => {
  const result = simulateNamedWorldline(loadRealStory(), 'WL-02');
  const warning = result.fullHistory.find((entry) =>
    entry.kind === 'event' && entry.eventId === 'evt_1818_wakaharu_last_conversation');
  const station = result.fullHistory.find((entry) => entry.kind === 'event' && entry.eventId === 'evt_1831_station');
  expect(warning?.variantId).toBe('warning_revealed');
  expect(station?.variantId).toBe('wakaharu_dies');
});

it('keeps reporter disappearance causally independent from the 18:31 victim', () => {
  const result = simulateNamedWorldline(loadRealStory(), 'WL-07');
  expect(result.fullHistory.find((entry) => entry.eventId === 'evt_1831_station')?.variantId).toBe('doctor_dies');
  expect(result.fullHistory.find((entry) => entry.eventId === 'evt_2114_reporter_status')?.variantId).toBe('reporter_missing');
});

it('is deterministic for the same named worldline', () => {
  const story = loadRealStory();
  const first = simulateNamedWorldline(story, 'WL-03');
  const second = simulateNamedWorldline(story, 'WL-03');
  expect(JSON.stringify(first.fullHistory)).toBe(JSON.stringify(second.fullHistory));
  expect(first.state).toEqual(second.state);
});
