import { describe, expect, it } from 'vitest';
import { normalizeSave, type PlayerSave } from '../../src/player/model';
import { confirmAction, replayLoop } from '../../src/player/runtime';
import { MINUTE } from '../../src/player/clock';
import { travelToOldStation } from '../../src/player/stationTravel';
import { playerSceneConditions, projectPlayerNarrativeRecords } from '../../src/player/narrativeRecords';
import { parseNarrativeDocument } from '../../src/lib/loadSimulationStory';
import { loadRealStory } from '../helpers/loadRealStory';
import yaml from 'js-yaml';
import loop01Yaml from '../../../../story/narrative/loop_01_player.yaml?raw';
import type { PlayerStoryBundle } from '../../src/types/playerStory';

const T0 = 1_000_000;
const realTimeAt = (minute: number) => T0 + ((minute - 372) / 12) * MINUTE;
const story = loadRealStory();
const bundle = {
  simulation: { loop: story.loop, initialState: story.initialState, schedules: story.schedules, definition: story.definition, worldlines: story.worldlines, playerChoices: story.playerChoices, travelEdges: story.travelEdges },
  narrativeDocuments: [{ sourcePath: 'loop_01_player.yaml', loopId: 1, scenes: parseNarrativeDocument(yaml.load(loop01Yaml)) }],
  artifacts: story.narrative.artifacts,
  protagonistSchedule: story.narrative.protagonistSchedule,
} as PlayerStoryBundle;

function atStation(): PlayerSave {
  const save = normalizeSave(null, T0);
  save.knowledge.opened = ['1:letter'];
  travelToOldStation(save, 17 * 60 + 10);
  return save;
}
const scenesAt = (save: PlayerSave, minute: number) => projectPlayerNarrativeRecords(
  bundle, 1, replayLoop(story.definition, story.initialState, save, 1, minute).history, minute, playerSceneConditions(save, 1),
).map(record => record.sceneId);

describe('the two choices only someone standing at the old station has', () => {
  it('meets Wakaharu at the side entrance, shows her the letter, and hears what she knows at 18:18', () => {
    const save = atStation();
    confirmAction(save, 'wait_for_wakaharu_at_entrance', realTimeAt(18 * 60 + 2));
    const scenes = scenesAt(save, 18 * 60 + 25);
    expect(scenes).toContain('scene_1805_entrance_wait');
    expect(scenes).not.toContain('scene_1805_station_handoff');
    expect(scenes).toContain('scene_1818_warning');
    expect(scenes).not.toContain('scene_1818_guarded');
  });

  it('watches the doctor after the handoff instead', () => {
    const save = atStation();
    confirmAction(save, 'watch_doctor_on_platform', realTimeAt(18 * 60 + 2));
    const scenes = scenesAt(save, 18 * 60 + 20);
    expect(scenes).toContain('scene_1812_doctor_watched');
    expect(scenes).toContain('scene_1805_station_handoff');
    expect(scenes).toContain('scene_1818_guarded');
  });

  it('does not change who dies at 18:31 in the first loop', () => {
    for (const id of ['wait_for_wakaharu_at_entrance', 'watch_doctor_on_platform'] as const) {
      const save = atStation();
      confirmAction(save, id, realTimeAt(18 * 60 + 2));
      const characters = replayLoop(story.definition, story.initialState, save, 1, 18 * 60 + 40).state.characters as Record<string, { status?: string }>;
      expect(characters.wakaharu.status).toBe('dead');
    }
  });

  it('can only be in one place, only while there, and only while there is still time', () => {
    const away = normalizeSave(null, T0);
    expect(() => confirmAction(away, 'watch_doctor_on_platform', realTimeAt(18 * 60 + 2))).toThrow('你人不在舊車站。');
    const both = atStation();
    confirmAction(both, 'watch_doctor_on_platform', realTimeAt(18 * 60 + 2));
    expect(() => confirmAction(both, 'wait_for_wakaharu_at_entrance', realTimeAt(18 * 60 + 3))).toThrow('你只能待在一個地方。');
    expect(() => confirmAction(both, 'stop_doctor', realTimeAt(18 * 60 + 3))).toThrow();
    const late = atStation();
    expect(() => confirmAction(late, 'wait_for_wakaharu_at_entrance', realTimeAt(18 * 60 + 6))).toThrow('若晴已經進站了。');
    const yuanWent = atStation();
    confirmAction(yuanWent, 'stop_doctor', realTimeAt(18 * 60 + 2));
    expect(() => confirmAction(yuanWent, 'watch_doctor_on_platform', realTimeAt(18 * 60 + 3))).toThrow();
  });
});
