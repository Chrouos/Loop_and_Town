import { describe, expect, it } from 'vitest';
import type { NarrativeFoundation } from '../src/narrative/types';
import { projectCharacterMemory } from '../src/narrative/characterMemory';
import { applyChoiceEffects } from '../src/playerNarrative/choices';
import { createInitialPlayerSession } from '../src/playerNarrative/model';
import { loadRealStory } from './helpers/loadRealStory';

const story: NarrativeFoundation = {
  characters: [{
    id: 'yuan',
    name: '周予安',
    identity: { occupation: '鐘錶店店主', hometown: '灰潮鎮' },
    background: { summary: '這段 authored background 不應直接出現在 player card。', history: ['secret history'] },
    personality: { traits: ['可靠'], habits: [], dislikes: [] },
    speech: { tone: 'casual', calls: {} },
    knowledge: { initial: ['fact_shop', 'fact_shared'], hidden: ['fact_secret'] },
    secrets: ['author secret'],
    scheduleRef: 'schedules/yuan.yaml',
  }],
  relationships: [],
  knowledgeFacts: [
    { id: 'fact_shop', characterId: 'yuan', summary: '他經營鐘錶店。' },
    { id: 'fact_secret', characterId: 'yuan', summary: '尚未知道的事。' },
    { id: 'fact_shared', characterId: 'zhixia', summary: '林知夏五年前死亡。' },
  ],
  activities: [],
  protagonistSchedule: { characterId: 'protagonist', entries: [] },
  scenes: [],
  artifacts: [],
  characterInsights: [{
    id: 'insight_yuan_tell',
    characterId: 'yuan',
    title: '予安緊張時反而很正式',
    presentation: '他越客氣，通常越不安。',
    retainedBy: 'protagonist',
    sourceLoop: 'loop_02',
  }],
  characterQuestions: [{
    id: 'question_yuan_leave',
    characterId: 'yuan',
    text: '他為什麼急著離開？',
    requiresFacts: ['fact_shop'],
  }],
};

describe('player character memory projection', () => {
  it('projects only player-known identity, facts, insights, and questions', () => {
    const [memory] = projectCharacterMemory(story, ['fact_shop', 'fact_shared'], ['insight_yuan_tell']);

    expect(memory).toMatchObject({
      characterId: 'yuan',
      name: '周予安',
      occupation: '鐘錶店店主',
      facts: [{ id: 'fact_shop', summary: '他經營鐘錶店。' }],
      insights: [{ id: 'insight_yuan_tell', title: '予安緊張時反而很正式', presentation: '他越客氣，通常越不安。' }],
      questions: [{ id: 'question_yuan_leave', text: '他為什麼急著離開？' }],
    });
    expect(JSON.stringify(memory)).not.toMatch(/authored background|secret history|author secret|scheduleRef|fact_shared/);
  });

  it('hides unknown facts, insights, and gated questions', () => {
    const [memory] = projectCharacterMemory(story, [], []);
    expect(memory.facts).toEqual([]);
    expect(memory.insights).toEqual([]);
    expect(memory.questions).toEqual([]);
  });

  it('does not repeat a character-attributed fact on every character card', () => {
    const loaded = loadRealStory();
    const memory = projectCharacterMemory(loaded.narrative, ['fact_zhixia_dead_five_years'], []);

    expect(memory.find((item) => item.characterId === 'zhixia')?.facts).toEqual([{
      id: 'fact_zhixia_dead_five_years',
      summary: '林知夏五年前死亡。',
    }]);
    expect(memory.find((item) => item.characterId === 'yuan')?.facts).toEqual([]);
    expect(memory.find((item) => item.characterId === 'wakaharu')?.facts).toEqual([]);
  });
});

describe('character insight loading and acquisition', () => {
  it('loads the existing retained insights document into the story bundle', () => {
    const loaded = loadRealStory();
    expect(loaded.narrative.characterInsights?.length).toBeGreaterThan(0);
    expect(loaded.narrative.characterInsights?.some((insight) => insight.id === 'insight_yuan_formal_when_nervous')).toBe(true);
  });

  it('learns an insight once without changing existing choice effects', () => {
    const loaded = loadRealStory();
    const session = createInitialPlayerSession(0);
    const next = applyChoiceEffects(loaded, session, {
      id: 'learn-yuan-insight',
      sceneId: 'scene_after_letter',
      label: '記住這件事',
      effects: [{ type: 'learn-insight', insightId: 'insight_yuan_formal_when_nervous' }],
    }, 900);
    const again = applyChoiceEffects(loaded, next, {
      id: 'learn-yuan-insight-again',
      sceneId: 'scene_after_letter',
      label: '再次記住',
      effects: [{ type: 'learn-insight', insightId: 'insight_yuan_formal_when_nervous' }],
    }, 900);

    expect(next.knownInsightIds).toEqual(['insight_yuan_formal_when_nervous']);
    expect(again.knownInsightIds).toEqual(['insight_yuan_formal_when_nervous']);
    expect(next.knownFactIds).toEqual(session.knownFactIds);
  });
});
