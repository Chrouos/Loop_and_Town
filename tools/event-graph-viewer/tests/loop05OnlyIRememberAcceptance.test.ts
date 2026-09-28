import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { parseStoryDagText, parseStoryWorldlinePathsText } from '../src/lib/loadStory';

const rawFiles = import.meta.glob('../../../story/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function raw(suffix: string): string {
  const key = Object.keys(rawFiles).find((candidate) => candidate.endsWith(suffix));
  if (!key) throw new Error(`Missing story file: ${suffix}`);
  return rawFiles[key];
}

function text(suffix: string) {
  return JSON.stringify(yaml.load(raw(suffix)) ?? {});
}

describe('Loop 05 only-I-remember canon', () => {
  it('keeps reset memory exclusive to the protagonist and turns intimacy into clues', () => {
    const narrative = text('/narrative/loop_05_player.yaml');

    expect(narrative).toContain('好久不見');
    expect(narrative).toContain('妳怎麼知道');
    expect(narrative).toContain('只有我記得');
    expect(narrative).toContain('備用鑰匙');
    expect(narrative).toContain('父親');
    expect(narrative).not.toContain('Memory Residue');
    expect(narrative).not.toContain('想起上一輪');
  });

  it('defines Character Insight separately from objective evidence', () => {
    const document = yaml.load(raw('/knowledge/character_insights.yaml')) as {
      insights?: Array<{ id: string; character_id: string; source_loop: string; clue_use: string }>;
    };
    const insights = document.insights ?? [];
    const yuan = insights.find((item) => item.id === 'insight_yuan_keeps_fathers_things');
    const wakaharu = insights.find((item) => item.id === 'insight_wakaharu_camera_strap_lie');

    expect(yuan?.character_id).toBe('yuan');
    expect(yuan?.source_loop).toBeTruthy();
    expect(yuan?.clue_use).toContain('父親');
    expect(wakaharu?.character_id).toBe('wakaharu');
  });

  it('provides a Loop 05 DAG where the protagonist remembers relationships but Yuan does not', () => {
    const dag = parseStoryDagText(raw('/events/loop_05_story_dag.yaml'));
    const paths = parseStoryWorldlinePathsText(raw('/worldlines/loop_05_paths.yaml'));
    const ids = new Set(dag.nodes.map((node) => node.id));

    for (const id of [
      'L5_N00_reset_alone',
      'L5_N01_yuan_stranger_again',
      'L5_N02_key_from_lost_day',
      'L5_N03_yuan_questions_knowledge',
      'L5_N04_character_insight_unlocked',
      'L5_N05_insight_becomes_clue',
      'L5_N06_friendship_only_one_remembers',
    ]) expect(ids.has(id), `missing ${id}`).toBe(true);

    const path = paths.find((item) => item.id === 'loop_05_only_i_remember');
    expect(path?.nodeIds[0]).toBe('L5_N00_reset_alone');
    expect(path?.nodeIds.at(-1)).toBe('L5_N06_friendship_only_one_remembers');
  });
});
