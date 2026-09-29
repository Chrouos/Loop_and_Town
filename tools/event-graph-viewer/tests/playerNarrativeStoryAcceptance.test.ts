import { describe, expect, it } from 'vitest';
import { toAbsoluteMinute } from '../src/simulator/time';
import { loadRealStory } from './helpers/loadRealStory';

describe('player narrative story slice', () => {
  it('has at least three distinct ordinary arrival choices', () => {
    const story = loadRealStory();
    const choices = story.playerChoices.filter((choice) => choice.sceneId === 'prologue_arrival');
    expect(choices.length).toBeGreaterThanOrEqual(3);
    expect(new Set(choices.map((choice) => JSON.stringify(choice.effects))).size).toBe(choices.length);
  });

  it('gives every visible choice at least one real effect', () => {
    const story = loadRealStory();
    expect(story.playerChoices.length).toBeGreaterThan(10);
    expect(story.playerChoices.every((choice) => choice.effects.length > 0)).toBe(true);
  });

  it('keeps the letter in world truth before player arrival but discovers it through mail handling', () => {
    const story = loadRealStory();
    const letter = story.narrative.artifacts.find((artifact) => artifact.id === 'zhixia_letter');
    const discovery = story.narrative.scenes.find((scene) => scene.id === 'prologue_letter_discovery');
    if (!letter || !discovery) throw new Error('missing letter story data');
    expect(toAbsoluteMinute(letter.formedAt)).toBeLessThan(14 * 60 + 20);
    expect(discovery.requiresLocation).toBe('old_house');
    expect(discovery.afterActivityId).toBe('sort_mail');
  });

  it('contains simulator-backed 18:31 player presentation variants', () => {
    const scenes = loadRealStory().narrative.scenes.filter((scene) => scene.sourceEventId === 'evt_1831_station');
    expect(new Set(scenes.map((scene) => scene.sourceVariantId))).toEqual(new Set([
      'wakaharu_dies',
      'doctor_dies',
      'no_death',
    ]));
  });

  it('carries Day 01 through the human aftermath, the old case, the impossible bell, and reset', () => {
    const scenes = loadRealStory().narrative.scenes;
    const byId = new Map(scenes.map((scene) => [scene.id, scene]));
    const required = [
      'scene_1842_station_aftermath',
      'scene_2000_yuan_realtor',
      'scene_2030_detective_old_case',
      'scene_2240_watch_warning',
      'scene_2320_kitchen_quiet',
      'scene_2359_impossible_bell',
      'scene_0000_reset',
    ];

    for (const id of required) {
      const scene = byId.get(id);
      expect(scene, `missing ${id}`).toBeDefined();
      expect(scene?.blocks.length ?? 0, `${id} should be a real scene, not a marker`).toBeGreaterThanOrEqual(2);
    }

    const oldCaseText = JSON.stringify(byId.get('scene_2030_detective_old_case'));
    expect(oldCaseText).toContain('18:31');
    expect(oldCaseText).toContain('林知夏');

    const quietText = JSON.stringify(byId.get('scene_2320_kitchen_quiet'));
    expect(quietText).toContain('但我會去接妳');

    const bellText = JSON.stringify(byId.get('scene_2359_impossible_bell'));
    expect(bellText).toContain('鐘');
    expect(bellText).toContain('拆');

    const reset = byId.get('scene_0000_reset');
    if (!reset) throw new Error('missing scene_0000_reset');
    expect(toAbsoluteMinute(reset.at)).toBe(24 * 60);
    expect(JSON.stringify(reset)).toContain('下一站，灰潮鎮');
  });

  it('contains no player-facing debug or outcome labels', () => {
    const story = loadRealStory();
    const text = JSON.stringify({ scenes: story.narrative.scenes, choices: story.playerChoices });
    expect(text).not.toMatch(/BAD END|GOOD END|WORLDLINE CHANGED|impactType|Knowledge \+|Flavor|World Intervention/);
  });
});
