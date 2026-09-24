import yaml from 'js-yaml';
import { expect, it, vi } from 'vitest';
import stationText from '../../../story/events/loop_01_1831.yaml?raw';
import reporterText from '../../../story/events/loop_01_2114.yaml?raw';
import yuanText from '../../../story/events/loop_01_1810.yaml?raw';
import warningText from '../../../story/events/loop_01_1818.yaml?raw';
import bellsText from '../../../story/events/loop_01_2359.yaml?raw';
import endText from '../../../story/events/loop_01_end.yaml?raw';
import { resolveEvent } from '../src/simulator/eventResolver';
import type { EventDefinition, WorldState } from '../src/simulator/types';

const parse = (text: string) => yaml.load(text) as EventDefinition;
function context(state: WorldState, minute = 1111) {
  return { state, queue: { enqueue: vi.fn() }, events: new Map(), currentMinute: minute };
}

it('18:31 chooses Wakaharu first when she is at the station', () => {
  const event = parse(stationText);
  const state = {
    characters: {
      wakaharu: { location: 'old_station', status: 'alive' },
      doctor: { location: 'old_station', status: 'alive' },
    },
    world: { anomaly_1831_observed: false },
  };
  expect(resolveEvent(context(state), event).variantId).toBe('wakaharu_dies');
  expect(state.characters.wakaharu.status).toBe('dead');
});

it('18:31 chooses doctor only when Wakaharu is absent and falls back to no_death when both are absent', () => {
  const event = parse(stationText);
  const doctorState = {
    characters: {
      wakaharu: { location: 'home', status: 'alive' },
      doctor: { location: 'old_station', status: 'alive' },
    },
    world: { anomaly_1831_observed: false },
  };
  expect(resolveEvent(context(doctorState), event).variantId).toBe('doctor_dies');

  const safeState = {
    characters: {
      wakaharu: { location: 'home', status: 'alive' },
      doctor: { location: 'hospital', status: 'alive' },
    },
    world: { anomaly_1831_observed: false },
  };
  expect(resolveEvent(context(safeState), event).variantId).toBe('no_death');
  expect(safeState.world.anomaly_1831_observed).toBe(true);
});

it('18:31 no longer schedules reporter disappearance', () => {
  const event = parse(stationText);
  expect(event.variants.find((variant) => variant.id === 'wakaharu_dies')?.delayed_effects ?? []).toEqual([]);
  expect(JSON.stringify(event)).not.toContain('evt_2114');
});

it('21:14 requires both reporter confrontation and old-lab presence', () => {
  const event = parse(reporterText);
  const missing = {
    flags: { reporter_confronted: true },
    characters: { reporter: { location: 'old_lab', status: 'available' } },
  };
  expect(resolveEvent(context(missing, 1274), event).variantId).toBe('reporter_missing');
  expect(missing.characters.reporter.status).toBe('missing');

  const safe = {
    flags: { reporter_confronted: false },
    characters: { reporter: { location: 'old_lab', status: 'available' } },
  };
  expect(resolveEvent(context(safe, 1274), event).variantId).toBe('no_visible_event');
});

it('18:10 derives Yuan information from his physical location', () => {
  const event = parse(yuanText);
  const state = {
    characters: { yuan: { location: 'station_area' } },
    flags: { yuan_saw_reporter_at_station: false },
  };
  expect(resolveEvent(context(state, 1090), event).variantId).toBe('saw_reporter');
  expect(state.flags.yuan_saw_reporter_at_station).toBe(true);
});

it('18:18 reveals the warning only if Wakaharu saw the letter', () => {
  const event = parse(warningText);
  const state = { flags: { wakaharu_saw_letter: true, wakaharu_warning_revealed: false } };
  expect(resolveEvent(context(state, 1098), event).variantId).toBe('warning_revealed');
});

it('23:59 bells and Day 1 00:00 loop end are authored invariants', () => {
  expect(parse(bellsText).variants[0]).toEqual(expect.objectContaining({ fallback: true }));
  expect(parse(endText).at).toEqual({ day: 1, time: '00:00' });
  expect(parse(endText).variants[0]).toEqual(expect.objectContaining({ fallback: true }));
});
