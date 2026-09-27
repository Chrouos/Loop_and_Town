import { expect, it } from 'vitest';
import yaml from 'js-yaml';
import { normalizeSave } from '../../src/player/model';
import { reconcilePlayer, visibleRecords } from '../../src/player/knowledge';
import type { ActionDefinition, EventDefinition, WorldState } from '../../src/simulator/types';
import initialYaml from '../../../../story/world/day_01_initial.yaml?raw';
import actionsYaml from '../../../../story/actions/day_01_actions.yaml?raw';
import stationYaml from '../../../../story/events/day_01_1831.yaml?raw';
import reporterYaml from '../../../../story/events/day_01_2114.yaml?raw';
const initial = yaml.load(initialYaml) as WorldState;
const definition = { actions: (yaml.load(actionsYaml) as { actions: ActionDefinition[] }).actions, events: [yaml.load(stationYaml), yaml.load(reporterYaml)] as EventDefinition[] };

it('never shows the outcome before a sourced bulletin arrives', () => {
  let save = reconcilePlayer(normalizeSave(null, 0), 30 * 60_000, definition, initial);
  expect(visibleRecords(save, 1).some(x => x.id.includes('bulletin'))).toBe(false);
  save = reconcilePlayer(save, 31 * 60_000, definition, initial);
  expect(visibleRecords(save, 1).map(x => x.id)).toContain('station-blackout');
  expect(visibleRecords(save, 1).some(x => x.id.includes('bulletin'))).toBe(false);
  save = reconcilePlayer(save, 40 * 60_000, definition, initial);
  expect(visibleRecords(save, 1).map(x => x.id)).toContain('station-bulletin-wakaharu');
  expect(visibleRecords(save, 1).some(x => x.id.includes('reporter'))).toBe(false);
});

it('reconciles the delayed event and seals an absent loop once', () => {
  let save = reconcilePlayer(normalizeSave(null, 0), 4 * 60 * 60_000, definition, initial);
  expect(visibleRecords(save, 1).map(x => x.id)).toContain('reporter-message');
  save = reconcilePlayer(save, 2 * 86_400_000, definition, initial);
  const before = [...save.loops[1].revealedIds];
  expect(save.loops[1].sealed).toBe(true);
  expect(reconcilePlayer(save, 2 * 86_400_000, definition, initial).loops[1].revealedIds).toEqual(before);
  expect(visibleRecords(save, 2).some(x => x.id.includes('bulletin'))).toBe(true);
});
