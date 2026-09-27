import yaml from 'js-yaml';
import { expect, it } from 'vitest';
import doctorText from '../../../story/schedules/doctor.yaml?raw';
import reporterText from '../../../story/schedules/reporter.yaml?raw';
import yuanText from '../../../story/schedules/yuan.yaml?raw';
import wakaharuText from '../../../story/schedules/wakaharu.yaml?raw';
import worldText from '../../../story/world/loop_01_initial.yaml?raw';
import { resolveScheduleEntry } from '../src/simulator/schedule';
import type { ScheduleEntryDefinition, WorldState } from '../src/simulator/types';

function document(text: string) {
  return yaml.load(text) as { character_id: string; entries: ScheduleEntryDefinition[] };
}

function resolve(state: WorldState, entry: ScheduleEntryDefinition) {
  return resolveScheduleEntry({
    state,
    queue: { enqueue: () => { throw new Error('not used'); } },
    events: new Map(),
    currentMinute: 0,
  }, entry);
}

it('doctor leave entry applies only on the old-station route', () => {
  const entry = document(doctorText).entries.find((item) => item.id === 'doctor_leave_hospital')!;
  const going = { characters: { doctor: { route: 'old_station', location: 'hospital' } } };
  expect(resolve(going, entry).status).toBe('applied');
  expect(going.characters.doctor.location).toBe('road_to_old_station');

  const staying = { characters: { doctor: { route: 'stay_hospital', location: 'hospital' } } };
  expect(resolve(staying, entry).status).toBe('skipped');
  expect(staying.characters.doctor.location).toBe('hospital');
});

it('reporter enters the old lab only after her route changes', () => {
  const entry = document(reporterText).entries.find((item) => item.id === 'reporter_enter_old_lab')!;
  const normal = { characters: { reporter: { route: 'normal', location: 'hotel' } } };
  expect(resolve(normal, entry).status).toBe('skipped');
  expect(normal.characters.reporter.location).toBe('hotel');

  const diverted = { characters: { reporter: { route: 'hotel_then_old_lab', location: 'hotel' } } };
  expect(resolve(diverted, entry).status).toBe('applied');
  expect(diverted.characters.reporter.location).toBe('old_lab');
});

it('yuan station and post-office entries are mutually exclusive', () => {
  const entries = document(yuanText).entries;
  const station = entries.find((item) => item.id === 'yuan_station_area_1810')!;
  const postOffice = entries.find((item) => item.id === 'yuan_post_office_1810')!;

  const baseline = { characters: { yuan: { assignment: 'normal', location: 'town' } } };
  expect(resolve(baseline, station).status).toBe('applied');
  expect(resolve(baseline, postOffice).status).toBe('skipped');
  expect(baseline.characters.yuan.location).toBe('station_area');

  const postal = { characters: { yuan: { assignment: 'post_office', location: 'town' } } };
  expect(resolve(postal, station).status).toBe('skipped');
  expect(resolve(postal, postOffice).status).toBe('applied');
  expect(postal.characters.yuan.location).toBe('post_office');
});

it('wakaharu station movement skips when the player changes her route home', () => {
  const entry = document(wakaharuText).entries.find((item) => item.id === 'wakaharu_arrive_station')!;
  const state = { characters: { wakaharu: { route: 'home', location: 'cafe' } } };
  expect(resolve(state, entry).status).toBe('skipped');
  expect(state.characters.wakaharu.location).toBe('cafe');
});

it('defines the baseline routes needed by the first loop', () => {
  const state = yaml.load(worldText) as any;
  expect(state.clock).toEqual({ day: 0, time: '14:20' });
  expect(state.characters.wakaharu.route).toBe('old_station');
  expect(state.characters.doctor.route).toBe('old_station');
  expect(state.characters.reporter.route).toBe('normal');
  expect(state.characters.yuan.assignment).toBe('normal');
});
