import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerApp } from '../../src/player/PlayerApp';
import { normalizeSave, type PlayerSave } from '../../src/player/model';
import { SAVE_KEY } from '../../src/player/storage';
import { MINUTE } from '../../src/player/clock';
import { replayLoop } from '../../src/player/runtime';
import { playerSceneConditions, projectPlayerNarrativeRecords } from '../../src/player/narrativeRecords';
import { parseNarrativeDocument } from '../../src/lib/loadSimulationStory';
import { loadRealStory } from '../helpers/loadRealStory';
import type { PlayerStoryBundle } from '../../src/types/playerStory';

const narrativeFiles = import.meta.glob('../../../../story/narrative/*_player.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function manifestBundle(): PlayerStoryBundle {
  const story = loadRealStory();
  return {
    simulation: {
      loop: story.loop, initialState: story.initialState, schedules: story.schedules, definition: story.definition,
      worldlines: story.worldlines, playerChoices: story.playerChoices, travelEdges: story.travelEdges,
    },
    narrativeDocuments: Object.entries(narrativeFiles).map(([path, raw]) => ({
      sourcePath: path,
      loopId: /final_player/.test(path) ? 'final' as const : Number(/loop_(\d+)_player/.exec(path)![1]),
      scenes: parseNarrativeDocument(yaml.load(raw)),
    })),
    artifacts: story.narrative.artifacts,
    protagonistSchedule: story.narrative.protagonistSchedule,
  };
}

const T0 = new Date(2026, 9, 20, 9, 0, 0, 0).getTime();
const realTimeAt = (minute: number) => T0 + ((minute - 372) / 12) * MINUTE;

function preferReducedMotion(): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  return () => { window.matchMedia = original; };
}

function loopOneSave(): PlayerSave {
  const save = normalizeSave(null, T0);
  save.knowledge.opened = ['1:letter'];
  return save;
}

function loopOneScenes(bundle: PlayerStoryBundle, save: PlayerSave, minute: number): string[] {
  const { definition, initialState } = bundle.simulation;
  const history = replayLoop(definition, initialState, save, 1, minute).history;
  return projectPlayerNarrativeRecords(bundle, 1, history, minute, playerSceneConditions(save, 1)).map(record => record.sceneId);
}

describe('Loop 01 authored narrative in the canonical player', () => {
  const bundle = manifestBundle();

  it('projects only the scenes consistent with a passive day at the old house', () => {
    const scenes = loopOneScenes(bundle, loopOneSave(), 1439);
    expect(scenes).toEqual(expect.arrayContaining([
      'prologue_yuan_reunion', 'prologue_letter_opened', 'prologue_old_house',
      'scene_1820_old_house', 'scene_2240_watch_warning', 'scene_2320_kitchen_quiet',
    ]));
    for (const elsewhere of ['scene_1820_cafe', 'scene_1820_hospital', 'scene_1805_station_handoff', 'scene_wakaharu_cafe']) {
      expect(scenes).not.toContain(elsewhere);
    }
    // Activity-choice and fact-choice branches have no player-side source yet.
    expect(scenes).not.toContain('prologue_after_coffee');
    expect(scenes).not.toContain('scene_after_research');
  });

  it('follows the player to the old station instead of the old house', () => {
    const save = loopOneSave();
    save.loops[1].stationVisit = { departMinute: 17 * 60 + 30, arriveMinute: 17 * 60 + 50 };
    const scenes = loopOneScenes(bundle, save, 1439);
    expect(scenes).toContain('scene_1805_station_handoff');
    expect(scenes).not.toContain('scene_1820_old_house');
    expect(scenes.filter(id => id.startsWith('scene_1820_'))).toHaveLength(0);
  });

  it('hides the letter-dependent scenes until the letter is opened', () => {
    const save = normalizeSave(null, T0);
    expect(loopOneScenes(bundle, save, 1439)).not.toContain('prologue_letter_opened');
  });

  it('labels every authored speaker instead of falling back to 對方', () => {
    for (const document of bundle.narrativeDocuments) {
      const records = projectPlayerNarrativeRecords(bundle, document.loopId, [], 1440, playerSceneConditions(loopOneSave(), 1));
      expect(records.flatMap(record => record.body).filter(line => line.startsWith('對方：'))).toEqual([]);
    }
  });

  it('moves the stage on to the next unwatched scene once the current passage has finished', async () => {
    const restore = preferReducedMotion();
    try {
      const storage = window.localStorage;
      storage.clear();
      storage.setItem(SAVE_KEY, JSON.stringify(loopOneSave()));
      const now = realTimeAt(8 * 60 + 10);
      render(<PlayerApp now={() => now} storage={storage} loadStory={async () => bundle} />);
      expect(await screen.findByText(/我在返鄉列車的震動裡醒來/, {}, { timeout: 8000 })).toBeDefined();
    } finally { restore(); }
  });

  it('keeps the 18:20 decision on stage instead of moving on to other scenes', async () => {
    const restore = preferReducedMotion();
    try {
      const storage = window.localStorage;
      storage.clear();
      storage.setItem(SAVE_KEY, JSON.stringify(loopOneSave()));
      const now = realTimeAt(18 * 60 + 1);
      render(<PlayerApp now={() => now} storage={storage} loadStory={async () => bundle} />);
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: /讀予安的留言/ }, { timeout: 8000 }));
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 3000)); });
      expect(screen.getByRole('button', { name: /保護若晴/ })).toBeDefined();
    } finally { restore(); }
  }, 15_000);

  it('counts only real messages as incoming, not scenes the protagonist lived through', async () => {
    const storage = window.localStorage;
    storage.clear();
    storage.setItem(SAVE_KEY, JSON.stringify(loopOneSave()));
    const now = realTimeAt(17 * 60 + 10);
    render(<PlayerApp now={() => now} storage={storage} loadStory={async () => bundle} />);
    await screen.findByRole('button', { name: '開啟工具' });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    expect(screen.queryByText(/則新消息/)).toBeNull();
  });

  it('lets the player reach the 22:40 watch warning from the Loop 1 case file', async () => {
    const storage = window.localStorage;
    storage.clear();
    storage.setItem(SAVE_KEY, JSON.stringify(loopOneSave()));
    const now = realTimeAt(23 * 60);
    render(<PlayerApp now={() => now} storage={storage} loadStory={async () => bundle} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '開啟工具' }));
    await user.click(screen.getByRole('button', { name: /^案卷/ }));
    const caseFile = within(screen.getByRole('dialog'));
    await user.click(caseFile.getByRole('button', { name: /22:40/ }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    expect(document.body.textContent).toContain('不要先救第一個死者');
  });
});
