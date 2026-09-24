import { expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';
import { validateNarrativeFoundation } from '../src/narrative/validation';

function sceneIndex(id: string): number {
  return loadRealStory().narrative.scenes.findIndex((scene) => scene.id === id);
}

it('starts as ordinary life before the impossible letter', () => {
  const story = loadRealStory();
  const scenes = story.narrative.scenes;
  expect(scenes.find((scene) => scene.id === 'prologue_arrival')?.at).toEqual({ day: 0, time: '14:20' });
  expect(scenes.find((scene) => scene.id === 'prologue_yuan_reunion')?.at).toEqual({ day: 0, time: '14:40' });
  const letter = scenes.find((scene) => scene.id === 'prologue_letter_discovery');
  expect(letter?.requiresLocation).toBe('old_house');
  expect(letter?.afterActivityId).toBe('sort_mail');
  expect(sceneIndex('prologue_letter_discovery')).toBeGreaterThan(sceneIndex('prologue_old_house'));
});

it('keeps mystery terminology out of pre-letter scenes', () => {
  const story = loadRealStory();
  const letterIndex = sceneIndex('prologue_letter_discovery');
  const text = story.narrative.scenes
    .slice(0, letterIndex)
    .flatMap((scene) => scene.blocks)
    .filter((block) => block.type !== 'artifact')
    .map((block) => block.text)
    .join('\n');
  expect(text).not.toMatch(/18:31|輪迴|研究所真相/);
});

it('introduces Yuan as an old friend before shorthand references', () => {
  const scene = loadRealStory().narrative.scenes.find((item) => item.id === 'prologue_yuan_reunion');
  const text = scene?.blocks.filter((block) => block.type !== 'artifact').map((block) => block.text).join('\n') ?? '';
  expect(text).toContain('周予安');
  expect(text).toContain('高中同學');
});

it('loads the letter as an artifact without preselected evidence excerpts', () => {
  const artifact = loadRealStory().narrative.artifacts.find((item) => item.id === 'zhixia_letter');
  expect(artifact?.kind).toBe('letter');
  expect(artifact?.content).toContain('如果午夜的鐘聲響起，就代表又失敗了。');
  expect(artifact && 'excerpts' in artifact).toBe(false);
});

it('validates all real prologue references', () => {
  expect(() => validateNarrativeFoundation(loadRealStory().narrative)).not.toThrow();
});

it('rejects unknown activity and artifact references', () => {
  const story = loadRealStory().narrative;
  const scene = story.scenes[0];
  expect(() => validateNarrativeFoundation({
    ...story,
    scenes: [{ ...scene, startsActivity: 'missing_activity' }],
  })).toThrow(`Scene ${scene.id}: unknown activity missing_activity`);

  expect(() => validateNarrativeFoundation({
    ...story,
    scenes: [{ ...scene, artifactId: 'missing_artifact' }],
  })).toThrow(`Scene ${scene.id}: unknown artifact missing_artifact`);
});
