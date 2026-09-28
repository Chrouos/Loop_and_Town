import { expect, it } from 'vitest';
import yaml from 'js-yaml';
import { MINUTE } from '../../src/player/clock';
import { normalizeSave } from '../../src/player/model';
import { reconcilePlayer } from '../../src/player/knowledge';
import type { ActionDefinition, EventDefinition, WorldState } from '../../src/simulator/types';
import initialYaml from '../../../../story/world/day_01_initial.yaml?raw';
import actionsYaml from '../../../../story/actions/day_01_actions.yaml?raw';
import stationYaml from '../../../../story/events/day_01_1831.yaml?raw';
import reporterYaml from '../../../../story/events/day_01_2114.yaml?raw';

it('persists simulation and real timestamps on internal history entries', () => {
  const initial = { ...(yaml.load(initialYaml) as WorldState), clock: { day: 0, time: '06:12' } };
  const definition = {
    actions: (yaml.load(actionsYaml) as { actions: ActionDefinition[] }).actions,
    events: [yaml.load(stationYaml), yaml.load(reporterYaml)] as EventDefinition[],
  };
  const target = Math.ceil((1111 - 372) / 12 * MINUTE);
  const save = reconcilePlayer(normalizeSave(null, 0), target, definition, initial);
  const entry = save.loops[1].history.find(item => item.eventId === 'evt_1831_station');
  expect(entry).toMatchObject({ simulationMinute: 1111, realTimestampMs: expect.any(Number) });
  expect(entry?.realTimestampMs).toBeGreaterThan(0);
});
