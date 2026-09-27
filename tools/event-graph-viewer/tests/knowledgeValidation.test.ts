import { expect, it } from 'vitest';
import { characterKnowsFact } from '../src/narrative/knowledge';
import { validateNarrativeFoundation } from '../src/narrative/validation';
import type { NarrativeFoundation } from '../src/narrative/types';

function fixture(): NarrativeFoundation {
  return {
    characters: [{
      id: 'yuan',
      name: '周予安',
      identity: {},
      background: { summary: '', history: [] },
      personality: { traits: [], habits: [], dislikes: [] },
      speech: { tone: 'casual', calls: {} },
      knowledge: { initial: ['fact_zhixia_dead_five_years'], hidden: [] },
      secrets: [],
    }],
    relationships: [],
    knowledgeFacts: [
      { id: 'fact_zhixia_dead_five_years', summary: '林知夏五年前死亡' },
      { id: 'fact_research_institute_truth', summary: '研究所真相' },
    ],
    activities: [],
    protagonistSchedule: { characterId: 'protagonist', entries: [] },
    artifacts: [],
    scenes: [{
      id: 'scene_1',
      at: '14:40',
      kind: 'dialogue',
      participants: ['yuan'],
      blocks: [{
        type: 'dialogue',
        speaker: 'yuan',
        text: '我知道研究所的事。',
        factId: 'fact_research_institute_truth',
      }],
      observation: { channel: 'present' },
    }],
  };
}

it('rejects dialogue that exposes a fact the speaker does not know', () => {
  expect(() => validateNarrativeFoundation(fixture())).toThrow(
    'Scene scene_1: character yuan does not know fact fact_research_institute_truth',
  );
});

it('accepts facts in either initial or hidden character knowledge', () => {
  const story = fixture();
  const yuan = story.characters[0];
  yuan.knowledge.hidden.push('fact_research_institute_truth');
  expect(characterKnowsFact(yuan, 'fact_research_institute_truth')).toBe(true);
  expect(() => validateNarrativeFoundation(story)).not.toThrow();
});

it('rejects duplicate fact ids', () => {
  const story = fixture();
  story.knowledgeFacts.push({ id: 'fact_zhixia_dead_five_years', summary: 'duplicate' });
  expect(() => validateNarrativeFoundation(story)).toThrow(
    'Duplicate Knowledge Fact ID: fact_zhixia_dead_five_years',
  );
});

it('rejects unknown scene participants before rendering', () => {
  const story = fixture();
  story.scenes[0].participants.push('missing_character');
  expect(() => validateNarrativeFoundation(story)).toThrow(
    'Scene scene_1: unknown participant missing_character',
  );
});

it('rejects unknown relationship endpoints', () => {
  const story = fixture();
  story.relationships.push({
    from: 'yuan',
    to: 'missing_character',
    type: 'friend',
    visibility: 'public',
    summary: 'invalid',
  });
  expect(() => validateNarrativeFoundation(story)).toThrow(
    'Relationship yuan->missing_character: unknown target character missing_character',
  );
});
