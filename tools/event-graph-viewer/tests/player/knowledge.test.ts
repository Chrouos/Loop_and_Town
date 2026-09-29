import { expect, it } from 'vitest';
import yaml from 'js-yaml';
import { normalizeSave } from '../../src/player/model';
import { attendPresenceRecord, reconcilePlayer, visibleRecords } from '../../src/player/knowledge';
import { MINUTE } from '../../src/player/clock';
import { createNextLoop } from '../../src/player/runtime';
import type { ActionDefinition, EventDefinition, WorldState } from '../../src/simulator/types';
import initialYaml from '../../../../story/world/day_01_initial.yaml?raw';
import actionsYaml from '../../../../story/actions/day_01_actions.yaml?raw';
import stationYaml from '../../../../story/events/day_01_1831.yaml?raw';
import reporterYaml from '../../../../story/events/day_01_2114.yaml?raw';
const initial = { ...(yaml.load(initialYaml) as WorldState), clock: { day: 0, time: '06:12' } };
const definition = { actions: (yaml.load(actionsYaml) as { actions: ActionDefinition[] }).actions, events: [yaml.load(stationYaml), yaml.load(reporterYaml)] as EventDefinition[] };
const local = (hour: number, minute = 0) => new Date(2026, 8, 28, hour, minute, 0, 0).getTime();

it('does not turn a presence-only world event into player knowledge before perception', () => {
  const convergence = Math.ceil((1111 - 372) / 12 * MINUTE);
  const bulletin = Math.ceil((1120 - 372) / 12 * MINUTE);
  let save = reconcilePlayer(normalizeSave(null, 0), 30 * MINUTE, definition, initial);
  expect(visibleRecords(save, 1).some(x => x.id.includes('bulletin'))).toBe(false);

  save = reconcilePlayer(save, convergence, definition, initial);
  expect(save.loops[1].revealedIds).toContain('1:station-blackout');
  expect(visibleRecords(save, 1).map(x => x.id)).not.toContain('station-blackout');
  expect(attendPresenceRecord(save, 1, 'station-blackout', 1111)).toBe(true);
  expect(visibleRecords(save, 1).map(x => x.id)).not.toContain('station-blackout');
  expect(save.loops[1].perceivedSceneIds).not.toContain('station-blackout');
  expect((save.loops[1] as unknown as { attention?: { phase?: string; targetId?: string } }).attention).toMatchObject({
    phase: 'shifting',
    targetId: 'station-blackout',
  });
  expect(visibleRecords(save, 1).some(x => x.id.includes('bulletin'))).toBe(false);

  save.loops[1].clock.pendingCriticalBoundary = undefined;
  save.loops[1].clock.lastProcessedMinute = 1111;
  save = reconcilePlayer(save, bulletin, definition, initial);
  expect(visibleRecords(save, 1).map(x => x.id)).toContain('station-bulletin-wakaharu');
  expect(visibleRecords(save, 1).some(x => x.id.includes('reporter'))).toBe(false);
});

it('attending a presence opportunity starts attention without changing world clock state', () => {
  const convergence = Math.ceil((1111 - 372) / 12 * MINUTE);
  const save = reconcilePlayer(normalizeSave(null, 0), convergence, definition, initial);
  const before = structuredClone(save.loops[1].clock);
  expect(attendPresenceRecord(save, 1, 'station-blackout', 1111)).toBe(true);
  expect(save.loops[1].clock).toEqual(before);
  expect(save.loops[1].perceivedSceneIds).not.toContain('station-blackout');
});

it('stops offline reconciliation at the first critical boundary without creating a later loop', () => {
  const save = reconcilePlayer(normalizeSave(null, 0), 4 * 60 * 60_000, definition, initial);
  expect(save.currentLoopId).toBe(1);
  expect(save.loops[1].clock.pendingCriticalBoundary).toBe('convergence');
  expect(save.loops[1].clock.lastProcessedMinute).toBe(1111);
  expect(save.loops[2]).toBeUndefined();
});

it('keeps late Live Sync pre-entry history internal without revealing presence-only evidence', () => {
  const entryAt = local(21, 40);
  const save = normalizeSave(null, entryAt);
  save.loops[1].sealed = true;
  const next = createNextLoop(save, 'LIVE_SYNC', entryAt);
  const reconciled = reconcilePlayer(next, entryAt, definition, initial);
  expect(reconciled.loops[2].history.some(item => item.eventId === 'evt_1831_station')).toBe(true);
  expect(visibleRecords(reconciled, 2).map(item => item.id)).not.toContain('station-blackout');
  expect(visibleRecords(reconciled, 2).map(item => item.id)).toContain('station-bulletin-wakaharu');
});
