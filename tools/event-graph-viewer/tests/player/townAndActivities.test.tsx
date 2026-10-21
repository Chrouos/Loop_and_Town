import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerApp } from '../../src/player/PlayerApp';
import { normalizeSave } from '../../src/player/model';
import { SAVE_KEY, readSave } from '../../src/player/storage';
import { MINUTE } from '../../src/player/clock';
import { leaveTown, protagonistLocationAt, TOWN_TRAVEL_MINUTES, travelToOldStation, travelToTown } from '../../src/player/stationTravel';
import { activeActivity, activityCompletedAt, startActivity } from '../../src/player/mainAction';
import { replayLoop } from '../../src/player/runtime';
import { playerSceneConditions, projectPlayerNarrativeRecords } from '../../src/player/narrativeRecords';
import { parseNarrativeDocument } from '../../src/lib/loadSimulationStory';
import { loadRealStory } from '../helpers/loadRealStory';
import travelYaml from '../../../../story/travel/loop_01.yaml?raw';
import loop01Yaml from '../../../../story/narrative/loop_01_player.yaml?raw';
import dailyYaml from '../../../../story/narrative/daily_player.yaml?raw';
import { narrativeExcerptMemoryId, rememberNarrativeExcerpt } from '../../src/player/knowledge';
import { createNextLoop } from '../../src/player/runtime';
import type { PlayerStoryBundle } from '../../src/types/playerStory';

const story = loadRealStory();
const activities = story.narrative.activities;
const bundle: PlayerStoryBundle = {
  simulation: {
    loop: story.loop, initialState: story.initialState, schedules: story.schedules, definition: story.definition,
    worldlines: story.worldlines, playerChoices: story.playerChoices, travelEdges: story.travelEdges,
  },
  narrativeDocuments: [
    { sourcePath: 'loop_01_player.yaml', loopId: 1, scenes: parseNarrativeDocument(yaml.load(loop01Yaml)) },
    { sourcePath: 'daily_player.yaml', loopId: 'daily', scenes: parseNarrativeDocument(yaml.load(dailyYaml)) },
  ],
  artifacts: story.narrative.artifacts,
  protagonistSchedule: story.narrative.protagonistSchedule,
  activities,
};
const T0 = new Date(2026, 9, 20, 9, 0, 0, 0).getTime();
const realTimeAt = (minute: number) => T0 + ((minute - 372) / 12) * MINUTE;
const freshSave = () => { const save = normalizeSave(null, T0); save.knowledge.opened = ['1:letter']; return save; };
const scenesAt = (save: ReturnType<typeof freshSave>, minute: number) => projectPlayerNarrativeRecords(
  bundle, 1, replayLoop(story.definition, story.initialState, save, 1, minute).history, minute, playerSceneConditions(save, 1, activities),
);

describe('walking around town', () => {
  it('uses the walking times from the travel data', () => {
    const edges = (yaml.load(travelYaml) as { travel: Array<{ from: string; to: string; minutes: number }> }).travel;
    for (const place of ['cafe', 'hospital'] as const) {
      expect(edges.find(edge => edge.from === 'old_house' && edge.to === place)?.minutes).toBe(TOWN_TRAVEL_MINUTES[place]);
    }
  });

  it('is on the road, then at the café, then on the road and home again', () => {
    const save = freshSave();
    travelToTown(save, 'cafe', 600);
    leaveTown(save, 700);
    expect([599, 600, 612, 699, 700, 712].map(minute => protagonistLocationAt(save, 1, minute)))
      .toEqual(['old_house', 'en_route', 'cafe', 'cafe', 'en_route', 'old_house']);
    expect(normalizeSave(JSON.parse(JSON.stringify(save)), T0).loops[1].townVisits).toEqual(save.loops[1].townVisits);
  });

  it('can follow someone from the café straight to the old station', () => {
    const save = freshSave();
    travelToTown(save, 'cafe', 960);
    travelToOldStation(save, 1040);
    expect([1039, 1040, 1060].map(minute => protagonistLocationAt(save, 1, minute))).toEqual(['cafe', 'en_route', 'old_station']);
  });

  it('cannot set out for town while already on the road or at the station', () => {
    const save = freshSave();
    travelToTown(save, 'hospital', 600);
    expect(() => travelToTown(save, 'cafe', 605)).toThrow('先回到老家');
  });

  it('meets Wakaharu at the café when arriving while she is still there', () => {
    const save = freshSave();
    travelToTown(save, 'cafe', 1008);
    const scene = scenesAt(save, 1100).find(record => record.id === 'scene_wakaharu_cafe');
    expect(scene?.revealMinute).toBe(1020);
    expect(scenesAt(save, 1100).map(record => record.id)).not.toContain('scene_1820_old_house');
  });
});

