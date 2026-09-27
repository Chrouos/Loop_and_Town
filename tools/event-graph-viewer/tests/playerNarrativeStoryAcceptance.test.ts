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

  it('contains no player-facing debug or outcome labels', () => {
    const story = loadRealStory();
    const text = JSON.stringify({ scenes: story.narrative.scenes, choices: story.playerChoices });
    expect(text).not.toMatch(/BAD END|GOOD END|WORLDLINE CHANGED|impactType|Knowledge \+|Flavor|World Intervention/);
  });
});
