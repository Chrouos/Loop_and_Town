import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { normalizeSave } from '../../src/player/model';
import { confirmAction, replayLoop, activeLoop, createNextLoop } from '../../src/player/runtime';
import { LOOP_START_MINUTE, MINUTE } from '../../src/player/clock';
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
  it('uses currentLoopId instead of elapsed wall-clock days', () => {
    const save = normalizeSave(null, 0);
    save.lastConfirmedMs = 3 * 86_400_000;
    expect(activeLoop(save)).toBe(save.loops[1]);
  });

  it('creates exactly one explicitly chosen next loop and locks its mode', () => {
    const save = normalizeSave(null, 0);
    save.knowledge.characterInsights = [{ id: 'wakaharu-alive', characterId: 'wakaharu', sourceLoop: 1, text: '若春仍活著。' }];
    save.knowledge.discoveredEvidence = ['doctor-route'];
    save.loops[1].actionIds = ['protect_wakaharu'];
    save.loops[1].revealedIds = ['1:old-record'];
    save.loops[1].seenSceneIds = ['loop01_scene'];
    save.loops[1].clock.pendingCriticalBoundary = 'reset';
    const anchorBefore = save.loops[1].clock.anchor;
    const next = createNextLoop(save, 'ACCELERATED', 10_000);
    expect(next.currentLoopId).toBe(2);
    expect(next.loops[1].sealed).toBe(true);
    expect(next.loops[2].clock.mode).toBe('ACCELERATED');
    expect(next.loops[1].clock.anchor).toEqual(anchorBefore);
    expect(next.knowledge.characterInsights).toEqual([{ id: 'wakaharu-alive', characterId: 'wakaharu', sourceLoop: 1, text: '若春仍活著。' }]);
    expect(next.knowledge.discoveredEvidence).toEqual(['doctor-route']);
    expect(next.loops[2].actionIds).toEqual([]);
    expect(next.loops[2].revealedIds).toEqual([]);
    expect(next.loops[2].seenSceneIds).toEqual([]);
    expect(next.loops[2].clock.pendingCriticalBoundary).toBeUndefined();
    expect(next.loops[2].sealed).toBe(false);
  });

  it('keeps the first loop anchored at 06:12 while real time advances', () => {
    const save = normalizeSave(null, 0);
    expect(activeLoop(save).clock.entryMinute).toBe(LOOP_START_MINUTE);
  });

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
    expect(confirmAction(save, 'protect_wakaharu', 60 * MINUTE).loops[1].actionIds).toEqual(['protect_wakaharu']);
    expect(() => confirmAction(save, 'protect_wakaharu', 61 * MINUTE)).toThrow(/截止/);
    expect(() => confirmAction(save, 'protect_wakaharu', 60 * MINUTE)).toThrow(/已經/);
    expect(createSimulation(definition, initial)).toBeDefined();
  });
});
