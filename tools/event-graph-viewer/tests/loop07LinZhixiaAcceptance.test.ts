import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
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

describe('Loop 07 Lin Zhixia', () => {
  it('reveals Worldline 31 and Zhixia warning without giving NPCs cross-loop memory', () => {
    const document = yaml.load(raw('/narrative/loop_07_player.yaml')) as {
      scenes?: Array<{ id: string; blocks?: Array<{ text?: string }> }>;
    };
    const scenes = document.scenes ?? [];
    const ids = new Set(scenes.map((scene) => scene.id));

    for (const id of [
      'loop07_0612_final_question',
      'loop07_0830_hidden_notebook',
      'loop07_0920_worldline_31',
      'loop07_1040_designed_argument',
      'loop07_1210_people_as_variables',
      'loop07_1340_final_break',
      'loop07_1500_do_not_become_me',
      'loop07_1620_letter_reply',
      'loop07_1758_yuan_choice',
      'loop07_1831_collective_convergence',
    ]) expect(ids.has(id), `missing ${id}`).toBe(true);

    const text = scenes.flatMap((scene) => scene.blocks ?? []).map((block) => block.text ?? '').join('\n');
    expect(text).toContain('世界線 31');
    expect(text).toContain('18:31');
    expect(text).toContain('如果她回來，不要讓她變成我');
    expect(text).toContain('因為我一個人做錯了');
    expect(text).toContain('所以這一次，不該再由一個人決定');
    expect(text).not.toContain('予安想起上一輪');
    expect(text).not.toContain('Memory Residue');
  });

  it('keeps the 17:58 action with Yuan and reconverges both choices at 18:31', () => {
    const dag = parseStoryDagText(raw('/events/loop_07_story_dag.yaml'));
    const choice = dag.nodes.find((node) => node.id === 'L7_N09_yuan_choice');
    const answer = dag.nodes.find((node) => node.id === 'L7_N10_yuan_answers');
    const decline = dag.nodes.find((node) => node.id === 'L7_N11_yuan_declines');
    const convergence = dag.nodes.find((node) => node.id === 'L7_N12_collective_1831');

    expect(choice?.detail.after.join('\n')).toContain('予安自己決定');
    expect(answer).toBeDefined();
    expect(decline).toBeDefined();
    expect(convergence?.time).toBe('18:31');
    expect(dag.edges.some((edge) => edge.source === 'L7_N10_yuan_answers' && edge.target === 'L7_N12_collective_1831')).toBe(true);
    expect(dag.edges.some((edge) => edge.source === 'L7_N11_yuan_declines' && edge.target === 'L7_N12_collective_1831')).toBe(true);
  });

  it('provides both Loop 07 paths and gives neither path a player-owned decision over Yuan', () => {
    const paths = parseStoryWorldlinePathsText(raw('/worldlines/loop_07_paths.yaml'));
    const answered = paths.find((item) => item.id === 'loop_07_yuan_answers');
    const declined = paths.find((item) => item.id === 'loop_07_yuan_declines');

    expect(answered).toBeDefined();
    expect(declined).toBeDefined();
    expect(answered?.nodeIds).toContain('L7_N09_yuan_choice');
    expect(declined?.nodeIds).toContain('L7_N09_yuan_choice');
    expect(answered?.nodeIds).toContain('L7_N10_yuan_answers');
    expect(declined?.nodeIds).toContain('L7_N11_yuan_declines');
    expect(answered?.nodeIds.at(-1)).toBe('L7_N13_collective_burden');
    expect(declined?.nodeIds.at(-1)).toBe('L7_N13_collective_burden');
  });
});