describe('things to do at the old house', () => {
  it('carries research through to the end and shows what it turned up then', () => {
    const save = freshSave();
    startActivity(save, 1, 'research_online', 13 * 60, activities);
    expect(activeActivity(save, 1, 13 * 60 + 20, activities)?.definition.id).toBe('research_online');
    expect(activityCompletedAt(save, 1, 'research_online', activities)).toBe(13 * 60 + 35);
    expect(scenesAt(save, 13 * 60 + 34).map(record => record.id)).not.toContain('scene_after_research');
    expect(scenesAt(save, 13 * 60 + 35).find(record => record.id === 'scene_after_research')?.revealMinute).toBe(13 * 60 + 35);
  });

  it('leaving the house interrupts the activity, and nothing turns up', () => {
    const save = freshSave();
    startActivity(save, 1, 'research_online', 13 * 60, activities);
    travelToTown(save, 'cafe', 13 * 60 + 10);
    expect(activityCompletedAt(save, 1, 'research_online', activities)).toBeUndefined();
    expect(scenesAt(save, 15 * 60).map(record => record.id)).not.toContain('scene_after_research');
    expect(() => startActivity(save, 1, 'research_online', 15 * 60, activities)).toThrow();
  });

  it('offers the laptop and phone from the quiet house and plays the activity on stage', async () => {
    const storage = window.localStorage;
    storage.clear();
    storage.setItem(SAVE_KEY, JSON.stringify(freshSave()));
    const now = realTimeAt(13 * 60);
    render(<PlayerApp now={() => now} storage={storage} loadStory={async () => bundle} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '打開筆電查資料' }, { timeout: 20_000 }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    expect(readSave(storage, now).loops[1].activityRuns?.[0]).toMatchObject({ id: 'research_online', startMinute: 13 * 60 });
    expect(await screen.findByText('正在查資料……')).toBeDefined();
    expect(screen.getByRole('button', { name: /走去咖啡店/ })).toBeDefined();
  }, 30_000);
});

describe('everyday town life between the morning and the evening', () => {
  it('lets the player find Yuan at his shop and keep what she noticed', () => {
    const save = freshSave();
    travelToTown(save, 'clock_shop', 11 * 60 + 35);
    const scene = scenesAt(save, 12 * 60).find(record => record.id === 'daily_clock_1140_black_coffee');
    expect(scene?.excerpts.map(excerpt => excerpt.text)).toEqual(['自己那杯什麼都沒加', '房仲的名片']);
    expect(scene?.source).toBe('予安');
  });

  it('gives every hour from 11:30 to 16:30 something to find somewhere in town', () => {
    const daily = parseNarrativeDocument(yaml.load(dailyYaml)).filter(scene => !scene.requiresMemory);
    for (let hour = 11; hour < 16; hour += 1) {
      const start = hour * 60 + 30;
      const covered = daily.some(scene => {
        const [h, m] = String((scene.at as { time: string }).time).split(':').map(Number);
        const [uh, um] = String((scene.availableUntil as { time: string }).time).split(':').map(Number);
        return h * 60 + m <= start + 60 && uh * 60 + um >= start;
      });
      expect(covered, `nothing between ${hour}:30 and ${hour + 1}:30`).toBe(true);
    }
  });

  it('remembers the detail in the next loop, where the same moment plays out differently', () => {
    const save = freshSave();
    travelToTown(save, 'clock_shop', 11 * 60 + 35);
    const scene = scenesAt(save, 12 * 60).find(record => record.id === 'daily_clock_1140_black_coffee')!;
    save.loops[1].revealedIds.push(`1:${scene.id}`);
    rememberNarrativeExcerpt(save, 1, scene, scene.excerpts[0].id, 12 * 60, 0);
    expect(save.knowledge.memories[0].id).toBe(narrativeExcerptMemoryId(1, scene.id, scene.excerpts[0].id));
    // Same loop: the memory does not rewrite the moment it came from.
    expect(scenesAt(save, 12 * 60).map(record => record.id)).not.toContain('daily_clock_1140_remembered_coffee');

    save.loops[1].sealed = true;
    createNextLoop(save, 'ACCELERATED', 1000);
    save.loops[2].chapterId = 1;
    travelToTown(save, 'clock_shop', 11 * 60 + 35);
    const nextLoop = projectPlayerNarrativeRecords(bundle, 1, [], 12 * 60, playerSceneConditions(save, 2, activities)).map(record => record.id);
    expect(nextLoop).toContain('daily_clock_1140_remembered_coffee');
    expect(nextLoop).not.toContain('daily_clock_1140_black_coffee');
  });
});
