import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { chapterOf, nextChapter, parseChapterProgression } from '../../src/player/chapters';
import { normalizeSave, type PlayerSave } from '../../src/player/model';
import { createNextLoop, replayLoop } from '../../src/player/runtime';
import { finalInvestigationReady } from '../../src/player/finalGameplay';
import { narrativeExcerptMemoryId, rememberNarrativeExcerpt } from '../../src/player/knowledge';
import { playerSceneConditions, projectPlayerNarrativeRecords } from '../../src/player/narrativeRecords';
import { parseNarrativeDocument } from '../../src/lib/loadSimulationStory';
import { loadRealStory } from '../helpers/loadRealStory';
import progressionYaml from '../../../../story/loops/chapter_progression.yaml?raw';
import loop04Yaml from '../../../../story/narrative/loop_04_player.yaml?raw';
import type { PlayerStoryBundle } from '../../src/types/playerStory';

const rules = parseChapterProgression(yaml.load(progressionYaml));

function sealedLoop(chapter: number | 'final', revealed: string[] = []): PlayerSave {
  const save = normalizeSave(null, 0);
  save.loops[1].chapterId = chapter;
  save.loops[1].revealedIds = revealed.map(id => `1:${id}`);
  save.loops[1].sealed = true;
  return save;
}

function remember(save: PlayerSave, sceneId: string) {
  save.knowledge.memories.push({
    id: `memory:1:${sceneId}`, sourceLoop: 1, sourceRecordId: sceneId, sourceSceneId: sceneId,
    capturedAtMinute: 600, capturedAtMs: 0, kind: 'text', title: '', content: [''],
  });
}

describe('chapter progression by player knowledge', () => {
  it('advances from Chapter 1 only once the player learned Wakaharu died', () => {
    expect(nextChapter(sealedLoop(1), 1, rules)).toBe(1);
    expect(nextChapter(sealedLoop(1, ['station-bulletin-wakaharu']), 1, rules)).toBe(2);
    // Learning a different death first does not skip ahead.
    expect(nextChapter(sealedLoop(1, ['station-bulletin-doctor']), 1, rules)).toBe(1);
  });

  it('advances Chapters 2 and 3 on a different death, then on a death-free reset', () => {
    expect(nextChapter(sealedLoop(2, ['station-bulletin-wakaharu']), 1, rules)).toBe(2);
    expect(nextChapter(sealedLoop(2, ['station-bulletin-doctor']), 1, rules)).toBe(3);
    expect(nextChapter(sealedLoop(3, ['station-bulletin-doctor']), 1, rules)).toBe(3);
    expect(nextChapter(sealedLoop(3, ['station-bulletin-none']), 1, rules)).toBe(4);
  });

  it('can actually reach the death-free worldline with the two 18:00 choices', () => {
    const story = loadRealStory();
    const save = normalizeSave(null, 0);
    save.loops[1].actionIds = ['protect_wakaharu', 'stop_doctor'];
    const station = replayLoop(story.definition, story.initialState, save, 1, 1440).history
      .find(entry => entry.kind === 'event' && entry.eventId === 'evt_1831_station');
    expect(station?.variantId).toBe('no_death');
  });

  it('needs captured evidence from all three five-years-ago gaps to leave Chapter 4', () => {
    const save = sealedLoop(4);
    remember(save, 'loop04_0910_detective_confrontation');
    remember(save, 'loop04_1140_seven_records');
    expect(nextChapter(save, 1, rules)).toBe(4);
    remember(save, 'loop04_1310_reporter_confession');
    expect(nextChapter(save, 1, rules)).toBe(5);
  });

  it('reaches the Final after Chapter 7', () => {
    expect(nextChapter(sealedLoop(7), 1, rules)).toBe('final');
  });

  it('creates the next loop in the unlocked chapter and keeps it through a save round-trip', () => {
    const save = sealedLoop(1, ['station-bulletin-wakaharu']);
    createNextLoop(save, 'ACCELERATED', 1000, rules);
    expect(chapterOf(save, 2)).toBe(2);
    expect(chapterOf(normalizeSave(JSON.parse(JSON.stringify(save)), 1000), 2)).toBe(2);

    const replay = sealedLoop(1);
    createNextLoop(replay, 'ACCELERATED', 1000, rules);
    expect(chapterOf(replay, 2)).toBe(1);
  });

  it('treats saves from before chapter progression as playing the chapter matching the loop number', () => {
    const save = normalizeSave(null, 0);
    save.loops[1].sealed = true;
    createNextLoop(save, 'ACCELERATED', 1000);
    expect(save.loops[2].chapterId).toBeUndefined();
    expect(chapterOf(save, 2)).toBe(2);
  });

  it('keeps the Final investigation closed outside the Final chapter', () => {
    const save = normalizeSave(null, 0);
    save.loops[1].sealed = true;
    createNextLoop(save, 'ACCELERATED', 1000);
    save.loops[2].chapterId = 7;
    save.loops[2].stationVisit = { departMinute: 1000, arriveMinute: 1020 };
    expect(finalInvestigationReady(save, { clock: { day: 0, time: '18:40' }, characters: {}, world: {}, flags: {} }, 1120)).toBe(false);
  });
});

describe('inline capture from authored scenes', () => {
  const bundle: PlayerStoryBundle = {
    simulation: {} as PlayerStoryBundle['simulation'],
    narrativeDocuments: [{ sourcePath: 'loop_04_player.yaml', loopId: 4, scenes: parseNarrativeDocument(yaml.load(loop04Yaml)) }],
    artifacts: [],
  };

  it('stores the captured words as a Persistent Memory of that scene', () => {
    const save = normalizeSave(null, 0);
    save.loops[1].chapterId = 4;
    save.loops[1].revealedIds = ['1:loop04_1310_reporter_confession'];
    const record = projectPlayerNarrativeRecords(bundle, 4, [], 1440, playerSceneConditions(save, 1))
      .find(item => item.id === 'loop04_1310_reporter_confession')!;
    const memory = rememberNarrativeExcerpt(save, 1, record, record.excerpts[0].id, 800, 5);
    expect(memory.id).toBe(narrativeExcerptMemoryId(1, record.id, record.excerpts[0].id));
    expect(memory.content).toEqual([record.excerpts[0].text]);
    expect(memory.sourceSceneId).toBe('loop04_1310_reporter_confession');
    expect(save.knowledge.pins).toEqual([]);
  });

  it('rejects words from a scene the player was not given this loop', () => {
    const save = normalizeSave(null, 0);
    const record = projectPlayerNarrativeRecords(bundle, 4, [], 1440)[1];
    expect(() => rememberNarrativeExcerpt(save, 1, record, record.excerpts[0].id, 800, 5)).toThrow('還沒有取得來源');
  });
});
