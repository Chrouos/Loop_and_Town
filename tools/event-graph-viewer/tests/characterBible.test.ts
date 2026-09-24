import { expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';

function byCharacter(id: string) {
  const character = loadRealStory().narrative.characters.find((item) => item.id === id);
  if (!character) throw new Error(`Missing character ${id}`);
  return character;
}

it('defines the seven core characters exactly once', () => {
  expect(loadRealStory().narrative.characters.map((character) => character.id).sort()).toEqual([
    'detective',
    'doctor',
    'protagonist',
    'reporter',
    'wakaharu',
    'yuan',
    'zhixia',
  ]);
});

it('locks the protagonist return-home premise', () => {
  const protagonist = byCharacter('protagonist');
  expect(protagonist.background.summary).toContain('整理');
  expect(protagonist.background.summary).toContain('出售');
  expect(protagonist.background.summary).not.toContain('收到信才回來');
});

it('uses only defined relationship endpoints and fact ids', () => {
  const story = loadRealStory();
  const characterIds = new Set(story.narrative.characters.map((character) => character.id));
  const factIds = new Set(story.narrative.knowledgeFacts.map((fact) => fact.id));

  for (const relation of story.narrative.relationships) {
    expect(characterIds.has(relation.from), `unknown relationship source ${relation.from}`).toBe(true);
    expect(characterIds.has(relation.to), `unknown relationship target ${relation.to}`).toBe(true);
  }

  for (const character of story.narrative.characters) {
    for (const fact of [...character.knowledge.initial, ...character.knowledge.hidden]) {
      expect(factIds.has(fact), `${character.id} references unknown fact ${fact}`).toBe(true);
    }
  }
});

it('keeps directional relationship pairs separate', () => {
  const relations = loadRealStory().narrative.relationships;
  expect(relations).toContainEqual(expect.objectContaining({
    from: 'protagonist',
    to: 'yuan',
    type: 'old_friend',
  }));
  expect(relations).toContainEqual(expect.objectContaining({
    from: 'yuan',
    to: 'protagonist',
    type: 'concerned_friend',
  }));
});
