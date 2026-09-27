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

describe('Loop 04 five-years-ago causal DAG', () => {
  it('connects hidden evidence into the correction and ethical-break chain', () => {
    const dag = parseStoryDagText(raw('/events/loop_04_story_dag.yaml'));
    const ids = new Set(dag.nodes.map((node) => node.id));

    for (const id of [
      'L4_N00_hard_reset_0612',
      'L4_N01_detective_confrontation',
      'L4_N02_hidden_recorder',
      'L4_N03_future_voice',
      'L4_N04_seven_records',
      'L4_N05_reporter_confession',
      'L4_N06_first_correction',
      'L4_N07_ethical_break',
      'L4_N08_final_call_log',
      'L4_N09_unknown_call_1803',
      'L4_N10_mirror_warning',
    ]) expect(ids.has(id), `missing ${id}`).toBe(true);

    expect(dag.edges.some((edge) => edge.source === 'L4_N02_hidden_recorder' && edge.target === 'L4_N03_future_voice')).toBe(true);
    expect(dag.edges.some((edge) => edge.source === 'L4_N04_seven_records' && edge.target === 'L4_N05_reporter_confession')).toBe(true);
    expect(dag.edges.some((edge) => edge.source === 'L4_N06_first_correction' && edge.target === 'L4_N07_ethical_break')).toBe(true);
    expect(dag.edges.some((edge) => edge.source === 'L4_N08_final_call_log' && edge.target === 'L4_N09_unknown_call_1803')).toBe(true);
  });

  it('provides a complete Loop 04 investigation path from 06:12 to the mirror warning', () => {
    const paths = parseStoryWorldlinePathsText(raw('/worldlines/loop_04_paths.yaml'));
    const path = paths.find((item) => item.id === 'loop_04_five_years_ago');
    expect(path).toBeDefined();
    expect(path?.nodeIds[0]).toBe('L4_N00_hard_reset_0612');
    expect(path?.nodeIds).toContain('L4_N09_unknown_call_1803');
    expect(path?.nodeIds.at(-1)).toBe('L4_N10_mirror_warning');
  });
});
