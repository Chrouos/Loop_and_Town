import { expect, it } from 'vitest';
import { advanceActivity, startActivity } from '../src/narrative/activity';
import { projectCharacterGraph } from '../src/narrative/characterGraph';
import { projectNarrative } from '../src/narrative/projection';
import { validateNarrativeFoundation } from '../src/narrative/validation';
import { simulateNamedWorldline } from '../src/simulator/storySimulation';
import { toAbsoluteMinute } from '../src/simulator/time';
import { loadRealStory } from './helpers/loadRealStory';

it('keeps ordinary life before mystery escalation and introduces Yuan with context', () => {
  const narrative = loadRealStory().narrative;
  const letterIndex = narrative.scenes.findIndex((scene) => scene.id === 'prologue_letter_discovery');
  const preLetterText = narrative.scenes
    .slice(0, letterIndex)
    .flatMap((scene) => scene.blocks)
    .filter((block) => block.type !== 'artifact')
    .map((block) => block.text)
    .join('\n');
  expect(preLetterText).not.toMatch(/18:31|輪迴|研究所真相/);

  const firstYuanScene = narrative.scenes.find((scene) => scene.participants.includes('yuan'));
  expect(firstYuanScene?.id).toBe('prologue_yuan_reunion');
  const yuanText = firstYuanScene?.blocks
    .filter((block) => block.type !== 'artifact')
    .map((block) => block.text)
    .join('\n') ?? '';
  expect(yuanText).toContain('周予安');
  expect(yuanText).toContain('高中同學');
});

it('advances rest_and_read in world minutes and ignores hidden movement', () => {
  const narrative = loadRealStory().narrative;
  const definition = narrative.activities.find((activity) => activity.id === 'rest_and_read')!;
  const started = startActivity('rest_and_read', 930, definition);
  const hiddenInterrupt = {
    minute: 940,
    visibility: 'hidden' as const,
    observable: false,
    sceneId: 'reporter_enter_old_lab',
  };
  const halfway = advanceActivity(started, 940, [hiddenInterrupt]);
  expect(halfway.status).toBe('running');
  expect(halfway.remainingMinutes).toBe(10);
  const completed = advanceActivity(halfway, 950, [hiddenInterrupt]);
  expect(completed.status).toBe('complete');
  expect(completed.remainingMinutes).toBe(0);
});

it('discovers the impossible letter from the mail activity after returning home', () => {
  const story = loadRealStory();
  const scenes = story.narrative.scenes;
  const home = scenes.find((scene) => scene.id === 'prologue_old_house')!;
  const letter = scenes.find((scene) => scene.id === 'prologue_letter_discovery')!;
  const artifact = story.narrative.artifacts.find((item) => item.id === 'zhixia_letter')!;
  expect(home.requiresLocation).toBe('old_house');
  expect(letter.requiresLocation).toBe('old_house');
  expect(letter.afterActivityId).toBe('sort_mail');
  expect(toAbsoluteMinute(artifact.formedAt)).toBeLessThan(14 * 60 + 20);
});

it('keeps author-only relationships out of public and player-known projections', () => {
  const narrative = loadRealStory().narrative;
  const publicGraph = projectCharacterGraph(narrative, 'public');
  const playerGraph = projectCharacterGraph(narrative, 'player-known', ['fact_zhixia_dead_five_years']);
  expect(publicGraph.edges.some((edge) => edge.visibility === 'author')).toBe(false);
  expect(playerGraph.edges.some((edge) => edge.visibility === 'author')).toBe(false);
  expect(publicGraph.edges.some((edge) => edge.summary.includes('研究所'))).toBe(false);
});

it('rejects a scene when its speaker lacks the referenced fact', () => {
  const narrative = loadRealStory().narrative;
  const yuan = narrative.characters.find((character) => character.id === 'yuan')!;
  const yuanFacts = new Set([...yuan.knowledge.initial, ...yuan.knowledge.hidden]);
  const unknownFact = narrative.knowledgeFacts.find((fact) => !yuanFacts.has(fact.id))!;
  const invalidScene = {
    ...narrative.scenes[0],
    id: 'acceptance_knowledge_leak',
    participants: ['yuan'],
    blocks: [{
      type: 'dialogue' as const,
      speaker: 'yuan',
      text: '這句話不應該被允許。',
      factId: unknownFact.id,
    }],
  };

  expect(() => validateNarrativeFoundation({
    ...narrative,
    scenes: [...narrative.scenes, invalidScene],
  })).toThrow(`Scene acceptance_knowledge_leak: character yuan does not know fact ${unknownFact.id}`);
});

it.each([
  ['WL-00', 'wakaharu_dies', false],
  ['WL-01', 'wakaharu_dies', false],
  ['WL-02', 'wakaharu_dies', false],
  ['WL-03', 'wakaharu_dies', true],
  ['WL-04', 'doctor_dies', false],
  ['WL-05', 'wakaharu_dies', false],
  ['WL-06', 'no_death', false],
  ['WL-07', 'doctor_dies', true],
] as const)('%s preserves approved station and reporter outcomes', (id, stationVariant, reporterMissing) => {
  const result = simulateNamedWorldline(loadRealStory(), id);
  expect(result.fullHistory.find((entry) => entry.eventId === 'evt_1831_station')?.variantId).toBe(stationVariant);
  expect(((result.state.characters as Record<string, any>).reporter).status === 'missing').toBe(reporterMissing);
});

it('keeps 23:59 bells before the Day 1 00:00 loop end', () => {
  const result = simulateNamedWorldline(loadRealStory(), 'WL-00');
  const bells = result.fullHistory.find((entry) => entry.eventId === 'evt_2359_midnight_bells')!;
  const loopEnd = result.fullHistory.find((entry) => entry.eventId === 'evt_0000_loop_end')!;
  expect(bells.absoluteMinute).toBe(1439);
  expect(loopEnd.absoluteMinute).toBe(1440);
  expect(bells.sequence).toBeLessThan(loopEnd.sequence);
});

it('produces deterministic narrative projection for identical inputs', () => {
  const story = loadRealStory();
  const worldline = simulateNamedWorldline(story, 'WL-03');
  const input = {
    story: story.narrative,
    fullHistory: worldline.fullHistory,
    context: {
      protagonistLocation: 'old_house',
      online: true,
      channels: ['present', 'phone', 'artifact'] as const,
      minute: 970,
    },
    activeActivity: null,
    consumedSceneIds: [],
  };
  expect(projectNarrative(input)).toEqual(projectNarrative(input));
});
