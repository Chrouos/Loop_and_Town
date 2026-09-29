import { expect, it } from 'vitest';
import yaml from 'js-yaml';
import { ATTENTION_SHIFT_MS } from '../../src/player/attention';
import { beginMemoryCapture, reconcilePlayer } from '../../src/player/knowledge';
import { MINUTE } from '../../src/player/clock';
import { normalizeSave } from '../../src/player/model';
import { recordById } from '../../src/player/story';
import { attendPresenceRecord } from '../../src/player/knowledge';
import type { ActionDefinition, EventDefinition, WorldState } from '../../src/simulator/types';
import initialYaml from '../../../../story/world/day_01_initial.yaml?raw';
import actionsYaml from '../../../../story/actions/day_01_actions.yaml?raw';
import stationYaml from '../../../../story/events/day_01_1831.yaml?raw';
import reporterYaml from '../../../../story/events/day_01_2114.yaml?raw';

const initial = { ...(yaml.load(initialYaml) as WorldState), clock: { day: 0, time: '06:12' } };
const definition = {
  actions: (yaml.load(actionsYaml) as { actions: ActionDefinition[] }).actions,
  events: [yaml.load(stationYaml), yaml.load(reporterYaml)] as EventDefinition[],
};
const convergence = Math.ceil((1111 - 372) / 12 * MINUTE);

it('rejects capture before perception and starts a focused capture after perception', () => {
  const save = reconcilePlayer(normalizeSave(null, 0), convergence, definition, initial);
  const clockBefore = structuredClone(save.loops[1].clock);

  expect(beginMemoryCapture(save, 1, 'station-blackout', 1111, undefined, convergence)).toBe(false);
  expect(attendPresenceRecord(save, 1, 'station-blackout', 1111, undefined, undefined, convergence)).toBe(true);
  const observationMs = recordById('station-blackout')?.spatialScript?.totalDurationMs ?? 0;
  const perceivedAt = convergence + ATTENTION_SHIFT_MS + observationMs + 1;
  reconcilePlayer(save, perceivedAt, definition, initial);

  expect(save.loops[1].perceivedSceneIds).toContain('station-blackout');
  expect(beginMemoryCapture(save, 1, 'station-blackout', 1111, undefined, perceivedAt)).toBe(true);
  expect(save.loops[1].capture?.recordId).toBe('station-blackout');
  expect(save.loops[1].attention.phase).toBe('shifting');
  expect(save.loops[1].clock).toEqual(clockBefore);
});

it('persists the original perceived moment after capture without adding player conclusions', () => {
  const save = reconcilePlayer(normalizeSave(null, 0), convergence, definition, initial);
  attendPresenceRecord(save, 1, 'station-blackout', 1111, undefined, undefined, convergence);
  const observationMs = recordById('station-blackout')?.spatialScript?.totalDurationMs ?? 0;
  const perceivedAt = convergence + ATTENTION_SHIFT_MS + observationMs + 1;
  reconcilePlayer(save, perceivedAt, definition, initial);
  beginMemoryCapture(save, 1, 'station-blackout', 1111, undefined, perceivedAt);

  const captureDoneAt = perceivedAt + ATTENTION_SHIFT_MS + 1_200 + 1;
  reconcilePlayer(save, captureDoneAt, definition, initial);

  expect(save.loops[1].capture).toBeUndefined();
  expect(save.loops[1].attention.phase).toBe('idle');
  expect(save.knowledge.memories).toHaveLength(1);
  expect(save.knowledge.memories[0]).toMatchObject({
    id: 'memory:1:station-blackout',
    sourceLoop: 1,
    sourceRecordId: 'station-blackout',
    kind: 'composite',
    content: ['舊車站那一帶忽然暗了。', '停電只有幾秒。遠處傳來一聲鐘響。', '你還不知道月台上發生了什麼。'],
  });
  expect(save.knowledge.pins).toEqual([]);
  expect(save.knowledge.connections).toEqual([]);
  expect(save.knowledge.notes).toEqual([]);
});
