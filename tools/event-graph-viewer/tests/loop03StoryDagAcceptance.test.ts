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

describe('Loop 03 causal DAG addendum', () => {
  it('models clearing people away as multiple character decisions before no-death convergence', () => {
    const dag = parseStoryDagText(raw('/events/loop_03_story_dag.yaml'));
    const ids = new Set(dag.nodes.map((node) => node.id));
    for (const id of [
      'L3_N01_foreknowledge_frightens_wakaharu',
      'L3_N02_yuan_notices_pattern',
      'L3_N03_doctor_asks_iteration',
      'L3_N04_clear_known_people',
      'L3_N05_no_death_1831',
      'L3_N06_wakaharu_resigns',
      'L3_N07_yuan_keeps_realtor',
      'L3_N08_not_success_note',
      'L3_N09_unknown_1831_death',
      'L3_N10_midnight_reset',
    ]) expect(ids.has(id), `missing ${id}`).toBe(true);

    expect(dag.edges.some((edge) => edge.source === 'L3_N04_clear_known_people' && edge.target === 'L3_N05_no_death_1831')).toBe(true);
    expect(dag.edges.some((edge) => edge.source === 'L3_N05_no_death_1831' && edge.target === 'L3_N06_wakaharu_resigns')).toBe(true);
    expect(dag.edges.some((edge) => edge.source === 'L3_N05_no_death_1831' && edge.target === 'L3_N07_yuan_keeps_realtor')).toBe(true);
  });

  it('provides a complete Loop 03 path from third awakening to reset', () => {
    const paths = parseStoryWorldlinePathsText(raw('/worldlines/loop_03_paths.yaml'));
    const path = paths.find((item) => item.id === 'loop_03_no_death');
    expect(path).toBeDefined();
    expect(path?.nodeIds[0]).toBe('L3_N00_third_awake');
    expect(path?.nodeIds).toContain('L3_N05_no_death_1831');
    expect(path?.nodeIds.at(-1)).toBe('L3_N10_midnight_reset');
  });
});
