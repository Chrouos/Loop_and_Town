import { expect, it } from 'vitest';
import { projectCharacterGraph } from '../src/narrative/characterGraph';
import { loadRealStory } from './helpers/loadRealStory';

it('keeps directional relationships separate in author mode', () => {
  const graph = projectCharacterGraph(loadRealStory().narrative, 'author');
  expect(graph.edges).toContainEqual(expect.objectContaining({
    source: 'protagonist',
    target: 'yuan',
    type: 'old_friend',
  }));
  expect(graph.edges).toContainEqual(expect.objectContaining({
    source: 'yuan',
    target: 'protagonist',
    type: 'concerned_friend',
  }));
});

it('hides author-only relationships in public mode', () => {
  const graph = projectCharacterGraph(loadRealStory().narrative, 'public');
  expect(graph.edges.some((edge) => edge.visibility === 'author')).toBe(false);
  expect(graph.edges.some((edge) => edge.summary.includes('研究所'))).toBe(false);
});

it('keeps player-known mode from revealing author-only relationships', () => {
  const graph = projectCharacterGraph(loadRealStory().narrative, 'player-known', [
    'fact_zhixia_dead_five_years',
  ]);
  expect(graph.edges.some((edge) => edge.visibility === 'author')).toBe(false);
});

it('shows secrets, schedules, and narrative appearances only in author details', () => {
  const story = loadRealStory().narrative;
  const author = projectCharacterGraph(story, 'author');
  const publicGraph = projectCharacterGraph(story, 'public');
  expect(author.details.yuan.secrets.length).toBeGreaterThan(0);
  expect(author.details.yuan.scheduleRef).toBe('schedules/yuan.yaml');
  expect(author.details.yuan.narrativeAppearanceIds).toContain('prologue_yuan_reunion');
  expect(publicGraph.details.yuan.secrets).toEqual([]);
  expect(publicGraph.details.yuan.scheduleRef).toBeUndefined();
  expect(publicGraph.details.yuan.narrativeAppearanceIds).toEqual([]);
});

it('only exposes explicitly player-known facts in player-known detail mode', () => {
  const graph = projectCharacterGraph(loadRealStory().narrative, 'player-known', [
    'fact_zhixia_dead_five_years',
    'fact_research_institute_connection',
  ]);
  expect(graph.details.yuan.knowledgeIds).toContain('fact_zhixia_dead_five_years');
  expect(graph.details.yuan.knowledgeIds).not.toContain('fact_research_institute_connection');
});
