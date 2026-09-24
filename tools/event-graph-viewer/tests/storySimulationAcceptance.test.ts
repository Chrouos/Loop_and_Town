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

it.each(['WL-00', 'WL-01', 'WL-02', 'WL-03', 'WL-04', 'WL-05', 'WL-06', 'WL-07'])('%s reaches the bells before the inclusive loop end', (id) => {
  const result = simulateNamedWorldline(loadRealStory(), id);
  const bells = result.fullHistory.find((entry) => entry.kind === 'event' && entry.eventId === 'evt_2359_midnight_bells');
  const loopEnd = result.fullHistory.find((entry) => entry.kind === 'event' && entry.eventId === 'evt_0000_loop_end');

  expect(bells?.variantId).toBe('bells_ring');
  expect(loopEnd?.variantId).toBe('loop_end');
  expect(bells?.absoluteMinute).toBe(1439);
  expect(loopEnd?.absoluteMinute).toBe(1440);
  expect(bells!.sequence).toBeLessThan(loopEnd!.sequence);
});

it('WL-03 player history reveals confrontation and disappearance but not hidden reporter movement', () => {
  const result = simulateNamedWorldline(loadRealStory(), 'WL-03');

  expect(result.playerHistory.some((entry) => entry.kind === 'player-action' && entry.actionId === 'confront_reporter')).toBe(true);
  expect(result.playerHistory.some((entry) => entry.kind === 'event' && entry.eventId === 'evt_2114_reporter_status' && entry.variantId === 'reporter_missing')).toBe(true);
  expect(result.playerHistory.some((entry) => entry.scheduleEntryId === 'reporter_return_hotel')).toBe(false);
  expect(result.playerHistory.some((entry) => entry.scheduleEntryId === 'reporter_enter_old_lab')).toBe(false);
});

it('is deterministic for the same named worldline', () => {
  const story = loadRealStory();
  const first = simulateNamedWorldline(story, 'WL-03');
  const second = simulateNamedWorldline(story, 'WL-03');
  expect(JSON.stringify(first.fullHistory)).toBe(JSON.stringify(second.fullHistory));
  expect(first.state).toEqual(second.state);
});
