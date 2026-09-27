import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { normalizeSave } from '../../src/player/model';
import { confirmAction, replayLoop } from '../../src/player/runtime';
import { createSimulation } from '../../src/simulator/simulator';
import type { ActionDefinition, EventDefinition, WorldState } from '../../src/simulator/types';
import initialYaml from '../../../../story/world/day_01_initial.yaml?raw';
import actionsYaml from '../../../../story/actions/day_01_actions.yaml?raw';
import stationYaml from '../../../../story/events/day_01_1831.yaml?raw';
import reporterYaml from '../../../../story/events/day_01_2114.yaml?raw';

const initial = yaml.load(initialYaml) as WorldState;
const definition = {
  actions: (yaml.load(actionsYaml) as { actions: ActionDefinition[] }).actions,
  events: [yaml.load(stationYaml), yaml.load(reporterYaml)] as EventDefinition[],
};

describe('the player adapter shares canonical story rules', () => {
  it.each([
    [[], 'wakaharu_dies', true],
    [['protect_wakaharu'], 'doctor_dies', false],
    [['stop_doctor'], 'wakaharu_dies', true],
    [['protect_wakaharu', 'stop_doctor'], 'no_death', false],
  ])('%j leads to %s', (actions, outcome, missing) => {
    const save = normalizeSave(null, 0);
    save.loops[1].actionIds = actions as typeof save.loops[1]['actionIds'];
    const result = replayLoop(definition, initial, save, 1, 1274);
    expect(result.history.find(x => x.eventId === 'evt_1831_station' && x.kind === 'event')?.variantId).toBe(outcome);
    expect(result.history.some(x => x.eventId === 'evt_2114_reporter_missing' && x.kind === 'event')).toBe(missing);
    expect(result.state.characters).toBeDefined();
  });

  it('refuses retroactive and duplicate choices', () => {
    const save = normalizeSave(null, 0);
    expect(confirmAction(save, 'protect_wakaharu', 19 * 60_000).loops[1].actionIds).toEqual(['protect_wakaharu']);
    expect(() => confirmAction(save, 'protect_wakaharu', 20 * 60_000)).toThrow(/截止/);
    expect(() => confirmAction(save, 'protect_wakaharu', 19 * 60_000)).toThrow(/已經/);
    expect(createSimulation(definition, initial)).toBeDefined();
  });
});
